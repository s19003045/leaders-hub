import { eq } from "drizzle-orm";
import * as t from "@/db/schema";
import type { Db } from "./db";
import { isStaffRole } from "./auth";
import { HttpError, forbidden, notFound } from "./http";
import type { FileRef, User } from "@/lib/types";

/**
 * R2 檔案：上傳、受保護下載、限時簽章連結。
 * 物件 key：uploads/{purpose}/{userId}/{uuid}-{檔名}
 * FileRef.id 即 key；資料表以 r2_key 參照。
 */

export type UploadPurpose = "assignment" | "material" | "form" | "article";

const LIMITS: Record<UploadPurpose, { maxMB: number; accept: RegExp }> = {
  assignment: { maxMB: 50, accept: /\.(pdf|docx?|pptx?|xlsx?|jpe?g|png|gif|webp|heic|mp3|m4a|mp4|txt)$/i },
  material: { maxMB: 100, accept: /\.(pdf|docx?|pptx?|xlsx?|jpe?g|png|gif|webp|mp3|m4a|wav|mp4|txt)$/i },
  form: { maxMB: 20, accept: /\.(pdf|jpe?g|png|gif|webp|heic)$/i },
  article: { maxMB: 10, accept: /\.(jpe?g|png|gif|webp)$/i },
};

function requireBucket(env: Cloudflare.Env) {
  if (!env.BUCKET) throw new HttpError(503, "檔案儲存空間尚未設定（R2 binding BUCKET）");
  return env.BUCKET;
}

function sanitizeName(name: string) {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(-120) || "file";
}

export async function uploadFile(env: Cloudflare.Env, user: User, req: Request): Promise<FileRef> {
  const bucket = requireBucket(env);
  const form = await req.formData().catch(() => null);
  if (!form) throw new HttpError(400, "請以 multipart/form-data 上傳");
  const file = form.get("file");
  const purpose = String(form.get("purpose") ?? "assignment") as UploadPurpose;
  if (!(file instanceof File)) throw new HttpError(400, "缺少檔案");
  const limit = LIMITS[purpose];
  if (!limit) throw new HttpError(400, "未知的用途");
  if ((purpose === "material") && !isStaffRole(user.role)) throw forbidden("只有老師、助教或管理員可以上傳教材");
  if (file.size === 0) throw new HttpError(400, "檔案是空的");
  if (file.size > limit.maxMB * 1024 * 1024) throw new HttpError(413, `檔案超過 ${limit.maxMB} MB 限制`);
  if (!limit.accept.test(file.name)) throw new HttpError(415, "不支援的檔案格式");

  const name = sanitizeName(file.name);
  const key = `uploads/${purpose}/${user.id}/${crypto.randomUUID()}-${name}`;
  await bucket.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream", contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(name)}` },
    customMetadata: { uploadedBy: user.id, purpose, originalName: name, uploadedAt: new Date().toISOString() },
  });
  return { id: key, name, size: file.size, mime: file.type || "application/octet-stream" };
}

/**
 * 檢查使用者能否讀取此 key：
 * - 老師／助教／管理員：全部
 * - 自己上傳的（key 含自己的 userId）
 * - 教材、文章圖片：所有已登入成員
 * - 作業附件：提交者本人或同組組員
 */
export async function canRead(db: Db, user: User, key: string) {
  if (isStaffRole(user.role)) return true;
  if (key.includes(`/${user.id}/`)) return true;
  if (key.startsWith("uploads/material/")) return true; // 教材與作業說明附件：所有成員可讀
  const material = await db.select({ id: t.materials.id }).from(t.materials).where(eq(t.materials.r2Key, key)).get();
  if (material) return true;
  const article = await db.select({ id: t.articles.id }).from(t.articles).where(eq(t.articles.imageR2Key, key)).get();
  if (article) return true;
  const file = await db.select({ versionId: t.assignmentFiles.versionId }).from(t.assignmentFiles).where(eq(t.assignmentFiles.r2Key, key)).get();
  if (file) {
    const version = await db.select({ submissionId: t.submissionVersions.submissionId }).from(t.submissionVersions).where(eq(t.submissionVersions.id, file.versionId)).get();
    const sub = version ? await db.select().from(t.assignmentSubmissions).where(eq(t.assignmentSubmissions.id, version.submissionId)).get() : undefined;
    if (!sub) return false;
    if (sub.ownerType === "user") return sub.ownerId === user.id;
    const member = await db.select({ id: t.groupMembers.id }).from(t.groupMembers).where(eq(t.groupMembers.groupId, sub.ownerId)).all();
    return member.length > 0 && (await isActiveMember(db, sub.ownerId, user.id));
  }
  return false;
}

async function isActiveMember(db: Db, groupId: string, userId: string) {
  const rows = await db.select({ userId: t.groupMembers.userId, leftAt: t.groupMembers.leftAt }).from(t.groupMembers).where(eq(t.groupMembers.groupId, groupId)).all();
  return rows.some((r) => r.userId === userId && !r.leftAt);
}

export async function streamFile(env: Cloudflare.Env, key: string, download: boolean) {
  const bucket = requireBucket(env);
  const obj = await bucket.get(key);
  if (!obj) throw notFound("檔案");
  const name = obj.customMetadata?.originalName ?? key.split("/").pop() ?? "file";
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "private, max-age=0, no-store");
  headers.set("content-disposition", `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(name)}`);
  headers.set("x-content-type-options", "nosniff");
  return new Response(obj.body, { headers });
}

// ---------- 限時簽章連結（可貼到 LINE 或分享給沒有登入狀態的瀏覽器；預設 15 分鐘） ----------
async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function signedLink(env: Cloudflare.Env, origin: string, key: string, ttlSeconds = 15 * 60, download = false) {
  const secret = env.FILE_LINK_SECRET;
  if (!secret) throw new HttpError(503, "尚未設定 FILE_LINK_SECRET，無法產生限時連結");
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = await hmac(secret, `${key}|${exp}`);
  const u = new URL(`/api/files/${key.split("/").map(encodeURIComponent).join("/")}`, origin);
  u.searchParams.set("exp", String(exp));
  u.searchParams.set("sig", sig);
  if (download) u.searchParams.set("download", "1");
  return { url: u.toString(), expiresAt: new Date(exp * 1000).toISOString() };
}

export async function verifySignedLink(env: Cloudflare.Env, key: string, exp: string | null, sig: string | null) {
  const secret = env.FILE_LINK_SECRET;
  if (!secret || !exp || !sig) return false;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
  const expected = await hmac(secret, `${key}|${exp}`);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

/** 提交作業／教材時確認引用的 key 確實是本人（或同組組員）上傳的，避免引用他人檔案。 */
export function assertOwnedKeys(files: FileRef[], allowedUserIds: string[], purpose: UploadPurpose) {
  for (const f of files) {
    if (!f.id.startsWith(`uploads/${purpose}/`)) throw new HttpError(400, `${f.name} 不是有效的上傳檔案`);
    if (!allowedUserIds.some((uid) => f.id.startsWith(`uploads/${purpose}/${uid}/`))) throw forbidden(`${f.name} 不是你上傳的檔案`);
  }
}
