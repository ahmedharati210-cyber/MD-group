import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  buildEmployeeDirectoryWorkbook,
  DIRECTORY_HEADERS,
  employeeDirectoryFileName,
  mapProfileToDirectoryRow,
  MD_GROUP_LABEL,
  NO_COMPANY_LABEL,
  type EmployeeDirectorySource,
} from "@/lib/employees/directory-export";

function source(
  overrides: Partial<EmployeeDirectorySource> = {},
): EmployeeDirectorySource {
  return {
    full_name: "حمزه مهني",
    phone: "0911690100",
    job_title: "مهندس/ مدير المشاريع",
    national_id: null,
    hired_at: "2024-11-01",
    is_active: true,
    date_of_birth: "1992-12-01",
    gender: "male",
    nationality: "سوداني",
    address: "سوق الجمعة",
    department: "القسم الهندسي",
    contract_type: "full_time",
    contract_end_date: null,
    passport_number: "P13435102",
    blood_type: "O+",
    education_level: "bachelor",
    emergency_contact_name: "عبود كتر",
    emergency_contact_phone: "0946141259",
    emergency_contact_relationship: "عم",
    external_employee_number: "4",
    role: "employee",
    companyName: "شركة إعمار",
    email: "hamzamhani44@gmail.com",
    ...overrides,
  };
}

async function loadWorkbook(data: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data as unknown as ExcelJS.Buffer);
  return workbook;
}

describe("mapProfileToDirectoryRow", () => {
  it("maps HR enums to Arabic labels and falls back to no-company", () => {
    const row = mapProfileToDirectoryRow(
      source({ companyName: "  ", gender: "female", is_active: false }),
    );
    expect(row.companyName).toBe(NO_COMPANY_LABEL);
    expect(row.gender).toBe("أنثى");
    expect(row.educationLevel).toBe("بكالوريوس");
    expect(row.contractType).toBe("دوام كامل");
    expect(row.role).toBe("موظف");
    expect(row.status).toBe("غير نشط");
    expect(row.dateOfBirth).toBe("1992-12-01");
  });

  it("groups company-less md_admin / owner profiles under MD Group, not 'no company'", () => {
    const admin = mapProfileToDirectoryRow(
      source({ companyName: null, role: "md_admin" }),
    );
    expect(admin.companyName).toBe(MD_GROUP_LABEL);

    const owner = mapProfileToDirectoryRow(
      source({ companyName: null, role: "owner" }),
    );
    expect(owner.companyName).toBe(MD_GROUP_LABEL);

    const employee = mapProfileToDirectoryRow(
      source({ companyName: null, role: "employee" }),
    );
    expect(employee.companyName).toBe(NO_COMPANY_LABEL);
  });

  it("canonicalizes any differently-cased 'MD Group' company row to the same label", () => {
    const upper = mapProfileToDirectoryRow(
      source({ companyName: "MD GROUP", role: "company_manager" }),
    );
    expect(upper.companyName).toBe(MD_GROUP_LABEL);

    const mixed = mapProfileToDirectoryRow(
      source({ companyName: "  md group  ", role: "employee" }),
    );
    expect(mixed.companyName).toBe(MD_GROUP_LABEL);
  });
});

describe("buildEmployeeDirectoryWorkbook", () => {
  it("writes RTL sheet, full headers, merged company cells, and a blank group separator", async () => {
    const rows = [
      mapProfileToDirectoryRow(source()),
      mapProfileToDirectoryRow(
        source({
          full_name: "محمد القبور",
          email: "Maddness13new@gmail.com",
          external_employee_number: "5",
        }),
      ),
      mapProfileToDirectoryRow(
        source({
          full_name: "خيري العائب",
          companyName: "MD GROUP",
          job_title: "شؤون إدارية",
          department: "الإدارة العامة",
          email: "Khayri472@gmail.com",
          role: "company_manager",
        }),
      ),
    ];

    const buffer = await buildEmployeeDirectoryWorkbook(rows);
    const workbook = await loadWorkbook(buffer);
    const sheet = workbook.worksheets[0];

    expect(sheet.name).toBe("دليل الموظفين");
    expect(sheet.views[0]?.rightToLeft).toBe(true);
    expect(DIRECTORY_HEADERS).toHaveLength(23);

    DIRECTORY_HEADERS.forEach((label, index) => {
      expect(sheet.getRow(1).getCell(index + 1).value).toBe(label);
    });

    expect(sheet.getCell("A2").value).toBe("شركة إعمار");
    expect(sheet.getCell("B2").value).toBe("حمزه مهني");
    expect(sheet.getCell("C2").value).toBe("4");
    expect(sheet.getCell("D2").value).toBe("0911690100");
    expect(sheet.getCell("L2").value).toBe("القسم الهندسي");
    expect(sheet.getCell("W2").value).toBe("نشط");

    const merged = [...sheet.model.merges];
    expect(merged).toContain("A2:A3");

    expect(sheet.getCell("A4").value).toBeNull();
    expect(sheet.getCell("B4").value).toBeNull();
    expect(sheet.getCell("A5").value).toBe(MD_GROUP_LABEL);
    expect(sheet.getCell("B5").value).toBe("خيري العائب");
    expect(sheet.getCell("T5").value).toBe("مدير شركة");
  });
});

describe("employeeDirectoryFileName", () => {
  it("includes an ISO date stamp", () => {
    expect(employeeDirectoryFileName(new Date("2026-09-01T12:00:00Z"))).toBe(
      "دليل_الموظفين_2026-09-01.xlsx",
    );
  });
});
