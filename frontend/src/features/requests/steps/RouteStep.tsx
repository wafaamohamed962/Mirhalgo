import { useFormContext, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { AIR_SERVICES, LOAD_TYPES, ROUTE_SIDES } from '@mirhalgo/shared';
import { FormSection, Full } from '../../../components/FormSection';
import { ChoiceField, CodeField, PlaceField, SwitchField, TextField } from '../components/fields';
import { useLabel } from '../formContext';
import { useChoices, useCountryOptions, usePlaceOptions } from '../options';

type End = 'origin' | 'destination';

/** Country → port / airport / city of one end of the route ("Other" allowed). */
function RouteEnd({ end, place }: { end: End; place: 'port' | 'airport' | 'city' }) {
  const { t } = useTranslation();
  const label = useLabel();
  const { watch } = useFormContext<FieldValues>();
  const country: string | undefined = watch(`shipment.${end}.country`) || undefined;
  const countries = useCountryOptions();
  const list = place === 'port' ? 'ports' : place === 'airport' ? 'airports' : 'cities';
  const places = usePlaceOptions(list, country);
  return (
    <>
      <CodeField
        name={`shipment.${end}.country`}
        label={label(`${end}Country`, true)}
        required
        options={countries.options}
        loading={countries.loading}
      />
      <PlaceField
        name={`shipment.${end}.${place}`}
        label={label(`${end}_${place}`, true)}
        required
        options={places.options}
        loading={places.loading}
        anyLabel={
          place === 'airport' && end === 'origin' ? t('portal.request.anyAirport') : undefined
        }
      />
    </>
  );
}

/** International Step 3 (spec B3): depends on the shipping mode. */
export function RouteStep() {
  const { t } = useTranslation();
  const label = useLabel();
  const choices = useChoices();
  const { watch } = useFormContext<FieldValues>();
  const mode: string | undefined = watch('shipment.mode');
  const scope: string | undefined = watch('operation.serviceScope');
  const customs = Boolean(scope) && scope !== 'shipping';
  const truckingNeeded = Boolean(watch('shipment.truckingNeeded'));
  const side: string | undefined = watch('shipment.trucking.side');
  const airService: string = watch('shipment.airService') ?? '';
  const landType: string | undefined = watch('shipment.landType');

  const clearance = customs && (
    <Full>
      <ChoiceField
        name="shipment.clearanceLocation"
        label={label('clearanceLocation', true)}
        required
        options={choices('routeSide', ROUTE_SIDES)}
      />
    </Full>
  );

  if (mode === 'sea') {
    return (
      <div className="flex flex-col gap-8">
        <FormSection title={t('portal.request.sections.seaType')} className="sm:grid-cols-1">
          <ChoiceField
            name="shipment.seaType"
            label={label('seaType', true)}
            required
            variant="card"
            options={choices('seaType', ['fcl', 'lcl'] as const)}
          />
        </FormSection>
        <FormSection title={t('portal.request.sections.route')}>
          <RouteEnd end="origin" place="port" />
          <RouteEnd end="destination" place="port" />
          {clearance}
        </FormSection>
        <FormSection title={t('portal.request.sections.trucking')}>
          <Full>
            <SwitchField
              name="shipment.truckingNeeded"
              label={t('portal.request.fields.truckingNeeded')}
            />
          </Full>
          {truckingNeeded && (
            <>
              <Full>
                <ChoiceField
                  name="shipment.trucking.side"
                  label={label('truckingSide', true)}
                  required
                  options={choices('routeSide', ROUTE_SIDES)}
                />
              </Full>
              {(side === 'origin' || side === 'both') && (
                <TextField
                  name="shipment.trucking.originAddress"
                  label={label('truckingOriginAddress', true)}
                  required
                />
              )}
              {(side === 'destination' || side === 'both') && (
                <TextField
                  name="shipment.trucking.destinationAddress"
                  label={label('truckingDestinationAddress', true)}
                  required
                />
              )}
            </>
          )}
        </FormSection>
      </div>
    );
  }

  if (mode === 'air') {
    return (
      <div className="flex flex-col gap-8">
        <FormSection title={t('portal.request.sections.route')}>
          <RouteEnd end="origin" place="airport" />
          <RouteEnd end="destination" place="airport" />
        </FormSection>
        <FormSection title={t('portal.request.sections.airService')}>
          <Full>
            <ChoiceField
              name="shipment.airService"
              label={label('airService', true)}
              required
              variant="card"
              options={choices('airService', AIR_SERVICES)}
            />
          </Full>
          {airService.startsWith('door') && (
            <TextField
              name="shipment.pickupAddress"
              label={label('pickupAddress', true)}
              required
            />
          )}
          {airService.endsWith('door') && (
            <TextField
              name="shipment.deliveryAddress"
              label={label('deliveryAddress', true)}
              required
            />
          )}
          {clearance}
        </FormSection>
      </div>
    );
  }

  if (mode === 'land') {
    return (
      <div className="flex flex-col gap-8">
        <FormSection title={t('portal.request.sections.landType')} className="sm:grid-cols-1">
          <ChoiceField
            name="shipment.landType"
            label={label('landType', true)}
            required
            variant="card"
            options={choices('landType', ['container', 'general'] as const)}
          />
          {landType === 'general' && (
            <ChoiceField
              name="shipment.loadType"
              label={label('loadType', true)}
              required
              variant="card"
              options={choices('loadType', LOAD_TYPES)}
            />
          )}
        </FormSection>
        <FormSection title={t('portal.request.sections.route')}>
          <RouteEnd end="origin" place="city" />
          <RouteEnd end="destination" place="city" />
          {customs && (
            <Full>
              <TextField
                name="shipment.clearancePoint"
                label={label('clearancePoint', true)}
                required
              />
            </Full>
          )}
        </FormSection>
      </div>
    );
  }

  return <p className="text-body">{t('portal.request.chooseModeFirst')}</p>;
}

/** Domestic Step 3 (spec B4): governorates (+ address) and, for containers, the Egyptian port. */
export function DomesticRouteStep() {
  const { t } = useTranslation();
  const label = useLabel();
  const choices = useChoices();
  const { watch } = useFormContext<FieldValues>();
  const landType: string | undefined = watch('shipment.landType');
  const regions = usePlaceOptions('regions', 'EG');
  const ports = usePlaceOptions('ports', 'EG');

  return (
    <div className="flex flex-col gap-8">
      <FormSection title={t('portal.request.sections.landType')} className="sm:grid-cols-1">
        <ChoiceField
          name="shipment.landType"
          label={label('landType', true)}
          required
          variant="card"
          options={choices('landType', ['container', 'general'] as const)}
        />
        {landType === 'general' && (
          <ChoiceField
            name="shipment.loadType"
            label={label('loadType', true)}
            required
            variant="card"
            options={choices('loadType', LOAD_TYPES)}
          />
        )}
      </FormSection>
      {landType && (
        <FormSection title={t('portal.request.sections.route')}>
          <CodeField
            name="shipment.loadingRegion"
            label={label('loadingRegion', true)}
            required
            options={regions.options}
            loading={regions.loading}
          />
          <TextField name="shipment.loadingAddress" label={label('loadingAddress')} />
          {landType === 'container' ? (
            <Full>
              <CodeField
                name="shipment.dischargePort"
                label={label('dischargePort', true)}
                required
                options={ports.options}
                loading={ports.loading}
              />
            </Full>
          ) : (
            <>
              <CodeField
                name="shipment.unloadingRegion"
                label={label('unloadingRegion', true)}
                required
                options={regions.options}
                loading={regions.loading}
              />
              <TextField name="shipment.unloadingAddress" label={label('unloadingAddress')} />
            </>
          )}
        </FormSection>
      )}
    </div>
  );
}
