import type { AssignmentType, MaterialType, QuestionType, ReviewStatus, Role, SubmitStatus } from "./types";

const TZ = "Asia/Taipei";

export function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("zh-TW", { timeZone: TZ, month: "numeric", day: "numeric" }).format(new Date(iso));
}

export function fmtFullDate(iso: string) {
  return new Intl.DateTimeFormat("zh-TW", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", weekday: "short" }).format(new Date(iso));
}

export function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("zh-TW", { timeZone: TZ, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

export function toInputDateTime(iso: string) {
  // datetime-local 需要台北時間的 YYYY-MM-DDTHH:mm
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

export function fromInputDateTime(value: string) {
  // 視為台北時間
  return new Date(`${value}:00+08:00`).toISOString();
}

export type DueTone = "overdue" | "soon" | "normal" | "done";

export function dueInfo(dueAt: string, now = Date.now()): { label: string; tone: DueTone; days: number } {
  const diffMs = new Date(dueAt).getTime() - now;
  const days = Math.ceil(diffMs / 86_400_000);
  if (diffMs < 0) return { label: `已逾期 ${Math.max(1, -days)} 天`, tone: "overdue", days };
  if (days <= 1) return { label: "今天截止", tone: "soon", days };
  if (days <= 3) return { label: `剩 ${days} 天`, tone: "soon", days };
  return { label: `${fmtDate(dueAt)} 截止`, tone: "normal", days };
}

export function fileSize(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

export const roleLabel: Record<Role, string> = { student: "學員", teacher: "老師", ta: "助教", admin: "管理員" };

export const submitStatusLabel: Record<SubmitStatus, string> = {
  not_submitted: "尚未繳交",
  draft: "已儲存草稿",
  submitted: "已繳交",
  late: "逾期繳交",
  resubmitted: "已重新繳交",
};

export const reviewStatusLabel: Record<ReviewStatus, string> = {
  pending: "待批改",
  reviewing: "批改中",
  reviewed: "已批改",
  needs_revision: "需要修改",
};

export const assignmentTypeLabel: Record<AssignmentType, string> = { individual: "個人作業", group: "分組作業" };

export const materialTypeLabel: Record<MaterialType, string> = {
  pdf: "PDF",
  doc: "Word",
  ppt: "簡報",
  image: "圖片",
  audio: "音訊",
  video: "影片",
  link: "連結",
};

export const questionTypeLabel: Record<QuestionType, string> = {
  short: "簡答題",
  long: "長文字回答",
  single: "單選題",
  multi: "多選題",
  rating: "評分題",
  date: "日期題",
  file: "檔案上傳題",
};

/** R2 key → 受保護下載路徑（需登入；權限在 /api/files 檢查）。非 R2 的示範檔案回傳 null。 */
export function fileHref(key: string, download = false) {
  if (!key.startsWith("uploads/")) return null;
  return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}${download ? "?download=1" : ""}`;
}

export function pct(n: number, d: number) {
  if (d === 0) return 0;
  return Math.round((n / d) * 1000) / 10;
}
