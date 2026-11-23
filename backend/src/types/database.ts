import type {
  ApplicationStatus,
  AttachmentSlot,
  DocumentType,
  Gender,
  OrderMime,
  OrderUploadPurpose,
  OtpPurpose,
  ServiceType,
  StatusActorType,
  TransitMethod,
  TransitSource,
  UserRole,
} from '@mirhalgo/shared';

/**
 * Typed view of the tables in backend/supabase/migrations (hand-written, keep in sync).
 * Can be regenerated with `supabase gen types typescript --linked`.
 */
type Timestamp = string;

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type ProfileRow = {
  id: string;
  role: UserRole;
  /** null for companies (MW_002), required for customers (check constraint) */
  first_name: string | null;
  last_name: string | null;
  gender: Gender | null;
  email: string;
  phone: string;
  email_verified_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type EmailOtpRow = {
  id: string;
  user_id: string;
  email: string;
  purpose: OtpPurpose;
  code_hash: string;
  attempts: number;
  expires_at: Timestamp;
  consumed_at: Timestamp | null;
  invalidated_at: Timestamp | null;
  ip: string | null;
  created_at: Timestamp;
};

export type ContactMessageRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  message: string;
  email_sent: boolean;
  ip: string | null;
  created_at: Timestamp;
};

export type CompanyDocumentRow = {
  id: string;
  company_id: string;
  type: DocumentType;
  storage_bucket: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: Timestamp;
};

export type CompanyApplicationRow = {
  id: string;
  company_id: string;
  reference_number: string;
  status: ApplicationStatus;
  submitted_at: Timestamp;
  declaration_accepted_at: Timestamp;
  terms_version: string;
  terms_accepted_at: Timestamp;
  submit_ip: string | null;
  user_agent: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

/** The columns the API reads (uniqueness pre-check, notification email). */
export type CompanyRow = {
  id: string;
  legal_name: string;
  country_code: string;
  region_id: string;
  activities: string[];
  commercial_register_number: string;
  tax_number: string;
};

/** Reference lists (MW_003): public read of active rows, written by migrations only. */
export type CountryRow = {
  code: string;
  name_ar: string;
  name_en: string;
  dial_code: string | null;
  company_signup: boolean;
  china_delivery: boolean;
  sort: number;
  active: boolean;
};

export type RegionRow = {
  id: string;
  country_code: string;
  name_ar: string;
  name_en: string;
  sort: number;
  active: boolean;
};

/** Cities, airports: same shape as regions (id + country + names). Ports add the UN/LOCODE. */
export type PlaceRow = RegionRow;
export type PortRow = RegionRow & { unlocode: string | null };

/** Container types, truck types, shipping lines. */
export type OptionRow = {
  id: string;
  name_ar: string;
  name_en: string;
  sort: number;
  active: boolean;
};

export type TransitEstimateRow = {
  source: TransitSource;
  method: TransitMethod;
  min_days: number;
  max_days: number;
  active: boolean;
};

/** Request balance (MW_003 B2): written only by grant_balance() / submit_order(). */
export type CustomerBalanceRow = { customer_id: string; balance: number; updated_at: Timestamp };

/** Drafts + uploads (MW_003 B3). Written by the backend only. */
export type OrderDraftRow = {
  id: string;
  customer_id: string;
  service: ServiceType;
  payload: Record<string, unknown>;
  form_version: string;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type OrderUploadRow = {
  id: string;
  customer_id: string;
  purpose: OrderUploadPurpose;
  storage_path: string;
  original_name: string;
  mime_type: OrderMime;
  size_bytes: number;
  draft_id: string | null;
  order_id: string | null;
  /** set with order_id by submit_order() (MW_003 B4) */
  slot: AttachmentSlot | null;
  cargo_item_id: number | null;
  created_at: Timestamp;
};

/** A stored file: bucket + path (from list_expired_company_registrations / company_documents). */
export type StoredFile = { bucket: string; path: string };

export type ClaimOtpStatus = 'ok' | 'none' | 'expired' | 'exhausted';

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        Omit<ProfileRow, 'role' | 'email_verified_at' | 'created_at' | 'updated_at'> &
          Partial<Pick<ProfileRow, 'role' | 'email_verified_at'>>,
        Partial<
          Pick<ProfileRow, 'first_name' | 'last_name' | 'gender' | 'phone' | 'email_verified_at'>
        >
      >;
      email_otps: Table<
        EmailOtpRow,
        Pick<EmailOtpRow, 'user_id' | 'email' | 'purpose' | 'code_hash' | 'expires_at' | 'ip'>,
        Partial<Pick<EmailOtpRow, 'consumed_at' | 'invalidated_at'>>
      >;
      contact_messages: Table<
        ContactMessageRow,
        Omit<ContactMessageRow, 'id' | 'email_sent' | 'created_at'>,
        Partial<Pick<ContactMessageRow, 'email_sent'>>
      >;
      // MW_002: written only through create_company_registration(); read by the backend.
      companies: Table<CompanyRow, never, never>;
      company_documents: Table<CompanyDocumentRow, never, never>;
      company_applications: Table<CompanyApplicationRow, never, never>;
      // MW_003
      countries: Table<CountryRow, never, never>;
      regions: Table<RegionRow, never, never>;
      cities: Table<PlaceRow, never, never>;
      ports: Table<PortRow, never, never>;
      airports: Table<PlaceRow, never, never>;
      container_types: Table<OptionRow, never, never>;
      truck_types: Table<OptionRow, never, never>;
      shipping_lines: Table<OptionRow, never, never>;
      transit_estimates: Table<TransitEstimateRow, never, never>;
      customer_balances: Table<CustomerBalanceRow, never, never>;
      order_drafts: Table<OrderDraftRow, never, never>;
      // MW_003 B4: written only by submit_order(); read back as plain rows (orderRows.ts)
      orders: Table<Record<string, unknown> & { id: string; reference: string }, never, never>;
      order_shipments: Table<Record<string, unknown>, never, never>;
      order_container_groups: Table<Record<string, unknown>, never, never>;
      order_truck_groups: Table<Record<string, unknown>, never, never>;
      order_cargo_items: Table<Record<string, unknown>, never, never>;
      order_china_details: Table<Record<string, unknown>, never, never>;
      order_china_products: Table<Record<string, unknown>, never, never>;
      order_china_product_variants: Table<Record<string, unknown>, never, never>;
      order_uploads: Table<
        OrderUploadRow,
        Pick<
          OrderUploadRow,
          'customer_id' | 'purpose' | 'storage_path' | 'original_name' | 'mime_type' | 'size_bytes'
        >,
        never
      >;
    };
    Views: Record<never, never>;
    Functions: {
      claim_otp_attempt: {
        Args: { p_email: string; p_purpose: OtpPurpose; p_max_attempts: number };
        Returns: Array<{
          status: ClaimOtpStatus;
          otp_id: string | null;
          user_id: string | null;
          code_hash: string | null;
          attempts: number | null;
        }>;
      };
      create_company_registration: {
        Args: {
          p_user_id: string;
          p_email: string;
          p_phone: string;
          p_company: Record<string, unknown>;
          p_services: Record<string, unknown>;
          /** Region ids of the company country (MW_003); empty with domestic_all_regions. */
          p_domestic_regions: string[];
          p_documents: Array<
            Pick<
              CompanyDocumentRow,
              | 'type'
              | 'storage_bucket'
              | 'storage_path'
              | 'original_name'
              | 'mime_type'
              | 'size_bytes'
            >
          >;
          p_consent: { terms_version: string; submit_ip: string | null; user_agent: string | null };
        };
        Returns: Array<{ application_id: string; reference_number: string }>;
      };
      save_order_draft: {
        Args: {
          p_customer_id: string;
          p_service: ServiceType;
          p_payload: Record<string, unknown>;
          p_form_version: string;
          p_upload_ids: string[];
        };
        Returns: Array<{ draft_id: string; updated_at: Timestamp }>;
      };
      list_orphan_uploads: {
        Args: { p_older_than?: string; p_limit?: number };
        Returns: Array<{ upload_id: string; storage_path: string }>;
      };
      list_expired_drafts: {
        Args: { p_older_than?: string; p_limit?: number };
        Returns: Array<{ draft_id: string; files: Array<{ id: string; path: string }> }>;
      };
      claim_job_lease: { Args: { p_name: string; p_seconds: number }; Returns: boolean };
      submit_order: {
        Args: {
          p_customer_id: string;
          p_order: Record<string, unknown>;
          p_attachments: Array<Record<string, unknown>>;
          p_idempotency_key: string;
          p_payload_hash: string;
        };
        Returns: Array<{
          order_id: string;
          reference: string;
          balance_after: number;
          replayed: boolean;
        }>;
      };
      grant_balance: {
        Args: {
          p_customer_id: string;
          p_amount: number;
          p_reason: string;
          p_unique_key: string;
          p_actor_type?: 'system' | 'customer' | 'admin';
          p_actor_id?: string | null;
        };
        /** The balance after the call. */
        Returns: number;
      };
      transition_application_status: {
        Args: {
          p_application_id: string;
          p_to: ApplicationStatus;
          p_actor_type: StatusActorType;
          p_actor_id?: string | null;
          p_note?: string | null;
        };
        Returns: ApplicationStatus;
      };
      list_expired_company_registrations: {
        Args: { p_older_than?: string; p_limit?: number };
        Returns: Array<{ user_id: string; documents: StoredFile[] }>;
      };
      revoke_user_sessions: { Args: { p_user_id: string }; Returns: number };
    };
    Enums: {
      user_role: UserRole;
      application_status: ApplicationStatus;
      status_actor_type: StatusActorType;
      company_document_type: DocumentType;
      gender: Gender;
      otp_purpose: OtpPurpose;
    };
    CompositeTypes: Record<never, never>;
  };
};
