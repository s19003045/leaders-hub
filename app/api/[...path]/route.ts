import { env } from "cloudflare:workers";
import { ZodError } from "zod";
import { getChatGPTUser } from "@/lib/chatgpt-auth";
import { DEMO_COOKIE, identify } from "@/lib/server/auth";
import { requireDb } from "@/lib/server/db";
import { HttpError, json, readJson, setCookie, unauthorized } from "@/lib/server/http";
import * as m from "@/lib/server/mutations";
import { clearAll, isEmpty, seedDatabase } from "@/lib/server/seed-db";
import { loadSnapshot, scopeSnapshot } from "@/lib/server/snapshot";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";

/**
 * Workers API 路由（第二階段：讀寫 D1）。
 *
 * 身分：每個請求由 Sites 帶入 ChatGPT 登入 header → identify() 對應 users 表。
 * 授權：所有規則在 lib/server/mutations.ts 與 snapshot.ts 伺服器端檢查。
 *
 *   GET  /api/health
 *   GET  /api/me                         目前身分（名單內使用者＋ChatGPT 身分）
 *   GET  /api/state                      依角色裁切的完整快照
 *   POST /api/forms                      建立表單（老師）
 *   POST /api/forms/:id/answers          暫存／送出回答
 *   POST /api/feedback                   回覆（老師／助教）
 *   POST /api/feedback/read              標示回覆已讀
 *   POST /api/assignments                發布作業（老師）
 *   PUT  /api/assignments/:id            修改作業（老師）
 *   POST /api/assignments/:id/draft      暫存草稿
 *   POST /api/assignments/:id/submit     正式提交（含版本衝突檢查）
 *   POST /api/submissions/:id/review     批改（老師／助教）
 *   POST /api/submissions/:id/read       標示批改已讀
 *   POST /api/materials, DELETE /api/materials/:id
 *   POST /api/articles, PUT|DELETE /api/articles/:id, POST /api/articles/:id/comments
 *   PUT  /api/groups/:id                 小組（老師／管理員）
 *   PUT  /api/users/:id                  帳號（管理員）
 *   POST /api/notifications/read
 *   POST /api/demo/login|logout|reset    只在 DEMO_LOGIN / SEED_DEMO_DATA 啟用時可用
 */
export const dynamic = "force-dynamic";

async function endpoint(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await ctx.params;
    const [resource, id, action] = path;
    const method = req.method;

    if (method === "GET" && resource === "health") return json({ ok: true, time: new Date().toISOString() });

    const db = requireDb(env);
    if (env.SEED_DEMO_DATA === "1" && (await isEmpty(db))) await seedDatabase(db);

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
      return json({ user: auth.user, chatgpt: auth.chatgpt ? { email: auth.chatgpt.email, displayName: auth.chatgpt.displayName } : null, demoLogin: auth.demoLogin, source: auth.source });
    }

    const user = auth.user;
    if (!user) throw unauthorized();

    if (method === "GET" && resource === "state") {
      const full = await loadSnapshot(db);
      return json({ user, snapshot: scopeSnapshot(full, user) });
    }

    const body = method === "GET" || method === "DELETE" ? undefined : await readJson(req);

    if (resource === "forms") {
      if (method === "POST" && !id) return json(await m.createForm(db, user, body));
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
    if (resource === "groups" && method === "PUT" && id) return json(await m.upsertGroup(db, user, id, body));
    if (resource === "users" && method === "PUT" && id) return json(await m.upsertUser(db, user, id, body));
    if (resource === "notifications" && method === "POST" && id === "read") return json(await m.markNotificationsRead(db, user, body));

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
