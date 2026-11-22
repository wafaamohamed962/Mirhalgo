import { Controller } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CONTACT_MESSAGE_MAX, contactSchema, type ContactInput } from '@mirhalgo/shared';
import { Reveal } from '../components/layout/Reveal';
import { Section, SectionHeader } from '../components/layout/Section';
import { SocialLinks } from '../components/layout/SocialLinks';
import { Button, Card, Input, PhoneInput, Textarea } from '../components/ui';
import { ServiceNotice } from '../components/ui/ServiceNotice';
import { apiPost, errorKey } from '../lib/apiClient';
import { useZodForm } from '../lib/forms';

const EMPTY: ContactInput = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  message: '',
  website: '',
};

/** Contact form + social links (spec 3.5). POST /api/contact → email + DB copy. */
export function Contact() {
  const { t } = useTranslation();
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useZodForm(contactSchema, { defaultValues: EMPTY });

  const send = useMutation({
    mutationFn: (values: ContactInput) => apiPost<null>('/contact', values),
    onSuccess: () => {
      toast.success(t('contact.success'));
      reset(EMPTY);
    },
    onError: (error) => toast.error(t(errorKey(error))),
  });

  const messageLength = watch('message')?.length ?? 0;

  return (
    <Section id="contact" tone="blue">
      <SectionHeader
        sectionId="contact"
        eyebrow={t('contact.eyebrow')}
        title={t('contact.title')}
        subtitle={t('contact.subtitle')}
      />

      <Reveal>
        <Card className="mx-auto max-w-3xl p-6 sm:p-10">
          <div className="mb-5 empty:hidden">
            <ServiceNotice needs="api" />
          </div>
          <form
            noValidate
            onSubmit={handleSubmit((values) => send.mutate(values))}
            className="grid gap-5 sm:grid-cols-2"
          >
            <Input
              label={t('contact.firstName')}
              autoComplete="given-name"
              required
              error={errors.firstName?.message}
              {...register('firstName')}
            />
            <Input
              label={t('contact.lastName')}
              autoComplete="family-name"
              required
              error={errors.lastName?.message}
              {...register('lastName')}
            />
            <Input
              label={t('contact.email')}
              type="email"
              autoComplete="email"
              dir="ltr"
              required
              error={errors.email?.message}
              {...register('email')}
            />
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <PhoneInput
                  label={t('contact.phone')}
                  required
                  error={errors.phone?.message}
                  {...field}
                />
              )}
            />
            <div className="sm:col-span-2">
              <Textarea
                label={t('contact.message')}
                required
                maxLength={CONTACT_MESSAGE_MAX}
                error={errors.message?.message}
                hint={t('contact.messageCount', {
                  count: messageLength,
                  max: CONTACT_MESSAGE_MAX,
                })}
                {...register('message')}
              />
            </div>

            {/* Honeypot (spec 3.5): invisible to people, bots fill it in. */}
            <div aria-hidden="true" className="sr-only">
              <label>
                {t('contact.honeypot')}
                <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
              </label>
            </div>

            <div className="sm:col-span-2">
              <Button type="submit" shape="form" fullWidth loading={send.isPending}>
                {t('contact.submit')}
              </Button>
            </div>
          </form>

          <div className="mt-8 flex flex-col items-center gap-4 border-t border-slate-200 pt-8">
            <p className="text-small font-semibold text-heading">{t('contact.followUs')}</p>
            <SocialLinks />
          </div>
        </Card>
      </Reveal>
    </Section>
  );
}
