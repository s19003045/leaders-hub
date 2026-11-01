import { and, eq, inArray, isNull } from "drizzle-orm";
import * as t from "@/db/schema";
import type { Db } from "./db";
import { newId, nowIso } from "./http";
import { lineEnabled, pushGroup, pushText } from "./line";

/**
 * 截止提醒。
 * Sites 沒有背景排程，因此採「惰性排程」：任何人載入 /api/state 時，若距上次檢查超過 1 小時就跑一次。
 * 每個表單／作業在「截止前 3 天」與「截止前 1 天」各提醒一次（app_settings 記錄已送出）。
 * 老師也可在後台對單一表單／作業手動觸發。
 */

const STAGES: { key: string; days: number }[] = [
  { key: "d3", days: 3 },
  { key: "d1", days: 1 },
];

async function getSetting(db: Db, key: string) {
  const row = await db.select().from(t.appSettings).where(eq(t.appSettings.key, key)).get();
  return row?.value ?? null;
}

async function setSetting(db: Db, key: string, value: string) {
  await db.insert(t.appSettings).values({ key, value, updatedAt: nowIso() }).onConflictDoUpdate({ target: t.appSettings.key, set: { value, updatedAt: nowIso() } });
}

async function activeStudents(db: Db) {
  const rows = await db.select({ id: t.users.id, name: t.users.name, lineUserId: t.users.lineUserId }).from(t.users).innerJoin(t.enrollments, eq(t.enrollments.userId, t.users.id)).where(eq(t.users.active, true)).all();
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

export interface ReminderResult {
  title: string;
  notified: number; // 站內通知人數
  linePersonal: number; // LINE 個人推播數
  lineGroup: boolean; // 是否推到群組
  done: number;
  total: number;
}

/** 對單一表單提醒尚未送出的學員。 */
export async function remindForm(db: Db, env: Cloudflare.Env, origin: string, formId: string, reason: string): Promise<ReminderResult> {
  const form = await db.select().from(t.forms).where(eq(t.forms.id, formId)).get();
  if (!form) throw new Error("找不到表單");
  const students = await activeStudents(db);
  const submitted = await db.select({ userId: t.formSubmissions.userId }).from(t.formSubmissions).where(and(eq(t.formSubmissions.formId, formId), eq(t.formSubmissions.status, "submitted"))).all();
  const doneIds = new Set(submitted.map((s) => s.userId));
  const pending = students.filter((s) => !doneIds.has(s.id));
  return deliver(db, env, origin, { title: form.title, href: `/forms/${form.id}`, dueAt: form.dueAt, kind: "表單", reason }, pending, students.length);
}

/** 對單一作業提醒尚未繳交的學員（分組作業提醒整組尚未提交的組員）。 */
export async function remindAssignment(db: Db, env: Cloudflare.Env, origin: string, assignmentId: string, reason: string): Promise<ReminderResult> {
  const a = await db.select().from(t.assignments).where(eq(t.assignments.id, assignmentId)).get();
  if (!a) throw new Error("找不到作業");
  const students = await activeStudents(db);
  const subs = await db.select({ ownerType: t.assignmentSubmissions.ownerType, ownerId: t.assignmentSubmissions.ownerId, status: t.assignmentSubmissions.submitStatus }).from(t.assignmentSubmissions).where(eq(t.assignmentSubmissions.assignmentId, assignmentId)).all();
  const submittedOwners = new Set(subs.filter((s) => s.status !== "not_submitted" && s.status !== "draft").map((s) => s.ownerId));
  let pending: typeof students;
  let total: number;
  if (a.type === "individual") {
    pending = students.filter((s) => !submittedOwners.has(s.id));
    total = students.length;
  } else {
    const targets = await db.select({ targetId: t.assignmentTargets.targetId }).from(t.assignmentTargets).where(and(eq(t.assignmentTargets.assignmentId, assignmentId), eq(t.assignmentTargets.targetType, "group"))).all();
    const allGroups = await db.select({ id: t.groups.id }).from(t.groups).all();
    const groupIds = targets.length ? targets.map((x) => x.targetId) : allGroups.map((g) => g.id);
    total = groupIds.length;
    const pendingGroups = groupIds.filter((g) => !submittedOwners.has(g));
    const members = pendingGroups.length ? await db.select({ userId: t.groupMembers.userId }).from(t.groupMembers).where(and(inArray(t.groupMembers.groupId, pendingGroups), isNull(t.groupMembers.leftAt))).all() : [];
    const memberIds = new Set(members.map((m) => m.userId));
    pending = students.filter((s) => memberIds.has(s.id));
    return deliver(db, env, origin, { title: a.title, href: `/assignments/${a.id}`, dueAt: a.dueAt, kind: "分組作業", reason }, pending, total, total - pendingGroups.length);
  }
  return deliver(db, env, origin, { title: a.title, href: `/assignments/${a.id}`, dueAt: a.dueAt, kind: "個人作業", reason }, pending, total);
}

async function deliver(db: Db, env: Cloudflare.Env, origin: string, item: { title: string; href: string; dueAt: string; kind: string; reason: string }, pending: { id: string; name: string; lineUserId: string | null }[], total: number, doneOverride?: number): Promise<ReminderResult> {
  const done = doneOverride ?? total - pending.length;
  const dueText = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(item.dueAt));
  const link = `${origin}${item.href}`;
  const now = nowIso();
  if (pending.length) {
    const rows = pending.map((p) => ({ id: newId("n"), userId: p.id, title: `${item.kind}提醒：${item.title}`, body: `${item.reason}，截止 ${dueText}`, href: item.href, read: false, createdAt: now }));
    for (let i = 0; i < rows.length; i += 10) await db.insert(t.notifications).values(rows.slice(i, i + 10));
  }
  let linePersonal = 0;
  let lineGroup = false;
  if (lineEnabled(env)) {
    const groupMsg = `【${item.kind}提醒】${item.title}\n${item.reason}，截止 ${dueText}。目前 ${done}/${total} 完成。\n${link}`;
    const g = await pushGroup(env, groupMsg);
    lineGroup = g.ok;
    for (const p of pending.filter((x) => x.lineUserId)) {
      const r = await pushText(env, p.lineUserId!, `${p.name} 平安，「${item.title}」還沒完成，截止 ${dueText}。\n${link}`);
      if (r.ok) linePersonal += 1;
    }
  }
  return { title: item.title, notified: pending.length, linePersonal, lineGroup, done, total };
}

/** 惰性排程入口：每小時最多跑一次。 */
export async function runDueReminders(db: Db, env: Cloudflare.Env, origin: string) {
  const last = await getSetting(db, "reminders:lastRun");
  if (last && Date.now() - new Date(last).getTime() < 60 * 60 * 1000) return;
  await setSetting(db, "reminders:lastRun", nowIso());
  const now = Date.now();
  const forms = await db.select({ id: t.forms.id, dueAt: t.forms.dueAt, openAt: t.forms.openAt }).from(t.forms).all();
  const assignments = await db.select({ id: t.assignments.id, dueAt: t.assignments.dueAt, openAt: t.assignments.openAt }).from(t.assignments).all();
  const items = [...forms.map((f) => ({ ...f, type: "form" as const })), ...assignments.map((a) => ({ ...a, type: "assignment" as const }))];
  for (const item of items) {
    const due = new Date(item.dueAt).getTime();
    if (new Date(item.openAt).getTime() > now || due < now) continue;
    for (const stage of STAGES) {
      if (due - now > stage.days * 86_400_000) continue;
      const key = `reminder:${item.type}:${item.id}:${stage.key}`;
      if (await getSetting(db, key)) continue;
      await setSetting(db, key, nowIso());
      const reason = stage.days === 1 ? "明天截止" : `還有 ${stage.days} 天截止`;
      try {
        if (item.type === "form") await remindForm(db, env, origin, item.id, reason);
        else await remindAssignment(db, env, origin, item.id, reason);
      } catch (e) {
        console.error("reminder failed", key, e);
      }
      break; // 同一項目一次只送最接近的一個階段
    }
  }
}
