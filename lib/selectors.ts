import type {
  Article,
  Assignment,
  AssignmentSubmission,
  Course,
  Feedback,
  Form,
  FormSubmission,
  Group,
  Material,
  Snapshot,
  User,
} from "./types";

/** 純函式選擇器：從 Snapshot 推導畫面所需資料。第二階段可直接搬到 Workers 端。 */

export const userById = (data: Snapshot, id: string | null | undefined) => data.users.find((u) => u.id === id);
export const userName = (data: Snapshot, id: string | null | undefined) => userById(data, id)?.name ?? "（未知）";
export const courseById = (data: Snapshot, id: string) => data.courses.find((c) => c.id === id);
export const groupOfUser = (data: Snapshot, userId: string): Group | undefined => data.groups.find((g) => g.memberIds.includes(userId));
export const students = (data: Snapshot) => data.users.filter((u) => u.role === "student" && u.active);
export const isStaff = (u: User | null | undefined) => !!u && (u.role === "teacher" || u.role === "ta" || u.role === "admin");

export function sortByDate<T>(items: T[], pick: (t: T) => string, dir: "asc" | "desc" = "desc") {
  return [...items].sort((a, b) => (new Date(pick(a)).getTime() - new Date(pick(b)).getTime()) * (dir === "asc" ? 1 : -1));
}

// ---------- 表單 ----------
export interface FormView {
  form: Form;
  course?: Course;
  submission?: FormSubmission;
  isOpen: boolean;
  isOverdue: boolean;
  feedback: Feedback[];
  unreadFeedback: Feedback[];
}

export function formViewsForUser(data: Snapshot, userId: string, now = Date.now()): FormView[] {
  return data.forms
    .map((form) => {
      const submission = data.formSubmissions.find((s) => s.formId === form.id && s.userId === userId);
      const feedback = submission ? data.feedback.filter((f) => f.targetType === "form" && f.targetId === submission.id) : [];
      return {
        form,
        course: courseById(data, form.courseId),
        submission,
        isOpen: new Date(form.openAt).getTime() <= now,
        isOverdue: new Date(form.dueAt).getTime() < now,
        feedback,
        unreadFeedback: feedback.filter((f) => !f.readBy.includes(userId)),
      };
    })
    .filter((v) => v.isOpen || v.submission);
}

export const pendingForms = (views: FormView[]) => views.filter((v) => v.isOpen && v.submission?.status !== "submitted").sort((a, b) => a.form.dueAt.localeCompare(b.form.dueAt));
export const completedForms = (views: FormView[]) => views.filter((v) => v.submission?.status === "submitted").sort((a, b) => (b.submission?.submittedAt ?? "").localeCompare(a.submission?.submittedAt ?? ""));

// ---------- 作業 ----------
export interface AssignmentView {
  assignment: Assignment;
  course?: Course;
  group?: Group; // 分組作業時
  submission?: AssignmentSubmission;
  isOpen: boolean;
  isOverdue: boolean;
  needsAction: boolean; // 尚未繳交、草稿、或需要修改
  unreadReview: boolean;
}

export function assignmentViewsForUser(data: Snapshot, userId: string, now = Date.now()): AssignmentView[] {
  const group = groupOfUser(data, userId);
  return data.assignments
    .filter((a) => a.type === "individual" || !group || !a.targetGroupIds?.length || a.targetGroupIds.includes(group.id))
    .map((assignment) => {
      const submission =
        assignment.type === "individual"
          ? data.assignmentSubmissions.find((s) => s.assignmentId === assignment.id && s.ownerType === "user" && s.ownerId === userId)
          : group
            ? data.assignmentSubmissions.find((s) => s.assignmentId === assignment.id && s.ownerType === "group" && s.ownerId === group.id)
            : undefined;
      const isOpen = new Date(assignment.openAt).getTime() <= now;
      const submitted = !!submission && submission.versions.length > 0;
      const needsAction = isOpen && (!submitted || submission?.reviewStatus === "needs_revision");
      return {
        assignment,
        course: courseById(data, assignment.courseId),
        group: assignment.type === "group" ? group : undefined,
        submission,
        isOpen,
        isOverdue: new Date(assignment.dueAt).getTime() < now,
        needsAction,
        unreadReview: !!submission?.review && !submission.review.readBy.includes(userId),
      };
    });
}

export function effectiveSubmitStatus(view: AssignmentView) {
  if (!view.submission) return "not_submitted" as const;
  return view.submission.submitStatus;
}

// ---------- 教材 / 文章 ----------
export function visibleMaterials(data: Snapshot): Material[] {
  return sortByDate(data.materials, (m) => m.createdAt);
}

export function visibleArticles(data: Snapshot, user: User): Article[] {
  const group = groupOfUser(data, user.id);
  const classIds = new Set(data.enrollments.filter((e) => e.userId === user.id).map((e) => e.classId));
  if (group) classIds.add(group.classId);
  return sortByDate(
    data.articles.filter((a) => {
      if (a.visibility === "draft") return a.authorId === user.id;
      if (isStaff(user)) return true;
      if (a.visibility === "all") return true;
      if (a.visibility === "class") return !a.classId || classIds.has(a.classId);
      if (a.visibility === "course") return true; // 第一階段：同班所有課程皆可見
      return false;
    }),
    (a) => a.createdAt,
  );
}

// ---------- 統計 ----------
export interface AssignmentStat {
  assignment: Assignment;
  course?: Course;
  expected: number;
  submitted: number;
  late: number;
  reviewed: number;
  rate: number;
  unit: "人" | "組";
}

export function assignmentStats(data: Snapshot): AssignmentStat[] {
  const studentIds = students(data).map((s) => s.id);
  return data.assignments.map((assignment) => {
    const subs = data.assignmentSubmissions.filter((s) => s.assignmentId === assignment.id && s.versions.length > 0);
    const targets = assignment.type === "group" ? (assignment.targetGroupIds?.length ? assignment.targetGroupIds : data.groups.map((g) => g.id)) : studentIds;
    const expected = targets.length;
    const submitted = subs.filter((s) => targets.includes(s.ownerId)).length;
    return {
      assignment,
      course: courseById(data, assignment.courseId),
      expected,
      submitted,
      late: subs.filter((s) => s.submitStatus === "late").length,
      reviewed: subs.filter((s) => s.reviewStatus === "reviewed").length,
      rate: expected ? Math.round((submitted / expected) * 1000) / 10 : 0,
      unit: assignment.type === "group" ? "組" : "人",
    };
  });
}

export interface FormStat {
  form: Form;
  course?: Course;
  expected: number;
  submitted: number;
  rate: number;
}

export function formStats(data: Snapshot): FormStat[] {
  const expected = students(data).length;
  return data.forms.map((form) => {
    const submitted = data.formSubmissions.filter((s) => s.formId === form.id && s.status === "submitted").length;
    return { form, course: courseById(data, form.courseId), expected, submitted, rate: expected ? Math.round((submitted / expected) * 1000) / 10 : 0 };
  });
}

export interface StudentCompletion {
  user: User;
  group?: Group;
  forms: { done: number; total: number };
  individual: { done: number; total: number };
  group_: { done: number; total: number };
  late: number;
}

export function studentCompletion(data: Snapshot, now = Date.now()): StudentCompletion[] {
  const openForms = data.forms.filter((f) => new Date(f.openAt).getTime() <= now);
  return students(data).map((user) => {
    const group = groupOfUser(data, user.id);
    const views = assignmentViewsForUser(data, user.id, now).filter((v) => v.isOpen);
    const ind = views.filter((v) => v.assignment.type === "individual");
    const grp = views.filter((v) => v.assignment.type === "group");
    const done = (v: AssignmentView) => !!v.submission && v.submission.versions.length > 0;
    return {
      user,
      group,
      forms: { done: openForms.filter((f) => data.formSubmissions.some((s) => s.formId === f.id && s.userId === user.id && s.status === "submitted")).length, total: openForms.length },
      individual: { done: ind.filter(done).length, total: ind.length },
      group_: { done: grp.filter(done).length, total: grp.length },
      late: views.filter((v) => v.submission?.submitStatus === "late").length,
    };
  });
}

export function groupCompletion(data: Snapshot, now = Date.now()) {
  const groupAssignments = data.assignments.filter((a) => a.type === "group" && new Date(a.openAt).getTime() <= now);
  return data.groups.map((group) => {
    const applicable = groupAssignments.filter((a) => !a.targetGroupIds?.length || a.targetGroupIds.includes(group.id));
    const done = applicable.filter((a) => data.assignmentSubmissions.some((s) => s.assignmentId === a.id && s.ownerType === "group" && s.ownerId === group.id && s.versions.length > 0)).length;
    return { group, done, total: applicable.length, leader: userById(data, group.leaderId) };
  });
}

export function courseCompletion(data: Snapshot) {
  const aStats = assignmentStats(data);
  const fStats = formStats(data);
  return data.courses.map((course) => {
    const a = aStats.filter((s) => s.assignment.courseId === course.id);
    const f = fStats.filter((s) => s.form.courseId === course.id);
    const expected = a.reduce((n, s) => n + s.expected, 0) + f.reduce((n, s) => n + s.expected, 0);
    const done = a.reduce((n, s) => n + s.submitted, 0) + f.reduce((n, s) => n + s.submitted, 0);
    return { course, expected, done, rate: expected ? Math.round((done / expected) * 1000) / 10 : 0, assignments: a.length, forms: f.length };
  });
}

/** 單選 / 多選 / 評分題統計 */
export function questionStats(data: Snapshot, form: Form) {
  const subs = data.formSubmissions.filter((s) => s.formId === form.id && s.status === "submitted");
  return form.questions.map((q) => {
    if (q.type === "single" || q.type === "multi") {
      const counts = Object.fromEntries((q.options ?? []).map((o) => [o, 0])) as Record<string, number>;
      for (const s of subs) {
        const v = s.answers[q.id];
        const values = Array.isArray(v) ? (v as string[]) : typeof v === "string" ? [v] : [];
        for (const x of values) if (x in counts) counts[x] += 1;
      }
      return { question: q, kind: "choice" as const, counts, total: subs.length };
    }
    if (q.type === "rating") {
      const values = subs.map((s) => Number(s.answers[q.id])).filter((n) => Number.isFinite(n) && n > 0);
      const avg = values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0;
      const dist = Object.fromEntries(Array.from({ length: q.max ?? 5 }, (_, i) => [String(i + 1), values.filter((v) => v === i + 1).length]));
      return { question: q, kind: "rating" as const, avg, dist, total: values.length };
    }
    const texts = subs.map((s) => ({ userId: s.userId, value: String(s.answers[q.id] ?? "") })).filter((t) => t.value.trim());
    return { question: q, kind: "text" as const, texts, total: texts.length };
  });
}

export function unreadCounts(data: Snapshot, user: User) {
  const notifications = data.notifications.filter((n) => n.userId === user.id && !n.read).length;
  const views = formViewsForUser(data, user.id);
  const feedback = views.reduce((n, v) => n + v.unreadFeedback.length, 0);
  const reviews = assignmentViewsForUser(data, user.id).filter((v) => v.unreadReview).length;
  return { notifications, feedback, reviews };
}
