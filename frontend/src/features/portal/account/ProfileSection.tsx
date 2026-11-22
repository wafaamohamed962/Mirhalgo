import { lazy, Suspense, useRef, useState } from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Camera } from 'lucide-react';
import {
  GENDERS,
  OTP_LENGTH,
  changeEmailSchema,
  changePhoneSchema,
  checkFile,
  confirmCodeSchema,
  detectMime,
  profileSchema,
  type Me,
} from '@mirhalgo/shared';
import {
  Avatar,
  Button,
  Input,
  Modal,
  OtpInput,
  PhoneInput,
  QueryState,
  Select,
  Skeleton,
} from '../../../components/ui';
import { useZodForm } from '../../../lib/forms';
import { useUnsavedChangesGuard } from '../../../lib/useUnsavedChangesGuard';
import { portalApi } from '../../../services/api/portal';
import { keys, useApiMutation, useMe } from '../../../services/api/queries';

const ImageCropper = lazy(() => import('../../../components/ImageCropper'));
const AVATAR_SIZE = 256;

/*
 * Email and phone come from the real profiles row and are read-only here: the change flow
 * (ChangeContactModal) only exists in the mocks, so its buttons stay hidden until the real
 * API can change them (MW_002 assumption, CLAUDE.md §14). Set to true to show them again.
 */
const CONTACT_CHANGE_ENABLED = false;

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

function AvatarPicker({ me }: { me: Me }) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [toCrop, setToCrop] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = useApiMutation(
    async (file: File) => portalApi.updateAvatar(await readAsDataUrl(file)),
    {
      setData: keys.me,
      success: 'portal.profile.avatarSaved',
    },
  );

  const pick = async (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    // same image rules as the company logo: PNG / JPG / WEBP, ≤ 2 MB, real type from the bytes
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const problem = checkFile({ size: file.size, mime: detectMime(head) }, 'logo');
    setError(problem);
    if (!problem) setToCrop(file);
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar name={`${me.firstName} ${me.lastName}`} src={me.avatarUrl} size="lg" />
      <div className="flex flex-col gap-1">
        <input
          ref={inputRef}
          id="avatar-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => void pick(event.target.files?.[0])}
        />
        <label
          htmlFor="avatar-input"
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-sm border-2 border-blue-600 px-4 text-small font-semibold text-blue-600 hover:bg-blue-50 has-focus-visible:outline-3 has-focus-visible:outline-focus"
        >
          <Camera aria-hidden="true" className="size-4" />
          {upload.isPending ? t('ui.loading') : t('portal.profile.changeAvatar')}
        </label>
        <p className="text-caption text-muted">{t('company.register.files.logoHint')}</p>
        {error && <p className="text-caption text-error">{t(error)}</p>}
      </div>
      {toCrop && (
        <Suspense fallback={null}>
          <ImageCropper
            file={toCrop}
            size={AVATAR_SIZE}
            title={t('ui.crop.avatarTitle')}
            onCancel={() => setToCrop(null)}
            onDone={(cropped) => {
              setToCrop(null);
              upload.mutate(cropped);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

function EmailStep({ busy, onSubmit }: { busy: boolean; onSubmit: (email: string) => void }) {
  const { t } = useTranslation();
  const form = useZodForm(changeEmailSchema, { defaultValues: { email: '' } });
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((v) => onSubmit(v.email))}
      className="flex flex-col gap-4"
    >
      <Input
        label={t('portal.profile.newEmail')}
        type="email"
        dir="ltr"
        required
        data-autofocus
        error={form.formState.errors.email?.message}
        {...form.register('email')}
      />
      <Button type="submit" shape="form" loading={busy}>
        {t('portal.profile.sendCode')}
      </Button>
    </form>
  );
}

function PhoneStep({ busy, onSubmit }: { busy: boolean; onSubmit: (phone: string) => void }) {
  const { t } = useTranslation();
  const form = useZodForm(changePhoneSchema, { defaultValues: { phone: '' } });
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((v) => onSubmit(v.phone))}
      className="flex flex-col gap-4"
    >
      <Controller
        control={form.control}
        name="phone"
        render={({ field, fieldState }) => (
          <PhoneInput
            label={t('portal.profile.newPhone')}
            required
            error={fieldState.error?.message}
            {...field}
          />
        )}
      />
      <Button type="submit" shape="form" loading={busy}>
        {t('portal.profile.sendCode')}
      </Button>
    </form>
  );
}

/** "Change email" / "Change phone": new value → OTP step (spec B6, UI only for now). */
function ChangeContactModal({ kind, onClose }: { kind: 'email' | 'phone'; onClose: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'value' | 'code'>('value');
  const [code, setCode] = useState('');
  const request = useApiMutation(
    (value: string) =>
      kind === 'email' ? portalApi.requestEmailChange(value) : portalApi.requestPhoneChange(value),
    { onSuccess: () => setStep('code') },
  );
  const confirm = useApiMutation(
    (value: string) =>
      kind === 'email' ? portalApi.confirmEmailChange(value) : portalApi.confirmPhoneChange(value),
    { setData: keys.me, success: `portal.profile.${kind}Changed`, onSuccess: onClose },
  );
  const Step = kind === 'email' ? EmailStep : PhoneStep;

  return (
    <Modal
      title={t(`portal.profile.change.${kind}`)}
      description={t(`portal.profile.change.${step}Text`)}
      onClose={onClose}
    >
      {step === 'value' ? (
        <Step busy={request.isPending} onSubmit={(value) => request.mutate(value)} />
      ) : (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (confirmCodeSchema.safeParse({ code }).success) confirm.mutate(code);
          }}
          className="flex flex-col gap-4"
        >
          <OtpInput
            label={t('auth.verify.codeLabel')}
            value={code}
            onChange={setCode}
            onComplete={(value) => confirm.mutate(value)}
            disabled={confirm.isPending}
            focusOnMount
          />
          <p className="text-caption text-muted">{t('portal.profile.demoCode')}</p>
          <Button
            type="submit"
            shape="form"
            loading={confirm.isPending}
            disabled={code.length !== OTP_LENGTH}
          >
            {t('auth.verify.submit')}
          </Button>
        </form>
      )}
    </Modal>
  );
}

function ProfileForm({ me }: { me: Me }) {
  const { t } = useTranslation();
  const [changing, setChanging] = useState<'email' | 'phone' | null>(null);
  const defaults = { firstName: me.firstName, lastName: me.lastName, gender: me.gender };
  const form = useZodForm(profileSchema, { defaultValues: defaults });
  const { isDirty, errors } = form.formState;
  const guard = useUnsavedChangesGuard(isDirty);
  const save = useApiMutation(portalApi.updateProfile, {
    setData: keys.me,
    success: 'portal.profile.saved',
    onSuccess: (saved) =>
      form.reset({ firstName: saved.firstName, lastName: saved.lastName, gender: saved.gender }),
  });

  return (
    <div className="flex flex-col gap-6">
      <AvatarPicker me={me} />
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
        className="grid gap-5 sm:grid-cols-2"
      >
        <Input
          label={t('auth.signup.firstName')}
          required
          error={errors.firstName?.message}
          {...form.register('firstName')}
        />
        <Input
          label={t('auth.signup.lastName')}
          required
          error={errors.lastName?.message}
          {...form.register('lastName')}
        />
        <Select
          label={t('auth.signup.gender')}
          required
          options={GENDERS.map((g) => ({ value: g, label: t(`auth.signup.${g}`) }))}
          error={errors.gender?.message}
          {...form.register('gender')}
        />
        <div className="hidden sm:block" />
        {(['email', 'phone'] as const).map((kind) => (
          <div key={kind} className="flex flex-col gap-1.5">
            <Input
              label={t(`auth.signup.${kind}`)}
              value={me[kind]}
              readOnly
              dir="ltr"
              className="bg-slate-50"
            />
            {CONTACT_CHANGE_ENABLED && (
              <Button
                variant="ghost"
                shape="form"
                className="self-start"
                onClick={() => setChanging(kind)}
              >
                {t(`portal.profile.change.${kind}`)}
              </Button>
            )}
          </div>
        ))}
        <div className="flex gap-3 sm:col-span-2">
          <Button type="submit" shape="form" loading={save.isPending} disabled={!isDirty}>
            {t('ui.save')}
          </Button>
          <Button
            variant="secondary"
            shape="form"
            disabled={!isDirty || save.isPending}
            onClick={() => form.reset(defaults)}
          >
            {t('ui.cancel')}
          </Button>
        </div>
      </form>
      {changing && <ChangeContactModal kind={changing} onClose={() => setChanging(null)} />}
      {guard.dialog}
    </div>
  );
}

/** Account › Profile (spec B6). */
export function ProfileSection() {
  const me = useMe();
  return (
    <QueryState query={me} skeleton={<Skeleton className="h-80 rounded-lg" />}>
      {(data) => <ProfileForm key={data.id} me={data} />}
    </QueryState>
  );
}
