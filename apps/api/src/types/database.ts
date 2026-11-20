import type { Gender, OtpPurpose } from '@mirhalgo/shared';

/**
 * Typed view of the tables in supabase/migrations (hand-written, keep in sync).
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
  role: 'customer' | 'company' | 'admin';
  first_name: string;
  last_name: string;
  gender: Gender;
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
    };
    Enums: {
      user_role: ProfileRow['role'];
      gender: Gender;
      otp_purpose: OtpPurpose;
    };
    CompositeTypes: Record<never, never>;
  };
};
