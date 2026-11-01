/**
 * 領域型別：對應需求書第九章的資料表。
 * 第一階段以記憶體 / localStorage 模擬；第二階段對應 db/schema.ts（Drizzle + D1）。
 */

export type Role = "student" | "teacher" | "ta" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  title?: string; // 顯示用職稱，例如「講師」「助教」
  company?: string; // 職場領袖的服務單位（選填）
  active: boolean;
  createdAt: string;
}

export interface Class {
  id: string;
  name: string; // 例如「2026 職場領袖聚集」
  year: string;
}

export interface Enrollment {
  id: string;
  userId: string;
  classId: string;
}

export interface Course {
  id: string;
  classId: string;
  title: string; // 例如「第六課：在職場中作光作鹽」
  unit: string; // 單元編號，例如「第六課」
  description: string;
  teacherId: string;
  date: string; // 上課日期 ISO
  location?: string;
  status: "upcoming" | "active" | "done";
}

export interface GroupHistory {
  at: string;
  action: string;
  byUserId: string;
}

export interface Group {
  id: string;
  classId: string;
  name: string;
  leaderId: string | null;
  memberIds: string[];
  history: GroupHistory[];
}

export type QuestionType = "short" | "long" | "single" | "multi" | "rating" | "date" | "file";

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;
  options?: string[]; // 單選 / 多選
  max?: number; // 評分題上限（預設 5）
}

export interface Form {
  id: string;
  courseId: string;
  title: string;
  description: string;
  openAt: string;
  dueAt: string;
  allowEdit: boolean;
  allowLate: boolean;
  questions: Question[];
  createdBy: string;
  createdAt: string;
}

export type AnswerValue = string | string[] | number | FileRef[] | null;

export interface FormSubmission {
  id: string;
  formId: string;
  userId: string;
  status: "draft" | "submitted";
  answers: Record<string, AnswerValue>;
  submittedAt?: string;
  updatedAt: string;
  version: number;
}

export interface Feedback {
  id: string;
  targetType: "form" | "assignment";
  targetId: string; // submission id
  questionId?: string; // 針對個別題目
  authorId: string;
  content: string;
  createdAt: string;
  readBy: string[];
}

export interface FileRef {
  id: string;
  name: string;
  size: number; // bytes
  mime: string;
  url?: string; // 第二階段：R2 限時連結
}

export type AssignmentType = "individual" | "group";
export type GradingMode = "score" | "comment" | "both";

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  type: AssignmentType;
  description: string;
  openAt: string;
  dueAt: string;
  formats: string[]; // 允許上傳格式
  maxSizeMB: number;
  allowLate: boolean;
  allowResubmit: boolean;
  gradingMode: GradingMode;
  attachments: FileRef[];
  targetGroupIds?: string[]; // 分組作業指派對象；空代表全部小組
  createdBy: string;
  createdAt: string;
}

export type SubmitStatus =
  | "not_submitted"
  | "draft"
  | "submitted"
  | "late"
  | "resubmitted";

export type ReviewStatus = "pending" | "reviewing" | "reviewed" | "needs_revision";

export interface SubmissionVersion {
  no: number;
  submittedById: string;
  submittedAt: string;
  text: string;
  files: FileRef[];
  link?: string;
}

export interface AssignmentReview {
  reviewerId: string;
  score?: number;
  comment: string;
  requestResubmit: boolean;
  reviewedAt: string;
  readBy: string[];
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  ownerType: "user" | "group";
  ownerId: string; // userId 或 groupId
  draft?: { text: string; link?: string; files: FileRef[]; savedById: string; savedAt: string };
  versions: SubmissionVersion[];
  submitStatus: SubmitStatus;
  reviewStatus: ReviewStatus;
  review?: AssignmentReview;
  version: number; // 樂觀鎖，用於多人同時提交的衝突偵測
}

export type MaterialType = "pdf" | "doc" | "ppt" | "image" | "audio" | "video" | "link";

export interface Material {
  id: string;
  courseId: string;
  title: string;
  type: MaterialType;
  description: string;
  url?: string;
  file?: FileRef;
  uploadedBy: string;
  createdAt: string;
  pinned?: boolean; // 課前預讀
}

export type ArticleVisibility = "draft" | "course" | "class" | "all";

export interface Comment {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface Article {
  id: string;
  authorId: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  visibility: ArticleVisibility;
  courseId?: string;
  classId?: string;
  link?: string;
  imageUrl?: string;
  createdAt: string;
  comments: Comment[];
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  read: boolean;
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  target: string;
  at: string;
}

export interface Snapshot {
  users: User[];
  classes: Class[];
  enrollments: Enrollment[];
  courses: Course[];
  groups: Group[];
  forms: Form[];
  formSubmissions: FormSubmission[];
  feedback: Feedback[];
  assignments: Assignment[];
  assignmentSubmissions: AssignmentSubmission[];
  materials: Material[];
  articles: Article[];
  notifications: Notification[];
  auditLogs: AuditLog[];
}
