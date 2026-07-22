/**
 * Supabase database types. Keep in sync with migrations.
 * Eventually replace with `supabase gen types typescript` output.
 */

export type UserRole = "md_admin" | "company_manager" | "employee" | "owner";
export type AttendanceStatus = "present" | "absent" | "late" | "leave";
export type DocumentCategory =
  | "letter"
  | "contract"
  | "memo"
  | "personal"
  | "other"
  | "record"
  | "license"
  | "stats_code"
  | "chamber"
  | "statistics_code";
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
  | "warnings"
  /** Dolce / «الطريق الصحيح» employee signup links & signup-requests queue */
  | "employee_signup";

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
  "employee_signup",
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
  /** Lower value = earlier in company grids (admin + public). */
  display_order: number;
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
  display_order?: number;
  enabled_features?: AppFeature[] | null;
  role_features?: RoleFeatures | null;
  created_at?: string;
};

export type Gender = "male" | "female";
export type ContractType = "full_time" | "part_time" | "contract" | "intern";
export type BloodType = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
export type EducationLevel = "high_school" | "diploma" | "bachelor" | "master" | "phd" | "other";

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
  /** Super-admin grant: receive automated project/task notifications. */
  project_notifications_enabled: boolean;
  /** Super-admin grant: access Al Itqan testing module. */
  testing_access_enabled: boolean;
  created_at: string;
  // Extended HR fields
  date_of_birth: string | null;
  gender: Gender | null;
  nationality: string | null;
  address: string | null;
  department: string | null;
  contract_type: ContractType | null;
  contract_end_date: string | null;
  passport_number: string | null;
  blood_type: BloodType | null;
  education_level: EducationLevel | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  hr_notes: string | null;
  /** Payroll / external attendance card ID (not portal internal ids). */
  external_employee_number: string | null;
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
  project_notifications_enabled?: boolean;
  testing_access_enabled?: boolean;
  created_at?: string;
  date_of_birth?: string | null;
  gender?: Gender | null;
  nationality?: string | null;
  address?: string | null;
  department?: string | null;
  contract_type?: ContractType | null;
  contract_end_date?: string | null;
  passport_number?: string | null;
  blood_type?: BloodType | null;
  education_level?: EducationLevel | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
  hr_notes?: string | null;
  external_employee_number?: string | null;
};

export interface AttendancePerson {
  id: string;
  company_id: string;
  branch_id: string;
  external_employee_number: string;
  full_name: string;
  active: boolean;
  first_seen_at: string;
  last_seen_at: string;
  notes: string | null;
  raw_department_hint: string | null;
  shift_id: string | null;
  /** Personal schedule start (HH:MM). Both start and end required for custom matching. */
  custom_start_time: string | null;
  custom_end_time: string | null;
  custom_crosses_midnight: boolean;
  custom_late_grace_minutes: number;
  custom_early_leave_grace_minutes: number;
  /** JS getDay() 0–6. null = all days. */
  custom_work_days: number[] | null;
  created_at: string;
}
type AttendancePersonInsert = {
  id?: string;
  company_id: string;
  branch_id: string;
  external_employee_number: string;
  full_name: string;
  active?: boolean;
  first_seen_at?: string;
  last_seen_at?: string;
  notes?: string | null;
  raw_department_hint?: string | null;
  shift_id?: string | null;
  custom_start_time?: string | null;
  custom_end_time?: string | null;
  custom_crosses_midnight?: boolean;
  custom_late_grace_minutes?: number;
  custom_early_leave_grace_minutes?: number;
  custom_work_days?: number[] | null;
  created_at?: string;
};

export type AttendanceImportStatus = "imported" | "finalized";

export interface AttendanceBranch {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  active: boolean;
  display_order: number;
  /** Total worked minutes that triggers "دوام كامل" classification. */
  full_time_threshold_minutes: number;
  /** Expected work minutes on a full-time day. */
  full_time_expected_minutes: number;
  created_at: string;
}
type AttendanceBranchInsert = {
  id?: string;
  company_id: string;
  name: string;
  code?: string | null;
  active?: boolean;
  display_order?: number;
  full_time_threshold_minutes?: number;
  full_time_expected_minutes?: number;
  created_at?: string;
};

export interface AttendanceShift {
  id: string;
  company_id: string;
  branch_id: string;
  name: string;
  start_time: string;
  end_time: string;
  crosses_midnight: boolean;
  checkout_cutoff_time: string | null;
  expected_minutes: number;
  late_grace_minutes: number;
  early_leave_grace_minutes: number;
  check_in_window_start: string | null;
  check_in_window_end: string | null;
  check_out_window_start: string | null;
  check_out_window_end: string | null;
  /** JS getDay() 0-6. null = all days; empty = none. */
  work_days: number[] | null;
  active: boolean;
  display_order: number;
  created_at: string;
}
type AttendanceShiftInsert = {
  id?: string;
  company_id: string;
  branch_id: string;
  name: string;
  start_time: string;
  end_time: string;
  crosses_midnight?: boolean;
  checkout_cutoff_time?: string | null;
  expected_minutes: number;
  late_grace_minutes?: number;
  early_leave_grace_minutes?: number;
  check_in_window_start?: string | null;
  check_in_window_end?: string | null;
  check_out_window_start?: string | null;
  check_out_window_end?: string | null;
  work_days?: number[] | null;
  active?: boolean;
  display_order?: number;
  created_at?: string;
};

export interface AttendanceImport {
  id: string;
  company_id: string;
  branch_id: string;
  month: string;
  file_name: string | null;
  status: AttendanceImportStatus;
  created_by: string | null;
  matched_count: number;
  unmatched_count: number;
  warning_summary: Record<string, unknown> | null;
  created_at: string;
}
type AttendanceImportInsert = {
  id?: string;
  company_id: string;
  branch_id: string;
  month: string;
  file_name?: string | null;
  status?: AttendanceImportStatus;
  created_by?: string | null;
  matched_count?: number;
  unmatched_count?: number;
  warning_summary?: Record<string, unknown> | null;
  created_at?: string;
};

export interface AttendanceMonthlyRecord {
  id: string;
  import_id: string;
  company_id: string;
  branch_id: string;
  attendance_person_id: string | null;
  profile_id: string | null;
  external_employee_number: string;
  employee_name: string;
  date: string;
  first_check_in: string | null;
  last_check_out: string | null;
  total_minutes: number | null;
  shift_type: string | null;
  expected_minutes: number | null;
  late_minutes: number;
  early_leave_minutes: number;
  overtime_minutes: number;
  deduction_minutes: number;
  is_holiday: boolean;
  is_absent: boolean;
  leave_type: string | null;
  notes: string | null;
  raw_payload: Record<string, unknown> | null;
  shift_id: string | null;
  punch_count: number | null;
  created_at: string;
}
type AttendanceMonthlyRecordInsert = {
  id?: string;
  import_id: string;
  company_id: string;
  branch_id: string;
  attendance_person_id?: string | null;
  profile_id?: string | null;
  external_employee_number: string;
  employee_name: string;
  date: string;
  first_check_in?: string | null;
  last_check_out?: string | null;
  total_minutes?: number | null;
  shift_type?: string | null;
  expected_minutes?: number | null;
  late_minutes?: number;
  early_leave_minutes?: number;
  overtime_minutes?: number;
  deduction_minutes?: number;
  is_holiday?: boolean;
  is_absent?: boolean;
  leave_type?: string | null;
  notes?: string | null;
  raw_payload?: Record<string, unknown> | null;
  shift_id?: string | null;
  punch_count?: number | null;
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
  /** Official issue date of the paper (optional). */
  issued_on: string | null;
  /** Expiry date; managers get in-app warning in the final month before this date. */
  expires_on: string | null;
  /** When automated expiry warnings were created for this document. */
  expiry_notified_at: string | null;
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
  issued_on?: string | null;
  expires_on?: string | null;
  expiry_notified_at?: string | null;
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
  | "on_hold"
  | "on_hold_claim"
  | "done";

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
  /** Manual client-entered estimate; not summed from tasks/categories */
  estimated_days: number | null;
  /** Date the estimate was last set — used to calculate remaining days countdown */
  estimated_days_set_at: string | null;
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
  estimated_days?: number | null;
  estimated_days_set_at?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export interface ProjectCategory {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  estimated_days: number | null;
  estimated_days_set_at: string | null;
  created_at: string;
}
type ProjectCategoryInsert = {
  id?: string;
  project_id: string;
  name: string;
  sort_order?: number;
  estimated_days?: number | null;
  estimated_days_set_at?: string | null;
  created_at?: string;
};

/** Private draft notes on a project/category; visible to author + superadmin only (RLS). */
export interface ProjectPersonalDraft {
  id: string;
  author_id: string;
  project_id: string;
  category_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}
type ProjectPersonalDraftInsert = {
  id?: string;
  author_id: string;
  project_id: string;
  category_id?: string | null;
  body: string;
  created_at?: string;
  updated_at?: string;
};

export type TaskWorkStatus = "in_progress" | null;

export type QaProjectStatus = "active" | "done";
export type QaTestResult = "pass" | "bug" | "improve";

export interface QaProject {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  status: QaProjectStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
type QaProjectInsert = {
  id?: string;
  company_id: string;
  name: string;
  description?: string | null;
  status?: QaProjectStatus;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export interface QaSection {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}
type QaSectionInsert = {
  id?: string;
  project_id: string;
  name: string;
  sort_order?: number;
  created_at?: string;
};

export interface QaTestItem {
  id: string;
  section_id: string;
  project_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  result: QaTestResult | null;
  result_note: string | null;
  tested_by: string | null;
  tested_at: string | null;
  sort_order: number;
  created_at: string;
}
type QaTestItemInsert = {
  id?: string;
  section_id: string;
  project_id: string;
  title: string;
  description?: string | null;
  assigned_to?: string | null;
  result?: QaTestResult | null;
  result_note?: string | null;
  tested_by?: string | null;
  tested_at?: string | null;
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
  estimated_days: number | null;
  estimated_days_set_at: string | null;
  task_status: TaskWorkStatus;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  sort_order: number;
  task_due_notified_at: string | null;
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
  estimated_days?: number | null;
  estimated_days_set_at?: string | null;
  task_status?: TaskWorkStatus;
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
  project_id: string | null;
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
  project_id?: string | null;
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
// Warnings / notifications center (table: warnings)
// ---------------------------------------------------------------------------
export type WarningKind = "warning" | "notification";

export interface Warning {
  id: string;
  company_id: string;
  sender_id: string;
  target_profile_id: string | null;
  message: string;
  kind: WarningKind;
  is_read: boolean;
  created_at: string;
}
type WarningInsert = {
  id?: string;
  company_id: string;
  sender_id: string;
  target_profile_id?: string | null;
  message: string;
  kind?: WarningKind;
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

// ---------------------------------------------------------------------------
// Employee self-signup (invite link → manager approval)
// ---------------------------------------------------------------------------
export type EmployeeSignupStatus = "draft" | "pending" | "approved" | "rejected";

export interface EmployeeSignupInvite {
  id: string;
  company_id: string;
  invite_token: string;
  token_expires_at: string;
  max_uses: number;
  use_count: number;
  created_by: string | null;
  created_at: string;
}

type EmployeeSignupInviteInsert = {
  id?: string;
  company_id: string;
  invite_token: string;
  token_expires_at: string;
  max_uses?: number;
  use_count?: number;
  created_by?: string | null;
  created_at?: string;
};

export interface EmployeeSignupRequest {
  id: string;
  company_id: string;
  invite_token: string;
  token_expires_at: string;
  token_used: boolean;
  invite_id: string | null;
  created_by: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  national_id: string | null;
  job_title: string | null;
  department: string | null;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  address: string | null;
  blood_type: string | null;
  passport_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  external_employee_number: string | null;
  passport_image_path: string | null;
  status: EmployeeSignupStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

type EmployeeSignupRequestInsert = {
  id?: string;
  company_id: string;
  invite_token: string;
  token_expires_at: string;
  token_used?: boolean;
  invite_id?: string | null;
  created_by?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  national_id?: string | null;
  job_title?: string | null;
  department?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  nationality?: string | null;
  address?: string | null;
  blood_type?: string | null;
  passport_number?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
  external_employee_number?: string | null;
  passport_image_path?: string | null;
  status?: EmployeeSignupStatus;
  rejection_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
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
      attendance_branches: TableDef<AttendanceBranch, AttendanceBranchInsert>;
      attendance_shifts: TableDef<AttendanceShift, AttendanceShiftInsert>;
      attendance_people: TableDef<AttendancePerson, AttendancePersonInsert>;
      attendance_imports: TableDef<AttendanceImport, AttendanceImportInsert>;
      attendance_monthly_records: TableDef<
        AttendanceMonthlyRecord,
        AttendanceMonthlyRecordInsert
      >;
      attendance: TableDef<Attendance, AttendanceInsert>;
      documents: TableDef<DocumentRow, DocumentInsert>;
      mail: TableDef<Mail, MailInsert>;
      contacts: TableDef<Contact, ContactInsert>;
      audit_log: TableDef<AuditLog, AuditLogInsert>;
      sites: TableDef<Site, SiteInsert>;
      projects: TableDef<Project, ProjectInsert>;
      project_categories: TableDef<ProjectCategory, ProjectCategoryInsert>;
      project_personal_drafts: TableDef<
        ProjectPersonalDraft,
        ProjectPersonalDraftInsert
      >;
      project_tasks: TableDef<ProjectTask, ProjectTaskInsert>;
      qa_projects: TableDef<QaProject, QaProjectInsert>;
      qa_sections: TableDef<QaSection, QaSectionInsert>;
      qa_test_items: TableDef<QaTestItem, QaTestItemInsert>;
      engineer_reports: TableDef<EngineerReport, EngineerReportInsert>;
      engineer_requests: TableDef<EngineerRequest, EngineerRequestInsert>;
      manager_claims: TableDef<ManagerClaim, ManagerClaimInsert>;
      map_links: TableDef<MapLink, MapLinkInsert>;
      warnings: TableDef<Warning, WarningInsert>;
      employee_signup_invites: TableDef<
        EmployeeSignupInvite,
        EmployeeSignupInviteInsert
      >;
      employee_signup_requests: TableDef<
        EmployeeSignupRequest,
        EmployeeSignupRequestInsert
      >;
    };
    Views: Record<string, never>;
    Functions: {
      reserve_invite_slot: {
        Args: { p_token: string };
        Returns: {
          invite_id: string;
          company_id: string;
          token_expires_at: string;
        }[];
      };
      release_invite_slot: {
        Args: { p_invite_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      user_role: UserRole;
      attendance_status: AttendanceStatus;
      attendance_import_status: AttendanceImportStatus;
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
