/**
 * Supabase database types. Keep in sync with supabase/migrations/0001_init.sql.
 * Eventually replace with `supabase gen types typescript` output.
 */

export type UserRole = "md_admin" | "company_manager" | "employee";
export type AttendanceStatus = "present" | "absent" | "late" | "leave";
export type DocumentCategory =
  | "letter"
  | "contract"
  | "memo"
  | "personal"
  | "other";
export type MailDirection = "inbound" | "outbound";

export interface Company {
  id: string;
  name_ar: string;
  name_en: string | null;
  slug: string;
  logo_url: string | null;
  active: boolean;
  created_at: string;
}
type CompanyInsert = {
  id?: string;
  name_ar: string;
  name_en?: string | null;
  slug: string;
  logo_url?: string | null;
  active?: boolean;
  created_at?: string;
};

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  company_id: string | null;
  job_title: string | null;
  national_id: string | null;
  hired_at: string | null;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
}
type ProfileInsert = {
  id: string;
  full_name: string;
  phone?: string | null;
  role?: UserRole;
  company_id?: string | null;
  job_title?: string | null;
  national_id?: string | null;
  hired_at?: string | null;
  is_active?: boolean;
  avatar_url?: string | null;
  created_at?: string;
};

export interface Attendance {
  id: string;
  profile_id: string;
  company_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: AttendanceStatus;
  notes: string | null;
  created_at: string;
}
type AttendanceInsert = {
  id?: string;
  profile_id: string;
  company_id: string;
  date: string;
  check_in?: string | null;
  check_out?: string | null;
  status?: AttendanceStatus;
  notes?: string | null;
  created_at?: string;
};

export interface DocumentRow {
  id: string;
  company_id: string;
  owner_profile_id: string | null;
  title: string;
  category: DocumentCategory;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  content_text: string | null;
  created_by: string | null;
  created_at: string;
}
type DocumentInsert = {
  id?: string;
  company_id: string;
  owner_profile_id?: string | null;
  title: string;
  category?: DocumentCategory;
  storage_path: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  content_text?: string | null;
  created_by?: string | null;
  created_at?: string;
};

export interface Mail {
  id: string;
  company_id: string;
  direction: MailDirection;
  subject: string;
  body: string | null;
  from_name: string | null;
  to_name: string | null;
  status: string | null;
  related_document_id: string | null;
  created_by: string | null;
  created_at: string;
}
type MailInsert = {
  id?: string;
  company_id: string;
  direction: MailDirection;
  subject: string;
  body?: string | null;
  from_name?: string | null;
  to_name?: string | null;
  status?: string | null;
  related_document_id?: string | null;
  created_by?: string | null;
  created_at?: string;
};

export interface Contact {
  id: string;
  company_id: string | null;
  full_name: string;
  title: string | null;
  organization: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
}
type ContactInsert = {
  id?: string;
  company_id?: string | null;
  full_name: string;
  title?: string | null;
  organization?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  created_at?: string;
};

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}
type AuditLogInsert = {
  id?: string;
  actor_id?: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  payload?: Record<string, unknown> | null;
  created_at?: string;
};

type TableDef<R, I> = {
  Row: R;
  Insert: I;
  Update: Partial<I>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      companies: TableDef<Company, CompanyInsert>;
      profiles: TableDef<Profile, ProfileInsert>;
      attendance: TableDef<Attendance, AttendanceInsert>;
      documents: TableDef<DocumentRow, DocumentInsert>;
      mail: TableDef<Mail, MailInsert>;
      contacts: TableDef<Contact, ContactInsert>;
      audit_log: TableDef<AuditLog, AuditLogInsert>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      attendance_status: AttendanceStatus;
      document_category: DocumentCategory;
      mail_direction: MailDirection;
    };
    CompositeTypes: Record<string, never>;
  };
}
