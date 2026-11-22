import type {
  ApplicationStatus,
  DocumentType,
  Gender,
  OtpPurpose,
  StatusActorType,
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
