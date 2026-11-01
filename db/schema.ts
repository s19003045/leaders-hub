import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * 第二階段資料庫架構（Cloudflare D1 / SQLite，Drizzle ORM）。
 * 對應需求書第九章；JSON 欄位以 text 儲存（D1 支援 json_extract）。
 * 第一階段尚未使用；lib/types.ts 的型別即這些表的應用層形狀。
 */

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  chatgptUserId: text("chatgpt_user_id"), // 首次以 ChatGPT 登入後綁定
  name: text("name").notNull(),
  role: text("role", { enum: ["student", "teacher", "ta", "admin"] }).notNull().default("student"),
  title: text("title"),
  company: text("company"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  lineUserId: text("line_user_id"), // 綁定 LINE 官方帳號後的使用者 ID（個人推播用）
  lineBindCode: text("line_bind_code"), // 綁定代碼（使用者在 LINE 傳送此代碼完成綁定）
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** 平台設定與排程狀態（key/value），例如提醒最後執行時間、已送出的提醒記錄。 */
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const classes = sqliteTable("classes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  year: text("year").notNull(),
});

export const enrollments = sqliteTable(
  "enrollments",
  {
    userId: text("user_id").notNull().references(() => users.id),
    classId: text("class_id").notNull().references(() => classes.id),
    createdAt: text("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.classId] })],
);

export const courses = sqliteTable(
  "courses",
  {
    id: text("id").primaryKey(),
    classId: text("class_id").notNull().references(() => classes.id),
    unit: text("unit").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    teacherId: text("teacher_id").notNull().references(() => users.id),
    date: text("date").notNull(),
    location: text("location"),
    status: text("status", { enum: ["upcoming", "active", "done"] }).notNull().default("upcoming"),
  },
  (t) => [index("courses_class_idx").on(t.classId, t.date)],
);

export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  classId: text("class_id").notNull().references(() => classes.id),
  name: text("name").notNull(),
  leaderId: text("leader_id").references(() => users.id),
  history: text("history").notNull().default("[]"), // JSON GroupHistory[]
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
});

/** 小組成員含歷史：leftAt 為 null 代表現任組員；異動不刪除列，作業紀錄因此可追溯。 */
export const groupMembers = sqliteTable(
  "group_members",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id").notNull().references(() => groups.id),
    userId: text("user_id").notNull().references(() => users.id),
    joinedAt: text("joined_at").notNull(),
    leftAt: text("left_at"),
    changedBy: text("changed_by").notNull(),
  },
  (t) => [index("group_members_group_idx").on(t.groupId, t.leftAt), index("group_members_user_idx").on(t.userId, t.leftAt)],
);

export const forms = sqliteTable(
  "forms",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id").notNull().references(() => courses.id),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    openAt: text("open_at").notNull(),
    dueAt: text("due_at").notNull(),
    allowEdit: integer("allow_edit", { mode: "boolean" }).notNull().default(true),
    allowLate: integer("allow_late", { mode: "boolean" }).notNull().default(true),
    createdBy: text("created_by").notNull().references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("forms_course_idx").on(t.courseId, t.dueAt)],
);

export const questions = sqliteTable(
  "questions",
  {
    id: text("id").primaryKey(),
    formId: text("form_id").notNull().references(() => forms.id),
    order: integer("order").notNull(),
    type: text("type", { enum: ["short", "long", "single", "multi", "rating", "date", "file"] }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    required: integer("required", { mode: "boolean" }).notNull().default(false),
    options: text("options"), // JSON string[]
    max: integer("max"),
  },
  (t) => [index("questions_form_idx").on(t.formId, t.order)],
);

export const formSubmissions = sqliteTable(
  "form_submissions",
  {
    id: text("id").primaryKey(),
    formId: text("form_id").notNull().references(() => forms.id),
    userId: text("user_id").notNull().references(() => users.id),
    status: text("status", { enum: ["draft", "submitted"] }).notNull().default("draft"),
    submittedAt: text("submitted_at"),
    updatedAt: text("updated_at").notNull(),
    version: integer("version").notNull().default(1),
  },
  (t) => [uniqueIndex("form_submissions_unique_idx").on(t.formId, t.userId)],
);

export const answers = sqliteTable(
  "answers",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id").notNull().references(() => formSubmissions.id),
    questionId: text("question_id").notNull().references(() => questions.id),
    value: text("value"), // JSON（字串、字串陣列、數字或檔案參照）
  },
  (t) => [uniqueIndex("answers_submission_question_idx").on(t.submissionId, t.questionId)],
);

export const feedback = sqliteTable(
  "feedback",
  {
    id: text("id").primaryKey(),
    targetType: text("target_type", { enum: ["form", "assignment"] }).notNull(),
    targetId: text("target_id").notNull(),
    questionId: text("question_id"),
    authorId: text("author_id").notNull().references(() => users.id),
    content: text("content").notNull(),
    createdAt: text("created_at").notNull(),
    readBy: text("read_by").notNull().default("[]"), // JSON string[]
  },
  (t) => [index("feedback_target_idx").on(t.targetType, t.targetId)],
);

export const assignments = sqliteTable(
  "assignments",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id").notNull().references(() => courses.id),
    title: text("title").notNull(),
    type: text("type", { enum: ["individual", "group"] }).notNull(),
    description: text("description").notNull(),
    openAt: text("open_at").notNull(),
    dueAt: text("due_at").notNull(),
    formats: text("formats").notNull().default("[]"), // JSON string[]
    maxSizeMb: integer("max_size_mb").notNull().default(10),
    allowLate: integer("allow_late", { mode: "boolean" }).notNull().default(true),
    allowResubmit: integer("allow_resubmit", { mode: "boolean" }).notNull().default(true),
    gradingMode: text("grading_mode", { enum: ["score", "comment", "both"] }).notNull().default("both"),
    attachments: text("attachments").notNull().default("[]"), // JSON FileRef[]（說明文件／範例）
    createdBy: text("created_by").notNull().references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("assignments_course_idx").on(t.courseId, t.dueAt)],
);

/** 作業指派對象：個人作業指派給 user，分組作業指派給 group。 */
export const assignmentTargets = sqliteTable(
  "assignment_targets",
  {
    assignmentId: text("assignment_id").notNull().references(() => assignments.id),
    targetType: text("target_type", { enum: ["user", "group"] }).notNull(),
    targetId: text("target_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.assignmentId, t.targetType, t.targetId] })],
);

export const assignmentSubmissions = sqliteTable(
  "assignment_submissions",
  {
    id: text("id").primaryKey(),
    assignmentId: text("assignment_id").notNull().references(() => assignments.id),
    ownerType: text("owner_type", { enum: ["user", "group"] }).notNull(),
    ownerId: text("owner_id").notNull(),
    submitStatus: text("submit_status", { enum: ["not_submitted", "draft", "submitted", "late", "resubmitted"] }).notNull().default("not_submitted"),
    reviewStatus: text("review_status", { enum: ["pending", "reviewing", "reviewed", "needs_revision"] }).notNull().default("pending"),
    draft: text("draft"), // JSON：{text, link, files, savedById, savedAt}
    version: integer("version").notNull().default(1), // 樂觀鎖：UPDATE … WHERE version = ?
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("assignment_submissions_owner_idx").on(t.assignmentId, t.ownerType, t.ownerId)],
);

/** 每次正式提交一列；保留所有版本與實際提交者。 */
export const submissionVersions = sqliteTable(
  "submission_versions",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id").notNull().references(() => assignmentSubmissions.id),
    no: integer("no").notNull(),
    submittedById: text("submitted_by_id").notNull().references(() => users.id),
    submittedAt: text("submitted_at").notNull(),
    text: text("text").notNull().default(""),
    link: text("link"),
  },
  (t) => [index("submission_versions_idx").on(t.submissionId, t.no)],
);

export const assignmentFiles = sqliteTable(
  "assignment_files",
  {
    id: text("id").primaryKey(),
    versionId: text("version_id").notNull().references(() => submissionVersions.id),
    name: text("name").notNull(),
    size: integer("size").notNull(),
    mime: text("mime").notNull(),
    r2Key: text("r2_key").notNull(), // 私人附件存 R2，下載時簽發限時連結
    uploadedAt: text("uploaded_at").notNull(),
  },
  (t) => [index("assignment_files_version_idx").on(t.versionId)],
);

export const assignmentReviews = sqliteTable("assignment_reviews", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull().references(() => assignmentSubmissions.id),
  reviewerId: text("reviewer_id").notNull().references(() => users.id),
  score: integer("score"),
  comment: text("comment").notNull().default(""),
  requestResubmit: integer("request_resubmit", { mode: "boolean" }).notNull().default(false),
  reviewedAt: text("reviewed_at").notNull(),
  readBy: text("read_by").notNull().default("[]"),
});

export const materials = sqliteTable(
  "materials",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id").notNull().references(() => courses.id),
    title: text("title").notNull(),
    type: text("type", { enum: ["pdf", "doc", "ppt", "image", "audio", "video", "link"] }).notNull(),
    description: text("description").notNull().default(""),
    url: text("url"),
    fileName: text("file_name"),
    fileSize: integer("file_size"),
    fileMime: text("file_mime"),
    r2Key: text("r2_key"),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    uploadedBy: text("uploaded_by").notNull().references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("materials_course_idx").on(t.courseId, t.createdAt)],
);

export const articles = sqliteTable(
  "articles",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id").notNull().references(() => users.id),
    title: text("title").notNull(),
    content: text("content").notNull(),
    category: text("category").notNull(),
    tags: text("tags").notNull().default("[]"),
    visibility: text("visibility", { enum: ["draft", "course", "class", "all"] }).notNull().default("all"),
    courseId: text("course_id"),
    classId: text("class_id"),
    link: text("link"),
    imageR2Key: text("image_r2_key"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("articles_created_idx").on(t.createdAt)],
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    articleId: text("article_id").notNull().references(() => articles.id),
    authorId: text("author_id").notNull().references(() => users.id),
    content: text("content").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("comments_article_idx").on(t.articleId, t.createdAt)],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    href: text("href").notNull().default("/"),
    channel: text("channel", { enum: ["app", "line", "email"] }).notNull().default("app"),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.read, t.createdAt)],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    target: text("target").notNull(),
    at: text("at").notNull(),
  },
  (t) => [index("audit_logs_at_idx").on(t.at)],
);
