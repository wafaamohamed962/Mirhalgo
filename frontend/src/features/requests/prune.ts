import type { FieldValues } from 'react-hook-form';
import { NAMED_CLIENT_TYPES, type OrderInput, type ServiceType } from '@mirhalgo/shared';
import { formVersionOf } from './model';

/*
 * Raw form values → the order of the chosen path (spec B2: "when a field becomes hidden, its
 * value is cleared and is not submitted"). Only what this path shows is kept; required values
 * that are still empty stay (as '' / undefined) so the shared schema reports them. The server
 * runs the same schema and rejects anything outside the path.
 */

type V = FieldValues;

const has = (value: unknown) =>
  value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '');
const opt = <T>(value: T) => (has(value) ? value : undefined);
const compact = (object: V): V =>
  Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
const yesNo = (value: unknown) => (value === 'yes' ? true : value === 'no' ? false : undefined);

/** A list choice or "Other" (+ text), as the shared schema expects. */
const place = (raw?: V) => (raw?.isOther ? { other: raw.other ?? '' } : { id: raw?.id ?? '' });
const optionalPlace = (raw?: V) =>
  raw?.isOther ? { other: raw.other ?? '' } : has(raw?.id) ? { id: raw!.id } : undefined;
const weight = (raw?: V) =>
  has(raw?.value) ? { value: raw!.value, unit: raw!.unit ?? 'kg' } : undefined;
const requiredWeight = (raw?: V) => ({ value: raw?.value ?? '', unit: raw?.unit ?? 'kg' });
const money = (raw?: V) =>
  has(raw?.amount) ? { amount: raw!.amount, currency: raw!.currency ?? 'USD' } : undefined;
const dimensions = (raw?: V) => ({
  length: raw?.length ?? '',
  width: raw?.width ?? '',
  height: raw?.height ?? '',
});
const optionalDimensions = (raw?: V) =>
  [raw?.length, raw?.width, raw?.height].some(has) ? dimensions(raw) : undefined;

export function pruneContact(contact: V = {}) {
  const same = contact.whatsappSameAsPhone !== false;
  return compact({
    fullName: contact.fullName ?? '',
    phone: contact.phone ?? '',
    whatsappSameAsPhone: same,
    whatsapp: same ? undefined : (contact.whatsapp ?? ''),
    clientType: contact.clientType,
    businessName: NAMED_CLIENT_TYPES.includes(contact.clientType)
      ? (contact.businessName ?? '')
      : undefined,
  });
}

type CargoKind = 'containers' | 'trucks' | 'ltl' | 'loose';

function pruneCargo(kind: CargoKind | undefined, cargo: V = {}, { prices }: { prices: boolean }) {
  if (!kind) return {};
  const hazardous = yesNo(cargo.hazardous);
  const hazard = { hazardous, msdsUploadId: hazardous ? opt(cargo.msdsUploadId) : undefined };
  const groups: V[] = cargo.groups ?? [];
  const manual = cargo.inputMethod === 'manual';
  const packingList = cargo.inputMethod === 'packing_list';
  switch (kind) {
    case 'containers':
      return compact({
        kind,
        groups: groups.map((g) =>
          compact({
            containerType: g.containerType ?? '',
            count: g.count ?? '',
            description: g.description ?? '',
            weightPerContainer: weight(g.weightPerContainer),
            shippingLine: optionalPlace(g.shippingLine),
            targetPrice: prices ? money(g.targetPrice) : undefined,
          }),
        ),
        ...hazard,
      });
    case 'trucks':
      return compact({
        kind,
        groups: groups.map((g) =>
          compact({
            truckType: g.truckType ?? '',
            count: g.count ?? '',
            description: g.description ?? '',
            weight: weight(g.weight),
          }),
        ),
        packaging: cargo.packaging,
        packagingOther: cargo.packaging === 'other' ? (cargo.packagingOther ?? '') : undefined,
        ...hazard,
      });
    case 'ltl':
      return compact({
        kind,
        description: cargo.description ?? '',
        inputMethod: cargo.inputMethod,
        totalWeight: manual ? weight(cargo.totalWeight) : undefined,
        pieces: manual ? opt(cargo.pieces) : undefined,
        volumeCbm: manual ? opt(cargo.volumeCbm) : undefined,
        dimensions: manual ? optionalDimensions(cargo.dimensions) : undefined,
        packingListUploadId: packingList ? opt(cargo.packingListUploadId) : undefined,
        ...hazard,
      });
    case 'loose':
      return compact({
        kind,
        description: cargo.description ?? '',
        inputMethod: cargo.inputMethod,
        items: manual
          ? (cargo.items ?? []).map((item: V) => {
              const itemHazard = yesNo(item.hazardous);
              return compact({
                description: item.description ?? '',
                weight: requiredWeight(item.weight),
                cartons: item.cartons ?? '',
                dimensions: dimensions(item.dimensions),
                hazardous: itemHazard,
                msdsUploadId: itemHazard ? opt(item.msdsUploadId) : undefined,
              });
            })
          : undefined,
        packingListUploadId: packingList ? opt(cargo.packingListUploadId) : undefined,
        hazardous: packingList ? hazardous : undefined,
        msdsUploadId: packingList && hazardous ? opt(cargo.msdsUploadId) : undefined,
      });
  }
}

function shippingCommon(raw: V, { incoterm }: { incoterm: boolean }) {
  const docs = raw.shipmentDocuments ?? {};
  const documents = {
    commercialInvoice: docs.commercialInvoice ?? [],
    packingList: docs.packingList ?? [],
    draftBl: docs.draftBl ?? [],
    other: docs.other ?? [],
  };
  const services = raw.services ?? {};
  return {
    services: compact({
      availableDocuments: services.availableDocuments ?? [],
      executionDocuments: opt(services.executionDocuments),
      insurance: Boolean(services.insurance),
      warehousing: Boolean(services.warehousing),
      incoterm: incoterm ? opt(services.incoterm) : undefined,
    }),
    readyDate: raw.readyDate ?? '',
    cargoValue: money(raw.cargoValue),
    shipmentDocuments: Object.values(documents).some((ids) => ids.length) ? documents : undefined,
    notes: opt(raw.notes),
    confirmAccuracy: raw.confirmAccuracy,
  };
}

function pruneInternational(raw: V) {
  const operation = raw.operation ?? {};
  const customs = has(operation.serviceScope) && operation.serviceScope !== 'shipping';
  const s: V = raw.shipment ?? {};
  const origin: V = s.origin ?? {};
  const destination: V = s.destination ?? {};
  let shipment: V = { mode: s.mode };
  if (s.mode === 'sea') {
    const side = s.trucking?.side;
    shipment = {
      mode: 'sea',
      seaType: s.seaType,
      origin: { country: origin.country ?? '', port: place(origin.port) },
      destination: { country: destination.country ?? '', port: place(destination.port) },
      clearanceLocation: customs ? (s.clearanceLocation ?? '') : undefined,
      trucking: s.truckingNeeded
        ? compact({
            side,
            originAddress:
              side === 'origin' || side === 'both' ? (s.trucking?.originAddress ?? '') : undefined,
            destinationAddress:
              side === 'destination' || side === 'both'
                ? (s.trucking?.destinationAddress ?? '')
                : undefined,
          })
        : undefined,
      cargo: pruneCargo(
        s.seaType === 'fcl' ? 'containers' : s.seaType === 'lcl' ? 'loose' : undefined,
        s.cargo,
        {
          prices: true,
        },
      ),
    };
  } else if (s.mode === 'air') {
    const service: string = s.airService ?? '';
    shipment = {
      mode: 'air',
      origin: {
        country: origin.country ?? '',
        airport: origin.airport?.any ? { any: true } : place(origin.airport),
      },
      destination: { country: destination.country ?? '', airport: place(destination.airport) },
      airService: s.airService,
      pickupAddress: service.startsWith('door') ? (s.pickupAddress ?? '') : undefined,
      deliveryAddress: service.endsWith('door') ? (s.deliveryAddress ?? '') : undefined,
      clearanceLocation: customs ? (s.clearanceLocation ?? '') : undefined,
      cargo: pruneCargo('loose', s.cargo, { prices: false }),
    };
  } else if (s.mode === 'land') {
    const general = s.landType === 'general';
    const kind =
      s.landType === 'container'
        ? 'containers'
        : general && s.loadType === 'ftl'
          ? 'trucks'
          : general && s.loadType === 'ltl'
            ? 'ltl'
            : undefined;
    shipment = {
      mode: 'land',
      landType: s.landType,
      loadType: general ? s.loadType : undefined,
      origin: { country: origin.country ?? '', city: place(origin.city) },
      destination: { country: destination.country ?? '', city: place(destination.city) },
      clearancePoint: customs ? (s.clearancePoint ?? '') : undefined,
      cargo: pruneCargo(kind, s.cargo, { prices: false }),
    };
  }
  return compact({
    service: 'international',
    formVersion: formVersionOf('international'),
    contact: pruneContact(raw.contact),
    operation: compact({
      operationType: operation.operationType,
      serviceScope: operation.serviceScope,
    }),
    shipment: compact(shipment),
    ...shippingCommon(raw, { incoterm: true }),
  });
}

function pruneDomestic(raw: V) {
  const s: V = raw.shipment ?? {};
  const general = s.landType === 'general';
  const kind =
    s.landType === 'container'
      ? 'containers'
      : general && s.loadType === 'ftl'
        ? 'trucks'
        : general && s.loadType === 'ltl'
          ? 'ltl'
          : undefined;
  const shipment = compact({
    landType: s.landType,
    loadType: general ? s.loadType : undefined,
    loadingRegion: s.loadingRegion ?? '',
    loadingAddress: opt(s.loadingAddress),
    unloadingRegion: general ? (s.unloadingRegion ?? '') : undefined,
    unloadingAddress: general ? opt(s.unloadingAddress) : undefined,
    dischargePort: s.landType === 'container' ? (s.dischargePort ?? '') : undefined,
    cargo: pruneCargo(kind, s.cargo, { prices: false }),
  });
  return compact({
    service: 'domestic',
    formVersion: formVersionOf('domestic'),
    contact: pruneContact(raw.contact),
    shipment,
    ...shippingCommon(raw, { incoterm: false }),
  });
}

function pruneChina(raw: V) {
  const o: V = raw.order ?? {};
  const d: V = raw.delivery ?? {};
  const chinese = o.source === 'chinese_sites';
  const countryOther = Boolean(d.country?.isOther);
  return compact({
    service: 'china',
    formVersion: formVersionOf('china'),
    contact: pruneContact(raw.contact),
    order: compact({
      source: o.source,
      sheinSite: o.source === 'shein' ? o.sheinSite : undefined,
      chineseSite: chinese ? o.chineseSite : undefined,
      chineseSiteOther:
        chinese && o.chineseSite === 'other' ? (o.chineseSiteOther ?? '') : undefined,
      addMethod: o.addMethod,
      cartLink: o.addMethod === 'cart_link' ? (o.cartLink ?? '') : undefined,
      screenshotUploadIds:
        o.addMethod === 'screenshots' ? (o.screenshotUploadIds ?? []) : undefined,
      products:
        o.addMethod === 'manual'
          ? (o.products ?? []).map((p: V) =>
              compact({
                url: opt(p.url),
                name: opt(p.name),
                quantity: p.quantity ?? '',
                colors: p.hasColors
                  ? (p.colors ?? []).map((v: V) => ({
                      value: v.value ?? '',
                      quantity: v.quantity ?? '',
                    }))
                  : undefined,
                sizes: p.hasSizes
                  ? (p.sizes ?? []).map((v: V) => ({
                      value: v.value ?? '',
                      quantity: v.quantity ?? '',
                    }))
                  : undefined,
                notes: opt(p.notes),
              }),
            )
          : undefined,
    }),
    delivery: compact({
      shippingMethod: d.shippingMethod,
      supplierAddress: chinese ? opt(d.supplierAddress) : undefined,
      country: countryOther ? { other: d.country.other ?? '' } : { id: d.country?.id ?? '' },
      city: countryOther ? { other: d.city?.other ?? '' } : place(d.city),
      address: d.address ?? '',
      receiverName: d.receiverName ?? '',
      receiverPhone: d.receiverPhone ?? '',
    }),
    notes: opt(raw.notes),
    confirmAccuracy: raw.confirmAccuracy,
  });
}

/** The order the chosen path describes (input of the shared orderSchema). */
export function pruneOrder(service: ServiceType, raw: V): OrderInput {
  const order =
    service === 'international'
      ? pruneInternational(raw)
      : service === 'domestic'
        ? pruneDomestic(raw)
        : pruneChina(raw);
  return order as OrderInput;
}

/** Paths of the raw values that the chosen path does not show (to clear them in the form). */
export function hiddenPaths(
  raw: V,
  visible: unknown,
  keep: ReadonlySet<string>,
  prefix = '',
): string[] {
  if (raw === null || typeof raw !== 'object') return [];
  const paths: string[] = [];
  for (const [key, value] of Object.entries(raw)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (keep.has(key) || value === undefined) continue;
    const shown = visible && typeof visible === 'object' ? (visible as V)[key] : undefined;
    if (shown === undefined) {
      if (value !== '' && !(Array.isArray(value) && value.length === 0)) paths.push(path);
    } else if (typeof value === 'object' && value !== null) {
      paths.push(...hiddenPaths(value as V, shown, keep, path));
    }
  }
  return paths;
}
