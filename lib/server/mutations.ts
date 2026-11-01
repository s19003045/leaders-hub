import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import * as t from "@/db/schema";
import type { Db } from "./db";
import { isStaffRole } from "./auth";
import { HttpError, conflict, forbidden, newId, notFound, nowIso } from "./http";
import type { AnswerValue, FileRef, Group, Role, User } from "@/lib/types";

/**
 * 所有寫入操作。每個函式都先做授權檢查（伺服器端為準），再寫入 D1。
 * 對應第一階段 lib/store.ts 的 actions，前端呼叫方式不變。
 */

const str = (max = 2000) => z.string().trim().max(max);
const iso = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T/));
const fileRef = z.object({ id: str(100), name: str(255), size: z.number().int().min(0).max(500 * 1024 * 1024), mime: str(100) });

const requireStaff = (user: User) => {
  if (!isStaffRole(user.role)) throw forbidden();
};

/** D1 每個 statement 最多 100 個綁定參數，批次插入要分段。 */
async function insertChunked<T>(rows: T[], size: number, insert: (rows: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await insert(rows.slice(i, i + size));
}

async function notify(db: Db, actorId: string, userIds: string[], title: string, body: string, href: string) {
  const ids = [...new Set(userIds)].filter((id) => id !== actorId);
  if (ids.length === 0) return;
  const now = nowIso();
  await insertChunked(ids.map((userId) => ({ id: newId("n"), userId, title, body, href, read: false, createdAt: now })), 10, (rows) => db.insert(t.notifications).values(rows));
}

async function audit(db: Db, actorId: string, action: string, target: string) {
  await db.insert(t.auditLogs).values({ id: newId("al"), actorId, action, target, at: nowIso() });
}

async function studentIds(db: Db) {
  const rows = await db.select({ userId: t.enrollments.userId }).from(t.enrollments).all();
  return rows.map((r) => r.userId);
}

async function groupMemberIds(db: Db, groupId: string) {
  const rows = await db.select({ userId: t.groupMembers.userId }).from(t.groupMembers).where(and(eq(t.groupMembers.groupId, groupId), isNull(t.groupMembers.leftAt))).all();
  return rows.map((r) => r.userId);
}

// ---------- 表單 ----------
export async function saveFormAnswers(db: Db, user: User, formId: string, body: unknown) {
  const input = z.object({ answers: z.record(z.string(), z.unknown()), submit: z.boolean() }).parse(body);
  const form = await db.select().from(t.forms).where(eq(t.forms.id, formId)).get();
  if (!form) throw notFound("表單");
  if (new Date(form.openAt).getTime() > Date.now()) throw new HttpError(400, "此表單尚未開放");
  const existing = await db.select().from(t.formSubmissions).where(and(eq(t.formSubmissions.formId, formId), eq(t.formSubmissions.userId, user.id))).get();
  if (existing?.status === "submitted" && !form.allowEdit) throw new HttpError(400, "此表單不允許修改已送出的回答");
  if (input.submit && new Date(form.dueAt).getTime() < Date.now() && !form.allowLate) throw new HttpError(400, "已超過截止時間，此表單不允許逾期提交");

  const questions = await db.select({ id: t.questions.id, required: t.questions.required, title: t.questions.title }).from(t.questions).where(eq(t.questions.formId, formId)).all();
  const validIds = new Set(questions.map((q) => q.id));
  const answers = Object.fromEntries(Object.entries(input.answers).filter(([k]) => validIds.has(k))) as Record<string, AnswerValue>;
  if (input.submit) {
    const missing = questions.filter((q) => q.required && isEmptyAnswer(answers[q.id]));
    if (missing.length) throw new HttpError(400, `還有 ${missing.length} 題必填未完成：${missing.map((q) => q.title).join("、")}`);
  }

  const now = nowIso();
  const subId = existing?.id ?? newId("fs");
  if (existing) {
    await db.update(t.formSubmissions).set({ status: input.submit ? "submitted" : existing.status, submittedAt: input.submit ? now : existing.submittedAt, updatedAt: now, version: existing.version + 1 }).where(eq(t.formSubmissions.id, subId));
    await db.delete(t.answers).where(eq(t.answers.submissionId, subId));
  } else {
    await db.insert(t.formSubmissions).values({ id: subId, formId, userId: user.id, status: input.submit ? "submitted" : "draft", submittedAt: input.submit ? now : null, updatedAt: now, version: 1 });
  }
  const rows = Object.entries(answers).map(([qid, v]) => ({ id: `${subId}:${qid}`, submissionId: subId, questionId: qid, value: JSON.stringify(v ?? null) }));
  await insertChunked(rows, 20, (batch) => db.insert(t.answers).values(batch));
  if (input.submit) {
    await audit(db, user.id, "提交表單", form.title);
    await notify(db, user.id, [form.createdBy], "有新的表單回答", `${user.name} 送出了「${form.title}」`, `/admin/forms/${form.id}`);
  }
  return { id: subId };
}

function isEmptyAnswer(v: AnswerValue | undefined) {
  if (v === null || v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "number") return !(v > 0);
  return String(v).trim() === "";
}

export async function addFeedback(db: Db, user: User, body: unknown) {
  requireStaff(user);
  const input = z.object({ targetType: z.enum(["form", "assignment"]), targetId: str(100), questionId: str(200).optional(), content: str(5000).min(1) }).parse(body);
  await db.insert(t.feedback).values({ id: newId("fb"), targetType: input.targetType, targetId: input.targetId, questionId: input.questionId ?? null, authorId: user.id, content: input.content, createdAt: nowIso(), readBy: JSON.stringify([user.id]) });
  if (input.targetType === "form") {
    const sub = await db.select().from(t.formSubmissions).where(eq(t.formSubmissions.id, input.targetId)).get();
    const form = sub ? await db.select().from(t.forms).where(eq(t.forms.id, sub.formId)).get() : undefined;
    if (sub && form) await notify(db, user.id, [sub.userId], "老師回覆了你的表單", form.title, `/forms/${form.id}`);
  }
  await audit(db, user.id, "回覆", input.targetId);
  return { ok: true };
}

export async function markFeedbackRead(db: Db, user: User, body: unknown) {
  const { ids } = z.object({ ids: z.array(str(100)).max(200) }).parse(body);
  if (!ids.length) return { ok: true };
  const rows = await db.select().from(t.feedback).where(inArray(t.feedback.id, ids)).all();
  for (const r of rows) {
    const readBy = JSON.parse(r.readBy) as string[];
    if (!readBy.includes(user.id)) await db.update(t.feedback).set({ readBy: JSON.stringify([...readBy, user.id]) }).where(eq(t.feedback.id, r.id));
  }
  return { ok: true };
}

const questionInput = z.object({ id: str(100), type: z.enum(["short", "long", "single", "multi", "rating", "date", "file"]), title: str(500).min(1), description: str(1000).optional(), required: z.boolean(), options: z.array(str(200)).max(50).optional(), max: z.number().int().min(2).max(10).optional() });

export async function createForm(db: Db, user: User, body: unknown) {
  requireStaff(user);
  const input = z.object({ courseId: str(100), title: str(200).min(1), description: str(2000), openAt: iso, dueAt: iso, allowEdit: z.boolean(), allowLate: z.boolean(), questions: z.array(questionInput).min(1).max(50) }).parse(body);
  const id = newId("f");
  const now = nowIso();
  await db.insert(t.forms).values({ id, courseId: input.courseId, title: input.title, description: input.description, openAt: input.openAt, dueAt: input.dueAt, allowEdit: input.allowEdit, allowLate: input.allowLate, createdBy: user.id, createdAt: now });
  await insertChunked(input.questions.map((q, i) => ({ id: `${id}:${q.id}`, formId: id, order: i, type: q.type, title: q.title, description: q.description ?? null, required: q.required, options: q.options ? JSON.stringify(q.options) : null, max: q.max ?? null })), 10, (rows) => db.insert(t.questions).values(rows));
  await audit(db, user.id, "建立表單", input.title);
  await notify(db, user.id, await studentIds(db), "新的表單待填寫", input.title, `/forms/${id}`);
  return { id };
}

// ---------- 作業 ----------
async function assertOwner(db: Db, user: User, ownerType: "user" | "group", ownerId: string) {
  if (ownerType === "user") {
    if (ownerId !== user.id) throw forbidden("只能繳交自己的作業");
    return [user.id];
  }
  const members = await groupMemberIds(db, ownerId);
  if (!members.includes(user.id)) throw forbidden("你不是這個小組的組員");
  return members;
}

const payloadInput = z.object({ text: str(20000), link: z.string().trim().url().max(2000).optional().or(z.literal("").transform(() => undefined)), files: z.array(fileRef).max(20) });

export async function saveAssignmentDraft(db: Db, user: User, assignmentId: string, body: unknown) {
  const input = z.object({ ownerType: z.enum(["user", "group"]), ownerId: str(100), payload: payloadInput }).parse(body);
  await assertOwner(db, user, input.ownerType, input.ownerId);
  const a = await db.select().from(t.assignments).where(eq(t.assignments.id, assignmentId)).get();
  if (!a) throw notFound("作業");
  const now = nowIso();
  const draft = JSON.stringify({ ...input.payload, savedById: user.id, savedAt: now });
  const sub = await db.select().from(t.assignmentSubmissions).where(and(eq(t.assignmentSubmissions.assignmentId, assignmentId), eq(t.assignmentSubmissions.ownerType, input.ownerType), eq(t.assignmentSubmissions.ownerId, input.ownerId))).get();
  if (sub) {
    await db.update(t.assignmentSubmissions).set({ draft, submitStatus: sub.submitStatus === "not_submitted" ? "draft" : sub.submitStatus, version: sub.version + 1, updatedAt: now }).where(eq(t.assignmentSubmissions.id, sub.id));
    return { id: sub.id };
  }
  const id = newId("as");
  await db.insert(t.assignmentSubmissions).values({ id, assignmentId, ownerType: input.ownerType, ownerId: input.ownerId, submitStatus: "draft", reviewStatus: "pending", draft, version: 1, updatedAt: now });
  return { id };
}

export async function submitAssignment(db: Db, user: User, assignmentId: string, body: unknown) {
  const input = z.object({ ownerType: z.enum(["user", "group"]), ownerId: str(100), payload: payloadInput, expectedVersion: z.number().int().nullable() }).parse(body);
  const members = await assertOwner(db, user, input.ownerType, input.ownerId);
  const a = await db.select().from(t.assignments).where(eq(t.assignments.id, assignmentId)).get();
  if (!a) throw notFound("作業");
  const p = input.payload;
  if (!p.text.trim() && p.files.length === 0 && !p.link) throw new HttpError(400, "請至少輸入文字、上傳檔案或提供連結");
  const allowed = JSON.parse(a.formats) as string[];
  for (const f of p.files) {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (allowed.length && !allowed.includes(ext)) throw new HttpError(400, `${f.name} 不是允許的格式（${allowed.join("、")}）`);
    if (f.size > a.maxSizeMb * 1024 * 1024) throw new HttpError(400, `${f.name} 超過 ${a.maxSizeMb} MB 限制`);
  }
  const now = nowIso();
  const isLate = new Date(a.dueAt).getTime() < Date.now();
  if (new Date(a.openAt).getTime() > Date.now()) throw new HttpError(400, "此作業尚未開放");
  if (isLate && !a.allowLate) throw new HttpError(400, "已超過截止時間，此作業不允許補交");

  const sub = await db.select().from(t.assignmentSubmissions).where(and(eq(t.assignmentSubmissions.assignmentId, assignmentId), eq(t.assignmentSubmissions.ownerType, input.ownerType), eq(t.assignmentSubmissions.ownerId, input.ownerId))).get();
  let subId: string;
  let no: number;
  if (sub) {
    if (input.expectedVersion !== null && sub.version !== input.expectedVersion) throw conflict();
    const prev = await db.select({ no: t.submissionVersions.no }).from(t.submissionVersions).where(eq(t.submissionVersions.submissionId, sub.id)).all();
    no = prev.length + 1;
    if (no > 1 && !a.allowResubmit) throw new HttpError(400, "此作業不允許重新提交");
    // 樂觀鎖：版本不符代表其他組員剛更新，拒絕覆蓋
    const r = await db
      .update(t.assignmentSubmissions)
      .set({ draft: null, submitStatus: no > 1 ? "resubmitted" : isLate ? "late" : "submitted", reviewStatus: "pending", version: sub.version + 1, updatedAt: now })
      .where(and(eq(t.assignmentSubmissions.id, sub.id), eq(t.assignmentSubmissions.version, sub.version)))
      .run();
    if (!r.meta.changes) throw conflict();
    subId = sub.id;
  } else {
    if (input.expectedVersion !== null && input.expectedVersion !== 0) throw conflict();
    subId = newId("as");
    no = 1;
    await db.insert(t.assignmentSubmissions).values({ id: subId, assignmentId, ownerType: input.ownerType, ownerId: input.ownerId, submitStatus: isLate ? "late" : "submitted", reviewStatus: "pending", draft: null, version: 1, updatedAt: now });
  }
  const versionId = `${subId}:v${no}`;
  await db.insert(t.submissionVersions).values({ id: versionId, submissionId: subId, no, submittedById: user.id, submittedAt: now, text: p.text, link: p.link ?? null });
  await insertChunked(p.files.map((f) => ({ id: `${versionId}:${f.id}`, versionId, name: f.name, size: f.size, mime: f.mime, r2Key: "", uploadedAt: now })), 10, (rows) => db.insert(t.assignmentFiles).values(rows));
  await audit(db, user.id, no > 1 ? "重新提交作業" : "提交作業", a.title);
  if (input.ownerType === "group") {
    const g = await db.select({ name: t.groups.name }).from(t.groups).where(eq(t.groups.id, input.ownerId)).get();
    await notify(db, user.id, members, "小組作業已提交", `${user.name} 代表 ${g?.name ?? "小組"} 提交了「${a.title}」`, `/assignments/${assignmentId}`);
  }
  await notify(db, user.id, [a.createdBy], "有新的作業提交", a.title, `/admin/assignments/${assignmentId}`);
  return { id: subId, versionNo: no };
}

export async function reviewAssignment(db: Db, user: User, submissionId: string, body: unknown) {
  requireStaff(user);
  const input = z.object({ score: z.number().min(0).max(100).optional(), comment: str(5000), requestResubmit: z.boolean() }).parse(body);
  const sub = await db.select().from(t.assignmentSubmissions).where(eq(t.assignmentSubmissions.id, submissionId)).get();
  if (!sub) throw notFound("提交紀錄");
  const now = nowIso();
  await db.insert(t.assignmentReviews).values({ id: newId("rv"), submissionId, reviewerId: user.id, score: input.score ?? null, comment: input.comment, requestResubmit: input.requestResubmit, reviewedAt: now, readBy: JSON.stringify([user.id]) });
  await db.update(t.assignmentSubmissions).set({ reviewStatus: input.requestResubmit ? "needs_revision" : "reviewed", version: sub.version + 1, updatedAt: now }).where(eq(t.assignmentSubmissions.id, submissionId));
  const a = await db.select({ title: t.assignments.title }).from(t.assignments).where(eq(t.assignments.id, sub.assignmentId)).get();
  const recipients = sub.ownerType === "user" ? [sub.ownerId] : await groupMemberIds(db, sub.ownerId);
  await notify(db, user.id, recipients, input.requestResubmit ? "作業需要修改" : "作業已批改", a?.title ?? "", `/assignments/${sub.assignmentId}`);
  await audit(db, user.id, "批改作業", a?.title ?? submissionId);
  return { ok: true };
}

export async function markReviewRead(db: Db, user: User, submissionId: string) {
  const rows = await db.select().from(t.assignmentReviews).where(eq(t.assignmentReviews.submissionId, submissionId)).all();
  for (const r of rows) {
    const readBy = JSON.parse(r.readBy) as string[];
    if (!readBy.includes(user.id)) await db.update(t.assignmentReviews).set({ readBy: JSON.stringify([...readBy, user.id]) }).where(eq(t.assignmentReviews.id, r.id));
  }
  return { ok: true };
}

const assignmentInput = z.object({ courseId: str(100), title: str(200).min(1), type: z.enum(["individual", "group"]), description: str(10000).min(1), openAt: iso, dueAt: iso, formats: z.array(str(10)).max(20), maxSizeMB: z.number().int().min(1).max(500), allowLate: z.boolean(), allowResubmit: z.boolean(), gradingMode: z.enum(["score", "comment", "both"]), attachments: z.array(fileRef).max(10), targetGroupIds: z.array(str(100)).max(100).optional() });

export async function createAssignment(db: Db, user: User, body: unknown) {
  requireStaff(user);
  const input = assignmentInput.parse(body);
  const id = newId("a");
  await db.insert(t.assignments).values({ id, courseId: input.courseId, title: input.title, type: input.type, description: input.description, openAt: input.openAt, dueAt: input.dueAt, formats: JSON.stringify(input.formats), maxSizeMb: input.maxSizeMB, allowLate: input.allowLate, allowResubmit: input.allowResubmit, gradingMode: input.gradingMode, attachments: JSON.stringify(input.attachments), createdBy: user.id, createdAt: nowIso() });
  if (input.type === "group" && input.targetGroupIds?.length) await db.insert(t.assignmentTargets).values(input.targetGroupIds.map((gid) => ({ assignmentId: id, targetType: "group" as const, targetId: gid })));
  await audit(db, user.id, "建立作業", input.title);
  await notify(db, user.id, await studentIds(db), input.type === "group" ? "新的分組作業" : "新的個人作業", input.title, `/assignments/${id}`);
  return { id };
}

export async function updateAssignment(db: Db, user: User, id: string, body: unknown) {
  requireStaff(user);
  const patch = assignmentInput.partial().parse(body);
  const a = await db.select().from(t.assignments).where(eq(t.assignments.id, id)).get();
  if (!a) throw notFound("作業");
  await db
    .update(t.assignments)
    .set({ ...(patch.title !== undefined && { title: patch.title }), ...(patch.description !== undefined && { description: patch.description }), ...(patch.openAt !== undefined && { openAt: patch.openAt }), ...(patch.dueAt !== undefined && { dueAt: patch.dueAt }), ...(patch.formats !== undefined && { formats: JSON.stringify(patch.formats) }), ...(patch.maxSizeMB !== undefined && { maxSizeMb: patch.maxSizeMB }), ...(patch.allowLate !== undefined && { allowLate: patch.allowLate }), ...(patch.allowResubmit !== undefined && { allowResubmit: patch.allowResubmit }), ...(patch.gradingMode !== undefined && { gradingMode: patch.gradingMode }) })
    .where(eq(t.assignments.id, id));
  await audit(db, user.id, "修改作業", patch.title ?? a.title);
  return { ok: true };
}

// ---------- 教材 ----------
export async function addMaterial(db: Db, user: User, body: unknown) {
  requireStaff(user);
  const input = z.object({ courseId: str(100), title: str(200).min(1), type: z.enum(["pdf", "doc", "ppt", "image", "audio", "video", "link"]), description: str(2000), url: z.string().trim().url().max(2000).optional(), file: fileRef.optional(), pinned: z.boolean().optional() }).parse(body);
  const id = newId("m");
  await db.insert(t.materials).values({ id, courseId: input.courseId, title: input.title, type: input.type, description: input.description, url: input.url ?? null, fileName: input.file?.name ?? null, fileSize: input.file?.size ?? null, fileMime: input.file?.mime ?? null, r2Key: null, pinned: !!input.pinned, uploadedBy: user.id, createdAt: nowIso() });
  await audit(db, user.id, "上傳教材", input.title);
  await notify(db, user.id, await studentIds(db), "新的教材", input.title, `/materials/${id}`);
  return { id };
}

export async function removeMaterial(db: Db, user: User, id: string) {
  requireStaff(user);
  const m = await db.select().from(t.materials).where(eq(t.materials.id, id)).get();
  if (!m) throw notFound("教材");
  await db.delete(t.materials).where(eq(t.materials.id, id));
  await audit(db, user.id, "刪除教材", m.title);
  return { ok: true };
}

// ---------- 文章 ----------
const articleInput = z.object({ title: str(200).min(1), content: str(20000).min(1), category: str(50), tags: z.array(str(30)).max(20), visibility: z.enum(["draft", "course", "class", "all"]), courseId: str(100).optional(), classId: str(100).optional(), link: z.string().trim().url().max(2000).optional() });

export async function createArticle(db: Db, user: User, body: unknown) {
  const input = articleInput.parse(body);
  const id = newId("p");
  const now = nowIso();
  await db.insert(t.articles).values({ id, authorId: user.id, title: input.title, content: input.content, category: input.category, tags: JSON.stringify(input.tags), visibility: input.visibility, courseId: input.courseId ?? null, classId: input.classId ?? null, link: input.link ?? null, createdAt: now, updatedAt: now });
  if (input.visibility !== "draft") {
    await audit(db, user.id, "發布文章", input.title);
    const staff = await db.select({ id: t.users.id }).from(t.users).where(inArray(t.users.role, ["teacher", "ta", "admin"])).all();
    await notify(db, user.id, [...(await studentIds(db)), ...staff.map((s) => s.id)], "新的分享文章", input.title, `/articles/${id}`);
  }
  return { id };
}

async function assertArticleOwner(db: Db, user: User, id: string) {
  const a = await db.select().from(t.articles).where(eq(t.articles.id, id)).get();
  if (!a) throw notFound("文章");
  if (a.authorId !== user.id && !isStaffRole(user.role)) throw forbidden();
  return a;
}

export async function updateArticle(db: Db, user: User, id: string, body: unknown) {
  await assertArticleOwner(db, user, id);
  const patch = articleInput.partial().parse(body);
  await db
    .update(t.articles)
    .set({ ...(patch.title !== undefined && { title: patch.title }), ...(patch.content !== undefined && { content: patch.content }), ...(patch.category !== undefined && { category: patch.category }), ...(patch.tags !== undefined && { tags: JSON.stringify(patch.tags) }), ...(patch.visibility !== undefined && { visibility: patch.visibility }), ...(patch.link !== undefined && { link: patch.link }), updatedAt: nowIso() })
    .where(eq(t.articles.id, id));
  return { ok: true };
}

export async function deleteArticle(db: Db, user: User, id: string) {
  await assertArticleOwner(db, user, id);
  await db.delete(t.comments).where(eq(t.comments.articleId, id));
  await db.delete(t.articles).where(eq(t.articles.id, id));
  return { ok: true };
}

export async function addComment(db: Db, user: User, articleId: string, body: unknown) {
  const { content } = z.object({ content: str(5000).min(1) }).parse(body);
  const a = await db.select().from(t.articles).where(eq(t.articles.id, articleId)).get();
  if (!a) throw notFound("文章");
  if (a.visibility === "draft") throw forbidden("草稿不能留言");
  await db.insert(t.comments).values({ id: newId("cm"), articleId, authorId: user.id, content, createdAt: nowIso() });
  await notify(db, user.id, [a.authorId], "有人回覆了你的文章", a.title, `/articles/${a.id}`);
  return { ok: true };
}

// ---------- 小組 / 帳號 ----------
export async function upsertGroup(db: Db, user: User, id: string, body: unknown) {
  if (user.role !== "teacher" && user.role !== "admin") throw forbidden("小組管理限老師與管理員");
  const input = z.object({ group: z.object({ id: str(100), classId: str(100), name: str(50).min(1), leaderId: str(100).nullable(), memberIds: z.array(str(100)).max(50) }), action: str(50) }).parse(body);
  const g = input.group as Pick<Group, "id" | "classId" | "name" | "leaderId" | "memberIds">;
  if (g.id !== id) throw new HttpError(400, "小組編號不符");
  if (g.leaderId && !g.memberIds.includes(g.leaderId)) throw new HttpError(400, "組長必須是組員之一");
  const now = nowIso();
  const entry = { at: now, action: input.action, byUserId: user.id };
  const existing = await db.select().from(t.groups).where(eq(t.groups.id, id)).get();
  if (existing) {
    const history = JSON.parse(existing.history) as Group["history"];
    await db.update(t.groups).set({ name: g.name, leaderId: g.leaderId, history: JSON.stringify([...history, entry]), version: existing.version + 1 }).where(eq(t.groups.id, id));
  } else {
    await db.insert(t.groups).values({ id, classId: g.classId, name: g.name, leaderId: g.leaderId, history: JSON.stringify([entry]), createdAt: now });
  }
  // 組員異動以歷史列記錄：離開者標記 leftAt，不刪除，作業紀錄因此保留
  const current = await groupMemberIds(db, id);
  const removed = current.filter((uid) => !g.memberIds.includes(uid));
  const added = g.memberIds.filter((uid) => !current.includes(uid));
  if (removed.length) await db.update(t.groupMembers).set({ leftAt: now, changedBy: user.id }).where(and(eq(t.groupMembers.groupId, id), isNull(t.groupMembers.leftAt), inArray(t.groupMembers.userId, removed)));
  await insertChunked(added.map((uid) => ({ id: newId("gm"), groupId: id, userId: uid, joinedAt: now, leftAt: null, changedBy: user.id })), 10, (rows) => db.insert(t.groupMembers).values(rows));
  await audit(db, user.id, input.action, g.name);
  return { ok: true };
}

export async function upsertUser(db: Db, user: User, id: string, body: unknown) {
  if (user.role !== "admin") throw forbidden("帳號管理限管理員");
  const input = z.object({ name: str(50).min(1), email: z.string().trim().email().max(200), role: z.enum(["student", "teacher", "ta", "admin"]), title: str(50).optional(), company: str(100).optional(), active: z.boolean() }).parse(body);
  const now = nowIso();
  const existing = await db.select().from(t.users).where(eq(t.users.id, id)).get();
  const dup = await db.select({ id: t.users.id }).from(t.users).where(eq(t.users.email, input.email)).get();
  if (dup && dup.id !== id) throw new HttpError(400, "此 Email 已被其他帳號使用");
  if (existing) {
    if (existing.id === user.id && input.role !== "admin") throw new HttpError(400, "不能移除自己的管理員身分");
    await db.update(t.users).set({ name: input.name, email: input.email, role: input.role as Role, title: input.title ?? null, company: input.company ?? null, active: input.active, updatedAt: now }).where(eq(t.users.id, id));
  } else {
    await db.insert(t.users).values({ id, name: input.name, email: input.email, role: input.role as Role, title: input.title ?? null, company: input.company ?? null, active: input.active, createdAt: now, updatedAt: now });
  }
  if (input.role === "student") {
    const cls = await db.select({ id: t.classes.id }).from(t.classes).get();
    if (cls) await db.insert(t.enrollments).values({ userId: id, classId: cls.id, createdAt: now }).onConflictDoNothing();
  }
  await audit(db, user.id, existing ? "修改帳號" : "建立帳號", input.name);
  return { ok: true };
}

// ---------- 通知 ----------
export async function markNotificationsRead(db: Db, user: User, body: unknown) {
  const { ids } = z.object({ ids: z.array(str(100)).max(500) }).parse(body);
  if (!ids.length) return { ok: true };
  await db.update(t.notifications).set({ read: true }).where(and(eq(t.notifications.userId, user.id), inArray(t.notifications.id, ids)));
  return { ok: true };
}

export type { FileRef };
