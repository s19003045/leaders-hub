"use client";

import { useSyncExternalStore } from "react";
import type { Article, Assignment, AnswerValue, Course, FileRef, Form, Group, Material, Snapshot, User } from "./types";

/**
 * 第二階段資料層：前端只保留一份由 /api/state 取得的快照（依角色裁切），
 * 所有寫入都呼叫 Workers API（→ D1），成功後重新載入快照。
 *
 * 方法名稱與第一階段相同，頁面呼叫方式不變（改為 async）。
 */

export class ConflictError extends Error {
  constructor(message = "資料已被其他人更新，請重新載入後再試。") {
    super(message);
    this.name = "ConflictError";
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const emptySnapshot: Snapshot = { users: [], classes: [], enrollments: [], courses: [], groups: [], forms: [], formSubmissions: [], feedback: [], assignments: [], assignmentSubmissions: [], materials: [], articles: [], notifications: [], auditLogs: [] };

export interface Features {
  line: boolean;
  lineGroup: boolean;
  r2: boolean;
  signedLinks: boolean;
}

interface StoreState {
  data: Snapshot;
  currentUser: User | null;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  features: Features;
}

type Listener = () => void;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  let payload: { error?: string } & T;
  try {
    payload = (await res.json()) as { error?: string } & T;
  } catch {
    payload = {} as { error?: string } & T;
  }
  if (!res.ok) {
    const message = payload.error ?? `請求失敗（${res.status}）`;
    if (res.status === 409) throw new ConflictError(message);
    throw new ApiError(res.status, message);
  }
  return payload;
}

class AppStore {
  private state: StoreState = { data: emptySnapshot, currentUser: null, hydrated: false, loading: false, error: null, features: { line: false, lineGroup: false, r2: false, signedLinks: false } };
  private listeners = new Set<Listener>();
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  getState = () => this.state;
  getServerState = () => this.state;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<StoreState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  /** 進入網站時載入；之後視窗回到前景或每 60 秒重新整理一次（多人同時操作時保持新鮮）。 */
  async hydrate() {
    if (typeof window === "undefined" || this.state.hydrated) return;
    await Promise.all([this.refresh(), this.loadFeatures()]);
    this.set({ hydrated: true });
    window.addEventListener("focus", () => void this.refresh());
    this.refreshTimer ??= setInterval(() => void this.refresh(), 60_000);
  }

  private async loadFeatures() {
    try {
      const res = await fetch("/api/me", { credentials: "same-origin" });
      if (res.ok) {
        const { features } = (await res.json()) as { features?: Features };
        if (features) this.set({ features });
      }
    } catch {
      /* ignore */
    }
  }

  async refresh() {
    try {
      const res = await fetch("/api/state", { credentials: "same-origin" });
      if (res.status === 401) {
        this.set({ data: emptySnapshot, currentUser: null, error: null });
        return;
      }
      if (!res.ok) throw new Error(`載入失敗（${res.status}）`);
      const { snapshot, user } = (await res.json()) as { snapshot: Snapshot; user: User };
      this.set({ data: snapshot, currentUser: user, error: null });
    } catch (e) {
      this.set({ error: (e as Error).message });
    }
  }

  private async mutate<T>(method: string, path: string, body?: unknown): Promise<T> {
    const result = await request<T>(method, path, body);
    await this.refresh();
    return result;
  }

  // ---------- 登入（示範身分；正式環境由 Sites 的 ChatGPT 登入提供身分） ----------
  async loginDemo(userId: string) {
    await request("POST", "demo/login", { userId });
    await this.refresh();
  }

  async logout() {
    await request("POST", "demo/logout").catch(() => undefined);
    this.set({ data: emptySnapshot, currentUser: null });
  }

  async resetDemo() {
    await this.mutate("POST", "demo/reset");
  }

  // ---------- 表單 ----------
  /** userId 由伺服器端身分決定；參數保留以相容第一階段呼叫方式。 */
  saveFormAnswers(formId: string, _userId: string, answers: Record<string, AnswerValue>, submit: boolean) {
    return this.mutate("POST", `forms/${formId}/answers`, { answers, submit });
  }

  addFeedback(input: { targetType: "form" | "assignment"; targetId: string; questionId?: string; content: string }) {
    return this.mutate("POST", "feedback", input);
  }

  markFeedbackRead(feedbackIds: string[], _userId: string) {
    if (feedbackIds.length === 0) return Promise.resolve();
    return this.mutate("POST", "feedback/read", { ids: feedbackIds });
  }

  async createForm(input: Omit<Form, "id" | "createdAt" | "createdBy">) {
    const { id } = await this.mutate<{ id: string }>("POST", "forms", input);
    return id;
  }

  // ---------- 作業 ----------
  saveAssignmentDraft(assignmentId: string, ownerType: "user" | "group", ownerId: string, payload: { text: string; link?: string; files: FileRef[] }) {
    return this.mutate("POST", `assignments/${assignmentId}/draft`, { ownerType, ownerId, payload });
  }

  /** expectedVersion：畫面載入時的版本；不符代表其他組員剛提交（409 → ConflictError）。 */
  submitAssignment(assignmentId: string, ownerType: "user" | "group", ownerId: string, payload: { text: string; link?: string; files: FileRef[] }, expectedVersion: number | null) {
    return this.mutate("POST", `assignments/${assignmentId}/submit`, { ownerType, ownerId, payload, expectedVersion });
  }

  reviewAssignment(submissionId: string, input: { score?: number; comment: string; requestResubmit: boolean }) {
    return this.mutate("POST", `submissions/${submissionId}/review`, input);
  }

  markReviewRead(submissionId: string, _userId: string) {
    return this.mutate("POST", `submissions/${submissionId}/read`, {});
  }

  async createAssignment(input: Omit<Assignment, "id" | "createdAt" | "createdBy">) {
    const { id } = await this.mutate<{ id: string }>("POST", "assignments", input);
    return id;
  }

  updateAssignment(id: string, patch: Partial<Assignment>) {
    return this.mutate("PUT", `assignments/${id}`, patch);
  }

  // ---------- 教材 ----------
  async addMaterial(input: Omit<Material, "id" | "createdAt" | "uploadedBy">) {
    const { id } = await this.mutate<{ id: string }>("POST", "materials", input);
    return id;
  }

  removeMaterial(id: string) {
    return this.mutate("DELETE", `materials/${id}`);
  }

  // ---------- 文章 ----------
  async createArticle(input: Omit<Article, "id" | "createdAt" | "authorId" | "comments">) {
    const { id } = await this.mutate<{ id: string }>("POST", "articles", input);
    return id;
  }

  updateArticle(id: string, patch: Partial<Article>) {
    return this.mutate("PUT", `articles/${id}`, patch);
  }

  deleteArticle(id: string) {
    return this.mutate("DELETE", `articles/${id}`);
  }

  addComment(articleId: string, content: string) {
    return this.mutate("POST", `articles/${articleId}/comments`, { content });
  }

  // ---------- 小組 / 帳號 ----------
  upsertGroup(group: Omit<Group, "history"> & { history?: Group["history"] }, action: string) {
    const { id, classId, name, leaderId, memberIds } = group;
    return this.mutate("PUT", `groups/${id}`, { group: { id, classId, name, leaderId, memberIds }, action });
  }

  upsertUser(user: User) {
    const { id, name, email, role, title, company, active } = user;
    return this.mutate("PUT", `users/${id}`, { name, email, role, title, company, active });
  }

  // ---------- 檔案（R2） ----------
  async uploadFile(file: File, purpose: "assignment" | "material" | "form" | "article"): Promise<FileRef> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("purpose", purpose);
    const res = await fetch("/api/uploads", { method: "POST", body: fd, credentials: "same-origin" });
    const payload = (await res.json().catch(() => ({}))) as { error?: string } & FileRef;
    if (!res.ok) throw new ApiError(res.status, payload.error ?? `上傳失敗（${res.status}）`);
    return payload;
  }

  /** 限時簽章連結（15 分鐘），可在新分頁開啟或貼到 LINE。 */
  fileLink(key: string, download = false) {
    return request<{ url: string; expiresAt: string }>("POST", "files/link", { key, download });
  }

  // ---------- 提醒 / LINE ----------
  remind(type: "form" | "assignment", id: string) {
    return this.mutate<{ title: string; notified: number; linePersonal: number; lineGroup: boolean; done: number; total: number }>("POST", "reminders", { type, id });
  }

  lineBindCode() {
    return request<{ code: string }>("POST", "line/bind-code", {});
  }

  unbindLine() {
    return this.mutate("POST", "line/unbind", {});
  }

  // ---------- 課程 / 表單編輯 ----------
  async upsertCourse(id: string | null, input: Omit<Course, "id" | "classId" | "teacherId"> & { teacherId?: string }) {
    const res = await this.mutate<{ id: string }>(id ? "PUT" : "POST", id ? `courses/${id}` : "courses", input);
    return res.id;
  }

  updateForm(id: string, input: Omit<Form, "id" | "createdAt" | "createdBy" | "questions"> & { questions?: Form["questions"] }) {
    return this.mutate("PUT", `forms/${id}`, input);
  }

  // ---------- 通知 ----------
  markNotificationsRead(ids: string[]) {
    if (ids.length === 0) return Promise.resolve();
    return this.mutate("POST", "notifications/read", { ids });
  }
}

export const store = new AppStore();

export function useStoreState() {
  return useSyncExternalStore(store.subscribe, store.getState, store.getServerState);
}

export function useData(): Snapshot {
  return useStoreState().data;
}

export function useCurrentUser(): User | null {
  return useStoreState().currentUser;
}

export function useHydrated() {
  return useStoreState().hydrated;
}

export function useFeatures() {
  return useStoreState().features;
}
