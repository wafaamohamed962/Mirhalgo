import { useState } from 'react';
import { Controller, get, useForm, type FieldErrors, type Resolver } from 'react-hook-form';
import type { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  COMPANY_PORTAL_LIMITS,
  CURRENCIES,
  FOREIGN_CURRENCIES,
  TOTAL_KIND,
  cairoToday,
  offerSchemas,
  type CompanyOffer,
  type OfferInput,
  type OfferTemplate,
} from '@mirhalgo/shared';
import {
  Alert,
  Button,
  ConfirmDialog,
  Input,
  Modal,
  Select,
  Textarea,
} from '../../../components/ui';
import { Combobox } from '../../../components/ui/Combobox';
import { ApiRequestError, errorKey } from '../../../lib/apiClient';
import { hasChanges } from '../../../lib/forms';
import { useUnsavedChangesGuard } from '../../../lib/useUnsavedChangesGuard';
import { companyApi } from '../../../services/api/company';
import { companyKeys } from '../../../services/api/companyQueries';
import { comboboxOptions, useReference } from '../../../services/api/reference';
import { useSeen } from '../seen';
import {
  OFFER_FIELDS,
  toFormValues,
  type OfferField,
  type OfferFormValues,
} from './offerFormModel';

const L = COMPANY_PORTAL_LIMITS;
const AMOUNT = { inputMode: 'decimal' as const, dir: 'ltr' as const, autoComplete: 'off' };

/**
 * Submit / edit offer (MW_004 spec B5). The form follows the order's template; every template
 * field is optional, the total cost is required (foreign and/or EGP, or EGP only). Amounts
 * accept Arabic digits. While offer submission is suspended the form explains why and cannot
 * be sent (the API refuses it too). Closing with unsaved values asks first.
 */
export function OfferModal({
  orderId,
  template,
  offer,
  suspended,
  onClose,
}: {
  orderId: string;
  template: OfferTemplate;
  /** Edit mode: the offer (under review) to change. */
  offer?: CompanyOffer;
  suspended: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { markSeen } = useSeen();
  const [confirmClose, setConfirmClose] = useState(false);
  const form = useForm<OfferFormValues>({
    mode: 'onTouched',
    resolver: zodResolver(
      offerSchemas[template] as z.ZodTypeAny,
    ) as unknown as Resolver<OfferFormValues>,
    defaultValues: toFormValues(template, offer),
  });
  const { register, control, handleSubmit, formState } = form;
  const dirty = hasChanges(formState.dirtyFields);
  const guard = useUnsavedChangesGuard(dirty, {
    title: t('companyPortal.offerForm.leaveTitle'),
    description: t('companyPortal.offerForm.leaveText'),
  });
  const trucks = useReference('truck-types');

  const save = useMutation({
    mutationFn: (values: OfferInput) =>
      offer ? companyApi.updateOffer(offer.id, values) : companyApi.submitOffer(orderId, values),
    onSuccess: async (saved) => {
      // our own offer is not "new" to us; a later status change makes it new again
      markSeen('offer', saved.id, saved.status);
      toast.success(
        t(offer ? 'companyPortal.offerForm.updated' : 'companyPortal.offerForm.submitted', {
          id: saved.id,
        }),
      );
      // lists, badges, KPIs and the activity log all change (spec B5)
      await queryClient.invalidateQueries({ queryKey: companyKeys.all });
      guard.allowLeave();
      onClose();
    },
    onError: (error) => {
      toast.error(t(errorKey(error)));
      // the administration suspended submission meanwhile: show the disabled state
      if (error instanceof ApiRequestError && error.code === 'OFFER_SUBMISSION_SUSPENDED') {
        void queryClient.invalidateQueries({ queryKey: companyKeys.account });
      }
    },
  });

  const error = (path: string) => {
    const message = (get(formState.errors as FieldErrors, path) as { message?: string } | undefined)
      ?.message;
    return message ? t(message) : undefined;
  };
  const label = (name: string) => t(`companyPortal.offerForm.fields.${name}`);
  const currencyOptions = (list: readonly string[]) =>
    list.map((code) => ({ value: code, label: t(`money.${code}`) }));
  const close = () => (dirty && !save.isPending ? setConfirmClose(true) : onClose());

  function renderField(field: OfferField) {
    const path = `details.${field.name}` as const;
    switch (field.kind) {
      case 'cost':
        return (
          <fieldset key={field.name} className="flex flex-col gap-2">
            <legend className="mb-1.5 text-small font-semibold text-heading">
              {label(field.name)}{' '}
              <span className="font-normal text-muted">
                {t('companyPortal.offerForm.optional')}
              </span>
            </legend>
            <div className="grid grid-cols-[1fr_8rem] gap-2">
              <Input
                label={t('companyPortal.offerForm.amount')}
                {...AMOUNT}
                {...register(`${path}.amount` as never)}
                error={error(`${path}.amount`)}
              />
              <Select
                label={t('companyPortal.offerForm.currency')}
                options={currencyOptions(CURRENCIES)}
                {...register(`${path}.currency` as never)}
              />
            </div>
          </fieldset>
        );
      case 'vehicle':
        return (
          <Controller
            key={field.name}
            control={control}
            name={path as never}
            render={({ field: input }) => (
              <Combobox
                label={label(field.name)}
                options={comboboxOptions(trucks.data ?? [], i18n.language, { flags: false })}
                loading={trucks.isPending}
                value={(input.value as string) || null}
                onChange={(value) => input.onChange(value ?? '')}
                onBlur={input.onBlur}
                error={error(path)}
              />
            )}
          />
        );
      case 'longText':
        return (
          <Textarea
            key={field.name}
            label={label(field.name)}
            maxLength={L.longText.max}
            {...register(path as never)}
            error={error(path)}
          />
        );
      default:
        return (
          <Input
            key={field.name}
            label={label(field.name)}
            hint={field.kind === 'days' ? t('companyPortal.offerForm.daysHint') : undefined}
            {...(field.kind === 'days'
              ? { inputMode: 'numeric' as const, dir: 'ltr' as const }
              : {})}
            {...(field.kind === 'date' ? { type: 'date', min: cairoToday() } : {})}
            maxLength={field.kind === 'text' ? L.shortText.max : undefined}
            {...register(path as never)}
            error={error(path)}
          />
        );
    }
  }

  const dual = TOTAL_KIND[template] === 'dual';
  const title = offer
    ? t('companyPortal.offerForm.editTitle', { id: offer.id })
    : t('companyPortal.offerForm.title', { id: orderId });

  return (
    <>
      <Modal
        title={title}
        description={t(`companyPortal.templates.${template}`)}
        onClose={close}
        size="lg"
        footer={
          <>
            <Button variant="secondary" shape="form" onClick={close}>
              {t('ui.cancel')}
            </Button>
            <Button
              type="submit"
              form="offer-form"
              shape="form"
              loading={save.isPending}
              disabled={suspended}
            >
              {offer ? t('companyPortal.offerForm.saveEdit') : t('companyPortal.offerForm.send')}
            </Button>
          </>
        }
      >
        <form
          id="offer-form"
          noValidate
          onSubmit={handleSubmit((values) => save.mutate(values as unknown as OfferInput))}
          className="flex flex-col gap-5"
        >
          {suspended && <Alert tone="error">{t('companyPortal.suspended')}</Alert>}
          {offer && <Alert tone="info">{t('companyPortal.offerForm.editNote')}</Alert>}
          <p className="text-small text-muted">{t('companyPortal.offerForm.intro')}</p>

          <div className="grid gap-4 sm:grid-cols-2">{OFFER_FIELDS[template].map(renderField)}</div>

          <fieldset className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-base font-semibold text-heading">
              {t('companyPortal.offerForm.total')} <span aria-hidden="true">*</span>
            </legend>
            <p className="text-small text-muted">
              {dual
                ? t('companyPortal.offerForm.totalDualHint')
                : t('companyPortal.offerForm.totalEgpHint')}
            </p>
            {dual && (
              <div className="grid grid-cols-[1fr_8rem] gap-2">
                <Input
                  label={t('companyPortal.offerForm.foreignAmount')}
                  {...AMOUNT}
                  {...register('total.foreign.amount')}
                  error={error('total.foreign.amount')}
                />
                <Select
                  label={t('companyPortal.offerForm.currency')}
                  options={currencyOptions(FOREIGN_CURRENCIES)}
                  {...register('total.foreign.currency')}
                />
              </div>
            )}
            <Input
              label={t('companyPortal.offerForm.egpAmount')}
              required={!dual}
              {...AMOUNT}
              {...register('total.egp')}
              error={error('total.egp')}
            />
          </fieldset>
        </form>
      </Modal>
      {confirmClose && (
        <ConfirmDialog
          title={t('companyPortal.offerForm.leaveTitle')}
          description={t('companyPortal.offerForm.leaveText')}
          confirmLabel={t('ui.leave.leave')}
          cancelLabel={t('ui.leave.stay')}
          tone="danger"
          onConfirm={() => {
            setConfirmClose(false);
            guard.allowLeave();
            onClose();
          }}
          onCancel={() => setConfirmClose(false)}
        />
      )}
      {guard.dialog}
    </>
  );
}
