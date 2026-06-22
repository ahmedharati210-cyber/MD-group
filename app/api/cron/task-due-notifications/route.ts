import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { dispatchProjectNotification } from "@/lib/push/dispatch-project-notification";

type DueTaskRow = {
  id: string;
  title: string;
  project_id: string;
  projects: { company_id: string; name: string } | { company_id: string; name: string }[] | null;
};

function projectFromTaskRow(row: DueTaskRow): { company_id: string; name: string } | null {
  const projects = row.projects;
  if (!projects) return null;
  return Array.isArray(projects) ? (projects[0] ?? null) : projects;
}

function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function runTaskDueNotificationsCron(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }

  if (!authorizeCron(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const now = new Date();

  const { data: fallbackSenders } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "md_admin")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1);

  const defaultSender = fallbackSenders?.[0]?.id ?? null;
  if (!defaultSender) {
    console.error("[cron/task-due-notifications] No md_admin profile for sender_id");
    return NextResponse.json(
      { ok: false, error: "No md_admin sender available" },
      { status: 500 },
    );
  }

  const threeDaysFromNow = new Date(now);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const fourDaysFromNow = new Date(now);
  fourDaysFromNow.setDate(fourDaysFromNow.getDate() + 4);

  const { data: dueTasks, error: tasksErr } = await admin
    .from("project_tasks")
    .select("id, title, project_id, projects(company_id, name)")
    .eq("is_completed", false)
    .is("task_due_notified_at", null)
    .not("due_date", "is", null)
    .gte("due_date", threeDaysFromNow.toISOString())
    .lte("due_date", fourDaysFromNow.toISOString());

  if (tasksErr) {
    console.error("[cron/task-due-notifications]", tasksErr);
    return NextResponse.json({ ok: false, error: tasksErr.message }, { status: 500 });
  }

  const tasks = (dueTasks ?? []) as DueTaskRow[];
  let tasksNotified = 0;

  for (const task of tasks) {
    const project = projectFromTaskRow(task);
    const companyId = project?.company_id;
    const projectName = project?.name;
    if (!companyId || !projectName) {
      console.warn("[cron/task-due-notifications] Missing project for task", task.id);
      continue;
    }

    const message = `المهمة «${task.title}» في مشروع «${projectName}» ستنتهي خلال 3 أيام.`;

    await dispatchProjectNotification({
      companyId,
      senderId: defaultSender,
      message,
    });

    const { error: upErr } = await admin
      .from("project_tasks")
      .update({ task_due_notified_at: new Date().toISOString() })
      .eq("id", task.id);

    if (upErr) {
      console.error("[cron/task-due-notifications] update task", task.id, upErr);
      continue;
    }

    tasksNotified += 1;
  }

  if (tasksNotified > 0) {
    revalidateTag("warnings", "default");
    revalidateTag("badges", "default");
  }

  return NextResponse.json({
    ok: true,
    candidates: tasks.length,
    tasksNotified,
  });
}

export async function GET(req: Request) {
  return runTaskDueNotificationsCron(req);
}

export async function POST(req: Request) {
  return runTaskDueNotificationsCron(req);
}
