/**
 * Supabase database types. Keep in sync with migrations.
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
export type TradeCategory =
  | "laborer"
  | "technician"
  | "mechanic"
  | "electrician"
  | "other";

export type AppFeature =
  | "attendance"
  | "papers"
  | "mail"
  | "contacts"
  | "timeline"
  | "reports"
  | "requests"
  | "claims"
  | "maps"
  | "warnings";

export const ALL_FEATURES: AppFeature[] = [
  "attendance",
  "papers",
  "mail",
  "contacts",
  "timeline",
  "reports",
  "requests",
  "claims",
  "maps",
  "warnings",
];

/**
 * Per-role feature visibility overrides stored in companies.role_features.
 * null = role sees all of the company's enabled_features.
 */
export type RoleFeatures = {
  company_manager?: AppFeature[];
  employee?: AppFeature[];
};

export interface Company {
  id: string;
  name_ar: string;
  name_en: string | null;
  slug: string;
  logo_url: string | null;
  active: boolean;
  /** null = all features enabled; array = only listed features enabled */
  enabled_features: AppFeature[] | null;
  /** null = each role sees all enabled_features; object = per-role overrides */
  role_features: RoleFeatures | null;
  created_at: string;
}
type CompanyInsert = {
  id?: string;
  name_ar: string;
  name_en?: string | null;
  slug: string;
  logo_url?: string | null;
  active?: boolean;
  enabled_features?: AppFeature[] | null;
  role_features?: RoleFeatures | null;
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
  is_super_admin: boolean;
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
  is_super_admin?: boolean;
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
  trade_category: TradeCategory | null;
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
  trade_category?: TradeCategory | null;
  created_at?: string;
};

// ---------------------------------------------------------------------------
// Sites (used by timeline, reports, maps)
// ---------------------------------------------------------------------------
export interface Site {
  id: string;
  company_id: string;
  name: string;
  location_notes: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  manager_email: string | null;
  default_engineer_id: string | null;
  is_active: boolean;
  created_at: string;
}
type SiteInsert = {
  id?: string;
  company_id: string;
  name: string;
  location_notes?: string | null;
  manager_name?: string | null;
  manager_phone?: string | null;
  manager_email?: string | null;
  default_engineer_id?: string | null;
  is_active?: boolean;
  created_at?: string;
};

// ---------------------------------------------------------------------------
// Legacy planning tables (kept in DB, UI removed)
// ---------------------------------------------------------------------------
export type TaskStatus = "todo" | "in_progress" | "done" | "blocked";
export type TaskPriority = "normal" | "urgent" | "emergency";

export interface PlanningTask {
  id: string;
  company_id: string;
  site_id: string | null;
  assigned_profile_id: string | null;
  task_date: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanningTaskNote {
  id: string;
  task_id: string;
  author_profile_id: string | null;
  body: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Timeline module (Project = Site for Emaar Al Youm)
// ---------------------------------------------------------------------------
export type ProjectStatus =
  | "planning"
  | "active"
  | "completed"
  | "maintenance"
  | "survey"
  | "on_hold";

export interface Project {
  id: string;
  company_id: string;
  /** Legacy FK kept for DB compat; project now carries its own location fields */
  site_id: string | null;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: ProjectStatus;
  /** Location / site info merged into project */
  location_notes: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  manager_email: string | null;
  default_engineer_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
type ProjectInsert = {
  id?: string;
  company_id: string;
  site_id?: string | null;
  name: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: ProjectStatus;
  location_notes?: string | null;
  manager_name?: string | null;
  manager_phone?: string | null;
  manager_email?: string | null;
  default_engineer_id?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export interface ProjectCategory {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}
type ProjectCategoryInsert = {
  id?: string;
  project_id: string;
  name: string;
  sort_order?: number;
  created_at?: string;
};

export interface ProjectTask {
  id: string;
  category_id: string;
  project_id: string;
  title: string;
  description: string | null;
  notes: string | null;
  assigned_to: string | null;
  due_date: string | null;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
}
type ProjectTaskInsert = {
  id?: string;
  category_id: string;
  project_id: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  assigned_to?: string | null;
  due_date?: string | null;
  is_completed?: boolean;
  completed_by?: string | null;
  completed_at?: string | null;
  sort_order?: number;
  created_at?: string;
};

// ---------------------------------------------------------------------------
// Reports module
// ---------------------------------------------------------------------------
export type ReportType = "daily" | "weekly";

export interface EngineerReport {
  id: string;
  company_id: string;
  /** Legacy FK to sites — no longer used by UI */
  site_id: string | null;
  /** New FK to projects (projects = sites in Emaar Al Youm) */
  project_id: string | null;
  author_id: string;
  report_type: ReportType;
  report_date: string;
  work_done: string | null;
  materials_used: string | null;
  workers_count: number | null;
  notes: string | null;
  created_at: string;
}
type EngineerReportInsert = {
  id?: string;
  company_id: string;
  site_id?: string | null;
  project_id?: string | null;
  author_id: string;
  report_type?: ReportType;
  report_date: string;
  work_done?: string | null;
  materials_used?: string | null;
  workers_count?: number | null;
  notes?: string | null;
  created_at?: string;
};

// ---------------------------------------------------------------------------
// Requests module
// ---------------------------------------------------------------------------
export type RequestType = "vacation" | "day_off" | "advance" | "equipment" | "other";
export type RequestStatus = "pending" | "approved" | "rejected";

export interface EngineerRequest {
  id: string;
  company_id: string;
  requester_id: string;
  request_type: RequestType;
  description: string;
  requested_date: string | null;
  status: RequestStatus;
  manager_response: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
}
type EngineerRequestInsert = {
  id?: string;
  company_id: string;
  requester_id: string;
  request_type: RequestType;
  description: string;
  requested_date?: string | null;
  status?: RequestStatus;
  manager_response?: string | null;
  responded_by?: string | null;
  responded_at?: string | null;
  created_at?: string;
};

// ---------------------------------------------------------------------------
// Claims module
// ---------------------------------------------------------------------------
export interface ManagerClaim {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  amount: number | null;
  file_url: string | null;
  created_by: string | null;
  created_at: string;
}
type ManagerClaimInsert = {
  id?: string;
  company_id: string;
  title: string;
  description?: string | null;
  amount?: number | null;
  file_url?: string | null;
  created_by?: string | null;
  created_at?: string;
};

// ---------------------------------------------------------------------------
// Maps module
// ---------------------------------------------------------------------------
export interface MapLink {
  id: string;
  company_id: string;
  /** Legacy FK to sites — no longer used by UI */
  site_id: string | null;
  /** New FK to projects (projects = sites in Emaar Al Youm) */
  project_id: string | null;
  name: string;
  description: string | null;
  drive_url: string;
  created_by: string | null;
  created_at: string;
}
type MapLinkInsert = {
  id?: string;
  company_id: string;
  site_id?: string | null;
  project_id?: string | null;
  name: string;
  description?: string | null;
  drive_url: string;
  created_by?: string | null;
  created_at?: string;
};

// ---------------------------------------------------------------------------
// Warnings module
// ---------------------------------------------------------------------------
export interface Warning {
  id: string;
  company_id: string;
  sender_id: string;
  target_profile_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}
type WarningInsert = {
  id?: string;
  company_id: string;
  sender_id: string;
  target_profile_id?: string | null;
  message: string;
  is_read?: boolean;
  created_at?: string;
};

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
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
      sites: TableDef<Site, SiteInsert>;
      projects: TableDef<Project, ProjectInsert>;
      project_categories: TableDef<ProjectCategory, ProjectCategoryInsert>;
      project_tasks: TableDef<ProjectTask, ProjectTaskInsert>;
      engineer_reports: TableDef<EngineerReport, EngineerReportInsert>;
      engineer_requests: TableDef<EngineerRequest, EngineerRequestInsert>;
      manager_claims: TableDef<ManagerClaim, ManagerClaimInsert>;
      map_links: TableDef<MapLink, MapLinkInsert>;
      warnings: TableDef<Warning, WarningInsert>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      attendance_status: AttendanceStatus;
      document_category: DocumentCategory;
      mail_direction: MailDirection;
      task_status: TaskStatus;
      task_priority: TaskPriority;
      project_status: ProjectStatus;
      report_type: ReportType;
      request_type: RequestType;
      request_status: RequestStatus;
      trade_category: TradeCategory;
    };
    CompositeTypes: Record<string, never>;
  };
}
