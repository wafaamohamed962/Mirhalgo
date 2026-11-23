import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, type FieldValues, type Path } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  type OrderInput,
  type ServiceType,
  type SubmitOrderResult,
  type UploadedFile,
} from '@mirhalgo/shared';
import { ApiRequestError, errorKey } from '../../lib/apiClient';
import { hasChanges } from '../../lib/forms';
import { useUnsavedChangesGuard } from '../../lib/useUnsavedChangesGuard';
import { focusFirstError, useAutosave, useWizardSteps } from '../../lib/wizard';
import { ordersApi } from '../../services/api/orders';
import { keys } from '../../services/api/queries';
import {
  BRANCH_FIELDS,
  REQUEST_STEPS,
  UI_ONLY_KEYS,
  emptyValues,
  formVersionOf,
  issueMessage,
  orderIssues,
  stepOfIssue,
  uploadIdsIn,
  type Prefill,
  type RequestStep,
} from './model';
import { hiddenPaths, pruneOrder } from './prune';

const AUTOSAVE_DELAY_MS = 1000;

/** Draft values on top of the empty form (draft wins, nested objects merged). */
function merge(base: FieldValues, draft: FieldValues): FieldValues {
  const out: FieldValues = { ...base };
  for (const [key, value] of Object.entries(draft)) {
    out[key] =
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      base[key] &&
      typeof base[key] === 'object'
        ? merge(base[key] as FieldValues, value as FieldValues)
        : value;
  }
  return out;
}

/**
 * State of one New Request form (MW_003 B2–B5): steps, validation with the shared schema,
 * hidden values cleared, server draft (restore + autosave), idempotent submit.
 */
export function useRequestWizard(service: ServiceType, prefill: Prefill) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const steps = REQUEST_STEPS[service] as readonly RequestStep[];
  const empty = useMemo(() => emptyValues(service, prefill), [service, prefill]);

  const form = useForm<FieldValues>({ defaultValues: empty });

  const { step, completed, goTo, markCompleted, restart } = useWizardSteps<RequestStep>('customer');
  const [ready, setReady] = useState(false); // the draft was looked up
  const [restored, setRestored] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [uploads, setUploads] = useState<Record<string, UploadedFile>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitted = useRef(false);

  // ── draft: restore once (a draft of another form version is ignored) ──────
  useEffect(() => {
    let cancelled = false;
    ordersApi
      .getDraft(service)
      .then((draft) => {
        if (cancelled || !draft || draft.formVersion !== formVersionOf(service)) return;
        form.reset(merge(empty, draft.payload), { keepDefaultValues: true });
        setUploads(Object.fromEntries(draft.uploads.map((u) => [u.id, u])));
        setRestored(true);
        setFormKey((k) => k + 1);
      })
      .catch(() => {}) // no draft service: the form still works, it just is not saved
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, [service, form, empty]);

  // ── autosave on edits (debounced), flushed when leaving; never after submit ──
  const save = useCallback(
    (payload: FieldValues) => {
      if (submitted.current) return;
      void ordersApi
        .saveDraft(service, {
          payload,
          formVersion: formVersionOf(service),
          uploadIds: uploadIdsIn(payload),
        })
        .then(() => queryClient.invalidateQueries({ queryKey: keys.summary }))
        .catch(() => {}); // best effort: the next edit tries again
    },
    [service, queryClient],
  );
  const { cancel: cancelSave } = useAutosave(form, save, {
    delayMs: AUTOSAVE_DELAY_MS,
    enabled: ready,
  });

  // ── a branch choice hides part of the form: its values are cleared (spec B2) ──
  useEffect(() => {
    if (!ready) return;
    const subscription = form.watch((values, { name }) => {
      if (!name) return; // resets (restore, start over) are not edits
      form.clearErrors(name);
      if (BRANCH_FIELDS.has(name.split('.').at(-1) ?? '')) {
        const visible = pruneOrder(service, values as FieldValues);
        for (const path of hiddenPaths(values as FieldValues, visible, UI_ONLY_KEYS)) {
          form.setValue(path as Path<FieldValues>, undefined);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [ready, form, service]);

  /** "Start over": the server draft and its files go, the form is empty again. */
  const startOver = () => {
    cancelSave();
    void ordersApi.discardDraft(service).catch(() => {});
    void queryClient.invalidateQueries({ queryKey: keys.summary });
    form.reset(empty);
    setUploads({});
    restart();
    setRestored(false);
    setFormKey((k) => k + 1);
  };

  // ── validation ─────────────────────────────────────────────────────────────
  const validate = (only?: RequestStep) => {
    const order = pruneOrder(service, form.getValues());
    return { order, issues: orderIssues(service, order, only) };
  };

  const showIssues = (issues: ReturnType<typeof validate>['issues']) => {
    form.clearErrors();
    for (const issue of issues) {
      form.setError(issue.path.join('.') as Path<FieldValues>, {
        type: 'schema',
        message: issueMessage(issue.message),
      });
    }
    focusFirstError();
  };

  const index = steps.indexOf(step);

  /** "Next" validates the current step only (spec B2). */
  const next = () => {
    const { issues } = validate(step);
    if (issues.length) return showIssues(issues);
    form.clearErrors();
    markCompleted(step);
    goTo(steps[index + 1] ?? 'review');
  };
  const back = () => goTo(steps[Math.max(0, index - 1)]!);

  /** Stepper / "Edit": back to any step, forward only when the current one is valid. */
  const select = (target: RequestStep) => {
    if (steps.indexOf(target) > index && validate(step).issues.length) return next();
    goTo(target);
  };

  // ── submit (idempotent: one key per payload, reused for retries) ──────────
  const attempt = useRef<{ key: string; body: string } | null>(null);
  const leaveGuard = useUnsavedChangesGuard(
    hasChanges(form.formState.dirtyFields) && !submitted.current,
    {
      title: t('portal.request.leave.title'),
      description: t('portal.request.leave.text'),
    },
  );

  const submit = async () => {
    const { order, issues } = validate();
    if (issues.length) {
      const firstStep =
        steps.find((s) => issues.some((i) => stepOfIssue(service, i.path) === s)) ?? 'review';
      goTo(firstStep);
      requestAnimationFrame(() =>
        showIssues(issues.filter((i) => stepOfIssue(service, i.path) === firstStep)),
      );
      return;
    }
    const body = JSON.stringify(order);
    if (attempt.current?.body !== body) attempt.current = { key: crypto.randomUUID(), body };
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result: SubmitOrderResult = await ordersApi.submitOrder(
        order as OrderInput,
        attempt.current.key,
      );
      submitted.current = true;
      cancelSave();
      leaveGuard.allowLeave();
      await queryClient.invalidateQueries({ queryKey: keys.summary });
      // replace: Back from the success screen never returns to the submitted form
      navigate(`/app/new-request/success/${result.reference}`, {
        replace: true,
        state: { result, service },
      });
    } catch (error) {
      setSubmitError(errorKey(error));
      // a refused order (not a network failure) gets a new key once it is changed
      if (!(error instanceof ApiRequestError && error.code === 'NETWORK_ERROR'))
        attempt.current = null;
    } finally {
      setSubmitting(false);
    }
  };

  return {
    form,
    formKey,
    steps,
    step,
    index,
    completed,
    ready,
    restored,
    dismissRestored: () => setRestored(false),
    startOver,
    next,
    back,
    select,
    submit,
    submitting,
    submitError,
    leaveDialog: leaveGuard.dialog,
    uploads,
    rememberUploads: (files: UploadedFile[]) =>
      setUploads((known) => ({ ...known, ...Object.fromEntries(files.map((f) => [f.id, f])) })),
    pruned: () => pruneOrder(service, form.getValues()),
  };
}

export type RequestWizard = ReturnType<typeof useRequestWizard>;
