import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { MapPin, Pencil, Star, Trash2 } from 'lucide-react';
import { GOVERNORATES, addressSchema, type Address, type AddressInput } from '@mirhalgo/shared';
import {
  Button,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  PhoneInput,
  QueryState,
  Select,
} from '../../../components/ui';
import { useZodForm } from '../../../lib/forms';
import { portalApi } from '../../../services/api/portal';
import { keys, useAddresses, useApiMutation } from '../../../services/api/queries';

function AddressForm({ address, onClose }: { address: Address | null; onClose: () => void }) {
  const { t } = useTranslation();
  const form = useZodForm(addressSchema, {
    defaultValues: address ?? {
      label: '',
      city: '',
      street: '',
      landmark: '',
      phone: '',
      isDefault: false,
    },
  });
  const { errors } = form.formState;
  const save = useApiMutation(
    (input: AddressInput) =>
      address ? portalApi.updateAddress(address.id, input) : portalApi.createAddress(input),
    { setData: keys.addresses, success: 'portal.addresses.saved', onSuccess: onClose },
  );
  const f = (key: string) => t(`portal.addresses.fields.${key}`);

  return (
    <Modal
      size="lg"
      title={t(address ? 'portal.addresses.edit' : 'portal.addresses.add')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" shape="form" onClick={onClose}>
            {t('ui.cancel')}
          </Button>
          <Button
            shape="form"
            loading={save.isPending}
            onClick={form.handleSubmit((values) => save.mutate(values))}
          >
            {t('ui.save')}
          </Button>
        </>
      }
    >
      <form noValidate className="grid gap-4 sm:grid-cols-2">
        <Input
          label={f('label')}
          hint={f('labelHint')}
          required
          data-autofocus
          error={errors.label?.message}
          {...form.register('label')}
        />
        <Select
          label={t('company.register.fields.governorate')}
          placeholder={t('company.register.fields.governoratePlaceholder')}
          options={GOVERNORATES.map((g) => ({ value: g, label: t(`options.governorate.${g}`) }))}
          required
          error={errors.governorate?.message}
          {...form.register('governorate')}
        />
        <Input
          label={t('company.register.fields.city')}
          required
          error={errors.city?.message}
          {...form.register('city')}
        />
        <Input
          label={t('company.register.fields.street')}
          required
          error={errors.street?.message}
          {...form.register('street')}
        />
        <Input
          label={f('landmark')}
          error={errors.landmark?.message}
          {...form.register('landmark')}
        />
        <Controller
          control={form.control}
          name="phone"
          render={({ field }) => (
            <PhoneInput label={f('phone')} required error={errors.phone?.message} {...field} />
          )}
        />
        <div className="sm:col-span-2">
          <Checkbox label={f('default')} {...form.register('isDefault')} />
        </div>
      </form>
    </Modal>
  );
}

/** Account › Saved addresses (spec B6). */
export function AddressesSection() {
  const { t, i18n } = useTranslation();
  const addresses = useAddresses();
  const [editing, setEditing] = useState<Address | null | 'new'>(null);
  const [deleting, setDeleting] = useState<Address | null>(null);
  const remove = useApiMutation((id: string) => portalApi.deleteAddress(id), {
    setData: keys.addresses,
    success: 'portal.addresses.deleted',
    onSuccess: () => setDeleting(null),
  });
  const makeDefault = useApiMutation((id: string) => portalApi.setDefaultAddress(id), {
    setData: keys.addresses,
    success: 'portal.addresses.defaultSet',
  });

  return (
    <div className="flex flex-col gap-4">
      <Button shape="form" className="self-start" onClick={() => setEditing('new')}>
        {t('portal.addresses.add')}
      </Button>
      <QueryState
        query={addresses}
        isEmpty={(list) => list.length === 0}
        empty={<EmptyState icon={MapPin} title={t('portal.addresses.empty')} />}
      >
        {(list) => (
          <ul className="grid gap-3 md:grid-cols-2">
            {list.map((address) => (
              <li
                key={address.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 p-4"
              >
                <div className="flex items-center gap-2">
                  <p dir="auto" className="flex-1 font-semibold text-heading">
                    {address.label}
                  </p>
                  {address.isDefault && (
                    <span className="rounded-full bg-blue-50 px-2 text-caption font-semibold text-blue-600">
                      {t('portal.addresses.default')}
                    </span>
                  )}
                </div>
                <p dir="auto" className="text-small text-body">
                  {new Intl.ListFormat(i18n.language, { type: 'unit' }).format([
                    address.street,
                    address.city,
                    t(`options.governorate.${address.governorate}`),
                  ])}
                </p>
                {address.landmark && <p className="text-caption text-muted">{address.landmark}</p>}
                <p dir="ltr" className="self-start text-caption text-muted">
                  {address.phone}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Button
                    variant="ghost"
                    shape="form"
                    aria-label={t('portal.addresses.editNamed', { label: address.label })}
                    onClick={() => setEditing(address)}
                  >
                    <Pencil aria-hidden="true" className="size-4" />
                    {t('portal.addresses.editShort')}
                  </Button>
                  {!address.isDefault && (
                    <Button
                      variant="ghost"
                      shape="form"
                      loading={makeDefault.isPending}
                      onClick={() => makeDefault.mutate(address.id)}
                    >
                      <Star aria-hidden="true" className="size-4" />
                      {t('portal.addresses.setDefault')}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    shape="form"
                    className="text-error"
                    aria-label={t('portal.addresses.deleteNamed', { label: address.label })}
                    onClick={() => setDeleting(address)}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    {t('portal.addresses.delete')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
      {editing && (
        <AddressForm
          address={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={t('portal.addresses.deleteTitle', { label: deleting.label })}
          confirmLabel={t('portal.addresses.delete')}
          cancelLabel={t('ui.cancel')}
          tone="danger"
          onConfirm={() => remove.mutate(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
