import { eq, sql } from "drizzle-orm";
import type { Db } from "./db";
import { users } from "@/db/schema";
import type { ChatGPTUser } from "@/lib/chatgpt-auth";
import type { Role, User } from "@/lib/types";
import { getCookie, nowIso } from "./http";

export const DEMO_COOKIE = "lh_demo_user";

export interface AuthContext {
  user: User | null; // 名單內的使用者（已對應角色）
  chatgpt: ChatGPTUser | null; // ChatGPT 登入身分（可能不在名單內）
  demoLogin: boolean; // 是否允許示範身分登入
  source: "chatgpt" | "demo" | "none";
}

function rowToUser(r: typeof users.$inferSelect): User {
  return { id: r.id, name: r.name, email: r.email, role: r.role as Role, title: r.title ?? undefined, company: r.company ?? undefined, active: r.active, createdAt: r.createdAt };
}

/**
 * 登入對應：
 * 1. DEMO_LOGIN=1 且帶 demo cookie → 直接以該使用者身分（本機／示範站）。
 * 2. 有 ChatGPT header → 以 Email（不分大小寫）對應 users；首次登入綁定 chatgpt_user_id。
 *    不在名單但等於 INITIAL_ADMIN_EMAIL → 自動建立 admin。
 * 3. 其他 → user 為 null。
 */
export async function identify(db: Db, env: Cloudflare.Env, req: Request, chatgpt: ChatGPTUser | null): Promise<AuthContext> {
  const demoLogin = env.DEMO_LOGIN === "1";

  if (demoLogin) {
    const demoId = getCookie(req, DEMO_COOKIE);
    if (demoId) {
      const row = await db.select().from(users).where(eq(users.id, demoId)).get();
      if (row && row.active) return { user: rowToUser(row), chatgpt, demoLogin, source: "demo" };
    }
  }

  if (!chatgpt) return { user: null, chatgpt: null, demoLogin, source: "none" };

  const email = chatgpt.email.trim().toLowerCase();
  let row = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).get();

  if (!row) {
    const admin = env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
    if (admin && admin === email) {
      const now = nowIso();
      await db
        .insert(users)
        .values({ id: `u-${crypto.randomUUID().slice(0, 12)}`, email: chatgpt.email, chatgptUserId: chatgpt.userId, name: chatgpt.fullName ?? chatgpt.email, role: "admin", title: "系統管理員", active: true, createdAt: now, updatedAt: now })
        .onConflictDoNothing();
      row = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).get();
    }
  } else if (!row.chatgptUserId) {
    await db.update(users).set({ chatgptUserId: chatgpt.userId, updatedAt: nowIso() }).where(eq(users.id, row.id));
  }

  if (!row || !row.active) return { user: null, chatgpt, demoLogin, source: "chatgpt" };
  return { user: rowToUser(row), chatgpt, demoLogin, source: "chatgpt" };
}

export const isStaffRole = (role: Role) => role === "teacher" || role === "ta" || role === "admin";
