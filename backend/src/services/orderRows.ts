import type {
  AttachmentSlot,
  ChinaOrder,
  DerivedOrderValues,
  DomesticOrder,
  InternationalOrder,
  Order,
  OrderAttachmentRef,
  PlaceRef,
} from '@mirhalgo/shared';

/*
 * Order ↔ table rows (MW_003 B4, spec B8). Pure functions (no DB, no env):
 * - toRows(): the validated order + server-computed values → submit_order() arguments, one
 *   column per field (reference ids and "other" texts in separate columns);
 * - fromRows(): the stored rows → the same order shape again, for GET /api/orders/:reference.
 * Domestic reuses the origin/destination columns: region = loading / unloading governorate,
 * destination port = port of discharge. Air: origin / destination address = pickup / delivery.
 */

type Json = Record<string, unknown>;
const compact = (row: Json): Json =>
  Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));

const place = (ref: PlaceRef | undefined, idColumn: string, otherColumn: string): Json =>
  ref ? ('id' in ref ? { [idColumn]: ref.id } : { [otherColumn]: ref.other }) : {};

const weightColumns = (w: { value: number; unit: string } | undefined, prefix = 'weight') =>
  w ? { [`${prefix}_value`]: w.value, [`${prefix}_unit`]: w.unit } : {};

type Cargo = InternationalOrder['shipment']['cargo'] | DomesticOrder['shipment']['cargo'];

function cargoRows(cargo: Cargo, derived: DerivedOrderValues) {
  const shipment: Json = {
    cargo_kind: cargo.kind,
    total_containers: derived.totalContainers ?? undefined,
    total_trucks: derived.totalTrucks ?? undefined,
    total_cbm: derived.totalCbm ?? undefined,
  };
  let containerGroups: Json[] = [];
  let truckGroups: Json[] = [];
  let cargoItems: Json[] = [];
  switch (cargo.kind) {
    case 'containers':
      shipment.hazardous = cargo.hazardous;
      containerGroups = cargo.groups.map((g, position) =>
        compact({
          position,
          container_type_id: g.containerType,
          count: g.count,
          description: g.description,
          ...weightColumns(g.weightPerContainer),
          ...place(g.shippingLine, 'shipping_line_id', 'shipping_line_other'),
          target_price: g.targetPrice?.amount,
          target_currency: g.targetPrice?.currency,
        }),
      );
      break;
    case 'trucks':
      Object.assign(shipment, {
        hazardous: cargo.hazardous,
        packaging_type: cargo.packaging,
        packaging_other: cargo.packagingOther,
      });
      truckGroups = cargo.groups.map((g, position) =>
        compact({
          position,
          truck_type_id: g.truckType,
          count: g.count,
          description: g.description,
          ...weightColumns(g.weight),
        }),
      );
      break;
    case 'ltl':
      Object.assign(shipment, {
        hazardous: cargo.hazardous,
        cargo_description: cargo.description,
        cargo_input_method: cargo.inputMethod,
        ltl_total_weight: cargo.totalWeight?.value,
        ltl_weight_unit: cargo.totalWeight?.unit,
        ltl_pieces: cargo.pieces,
        ltl_volume_cbm: cargo.volumeCbm,
        ltl_length_cm: cargo.dimensions?.length,
        ltl_width_cm: cargo.dimensions?.width,
        ltl_height_cm: cargo.dimensions?.height,
      });
      break;
    case 'loose':
      Object.assign(shipment, {
        hazardous: cargo.hazardous ?? (cargo.items ?? []).some((item) => item.hazardous),
        cargo_description: cargo.description,
        cargo_input_method: cargo.inputMethod,
      });
      cargoItems = (cargo.items ?? []).map((item, position) => ({
        position,
        description: item.description,
        weight_value: item.weight.value,
        weight_unit: item.weight.unit,
        cartons: item.cartons,
        length_cm: item.dimensions.length,
        width_cm: item.dimensions.width,
        height_cm: item.dimensions.height,
        cbm: derived.items[position]!.cbm,
        volumetric_kg: derived.items[position]!.volumetricKg,
        hazardous: item.hazardous,
      }));
      break;
  }
  return { shipment, containerGroups, truckGroups, cargoItems };
}

function internationalShipment(order: InternationalOrder): Json {
  const s = order.shipment;
  // origin_airport_any is NOT NULL and jsonb_populate_record() turns a missing key into NULL
  const route: Json = { mode: s.mode, origin_airport_any: false };
  if (s.mode === 'sea') {
    Object.assign(route, {
      sea_type: s.seaType,
      origin_country: s.origin.country,
      ...place(s.origin.port, 'origin_port_id', 'origin_place_other'),
      destination_country: s.destination.country,
      ...place(s.destination.port, 'destination_port_id', 'destination_place_other'),
      clearance_location: s.clearanceLocation,
      trucking_side: s.trucking?.side,
      trucking_origin_address: s.trucking?.originAddress,
      trucking_destination_address: s.trucking?.destinationAddress,
    });
  } else if (s.mode === 'air') {
    const anyAirport = 'any' in s.origin.airport;
    Object.assign(route, {
      air_service: s.airService,
      origin_country: s.origin.country,
      origin_airport_any: anyAirport,
      ...('any' in s.origin.airport
        ? {}
        : place(s.origin.airport, 'origin_airport_id', 'origin_place_other')),
      destination_country: s.destination.country,
      ...place(s.destination.airport, 'destination_airport_id', 'destination_place_other'),
      origin_address: s.pickupAddress,
      destination_address: s.deliveryAddress,
      clearance_location: s.clearanceLocation,
    });
  } else {
    Object.assign(route, {
      land_type: s.landType,
      load_type: s.loadType,
      origin_country: s.origin.country,
      ...place(s.origin.city, 'origin_city_id', 'origin_place_other'),
      destination_country: s.destination.country,
      ...place(s.destination.city, 'destination_city_id', 'destination_place_other'),
      clearance_point: s.clearancePoint,
    });
  }
  return {
    operation_type: order.operation.operationType,
    service_scope: order.operation.serviceScope,
    ...route,
    incoterm: order.services.incoterm,
  };
}

function domesticShipment(order: DomesticOrder): Json {
  const s = order.shipment;
  return {
    operation_type: 'domestic',
    service_scope: 'shipping',
    mode: 'land',
    origin_airport_any: false,
    land_type: s.landType,
    load_type: s.landType === 'general' ? s.loadType : undefined,
    origin_country: 'EG',
    destination_country: 'EG',
    origin_region_id: s.loadingRegion,
    origin_address: s.loadingAddress,
    destination_region_id: s.landType === 'general' ? s.unloadingRegion : undefined,
    destination_address: s.landType === 'general' ? s.unloadingAddress : undefined,
    destination_port_id: s.landType === 'container' ? s.dischargePort : undefined,
  };
}

function chinaRows(order: ChinaOrder) {
  const o = order.order;
  const d = order.delivery;
  const china = compact({
    source: o.source,
    shein_site: o.sheinSite,
    chinese_site: o.chineseSite,
    chinese_site_other: o.chineseSiteOther,
    add_method: o.addMethod,
    cart_link: o.cartLink,
    shipping_method: d.shippingMethod,
    supplier_address: d.supplierAddress,
    ...('id' in d.country
      ? { delivery_country: d.country.id }
      : { delivery_country_other: d.country.other }),
    ...place(d.city, 'delivery_city_id', 'delivery_city_other'),
    delivery_address: d.address,
    receiver_name: d.receiverName,
    receiver_phone: d.receiverPhone,
  });
  const products = (o.products ?? []).map((p, position) => ({
    ...compact({ position, url: p.url, name: p.name, quantity: p.quantity, notes: p.notes }),
    variants: [
      ...(p.colors ?? []).map((v, i) => ({ kind: 'color', position: i, ...v })),
      ...(p.sizes ?? []).map((v, i) => ({ kind: 'size', position: i, ...v })),
    ],
  }));
  return { china, products };
}

/** submit_order() arguments: p_order + p_attachments. */
export function toRows(
  order: Order,
  derived: DerivedOrderValues,
  attachments: OrderAttachmentRef[],
) {
  const common = compact({
    service: order.service,
    contact_name: order.contact.fullName,
    contact_phone: order.contact.phone,
    contact_whatsapp: order.contact.whatsappSameAsPhone
      ? order.contact.phone
      : order.contact.whatsapp,
    client_type: order.contact.clientType,
    business_name: order.contact.businessName,
    notes: order.notes,
    form_version: order.formVersion,
  });
  const p_attachments = attachments.map((a) =>
    compact({ upload_id: a.uploadId, slot: a.slot, item_position: a.itemPosition }),
  );

  if (order.service === 'china') {
    const { china, products } = chinaRows(order);
    return { p_order: { order: common, china, china_products: products }, p_attachments };
  }

  const cargo = cargoRows(order.shipment.cargo, derived);
  const shipment = compact({
    ...(order.service === 'international' ? internationalShipment(order) : domesticShipment(order)),
    ready_date: order.readyDate,
    cargo_value: order.cargoValue?.amount,
    cargo_value_currency: order.cargoValue?.currency,
    available_documents: order.services.availableDocuments,
    execution_documents: order.services.executionDocuments,
    insurance: order.services.insurance,
    warehousing: order.services.warehousing,
    ...cargo.shipment,
  });
  return {
    p_order: {
      order: common,
      shipment,
      container_groups: cargo.containerGroups,
      truck_groups: cargo.truckGroups,
      cargo_items: cargo.cargoItems,
    },
    p_attachments,
  };
}

// ── rows → order (GET /api/orders/:reference) ─────────────────────────────────

export type StoredOrderRows = {
  order: Json;
  shipment: Json | null;
  containerGroups: Json[];
  truckGroups: Json[];
  cargoItems: Json[];
  china: Json | null;
  chinaProducts: Array<Json & { variants: Json[] }>;
  /** Attachments with their slot and, for a product MSDS, the product position. */
  attachments: Array<{ id: string; slot: AttachmentSlot; itemPosition: number | null }>;
};

const opt = <T>(value: T | null | undefined): T | undefined => (value === null ? undefined : value);
const n = (value: unknown) => (value === null || value === undefined ? undefined : Number(value));
const placeFrom = (row: Json, idColumn: string, otherColumn: string) =>
  row[idColumn] != null
    ? { id: String(row[idColumn]) }
    : row[otherColumn] != null
      ? { other: String(row[otherColumn]) }
      : undefined;
const weightFrom = (row: Json, prefix = 'weight') =>
  row[`${prefix}_value`] == null
    ? undefined
    : { value: Number(row[`${prefix}_value`]), unit: row[`${prefix}_unit`] };

/** The stored order in the same shape as the validated one (undefined = not given). */
export function fromRows(rows: StoredOrderRows): Json {
  const o = rows.order;
  const slotIds = (slot: AttachmentSlot) =>
    rows.attachments.filter((a) => a.slot === slot).map((a) => a.id);
  const firstId = (slot: AttachmentSlot) => slotIds(slot)[0];
  const contact = {
    fullName: o.contact_name,
    phone: o.contact_phone,
    whatsappSameAsPhone: o.contact_whatsapp === o.contact_phone,
    whatsapp: o.contact_whatsapp === o.contact_phone ? undefined : o.contact_whatsapp,
    clientType: o.client_type,
    businessName: opt(o.business_name),
  };
  const common = { service: o.service, formVersion: o.form_version, contact, notes: opt(o.notes) };

  if (o.service === 'china') {
    const c = rows.china!;
    const variants = (p: { variants: Json[] }, kind: string) => {
      const list = p.variants
        .filter((v) => v.kind === kind)
        .sort((a, b) => Number(a.position) - Number(b.position))
        .map((v) => ({ value: v.value, quantity: Number(v.quantity) }));
      return list.length ? list : undefined;
    };
    const products = rows.chinaProducts
      .sort((a, b) => Number(a.position) - Number(b.position))
      .map((p) => ({
        url: opt(p.url),
        name: opt(p.name),
        quantity: Number(p.quantity),
        colors: variants(p, 'color'),
        sizes: variants(p, 'size'),
        notes: opt(p.notes),
      }));
    const screenshots = slotIds('screenshot');
    return {
      ...common,
      order: {
        source: c.source,
        sheinSite: opt(c.shein_site),
        chineseSite: opt(c.chinese_site),
        chineseSiteOther: opt(c.chinese_site_other),
        addMethod: c.add_method,
        cartLink: opt(c.cart_link),
        screenshotUploadIds: screenshots.length ? screenshots : undefined,
        products: products.length ? products : undefined,
      },
      delivery: {
        shippingMethod: c.shipping_method,
        supplierAddress: opt(c.supplier_address),
        country: c.delivery_country
          ? { id: c.delivery_country }
          : { other: c.delivery_country_other },
        city: placeFrom(c, 'delivery_city_id', 'delivery_city_other'),
        address: c.delivery_address,
        receiverName: c.receiver_name,
        receiverPhone: c.receiver_phone,
      },
      confirmAccuracy: true,
    };
  }

  const s = rows.shipment!;
  const hazard = { hazardous: Boolean(s.hazardous), msdsUploadId: firstId('msds') };
  const byPosition = (list: Json[]) =>
    [...list].sort((a, b) => Number(a.position) - Number(b.position));
  let cargo: Json;
  switch (s.cargo_kind) {
    case 'containers':
      cargo = {
        kind: 'containers',
        groups: byPosition(rows.containerGroups).map((g) => ({
          containerType: g.container_type_id,
          count: Number(g.count),
          description: g.description,
          weightPerContainer: weightFrom(g),
          shippingLine: placeFrom(g, 'shipping_line_id', 'shipping_line_other'),
          targetPrice:
            g.target_price == null
              ? undefined
              : { amount: Number(g.target_price), currency: g.target_currency },
        })),
        ...hazard,
      };
      break;
    case 'trucks':
      cargo = {
        kind: 'trucks',
        groups: byPosition(rows.truckGroups).map((g) => ({
          truckType: g.truck_type_id,
          count: Number(g.count),
          description: g.description,
          weight: weightFrom(g),
        })),
        packaging: s.packaging_type,
        packagingOther: opt(s.packaging_other),
        ...hazard,
      };
      break;
    case 'ltl':
      cargo = {
        kind: 'ltl',
        description: s.cargo_description,
        inputMethod: s.cargo_input_method,
        totalWeight:
          s.ltl_total_weight == null
            ? undefined
            : { value: Number(s.ltl_total_weight), unit: s.ltl_weight_unit },
        pieces: n(s.ltl_pieces),
        volumeCbm: n(s.ltl_volume_cbm),
        dimensions:
          s.ltl_length_cm == null
            ? undefined
            : {
                length: Number(s.ltl_length_cm),
                width: Number(s.ltl_width_cm),
                height: Number(s.ltl_height_cm),
              },
        packingListUploadId: firstId('cargo_packing_list'),
        ...hazard,
      };
      break;
    default: {
      const manual = s.cargo_input_method === 'manual';
      const itemMsds = (position: number) =>
        rows.attachments.find((a) => a.slot === 'item_msds' && a.itemPosition === position)?.id;
      cargo = {
        kind: 'loose',
        description: s.cargo_description,
        inputMethod: s.cargo_input_method,
        items: manual
          ? byPosition(rows.cargoItems).map((i) => ({
              description: i.description,
              weight: { value: Number(i.weight_value), unit: i.weight_unit },
              cartons: Number(i.cartons),
              dimensions: {
                length: Number(i.length_cm),
                width: Number(i.width_cm),
                height: Number(i.height_cm),
              },
              hazardous: Boolean(i.hazardous),
              msdsUploadId: itemMsds(Number(i.position)),
            }))
          : undefined,
        packingListUploadId: manual ? undefined : firstId('cargo_packing_list'),
        hazardous: manual ? undefined : Boolean(s.hazardous),
        msdsUploadId: manual ? undefined : firstId('msds'),
      };
    }
  }

  const documents = {
    commercialInvoice: slotIds('commercial_invoice'),
    packingList: slotIds('packing_list'),
    draftBl: slotIds('draft_bl'),
    other: slotIds('other_document'),
  };
  const extras = {
    readyDate: s.ready_date,
    cargoValue:
      s.cargo_value == null
        ? undefined
        : { amount: Number(s.cargo_value), currency: s.cargo_value_currency },
    shipmentDocuments: Object.values(documents).some((ids) => ids.length) ? documents : undefined,
    confirmAccuracy: true,
  };

  if (o.service === 'domestic') {
    const general = s.land_type === 'general';
    return {
      ...common,
      shipment: general
        ? {
            landType: 'general',
            loadType: s.load_type,
            loadingRegion: s.origin_region_id,
            loadingAddress: opt(s.origin_address),
            unloadingRegion: s.destination_region_id,
            unloadingAddress: opt(s.destination_address),
            cargo,
          }
        : {
            landType: 'container',
            loadingRegion: s.origin_region_id,
            loadingAddress: opt(s.origin_address),
            dischargePort: s.destination_port_id,
            cargo,
          },
      services: {
        availableDocuments: s.available_documents ?? [],
        executionDocuments: opt(s.execution_documents),
        insurance: Boolean(s.insurance),
        warehousing: Boolean(s.warehousing),
      },
      ...extras,
    };
  }

  let shipment: Json;
  if (s.mode === 'sea') {
    shipment = {
      mode: 'sea',
      seaType: s.sea_type,
      origin: {
        country: s.origin_country,
        port: placeFrom(s, 'origin_port_id', 'origin_place_other'),
      },
      destination: {
        country: s.destination_country,
        port: placeFrom(s, 'destination_port_id', 'destination_place_other'),
      },
      clearanceLocation: opt(s.clearance_location),
      trucking: s.trucking_side
        ? {
            side: s.trucking_side,
            originAddress: opt(s.trucking_origin_address),
            destinationAddress: opt(s.trucking_destination_address),
          }
        : undefined,
      cargo,
    };
  } else if (s.mode === 'air') {
    shipment = {
      mode: 'air',
      origin: {
        country: s.origin_country,
        airport: s.origin_airport_any
          ? { any: true }
          : placeFrom(s, 'origin_airport_id', 'origin_place_other'),
      },
      destination: {
        country: s.destination_country,
        airport: placeFrom(s, 'destination_airport_id', 'destination_place_other'),
      },
      airService: s.air_service,
      pickupAddress: opt(s.origin_address),
      deliveryAddress: opt(s.destination_address),
      clearanceLocation: opt(s.clearance_location),
      cargo,
    };
  } else {
    shipment = {
      mode: 'land',
      landType: s.land_type,
      loadType: opt(s.load_type),
      origin: {
        country: s.origin_country,
        city: placeFrom(s, 'origin_city_id', 'origin_place_other'),
      },
      destination: {
        country: s.destination_country,
        city: placeFrom(s, 'destination_city_id', 'destination_place_other'),
      },
      clearancePoint: opt(s.clearance_point),
      cargo,
    };
  }
  return {
    ...common,
    operation: { operationType: s.operation_type, serviceScope: s.service_scope },
    shipment,
    services: {
      availableDocuments: s.available_documents ?? [],
      executionDocuments: s.execution_documents,
      insurance: Boolean(s.insurance),
      warehousing: Boolean(s.warehousing),
      incoterm: opt(s.incoterm),
    },
    ...extras,
  };
}

/** Drops undefined values deeply (JSON never carries them; tests compare with this). */
export const withoutUndefined = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
