import { NextResponse, type NextRequest } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, tripoliTodayIso } from "@/lib/utils";
import { toDateOnlyIso } from "@/lib/paper-expiry";
import type { ProjectStatus, TaskWorkStatus } from "@/types/db";

export const maxDuration = 120;

const statusLabels: Record<ProjectStatus, string> = {
  planning:    "تصميم",
  active:      "انشاء (اعمال الهيكل)",
  completed:   "تشطيب",
  maintenance: "صيانة",
  survey:      "رفع مساحي",
  on_hold:       "متوقف",
  on_hold_claim: "متوقف ( مطالبة)",
  done:          "تم الانتهاء",
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  estimated_days: number | null;
  estimated_days_set_at: string | null;
  is_completed: boolean;
  task_status: TaskWorkStatus;
  sort_order: number;
  assignee: { full_name: string } | null;
};

type CategoryRow = {
  id: string;
  name: string;
  sort_order: number;
  estimated_days: number | null;
  estimated_days_set_at: string | null;
  tasks: TaskRow[];
};

function calcRemaining(days: number | null | undefined, setAt: string | null | undefined, today: string): number | null {
  if (days == null || days < 0) return null;
  if (!setAt) return days;
  const elapsed = Math.floor(
    (new Date(today).getTime() - new Date(setAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.max(0, days - elapsed);
}

function remainingLabel(days: number | null | undefined, setAt: string | null | undefined, today: string): string {
  const r = calcRemaining(days, setAt, today);
  if (r == null) return "—";
  if (r === 0) return "اليوم الأخير";
  return r === 1 ? "يوم واحد" : `${r} يوم`;
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeFilename(name: string): string {
  // HTTP headers must be ASCII — strip non-ASCII characters for the plain filename.
  const safe = name
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return safe || "project-timeline";
}

function contentDispositionHeader(projectName: string): string {
  const ascii = sanitizeFilename(projectName);
  // RFC 5987 encoding allows the browser to save with the full Unicode name.
  const encoded = encodeURIComponent(`${projectName}.pdf`);
  return `attachment; filename="${ascii}.pdf"; filename*=UTF-8''${encoded}`;
}

async function getBrowserExecutablePath(): Promise<string> {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.env.VERCEL) {
    return chromium.executablePath();
  }
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }
  if (process.platform === "win32") {
    return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  }
  return "/usr/bin/google-chrome";
}

async function renderPdfFromHtml(html: string): Promise<Uint8Array> {
  const executablePath = await getBrowserExecutablePath();
  const browser = await puppeteer.launch({
    args: process.env.VERCEL ? chromium.args : ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 794, height: 1123 },
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    await page.evaluateHandle("document.fonts.ready");
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "1.5cm", right: "1.5cm", bottom: "1.5cm", left: "1.5cm" },
    });
    return new Uint8Array(pdf);
  } finally {
    await browser.close();
  }
}

// Build a fully self-contained HTML document suitable for print-to-PDF
function buildHtml(
  project: {
    name: string;
    description: string | null;
    status: ProjectStatus;
    start_date: string | null;
    end_date: string | null;
    location_notes: string | null;
    manager_name: string | null;
    manager_phone: string | null;
    default_engineer: { full_name: string } | null;
    estimated_days: number | null;
    estimated_days_set_at: string | null;
  },
  categories: CategoryRow[],
  today: string,
): string {
  const allTasks = categories.flatMap((c) => c.tasks);
  const total = allTasks.length;
  const done = allTasks.filter((t) => t.is_completed).length;
  const overdue = allTasks.filter((t) => {
    const due = toDateOnlyIso(t.due_date);
    return !t.is_completed && due && due < today;
  }).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const printDate = new Date().toLocaleDateString("ar-LY", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Africa/Tripoli",
  });

  const categoriesHtml = categories
    .map((cat) => {
      const catDone = cat.tasks.filter((t) => t.is_completed).length;
      const tasksHtml =
        cat.tasks.length === 0
          ? `<tr><td colspan="5" style="color:#999;padding:8px 12px;">لا توجد مهام</td></tr>`
          : cat.tasks
              .map((task) => {
                const dueDateOnly = toDateOnlyIso(task.due_date);
                const isOverdue =
                  !task.is_completed && dueDateOnly && dueDateOnly < today;
                const checkbox = task.is_completed
                  ? `<span class="cb cb-done">✓</span>`
                  : `<span class="cb cb-empty"></span>`;
                const dueLabel = task.due_date ? formatDate(task.due_date) : "—";
                const statusLabel = task.is_completed ? "تم الانتهاء" : task.task_status === "in_progress" ? "قيد العمل" : "—";
                return `
              <tr class="${task.is_completed ? "done" : ""}${isOverdue ? " overdue" : ""}">
                <td class="td-cb">${checkbox}</td>
                <td class="td-title">
                  ${escapeHtml(task.title)}
                  ${task.description ? `<div class="sub">${escapeHtml(task.description)}</div>` : ""}
                </td>
                <td class="td-meta">${escapeHtml(statusLabel)}</td>
                <td class="td-meta">${remainingLabel(task.estimated_days, task.estimated_days_set_at, today)}</td>
                <td class="td-meta${isOverdue ? " overdue-text" : ""}">
                  ${escapeHtml(dueLabel)}${isOverdue ? " ⚠" : ""}
                </td>
              </tr>`;
              })
              .join("");

      return `
      <div class="cat-block">
        <div class="cat-header">
          <strong>${escapeHtml(cat.name)}</strong>
          <span>
            ${cat.estimated_days != null ? `متبقي: ${remainingLabel(cat.estimated_days, cat.estimated_days_set_at, today)} · ` : ""}
            ${catDone}/${cat.tasks.length} تم
          </span>
        </div>
        <table style="table-layout:fixed;width:100%">
          <colgroup>
            <col style="width:28px">
            <col>
            <col style="width:80px">
            <col style="width:88px">
            <col style="width:96px">
          </colgroup>
          <tbody>${tasksHtml}</tbody>
        </table>
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(project.name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4 portrait; margin: 1.5cm; }
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      direction: rtl;
      font-family: 'Cairo', 'Arial', sans-serif;
      font-size: 11pt;
      color: #111;
      background: #fff;
      margin: 0;
      padding: 0;
    }

    /* ── Project header ─────────────────────────────── */
    .page-header {
      border-bottom: 2px solid #111;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    h1 { font-size: 20pt; font-weight: 700; margin: 0 0 4px; }
    .project-desc { font-size: 10pt; color: #555; margin: 0; }
    .header-meta-right { text-align: left; font-size: 10pt; color: #555; flex-shrink: 0; }
    .header-meta-right .status { font-weight: 700; font-size: 11pt; color: #111; }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px 24px;
      margin-top: 10px;
      font-size: 10pt;
    }
    .meta-grid span { color: #555; }
    .meta-grid strong { color: #111; }

    /* ── Progress bar ──────────────────────────────── */
    .progress-bar-wrap {
      display: flex;
      align-items: center;
      gap: 16px;
      background: #f5f5f5;
      border-radius: 10px;
      padding: 10px 16px;
      margin-bottom: 20px;
      font-size: 10pt;
    }
    .pct { font-size: 16pt; font-weight: 700; }
    .overdue-label { color: #b91c1c; font-weight: 700; }
    .bar { flex: 1; height: 10px; background: #ddd; border-radius: 999px; overflow: hidden; }
    .bar-fill { height: 100%; background: #111; border-radius: 999px; }

    /* ── Category blocks ───────────────────────────── */
    .cat-block { break-inside: avoid; margin-bottom: 20px; }
    .cat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #eee;
      padding: 7px 14px;
      border-radius: 8px;
      margin-bottom: 2px;
      font-size: 11pt;
    }
    .cat-header span { font-size: 9pt; color: #666; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    tr { border-bottom: 1px solid #f0f0f0; }
    tr.done .td-title { color: #aaa; text-decoration: line-through; }
    td { padding: 6px 10px; vertical-align: middle; font-size: 10pt; }
    .td-cb { width: 28px; text-align: center; }
    .td-title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .td-meta { white-space: nowrap; color: #666; font-size: 9pt; text-align: left; }
    .sub { font-size: 8.5pt; color: #888; margin-top: 2px; }

    /* Checkbox visuals */
    .cb {
      display: inline-flex; align-items: center; justify-content: center;
      width: 14px; height: 14px;
      border-radius: 3px; font-size: 9pt;
    }
    .cb-done { background: #111; color: #fff; }
    .cb-empty { border: 1.5px solid #999; }
    .overdue-text { color: #b91c1c; font-weight: 600; }

    /* ── Footer ────────────────────────────────────── */
    .footer {
      margin-top: 28px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
      display: flex;
      justify-content: space-between;
      font-size: 8.5pt;
      color: #aaa;
    }
  </style>
</head>
<body>

  <!-- ── Main content ── -->
  <div class="page-header">
    <div class="header-top">
      <div>
        <h1>${escapeHtml(project.name)}</h1>
        ${project.description ? `<p class="project-desc">${escapeHtml(project.description)}</p>` : ""}
      </div>
      <div class="header-meta-right">
        <div class="status">${statusLabels[project.status]}</div>
        <div>${escapeHtml(printDate)}</div>
      </div>
    </div>
    <div class="meta-grid">
      ${project.location_notes ? `<div><strong>الموقع: </strong><span>${escapeHtml(project.location_notes)}</span></div>` : ""}
      ${project.default_engineer ? `<div><strong>المهندس: </strong><span>${escapeHtml(project.default_engineer.full_name)}</span></div>` : ""}
      ${project.start_date ? `<div><strong>البداية: </strong><span>${escapeHtml(project.start_date)}</span></div>` : ""}
      ${project.end_date ? `<div><strong>النهاية: </strong><span>${escapeHtml(project.end_date)}</span></div>` : ""}
      ${project.manager_name ? `<div><strong>الغفير: </strong><span>${escapeHtml(project.manager_name)}</span></div>` : ""}
      ${project.manager_phone ? `<div><strong>الهاتف: </strong><span>${escapeHtml(project.manager_phone)}</span></div>` : ""}
    </div>
  </div>

  <!-- Progress summary -->
  <div class="progress-bar-wrap">
    <div><span class="pct">${pct}%</span> مكتمل</div>
    <div>${done} / ${total} مهمة</div>
    ${project.estimated_days != null ? `<div>متبقي للمشروع: ${remainingLabel(project.estimated_days, project.estimated_days_set_at, today)}</div>` : ""}
    ${overdue > 0 ? `<div class="overdue-label">${overdue} مهمة متأخرة</div>` : ""}
    <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
  </div>

  <!-- Categories and tasks -->
  ${categories.length === 0 ? `<p style="color:#999;text-align:center;padding:32px 0;">لا توجد فئات أو مهام.</p>` : categoriesHtml}

  <!-- Footer -->
  <div class="footer">
    <span>MD Group — ${escapeHtml(project.name)}</span>
    <span>${escapeHtml(printDate)}</span>
  </div>
</body>
</html>`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const format = req.nextUrl.searchParams.get("format");

  const user = await requireUser().catch(() => null);
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = await createSupabaseServerClient();

  const [{ data: rawProject }, { data: rawCategories }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, name, description, start_date, end_date, status, estimated_days, estimated_days_set_at, location_notes, manager_name, manager_phone, default_engineer:default_engineer_id(full_name)",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("project_categories")
      .select(
        "id, name, sort_order, estimated_days, estimated_days_set_at, tasks:project_tasks(id, title, description, due_date, estimated_days, estimated_days_set_at, task_status, is_completed, sort_order, assignee:assigned_to(full_name))",
      )
      .eq("project_id", id)
      .order("sort_order"),
  ]);

  if (!rawProject) {
    return new NextResponse("Not Found", { status: 404 });
  }

  type ProjectRow = {
    id: string;
    name: string;
    description: string | null;
    start_date: string | null;
    end_date: string | null;
    status: ProjectStatus;
    estimated_days: number | null;
    estimated_days_set_at: string | null;
    location_notes: string | null;
    manager_name: string | null;
    manager_phone: string | null;
    default_engineer: { full_name: string } | null;
  };

  const project = rawProject as unknown as ProjectRow;
  const categories = ((rawCategories ?? []) as unknown as CategoryRow[]).map(
    (cat) => ({
      ...cat,
      tasks: [...cat.tasks].sort((a, b) => a.sort_order - b.sort_order),
    }),
  );

  const today = tripoliTodayIso();
  const html = buildHtml(project, categories, today);

  if (format === "pdf") {
    try {
      const pdfBytes = await renderPdfFromHtml(html);
      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": contentDispositionHeader(project.name),
          "Cache-Control": "no-store",
        },
      });
    } catch (err) {
      console.error("timeline pdf generation failed", err);
      return new NextResponse("PDF generation failed", { status: 500 });
    }
  }

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
