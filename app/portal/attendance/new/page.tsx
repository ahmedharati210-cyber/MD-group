import { redirect } from "next/navigation";
import { requireAttendanceAccess } from "@/lib/auth";

export const metadata = { title: "إضافة سجل حضور" };

export default async function NewAttendancePage() {
  await requireAttendanceAccess();
  redirect("/portal/attendance");
}
