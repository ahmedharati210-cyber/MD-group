import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProjectStatus } from "@/types/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statusLabels: Record<ProjectStatus, string> = {
  planning:    "تصميم",
  active:      "انشاء (اعمال الهيكل)",
  completed:   "تشطيب",
  maintenance: "صيانة",
  survey:      "رفع مساحي",
  on_hold:     "موقوف",
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  is_completed: boolean;
  sort_order: number;
  assignee: { full_name: string } | null;
};

type CategoryRow = {
  id: string;
  name: string;
  sort_order: number;
  tasks: TaskRow[];
};

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  },
  categories: CategoryRow[],
  today: string,
): string {
  const allTasks = categories.flatMap((c) => c.tasks);
  const total = allTasks.length;
  const done = allTasks.filter((t) => t.is_completed).length;
  const overdue = allTasks.filter(
    (t) => !t.is_completed && t.due_date && t.due_date < today,
  ).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const printDate = new Date().toLocaleDateString("ar-LY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const categoriesHtml = categories
    .map((cat) => {
      const catDone = cat.tasks.filter((t) => t.is_completed).length;
      const tasksHtml =
        cat.tasks.length === 0
          ? `<tr><td colspan="4" style="color:#999;padding:8px 12px;">لا توجد مهام</td></tr>`
          : cat.tasks
              .map((task) => {
                const isOverdue =
                  !task.is_completed && task.due_date && task.due_date < today;
                const checkbox = task.is_completed
                  ? `<span class="cb cb-done">✓</span>`
                  : `<span class="cb cb-empty"></span>`;
                return `
              <tr class="${task.is_completed ? "done" : ""}${isOverdue ? " overdue" : ""}">
                <td class="td-cb">${checkbox}</td>
                <td class="td-title">
                  ${escapeHtml(task.title)}
                  ${task.description ? `<div class="sub">${escapeHtml(task.description)}</div>` : ""}
                </td>
                <td class="td-meta">${escapeHtml(task.assignee?.full_name) || "—"}</td>
                <td class="td-meta${isOverdue ? " overdue-text" : ""}">
                  ${escapeHtml(task.due_date) || "—"}${isOverdue ? " ⚠" : ""}
                </td>
              </tr>`;
              })
              .join("");

      return `
      <div class="cat-block">
        <div class="cat-header">
          <strong>${escapeHtml(cat.name)}</strong>
          <span>${catDone}/${cat.tasks.length} تم</span>
        </div>
        <table>
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

    /* ── Toolbar (screen only) ─────────────────────── */
    #toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 24px;
      background: #f5f5f5;
      border-bottom: 1px solid #ddd;
      margin-bottom: 20px;
    }
    #toolbar a { color: #555; text-decoration: none; font-size: 13px; }
    #toolbar a:hover { color: #111; }
    #save-btn {
      background: #15803d; color: #fff; border: none;
      padding: 8px 18px; border-radius: 8px; font-family: 'Cairo', sans-serif;
      font-size: 13px; cursor: pointer; font-weight: 600;
    }
    #save-btn:hover { background: #166534; }
    @media print { #toolbar { display: none; } }

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
    table { width: 100%; border-collapse: collapse; }
    tr { border-bottom: 1px solid #f0f0f0; }
    tr.done .td-title { color: #aaa; text-decoration: line-through; }
    td { padding: 6px 10px; vertical-align: middle; font-size: 10pt; }
    .td-cb { width: 28px; text-align: center; }
    .td-title { flex: 1; }
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

  <!-- Screen-only toolbar -->
  <div id="toolbar">
    <a href="javascript:history.back()">← العودة للمشروع</a>
    <button id="save-btn" onclick="window.print()">حفظ كـ PDF / طباعة</button>
  </div>

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
      ${project.manager_name ? `<div><strong>مسؤول الموقع: </strong><span>${escapeHtml(project.manager_name)}</span></div>` : ""}
      ${project.manager_phone ? `<div><strong>الهاتف: </strong><span>${escapeHtml(project.manager_phone)}</span></div>` : ""}
    </div>
  </div>

  <!-- Progress summary -->
  <div class="progress-bar-wrap">
    <div><span class="pct">${pct}%</span> مكتمل</div>
    <div>${done} / ${total} مهمة</div>
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

  <script>
    // Auto-trigger print dialog once fonts are ready
    const autoprint = new URLSearchParams(location.search).get('autoprint');
    if (autoprint === '1') {
      document.fonts.ready.then(() => {
        setTimeout(() => window.print(), 800);
      });
    }
  </script>
</body>
</html>`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await requireUser().catch(() => null);
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = await createSupabaseServerClient();

  const [{ data: rawProject }, { data: rawCategories }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, name, description, start_date, end_date, status, location_notes, manager_name, manager_phone, default_engineer:default_engineer_id(full_name)",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("project_categories")
      .select(
        "id, name, sort_order, tasks:project_tasks(id, title, description, due_date, is_completed, sort_order, assignee:assigned_to(full_name))",
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

  const today = new Date().toISOString().slice(0, 10);
  const html = buildHtml(project, categories, today);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
