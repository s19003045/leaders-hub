import { headers } from "next/headers";

/**
 * ChatGPT Sites 登入整合（伺服器端）。
 * Sites 在使用者以 ChatGPT 登入後，會在每個請求加入以下 header；
 * 本機開發時由 scripts/vite/sites-vite-plugin.ts 模擬（seedy@sites.test）。
 * 登入 / 登出連結：/signin-with-chatgpt?return_to=… 與 /signout-with-chatgpt。
 */
export type ChatGPTUser = {
  userId: string;
  email: string;
  displayName: string;
  fullName: string | null;
};

const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const h = await headers();
  const email = h.get(USER_EMAIL_HEADER);
  if (!email) return null;
  const userId = h.get(USER_ID_HEADER) ?? email; // 官方文件只保證 email；缺 id 時以 email 作為穩定鍵
  const encoded = h.get(USER_FULL_NAME_HEADER);
  let fullName: string | null = null;
  if (encoded) {
    try {
      fullName = h.get(USER_FULL_NAME_ENCODING_HEADER) === "percent-encoded-utf-8" ? decodeURIComponent(encoded) : encoded;
    } catch {
      fullName = null;
    }
  }
  return { userId, email, displayName: fullName ?? email, fullName };
}
