/** Workers API 共用：錯誤、JSON 讀取、cookie。 */

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const unauthorized = () => new HttpError(401, "請先登入");
export const forbidden = (msg = "你沒有權限執行此操作") => new HttpError(403, msg);
export const notFound = (what = "資料") => new HttpError(404, `找不到${what}`);
export const conflict = () => new HttpError(409, "資料已被其他人更新，請重新載入後再試。");

const MAX_BODY = 400_000;

export async function readJson<T = unknown>(req: Request): Promise<T> {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) throw new HttpError(403, "請從本站操作");
  if (!req.headers.get("content-type")?.includes("application/json")) throw new HttpError(415, "資料格式錯誤");
  const raw = await req.text();
  if (raw.length > MAX_BODY) throw new HttpError(413, "資料過大");
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(400, "資料格式錯誤");
  }
}

export function getCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function setCookie(name: string, value: string, maxAgeSeconds: number, secure: boolean) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export const NO_STORE = { "Cache-Control": "no-store", Vary: "Cookie" } as const;

export function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, { ...init, headers: { ...NO_STORE, ...(init.headers ?? {}) } });
}

export const nowIso = () => new Date().toISOString();
export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
