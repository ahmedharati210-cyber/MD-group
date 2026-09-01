import "server-only";

import ExcelJS from "exceljs";
import { formatDate } from "@/lib/utils";
import type {
  BloodType,
  ContractType,
  EducationLevel,
  Gender,
  UserRole,
} from "@/types/db";

export const NO_COMPANY_LABEL = "بدون شركة";
/** md_admin / owner profiles never carry a company_id (group-wide roles, enforced by a
 * DB constraint) — group them under the MD Group headquarters label instead of "no company".
 * Also used to canonicalize any differently-cased "MD Group" company row so it merges into
 * a single group instead of appearing twice (e.g. "MD Group" vs "MD GROUP"). */
export const MD_GROUP_LABEL = "MD Group";

export const DIRECTORY_HEADERS = [
  "الشركـــــة",
  "اسم الموظف",
  "رقم الموظف (خارجي)",
  "رقم الهاتف",
  "تاريخ الميلاد",
  "الجنس",
  "الجنسية",
  "رقم جواز السفر",
  "الرقم الوطني",
  "العنوان",
  "المسمى الوظيفي",
  "الفرع / القسم",
  "تاريخ التوظيف",
  "اسم جهة اتصال الطوارئ",
  "رقم جهة اتصال الطوارئ",
  "الصلة",
  "المستوى التعليمي",
  "نوع العقد",
  "تاريخ انتهاء العقد",
  "الدور",
  "البريد الالكتروني",
  "فصيلة الدم",
  "الحالة",
] as const;

const COLUMN_WIDTHS = [
  25, 22.5, 18, 16, 14, 10, 12, 16, 16, 22, 22, 18, 14, 20, 18, 12, 16, 14, 16,
  16, 28, 12, 12,
];

const TEXT_COLUMNS = new Set([3, 4, 8, 9, 15, 21]);

export type EmployeeDirectoryRow = {
  companyName: string;
  fullName: string;
  externalEmployeeNumber: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  nationality: string | null;
  passportNumber: string | null;
  nationalId: string | null;
  address: string | null;
  jobTitle: string | null;
  department: string | null;
  hiredAt: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  educationLevel: string | null;
  contractType: string | null;
  contractEndDate: string | null;
  role: string | null;
  email: string | null;
  bloodType: string | null;
  status: string;
};

export type EmployeeDirectorySource = {
  full_name: string;
  phone: string | null;
  job_title: string | null;
  national_id: string | null;
  hired_at: string | null;
  is_active: boolean;
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
  external_employee_number: string | null;
  role: UserRole;
  companyName: string | null;
  email: string | null;
};

function genderLabel(value: Gender | null): string | null {
  if (value === "male") return "ذكر";
  if (value === "female") return "أنثى";
  return null;
}

function contractLabel(value: ContractType | null): string | null {
  if (value === "full_time") return "دوام كامل";
  if (value === "part_time") return "دوام جزئي";
  if (value === "contract") return "عقد مؤقت";
  if (value === "intern") return "متدرب";
  return null;
}

function educationLabel(value: EducationLevel | null): string | null {
  const map: Record<EducationLevel, string> = {
    high_school: "ثانوي",
    diploma: "دبلوم",
    bachelor: "بكالوريوس",
    master: "ماجستير",
    phd: "دكتوراه",
    other: "أخرى",
  };
  return value ? (map[value] ?? null) : null;
}

function roleLabel(role: UserRole): string {
  if (role === "md_admin") return "مدير MD Group";
  if (role === "company_manager") return "مدير شركة";
  if (role === "owner") return "مالك";
  return "موظف";
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isMdGroupName(name: string): boolean {
  return name.trim().toLowerCase() === MD_GROUP_LABEL.toLowerCase();
}

function resolveCompanyLabel(
  companyName: string | null,
  role: UserRole,
): string {
  const name = emptyToNull(companyName);
  if (name) return isMdGroupName(name) ? MD_GROUP_LABEL : name;
  return role === "md_admin" || role === "owner"
    ? MD_GROUP_LABEL
    : NO_COMPANY_LABEL;
}

export function mapProfileToDirectoryRow(
  source: EmployeeDirectorySource,
): EmployeeDirectoryRow {
  return {
    companyName: resolveCompanyLabel(source.companyName, source.role),
    fullName: source.full_name,
    externalEmployeeNumber: emptyToNull(source.external_employee_number),
    phone: emptyToNull(source.phone),
    dateOfBirth: formatDate(source.date_of_birth) || null,
    gender: genderLabel(source.gender),
    nationality: emptyToNull(source.nationality),
    passportNumber: emptyToNull(source.passport_number),
    nationalId: emptyToNull(source.national_id),
    address: emptyToNull(source.address),
    jobTitle: emptyToNull(source.job_title),
    department: emptyToNull(source.department),
    hiredAt: formatDate(source.hired_at) || null,
    emergencyContactName: emptyToNull(source.emergency_contact_name),
    emergencyContactPhone: emptyToNull(source.emergency_contact_phone),
    emergencyContactRelationship: emptyToNull(
      source.emergency_contact_relationship,
    ),
    educationLevel: educationLabel(source.education_level),
    contractType: contractLabel(source.contract_type),
    contractEndDate: formatDate(source.contract_end_date) || null,
    role: roleLabel(source.role),
    email: emptyToNull(source.email),
    bloodType: emptyToNull(source.blood_type),
    status: source.is_active ? "نشط" : "غير نشط",
  };
}

function rowValues(row: EmployeeDirectoryRow): Array<string | null> {
  return [
    row.companyName,
    row.fullName,
    row.externalEmployeeNumber,
    row.phone,
    row.dateOfBirth,
    row.gender,
    row.nationality,
    row.passportNumber,
    row.nationalId,
    row.address,
    row.jobTitle,
    row.department,
    row.hiredAt,
    row.emergencyContactName,
    row.emergencyContactPhone,
    row.emergencyContactRelationship,
    row.educationLevel,
    row.contractType,
    row.contractEndDate,
    row.role,
    row.email,
    row.bloodType,
    row.status,
  ];
}

function groupByCompany(
  rows: EmployeeDirectoryRow[],
): { name: string; rows: EmployeeDirectoryRow[] }[] {
  const groups: { name: string; rows: EmployeeDirectoryRow[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.name === row.companyName) {
      last.rows.push(row);
    } else {
      groups.push({ name: row.companyName, rows: [row] });
    }
  }
  return groups;
}

const headerFill: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF4472C4" },
};

const headerFont: Partial<ExcelJS.Font> = {
  name: "Calibri",
  size: 16,
  bold: true,
  color: { argb: "FFFFFFFF" },
};

const dataFont: Partial<ExcelJS.Font> = {
  name: "Calibri",
  size: 12,
};

const centerAlign: Partial<ExcelJS.Alignment> = {
  horizontal: "center",
  vertical: "middle",
  wrapText: true,
};

const boxBorder: Partial<ExcelJS.Borders> = {
  top: { style: "medium", color: { argb: "FF000000" } },
  bottom: { style: "medium", color: { argb: "FF000000" } },
  left: { style: "medium", color: { argb: "FF000000" } },
  right: { style: "medium", color: { argb: "FF000000" } },
};

const verticalBorder: Partial<ExcelJS.Borders> = {
  left: { style: "medium", color: { argb: "FF000000" } },
  right: { style: "medium", color: { argb: "FF000000" } },
};

function applyCellStyle(
  cell: ExcelJS.Cell,
  opts: {
    font: Partial<ExcelJS.Font>;
    border: Partial<ExcelJS.Borders>;
    fill?: ExcelJS.Fill;
    text?: boolean;
  },
): void {
  cell.font = opts.font;
  cell.alignment = centerAlign;
  cell.border = opts.border;
  if (opts.fill) cell.fill = opts.fill;
  if (opts.text) cell.numFmt = "@";
}

function writeHeader(sheet: ExcelJS.Worksheet): void {
  const headerRow = sheet.getRow(1);
  headerRow.height = 21.75;
  DIRECTORY_HEADERS.forEach((label, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = label;
    applyCellStyle(cell, {
      font: headerFont,
      border: boxBorder,
      fill: headerFill,
    });
  });
}

function writeEmployeeRow(
  sheet: ExcelJS.Worksheet,
  excelRowIndex: number,
  row: EmployeeDirectoryRow,
): void {
  const excelRow = sheet.getRow(excelRowIndex);
  excelRow.height = 18.75;
  rowValues(row).forEach((value, index) => {
    const cell = excelRow.getCell(index + 1);
    cell.value = value ?? "";
    applyCellStyle(cell, {
      font: dataFont,
      border: verticalBorder,
      text: TEXT_COLUMNS.has(index + 1),
    });
  });
}

export async function buildEmployeeDirectoryWorkbook(
  rows: EmployeeDirectoryRow[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MD Group Portal";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("دليل الموظفين", {
    views: [{ rightToLeft: true }],
  });

  sheet.columns = COLUMN_WIDTHS.map((width) => ({ width }));
  writeHeader(sheet);

  let excelRowIndex = 2;
  const groups = groupByCompany(rows);

  groups.forEach((group, groupIndex) => {
    const startRow = excelRowIndex;
    for (const employee of group.rows) {
      writeEmployeeRow(sheet, excelRowIndex, employee);
      excelRowIndex += 1;
    }
    const endRow = excelRowIndex - 1;
    if (endRow > startRow) {
      sheet.mergeCells(startRow, 1, endRow, 1);
    }
    const companyCell = sheet.getCell(startRow, 1);
    companyCell.value = group.name;
    applyCellStyle(companyCell, {
      font: { ...dataFont, size: 14 },
      border: boxBorder,
    });

    if (groupIndex < groups.length - 1) {
      excelRowIndex += 1;
    }
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export function employeeDirectoryFileName(now = new Date()): string {
  const date = formatDate(now) || now.toISOString().slice(0, 10);
  return `دليل_الموظفين_${date}.xlsx`;
}
