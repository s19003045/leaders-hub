import { env } from "cloudflare:workers";
import { ZodError } from "zod";
import { eq } from "drizzle-orm";
import { getChatGPTUser } from "@/lib/chatgpt-auth";
import { users } from "@/db/schema";
import { DEMO_COOKIE, identify, isStaffRole } from "@/lib/server/auth";
import { runWithRequestContext } from "@/lib/server/context";
import { requireDb } from "@/lib/server/db";
import { canRead, signedLink, streamFile, uploadFile, verifySignedLink } from "@/lib/server/files";
import { HttpError, forbidden, json, readJson, setCookie, unauthorized } from "@/lib/server/http";
import { replyText, verifySignature, type LineEvent } from "@/lib/server/line";
import * as m from "@/lib/server/mutations";
import { remindAssignment, remindForm, runDueReminders } from "@/lib/server/reminders";
import { clearAll, isEmpty, seedDatabase } from "@/lib/server/seed-db";
import { loadSnapshot, scopeSnapshot } from "@/lib/server/snapshot";

/**
 * Workers API 路由。
 *
 * 身分：每個請求由 Sites 帶入 ChatGPT 登入 header → identify() 對應 users 表。
 * 授權：所有規則在 lib/server/* 伺服器端檢查。
 *
 *   GET  /api/health
 *   GET  /api/me                         目前身分
 *   GET  /api/state                      依角色裁切的完整快照（順帶執行惰性截止提醒）
 *   POST /api/forms, PUT /api/forms/:id, POST /api/forms/:id/answers
 *   POST /api/feedback, POST /api/feedback/read
 *   POST /api/assignments, PUT /api/assignments/:id, POST /api/assignments/:id/draft|submit
 *   POST /api/submissions/:id/review|read
 *   POST /api/materials, DELETE /api/materials/:id
 *   POST /api/articles, PUT|DELETE /api/articles/:id, POST /api/articles/:id/comments
 *   PUT  /api/groups/:id, PUT /api/users/:id, POST|PUT /api/courses[/:id]
 *   POST /api/notifications/read
 *   POST /api/uploads                    multipart：file、purpose → R2，回傳 FileRef
 *   GET  /api/files/{key}                受保護下載（登入＋權限，或限時簽章 exp/sig）
 *   POST /api/files/link                 產生限時簽章連結 { key, download }
 *   POST /api/reminders                  老師手動提醒 { type: form|assignment, id }
 *   POST /api/line/bind-code|unbind      LINE 綁定
 *   POST /api/line/webhook               LINE 官方帳號 webhook（驗簽，不需登入）
 *   POST /api/demo/login|logout|reset    只在 DEMO_LOGIN / SEED_DEMO_DATA 啟用時可用
 */
export const dynamic = "force-dynamic";

async function endpoint(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const origin = new URL(req.url).origin;
  return runWithRequestContext({ env, origin }, () => handle(req, ctx, origin));
}

async function handle(req: Request, ctx: { params: Promise<{ path: string[] }> }, origin: string) {
  try {
    const { path } = await ctx.params;
    const [resource, id, action] = path;
    const method = req.method;

    if (method === "GET" && resource === "health") return json({ ok: true, time: new Date().toISOString() });

    const db = requireDb(env);
    if (env.SEED_DEMO_DATA === "1" && (await isEmpty(db))) await seedDatabase(db);

    // ----- LINE webhook（LINE 伺服器呼叫，無登入；以簽章驗證） -----
    if (resource === "line" && id === "webhook" && method === "POST") {
      const raw = await req.text();
      if (!(await verifySignature(env, raw, req.headers.get("x-line-signature")))) throw new HttpError(403, "簽章不符");
      const payload = JSON.parse(raw) as { events?: LineEvent[] };
      for (const ev of payload.events ?? []) {
        if (!ev.replyToken) continue;
        if (ev.type === "join" && ev.source?.groupId) {
          await replyText(env, ev.replyToken, `已加入群組。請管理員把這個群組 ID 設到平台的 LINE_GROUP_ID：\n${ev.source.groupId}`);
        } else if (ev.type === "follow") {
          await replyText(env, ev.replyToken, "平安！請到學習平台「我的 → LINE 通知」取得 6 碼綁定代碼，直接傳給我即可完成綁定。");
        } else if (ev.type === "message" && ev.message?.type === "text" && ev.source?.type === "user" && ev.source.userId) {
          const text = (ev.message.text ?? "").trim().toUpperCase();
          if (/^[A-Z0-9]{6}$/.test(text)) {
            const bound = await m.bindLineByCode(db, text, ev.source.userId);
            await replyText(env, ev.replyToken, bound ? `${bound.name} 平安，LINE 通知已綁定完成。之後老師回覆、作業批改與截止提醒都會傳到這裡。` : "找不到這個綁定代碼，請回平台「我的 → LINE 通知」重新產生。");
          }
        }
      }
      return json({ ok: true });
    }

    const auth = await identify(db, env, req, await getChatGPTUser());
    const secure = new URL(req.url).protocol === "https:";

    // ----- 示範身分（本機／示範站） -----
    if (resource === "demo") {
      if (id === "login" && method === "POST") {
        if (!auth.demoLogin) throw new HttpError(403, "此站未啟用示範登入");
        const { userId } = (await readJson<{ userId?: string }>(req)) ?? {};
        const row = userId ? await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).get() : undefined;
        if (!row) throw new HttpError(404, "找不到此身分");
        return json({ ok: true }, { headers: { "Set-Cookie": setCookie(DEMO_COOKIE, row.id, 60 * 60 * 24 * 30, secure) } });
      }
      if (id === "logout" && method === "POST") return json({ ok: true }, { headers: { "Set-Cookie": setCookie(DEMO_COOKIE, "", 0, secure) } });
      if (id === "reset" && method === "POST") {
        if (env.SEED_DEMO_DATA !== "1") throw new HttpError(403, "此站未啟用示範資料");
        await clearAll(db);
        await seedDatabase(db);
        return json({ ok: true });
      }
    }

    if (method === "GET" && resource === "me") {
      return json({ user: auth.user, chatgpt: auth.chatgpt ? { email: auth.chatgpt.email, displayName: auth.chatgpt.displayName } : null, demoLogin: auth.demoLogin, source: auth.source, features: { line: !!env.LINE_CHANNEL_ACCESS_TOKEN, lineGroup: !!env.LINE_GROUP_ID, r2: !!env.BUCKET, signedLinks: !!env.FILE_LINK_SECRET } });
    }

    // ----- 受保護檔案：登入＋權限，或限時簽章 -----
    if (resource === "files" && method === "GET" && id) {
      const key = path.slice(1).map(decodeURIComponent).join("/");
      const url = new URL(req.url);
      const download = url.searchParams.get("download") === "1";
      const signed = await verifySignedLink(env, key, url.searchParams.get("exp"), url.searchParams.get("sig"));
      if (!signed) {
        if (!auth.user) throw unauthorized();
        if (!(await canRead(db, auth.user, key))) throw forbidden("你沒有權限讀取此檔案");
      }
      return streamFile(env, key, download);
    }

    const user = auth.user;
    if (!user) throw unauthorized();

    if (method === "GET" && resource === "state") {
      try {
        await runDueReminders(db, env, origin);
      } catch (e) {
        console.error("reminders", e);
      }
      const full = await loadSnapshot(db);
      return json({ user, snapshot: scopeSnapshot(full, user) });
    }

    if (resource === "uploads" && method === "POST") return json(await uploadFile(env, user, req));

    const body = method === "GET" || method === "DELETE" ? undefined : await readJson(req);

    if (resource === "files" && id === "link" && method === "POST") {
      const { key, download } = body as { key?: string; download?: boolean };
      if (!key) throw new HttpError(400, "缺少 key");
      if (!(await canRead(db, user, key))) throw forbidden("你沒有權限讀取此檔案");
      return json(await signedLink(env, origin, key, 15 * 60, !!download));
    }
    if (resource === "forms") {
      if (method === "POST" && !id) return json(await m.createForm(db, user, body));
      if (method === "PUT" && id && !action) return json(await m.updateForm(db, user, id, body));
      if (method === "POST" && id && action === "answers") return json(await m.saveFormAnswers(db, user, id, body));
    }
    if (resource === "feedback") {
      if (method === "POST" && !id) return json(await m.addFeedback(db, user, body));
      if (method === "POST" && id === "read") return json(await m.markFeedbackRead(db, user, body));
    }
    if (resource === "assignments") {
      if (method === "POST" && !id) return json(await m.createAssignment(db, user, body));
      if (method === "PUT" && id && !action) return json(await m.updateAssignment(db, user, id, body));
      if (method === "POST" && id && action === "draft") return json(await m.saveAssignmentDraft(db, user, id, body));
      if (method === "POST" && id && action === "submit") return json(await m.submitAssignment(db, user, id, body));
    }
    if (resource === "submissions" && id) {
      if (method === "POST" && action === "review") return json(await m.reviewAssignment(db, user, id, body));
      if (method === "POST" && action === "read") return json(await m.markReviewRead(db, user, id));
    }
    if (resource === "materials") {
      if (method === "POST" && !id) return json(await m.addMaterial(db, user, body));
      if (method === "DELETE" && id) return json(await m.removeMaterial(db, user, id));
    }
    if (resource === "articles") {
      if (method === "POST" && !id) return json(await m.createArticle(db, user, body));
      if (method === "PUT" && id && !action) return json(await m.updateArticle(db, user, id, body));
      if (method === "DELETE" && id && !action) return json(await m.deleteArticle(db, user, id));
      if (method === "POST" && id && action === "comments") return json(await m.addComment(db, user, id, body));
    }
    if (resource === "courses") {
      if (method === "POST" && !id) return json(await m.upsertCourse(db, user, null, body));
      if (method === "PUT" && id) return json(await m.upsertCourse(db, user, id, body));
    }
    if (resource === "groups" && method === "PUT" && id) return json(await m.upsertGroup(db, user, id, body));
    if (resource === "users" && method === "PUT" && id) return json(await m.upsertUser(db, user, id, body));
    if (resource === "notifications" && method === "POST" && id === "read") return json(await m.markNotificationsRead(db, user, body));
    if (resource === "reminders" && method === "POST") {
      if (!isStaffRole(user.role)) throw forbidden();
      const { type, id: targetId } = body as { type?: string; id?: string };
      if (!targetId) throw new HttpError(400, "缺少 id");
      if (type === "form") return json(await remindForm(db, env, origin, targetId, "老師提醒您儘快填寫"));
      if (type === "assignment") return json(await remindAssignment(db, env, origin, targetId, "老師提醒您儘快繳交"));
      throw new HttpError(400, "type 需為 form 或 assignment");
    }
    if (resource === "line") {
      if (id === "bind-code" && method === "POST") return json(await m.issueLineBindCode(db, user));
      if (id === "unbind" && method === "POST") return json(await m.unbindLine(db, user));
    }

    throw new HttpError(404, "找不到此操作");
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, { status: e.status });
    if (e instanceof ZodError) return json({ error: "欄位格式或數值不正確，請檢查輸入。", issues: e.issues.slice(0, 5) }, { status: 400 });
    console.error(e);
    return json({ error: "服務暫時無法處理，請稍後重試。" }, { status: 500 });
  }
}

export const GET = endpoint;
export const POST = endpoint;
export const PUT = endpoint;
export const DELETE = endpoint;
