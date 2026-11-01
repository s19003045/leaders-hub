import { asc } from "drizzle-orm";
import * as t from "@/db/schema";
import type { Db } from "./db";
import type {
  AnswerValue,
  Article,
  Assignment,
  AssignmentSubmission,
  Comment,
  Course,
  Feedback,
  FileRef,
  Form,
  FormSubmission,
  Group,
  GroupHistory,
  Material,
  Notification,
  Question,
  Snapshot,
  SubmissionVersion,
  User,
} from "@/lib/types";
import { visibleArticles } from "@/lib/selectors";
import { isStaffRole } from "./auth";

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** 從 D1 組出完整 Snapshot（資料量小，整包載入最簡單也最一致）。 */
export async function loadSnapshot(db: Db): Promise<Snapshot> {
  const [
    userRows,
    classRows,
    enrollmentRows,
    courseRows,
    groupRows,
    memberRows,
    formRows,
    questionRows,
    fsRows,
    answerRows,
    feedbackRows,
    assignmentRows,
    targetRows,
    asRows,
    versionRows,
    fileRows,
    reviewRows,
    materialRows,
    articleRows,
    commentRows,
    notificationRows,
    auditRows,
  ] = await Promise.all([
    db.select().from(t.users).all(),
    db.select().from(t.classes).all(),
    db.select().from(t.enrollments).all(),
    db.select().from(t.courses).orderBy(asc(t.courses.date)).all(),
    db.select().from(t.groups).orderBy(asc(t.groups.createdAt), asc(t.groups.id)).all(),
    db.select().from(t.groupMembers).orderBy(asc(t.groupMembers.joinedAt)).all(),
    db.select().from(t.forms).all(),
    db.select().from(t.questions).orderBy(asc(t.questions.order)).all(),
    db.select().from(t.formSubmissions).all(),
    db.select().from(t.answers).all(),
    db.select().from(t.feedback).orderBy(asc(t.feedback.createdAt)).all(),
    db.select().from(t.assignments).all(),
    db.select().from(t.assignmentTargets).all(),
    db.select().from(t.assignmentSubmissions).all(),
    db.select().from(t.submissionVersions).orderBy(asc(t.submissionVersions.no)).all(),
    db.select().from(t.assignmentFiles).all(),
    db.select().from(t.assignmentReviews).orderBy(asc(t.assignmentReviews.reviewedAt)).all(),
    db.select().from(t.materials).all(),
    db.select().from(t.articles).all(),
    db.select().from(t.comments).orderBy(asc(t.comments.createdAt)).all(),
    db.select().from(t.notifications).all(),
    db.select().from(t.auditLogs).all(),
  ]);

  const users: User[] = userRows.map((r) => ({ id: r.id, name: r.name, email: r.email, role: r.role, title: r.title ?? undefined, company: r.company ?? undefined, active: r.active, createdAt: r.createdAt }));

  const groups: Group[] = groupRows.map((g) => ({
    id: g.id,
    classId: g.classId,
    name: g.name,
    leaderId: g.leaderId,
    memberIds: memberRows.filter((m) => m.groupId === g.id && !m.leftAt).map((m) => m.userId),
    history: parseJson<GroupHistory[]>(g.history, []),
  }));

  const questionsByForm = new Map<string, Question[]>();
  for (const q of questionRows) {
    const list = questionsByForm.get(q.formId) ?? [];
    list.push({ id: q.id, type: q.type, title: q.title, description: q.description ?? undefined, required: q.required, options: parseJson<string[] | undefined>(q.options, undefined), max: q.max ?? undefined });
    questionsByForm.set(q.formId, list);
  }
  const forms: Form[] = formRows.map((f) => ({ id: f.id, courseId: f.courseId, title: f.title, description: f.description, openAt: f.openAt, dueAt: f.dueAt, allowEdit: f.allowEdit, allowLate: f.allowLate, questions: questionsByForm.get(f.id) ?? [], createdBy: f.createdBy, createdAt: f.createdAt }));

  const answersBySub = new Map<string, Record<string, AnswerValue>>();
  for (const a of answerRows) {
    const rec = answersBySub.get(a.submissionId) ?? {};
    rec[a.questionId] = parseJson<AnswerValue>(a.value, null);
    answersBySub.set(a.submissionId, rec);
  }
  const formSubmissions: FormSubmission[] = fsRows.map((s) => ({ id: s.id, formId: s.formId, userId: s.userId, status: s.status, answers: answersBySub.get(s.id) ?? {}, submittedAt: s.submittedAt ?? undefined, updatedAt: s.updatedAt, version: s.version }));

  const feedback: Feedback[] = feedbackRows.map((f) => ({ id: f.id, targetType: f.targetType, targetId: f.targetId, questionId: f.questionId ?? undefined, authorId: f.authorId, content: f.content, createdAt: f.createdAt, readBy: parseJson<string[]>(f.readBy, []) }));

  const assignments: Assignment[] = assignmentRows.map((a) => {
    const groupTargets = targetRows.filter((x) => x.assignmentId === a.id && x.targetType === "group").map((x) => x.targetId);
    return { id: a.id, courseId: a.courseId, title: a.title, type: a.type, description: a.description, openAt: a.openAt, dueAt: a.dueAt, formats: parseJson<string[]>(a.formats, []), maxSizeMB: a.maxSizeMb, allowLate: a.allowLate, allowResubmit: a.allowResubmit, gradingMode: a.gradingMode, attachments: parseJson<FileRef[]>(a.attachments, []), targetGroupIds: groupTargets.length ? groupTargets : undefined, createdBy: a.createdBy, createdAt: a.createdAt };
  });

  const filesByVersion = new Map<string, FileRef[]>();
  for (const f of fileRows) {
    const list = filesByVersion.get(f.versionId) ?? [];
    list.push({ id: f.id, name: f.name, size: f.size, mime: f.mime });
    filesByVersion.set(f.versionId, list);
  }
  const versionsBySub = new Map<string, SubmissionVersion[]>();
  for (const v of versionRows) {
    const list = versionsBySub.get(v.submissionId) ?? [];
    list.push({ no: v.no, submittedById: v.submittedById, submittedAt: v.submittedAt, text: v.text, link: v.link ?? undefined, files: filesByVersion.get(v.id) ?? [] });
    versionsBySub.set(v.submissionId, list);
  }
  const reviewBySub = new Map<string, (typeof reviewRows)[number]>();
  for (const r of reviewRows) reviewBySub.set(r.submissionId, r); // 排序後最後一筆即最新
  const assignmentSubmissions: AssignmentSubmission[] = asRows.map((s) => {
    const r = reviewBySub.get(s.id);
    return {
      id: s.id,
      assignmentId: s.assignmentId,
      ownerType: s.ownerType,
      ownerId: s.ownerId,
      draft: parseJson<AssignmentSubmission["draft"]>(s.draft, undefined),
      versions: versionsBySub.get(s.id) ?? [],
      submitStatus: s.submitStatus,
      reviewStatus: s.reviewStatus,
      review: r ? { reviewerId: r.reviewerId, score: r.score ?? undefined, comment: r.comment, requestResubmit: r.requestResubmit, reviewedAt: r.reviewedAt, readBy: parseJson<string[]>(r.readBy, []) } : undefined,
      version: s.version,
    };
  });

  const materials: Material[] = materialRows.map((m) => ({ id: m.id, courseId: m.courseId, title: m.title, type: m.type, description: m.description, url: m.url ?? undefined, file: m.fileName ? { id: `mf-${m.id}`, name: m.fileName, size: m.fileSize ?? 0, mime: m.fileMime ?? "application/octet-stream" } : undefined, uploadedBy: m.uploadedBy, createdAt: m.createdAt, pinned: m.pinned }));

  const commentsByArticle = new Map<string, Comment[]>();
  for (const c of commentRows) {
    const list = commentsByArticle.get(c.articleId) ?? [];
    list.push({ id: c.id, authorId: c.authorId, content: c.content, createdAt: c.createdAt });
    commentsByArticle.set(c.articleId, list);
  }
  const articles: Article[] = articleRows.map((a) => ({ id: a.id, authorId: a.authorId, title: a.title, content: a.content, category: a.category, tags: parseJson<string[]>(a.tags, []), visibility: a.visibility, courseId: a.courseId ?? undefined, classId: a.classId ?? undefined, link: a.link ?? undefined, createdAt: a.createdAt, comments: commentsByArticle.get(a.id) ?? [] }));

  const notifications: Notification[] = notificationRows.map((n) => ({ id: n.id, userId: n.userId, title: n.title, body: n.body, href: n.href, createdAt: n.createdAt, read: n.read }));

  return {
    users,
    classes: classRows.map((c) => ({ id: c.id, name: c.name, year: c.year })),
    enrollments: enrollmentRows.map((e) => ({ id: `${e.userId}:${e.classId}`, userId: e.userId, classId: e.classId })),
    courses: courseRows.map<Course>((c) => ({ id: c.id, classId: c.classId, unit: c.unit, title: c.title, description: c.description, teacherId: c.teacherId, date: c.date, location: c.location ?? undefined, status: c.status })),
    groups,
    forms,
    formSubmissions,
    feedback,
    assignments,
    assignmentSubmissions,
    materials,
    articles,
    notifications,
    auditLogs: auditRows.map((l) => ({ id: l.id, actorId: l.actorId, action: l.action, target: l.target, at: l.at })),
  };
}

/** 依角色裁切：學員只拿到自己（與自己小組）的提交、回覆與通知，看不到他人 Email 與操作紀錄。 */
export function scopeSnapshot(full: Snapshot, user: User): Snapshot {
  if (isStaffRole(user.role)) return { ...full, notifications: full.notifications.filter((n) => n.userId === user.id) };
  const myGroupIds = full.groups.filter((g) => g.memberIds.includes(user.id)).map((g) => g.id);
  const formSubmissions = full.formSubmissions.filter((s) => s.userId === user.id);
  const mySubIds = new Set(formSubmissions.map((s) => s.id));
  const assignmentSubmissions = full.assignmentSubmissions.filter((s) => (s.ownerType === "user" && s.ownerId === user.id) || (s.ownerType === "group" && myGroupIds.includes(s.ownerId)));
  const myAsIds = new Set(assignmentSubmissions.map((s) => s.id));
  return {
    ...full,
    users: full.users.map((u) => (u.id === user.id ? u : { ...u, email: "" })),
    formSubmissions,
    feedback: full.feedback.filter((f) => (f.targetType === "form" && mySubIds.has(f.targetId)) || (f.targetType === "assignment" && myAsIds.has(f.targetId))),
    assignmentSubmissions,
    articles: visibleArticles(full, user),
    notifications: full.notifications.filter((n) => n.userId === user.id),
    auditLogs: [],
  };
}
