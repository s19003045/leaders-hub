import { sql } from "drizzle-orm";
import * as t from "@/db/schema";
import type { Db } from "./db";
import { seedSnapshot } from "@/lib/seed";
import type { Snapshot } from "@/lib/types";

const TABLES = [t.auditLogs, t.notifications, t.comments, t.articles, t.materials, t.assignmentReviews, t.assignmentFiles, t.submissionVersions, t.assignmentSubmissions, t.assignmentTargets, t.assignments, t.feedback, t.answers, t.formSubmissions, t.questions, t.forms, t.groupMembers, t.groups, t.courses, t.enrollments, t.classes, t.users];

export async function isEmpty(db: Db) {
  const row = await db.select({ n: sql<number>`count(*)` }).from(t.users).get();
  return !row || Number(row.n) === 0;
}

export async function clearAll(db: Db) {
  for (const table of TABLES) await db.delete(table);
}

/** 將 lib/seed.ts 的示範資料寫入 D1（只在 SEED_DEMO_DATA=1 且資料庫為空時使用）。 */
export async function seedDatabase(db: Db, data: Snapshot = seedSnapshot) {
  const now = new Date().toISOString();
  const chunk = async <T,>(rows: T[], insert: (rows: T[]) => Promise<unknown>) => {
    // D1 每個 statement 最多 100 個綁定參數；最寬的表 13 欄 → 每批 6 列
    for (let i = 0; i < rows.length; i += 6) await insert(rows.slice(i, i + 6));
  };

  await chunk(data.users, (rows) => db.insert(t.users).values(rows.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, title: u.title, company: u.company, active: u.active, createdAt: u.createdAt, updatedAt: u.createdAt }))));
  await chunk(data.classes, (rows) => db.insert(t.classes).values(rows));
  await chunk(data.enrollments, (rows) => db.insert(t.enrollments).values(rows.map((e) => ({ userId: e.userId, classId: e.classId, createdAt: now }))));
  await chunk(data.courses, (rows) => db.insert(t.courses).values(rows.map((c) => ({ id: c.id, classId: c.classId, unit: c.unit, title: c.title, description: c.description, teacherId: c.teacherId, date: c.date, location: c.location, status: c.status }))));
  await chunk(data.groups, (rows) => db.insert(t.groups).values(rows.map((g) => ({ id: g.id, classId: g.classId, name: g.name, leaderId: g.leaderId, history: JSON.stringify(g.history), createdAt: g.history[0]?.at ?? now }))));
  await chunk(
    data.groups.flatMap((g) => g.memberIds.map((uid) => ({ id: `gm-${g.id}-${uid}`, groupId: g.id, userId: uid, joinedAt: g.history[0]?.at ?? now, leftAt: null, changedBy: g.history[0]?.byUserId ?? "system" }))),
    (rows) => db.insert(t.groupMembers).values(rows),
  );
  await chunk(data.forms, (rows) => db.insert(t.forms).values(rows.map((f) => ({ id: f.id, courseId: f.courseId, title: f.title, description: f.description, openAt: f.openAt, dueAt: f.dueAt, allowEdit: f.allowEdit, allowLate: f.allowLate, createdBy: f.createdBy, createdAt: f.createdAt }))));
  await chunk(
    data.forms.flatMap((f) => f.questions.map((q, i) => ({ id: `${f.id}:${q.id}`, formId: f.id, order: i, type: q.type, title: q.title, description: q.description, required: q.required, options: q.options ? JSON.stringify(q.options) : null, max: q.max }))),
    (rows) => db.insert(t.questions).values(rows),
  );
  await chunk(data.formSubmissions, (rows) => db.insert(t.formSubmissions).values(rows.map((s) => ({ id: s.id, formId: s.formId, userId: s.userId, status: s.status, submittedAt: s.submittedAt, updatedAt: s.updatedAt, version: s.version }))));
  await chunk(
    data.formSubmissions.flatMap((s) => Object.entries(s.answers).map(([qid, v]) => ({ id: `${s.id}:${qid}`, submissionId: s.id, questionId: `${s.formId}:${qid}`, value: JSON.stringify(v) }))),
    (rows) => db.insert(t.answers).values(rows),
  );
  await chunk(data.feedback, (rows) => db.insert(t.feedback).values(rows.map((f) => ({ id: f.id, targetType: f.targetType, targetId: f.targetId, questionId: f.questionId ? `${data.formSubmissions.find((s) => s.id === f.targetId)?.formId}:${f.questionId}` : null, authorId: f.authorId, content: f.content, createdAt: f.createdAt, readBy: JSON.stringify(f.readBy) }))));
  await chunk(data.assignments, (rows) => db.insert(t.assignments).values(rows.map((a) => ({ id: a.id, courseId: a.courseId, title: a.title, type: a.type, description: a.description, openAt: a.openAt, dueAt: a.dueAt, formats: JSON.stringify(a.formats), maxSizeMb: a.maxSizeMB, allowLate: a.allowLate, allowResubmit: a.allowResubmit, gradingMode: a.gradingMode, attachments: JSON.stringify(a.attachments), createdBy: a.createdBy, createdAt: a.createdAt }))));
  await chunk(
    data.assignments.flatMap((a) => (a.targetGroupIds ?? []).map((gid) => ({ assignmentId: a.id, targetType: "group" as const, targetId: gid }))),
    (rows) => db.insert(t.assignmentTargets).values(rows),
  );
  await chunk(data.assignmentSubmissions, (rows) => db.insert(t.assignmentSubmissions).values(rows.map((s) => ({ id: s.id, assignmentId: s.assignmentId, ownerType: s.ownerType, ownerId: s.ownerId, submitStatus: s.submitStatus, reviewStatus: s.reviewStatus, draft: s.draft ? JSON.stringify(s.draft) : null, version: s.version, updatedAt: s.versions[s.versions.length - 1]?.submittedAt ?? now }))));
  const versionRows = data.assignmentSubmissions.flatMap((s) => s.versions.map((v) => ({ id: `${s.id}:v${v.no}`, submissionId: s.id, no: v.no, submittedById: v.submittedById, submittedAt: v.submittedAt, text: v.text, link: v.link, files: v.files })));
  await chunk(versionRows, (rows) => db.insert(t.submissionVersions).values(rows.map((v) => ({ id: v.id, submissionId: v.submissionId, no: v.no, submittedById: v.submittedById, submittedAt: v.submittedAt, text: v.text, link: v.link }))));
  await chunk(
    versionRows.flatMap((v) => v.files.map((f) => ({ id: `${v.id}:${f.id}`, versionId: v.id, name: f.name, size: f.size, mime: f.mime, r2Key: "", uploadedAt: v.submittedAt }))),
    (rows) => db.insert(t.assignmentFiles).values(rows),
  );
  await chunk(
    data.assignmentSubmissions.filter((s) => s.review).map((s) => ({ id: `rv-${s.id}`, submissionId: s.id, reviewerId: s.review!.reviewerId, score: s.review!.score, comment: s.review!.comment, requestResubmit: s.review!.requestResubmit, reviewedAt: s.review!.reviewedAt, readBy: JSON.stringify(s.review!.readBy) })),
    (rows) => db.insert(t.assignmentReviews).values(rows),
  );
  await chunk(data.materials, (rows) => db.insert(t.materials).values(rows.map((m) => ({ id: m.id, courseId: m.courseId, title: m.title, type: m.type, description: m.description, url: m.url, fileName: m.file?.name, fileSize: m.file?.size, fileMime: m.file?.mime, r2Key: null, pinned: !!m.pinned, uploadedBy: m.uploadedBy, createdAt: m.createdAt }))));
  await chunk(data.articles, (rows) => db.insert(t.articles).values(rows.map((a) => ({ id: a.id, authorId: a.authorId, title: a.title, content: a.content, category: a.category, tags: JSON.stringify(a.tags), visibility: a.visibility, courseId: a.courseId, classId: a.classId, link: a.link, createdAt: a.createdAt, updatedAt: a.createdAt }))));
  await chunk(
    data.articles.flatMap((a) => a.comments.map((c) => ({ id: c.id, articleId: a.id, authorId: c.authorId, content: c.content, createdAt: c.createdAt }))),
    (rows) => db.insert(t.comments).values(rows),
  );
  await chunk(data.notifications, (rows) => db.insert(t.notifications).values(rows.map((n) => ({ id: n.id, userId: n.userId, title: n.title, body: n.body, href: n.href, read: n.read, createdAt: n.createdAt }))));
  await chunk(data.auditLogs, (rows) => db.insert(t.auditLogs).values(rows));
}
