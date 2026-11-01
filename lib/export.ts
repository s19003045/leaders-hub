import type { Snapshot } from "./types";
import { assignmentStats, courseCompletion, formStats, groupCompletion, questionStats, studentCompletion, userName } from "./selectors";
import { fmtDateTime, submitStatusLabel, reviewStatusLabel, pct } from "./format";

/**
 * 匯出資料整理：對應需求書第八章的 8 個工作表。
 * 這裡只產生純資料（rows），由 lib/export-xlsx.ts 組成 Excel、或退回 CSV。
 * 匯出以使用者取得的快照為來源，因此自然遵守伺服器端的資料存取裁切。
 */
export interface Sheet {
  name: string;
  rows: (string | number)[][];
  /** 以百分比呈現並加上資料列（data bar）的欄位索引（0 起算） */
  percentColumns?: number[];
  /** 欄寬（字元數） */
  widths?: number[];
}

export interface ChartData {
  title: string;
  unit: string; // 例如「%」
  items: { label: string; value: number }[];
  max?: number;
}

export interface ExportOptions {
  courseId?: string; // 指定課程
  assignmentId?: string; // 指定作業
  from?: string; // 時間範圍（ISO），依提交／送出時間過濾
  to?: string;
  anonymous?: boolean; // 以學員編號取代姓名
}

const inRange = (iso: string | undefined, opts: ExportOptions) => {
  if (!iso) return true;
  const t = new Date(iso).getTime();
  if (opts.from && t < new Date(opts.from).getTime()) return false;
  if (opts.to && t > new Date(opts.to).getTime() + 86_400_000 - 1) return false;
  return true;
};

export function describeScope(data: Snapshot, opts: ExportOptions) {
  const parts: string[] = [];
  if (opts.courseId) parts.push(data.courses.find((c) => c.id === opts.courseId)?.unit ?? opts.courseId);
  if (opts.assignmentId) parts.push(data.assignments.find((a) => a.id === opts.assignmentId)?.title ?? opts.assignmentId);
  if (opts.from || opts.to) parts.push(`${opts.from ?? "…"} ～ ${opts.to ?? "…"}`);
  if (opts.anonymous) parts.push("匿名");
  return parts.length ? parts.join("・") : "全部資料";
}

export function buildExportSheets(data: Snapshot, opts: ExportOptions = {}): Sheet[] {
  const name = (id: string) => (opts.anonymous ? anonId(data, id) : userName(data, id));
  const inScope = (courseId: string) => !opts.courseId || courseId === opts.courseId;
  const assignmentOk = (id: string) => !opts.assignmentId || id === opts.assignmentId;
  const course = (id: string) => data.courses.find((c) => c.id === id)?.unit ?? "";
  const groupName = (id: string) => data.groups.find((g) => g.id === id)?.name ?? id;

  const formAnswers: Sheet = { name: "1 表單原始回答", rows: [["表單", "課程", "學員", "題號", "題目", "回答", "送出時間"]], widths: [28, 10, 12, 6, 36, 48, 16] };
  for (const f of data.forms.filter((f) => inScope(f.courseId))) {
    for (const s of data.formSubmissions.filter((s) => s.formId === f.id && s.status === "submitted" && inRange(s.submittedAt, opts))) {
      f.questions.forEach((q, i) => {
        const v = s.answers[q.id];
        const text = Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : x.name)).join("；") : v === null || v === undefined ? "" : String(v);
        formAnswers.rows.push([f.title, course(f.courseId), name(s.userId), i + 1, q.title, text, s.submittedAt ? fmtDateTime(s.submittedAt) : ""]);
      });
    }
  }

  const individual: Sheet = { name: "2 個人作業繳交紀錄", rows: [["作業", "課程", "學員", "繳交狀態", "批改狀態", "版本數", "最後繳交時間", "分數", "評語"]], widths: [34, 10, 12, 12, 10, 8, 16, 8, 40] };
  const group: Sheet = { name: "3 分組作業繳交紀錄", rows: [["作業", "課程", "小組", "實際提交者", "繳交狀態", "批改狀態", "版本數", "最後繳交時間", "評語"]], widths: [34, 10, 10, 12, 12, 10, 8, 16, 40] };
  for (const a of data.assignments.filter((a) => inScope(a.courseId) && assignmentOk(a.id))) {
    for (const s of data.assignmentSubmissions.filter((s) => s.assignmentId === a.id && s.versions.length > 0)) {
      const last = s.versions[s.versions.length - 1];
      if (!inRange(last.submittedAt, opts)) continue;
      if (a.type === "individual") individual.rows.push([a.title, course(a.courseId), name(s.ownerId), submitStatusLabel[s.submitStatus], reviewStatusLabel[s.reviewStatus], s.versions.length, fmtDateTime(last.submittedAt), s.review?.score ?? "", s.review?.comment ?? ""]);
      else group.rows.push([a.title, course(a.courseId), groupName(s.ownerId), name(last.submittedById), submitStatusLabel[s.submitStatus], reviewStatusLabel[s.reviewStatus], s.versions.length, fmtDateTime(last.submittedAt), s.review?.comment ?? ""]);
    }
  }

  const sc = studentCompletion(data);
  const perStudent: Sheet = { name: "4 各學員完成率", rows: [["學員", "小組", "表單完成", "表單總數", "個人作業完成", "個人作業總數", "分組作業完成", "分組作業總數", "逾期次數", "整體完成率 %"]], percentColumns: [9], widths: [12, 10, 10, 10, 12, 12, 12, 12, 10, 14] };
  for (const r of sc) {
    const done = r.forms.done + r.individual.done + r.group_.done;
    const total = r.forms.total + r.individual.total + r.group_.total;
    perStudent.rows.push([name(r.user.id), r.group?.name ?? "", r.forms.done, r.forms.total, r.individual.done, r.individual.total, r.group_.done, r.group_.total, r.late, pct(done, total)]);
  }

  const perGroup: Sheet = { name: "5 各小組完成率", rows: [["小組", "組長", "已完成", "應完成", "完成率 %"]], percentColumns: [4], widths: [10, 12, 10, 10, 12] };
  for (const g of groupCompletion(data)) perGroup.rows.push([g.group.name, g.leader ? name(g.leader.id) : "", g.done, g.total, pct(g.done, g.total)]);

  const perCourse: Sheet = { name: "6 各課程完成率", rows: [["課程", "作業數", "表單數", "已完成", "應完成", "完成率 %"]], percentColumns: [5], widths: [34, 8, 8, 10, 10, 12] };
  for (const c of courseCompletion(data).filter((c) => inScope(c.course.id))) perCourse.rows.push([`${c.course.unit} ${c.course.title}`, c.assignments, c.forms, c.done, c.expected, c.rate]);

  const qStats: Sheet = { name: "7 表單題目統計", rows: [["表單", "題號", "題目", "類型", "統計", "數值"]], widths: [28, 6, 36, 8, 16, 10] };
  for (const f of data.forms.filter((f) => inScope(f.courseId))) {
    questionStats(data, f).forEach((q, i) => {
      if (q.kind === "choice") for (const [o, n] of Object.entries(q.counts)) qStats.rows.push([f.title, i + 1, q.question.title, "選項", o, n]);
      else if (q.kind === "rating") {
        qStats.rows.push([f.title, i + 1, q.question.title, "評分", "平均", q.avg]);
        for (const [k, n] of Object.entries(q.dist)) qStats.rows.push([f.title, i + 1, q.question.title, "評分", `${k} 分人數`, n]);
      } else qStats.rows.push([f.title, i + 1, q.question.title, "文字", "回答數", q.total]);
    });
  }

  const charts: Sheet = { name: "8 統計圖表", rows: [["圖表", "項目", "數值", "單位"]], widths: [16, 40, 10, 8] };
  for (const c of buildChartData(data, opts)) for (const it of c.items) charts.rows.push([c.title, it.label, it.value, c.unit]);

  return [formAnswers, individual, group, perStudent, perGroup, perCourse, qStats, charts];
}

/** 第 8 張工作表的圖表資料（也用於統計頁預覽與 PNG 繪製）。 */
export function buildChartData(data: Snapshot, opts: ExportOptions = {}): ChartData[] {
  const inScope = (courseId: string) => !opts.courseId || courseId === opts.courseId;
  const now = Date.now();
  const a = assignmentStats(data).filter((s) => inScope(s.assignment.courseId) && (!opts.assignmentId || s.assignment.id === opts.assignmentId) && new Date(s.assignment.openAt).getTime() <= now);
  const f = formStats(data).filter((s) => inScope(s.form.courseId) && new Date(s.form.openAt).getTime() <= now);
  const g = groupCompletion(data);
  const c = courseCompletion(data).filter((x) => inScope(x.course.id) && x.expected > 0);
  return [
    { title: "作業完成率", unit: "%", max: 100, items: a.map((s) => ({ label: s.assignment.title.replace(/：.*$/, ""), value: s.rate })) },
    { title: "表單填寫率", unit: "%", max: 100, items: f.map((s) => ({ label: s.form.title, value: s.rate })) },
    { title: "各小組完成率", unit: "%", max: 100, items: g.map((x) => ({ label: x.group.name, value: pct(x.done, x.total) })) },
    { title: "各課程完成率", unit: "%", max: 100, items: c.map((x) => ({ label: x.course.unit, value: x.rate })) },
  ].filter((ch) => ch.items.length > 0);
}

function anonId(data: Snapshot, id: string) {
  const idx = data.users.filter((u) => u.role === "student").findIndex((u) => u.id === id);
  return idx >= 0 ? `學員${String(idx + 1).padStart(2, "0")}` : "成員";
}

function toCsv(rows: (string | number)[][]) {
  return "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
}

/** 備援：每個工作表下載為一個 CSV（含 BOM 避免中文亂碼）。 */
export function downloadCsvBundle(sheets: Sheet[], baseName: string) {
  sheets.forEach((s, i) => {
    const blob = new Blob([toCsv(s.rows)], { type: "text/csv;charset=utf-8" });
    setTimeout(() => downloadBlob(blob, `${baseName}_${s.name}.csv`), i * 250);
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
