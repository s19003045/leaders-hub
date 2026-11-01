/**
 * LINE Messaging API（官方帳號）。
 * 需要環境變數：LINE_CHANNEL_ACCESS_TOKEN（推播）、LINE_CHANNEL_SECRET（webhook 驗簽）、LINE_GROUP_ID（群組公告）。
 * 任一缺少時相關功能靜默略過，不影響平台其他操作。
 */

const API = "https://api.line.me/v2/bot";

export function lineEnabled(env: Cloudflare.Env) {
  return !!env.LINE_CHANNEL_ACCESS_TOKEN;
}

async function call(env: Cloudflare.Env, path: string, body: unknown) {
  const token = env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, skipped: true as const };
  const res = await fetch(`${API}${path}`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`LINE ${path} ${res.status}: ${text.slice(0, 300)}`);
    return { ok: false, skipped: false as const, status: res.status };
  }
  return { ok: true, skipped: false as const };
}

/** 推播給單一使用者或群組（to 為 userId 或 groupId）。 */
export function pushText(env: Cloudflare.Env, to: string, text: string) {
  return call(env, "/message/push", { to, messages: [{ type: "text", text: text.slice(0, 4900) }] });
}

/** 推播到設定的 LINE 群組（公告用）。 */
export function pushGroup(env: Cloudflare.Env, text: string) {
  if (!env.LINE_GROUP_ID) return Promise.resolve({ ok: false, skipped: true as const });
  return pushText(env, env.LINE_GROUP_ID, text);
}

export function replyText(env: Cloudflare.Env, replyToken: string, text: string) {
  return call(env, "/message/reply", { replyToken, messages: [{ type: "text", text: text.slice(0, 4900) }] });
}

/** 驗證 webhook 簽章：X-Line-Signature = base64(HMAC-SHA256(channelSecret, body)) */
export async function verifySignature(env: Cloudflare.Env, rawBody: string, signature: string | null) {
  const secret = env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { type: "user" | "group" | "room"; userId?: string; groupId?: string; roomId?: string };
  message?: { type: string; text?: string };
}

/** 產生 6 碼綁定代碼（去除易混淆字元）。 */
export function newBindCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
