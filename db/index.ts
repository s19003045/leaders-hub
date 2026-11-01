import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/** 第二階段：Workers 內取得 D1（binding 名稱 DB，見 .openai/hosting.json）。 */
export function getDb() {
  if (!env.DB) {
    throw new Error("Cloudflare D1 binding `DB` is unavailable. Check .openai/hosting.json (d1: \"DB\").");
  }
  return drizzle(env.DB, { schema });
}
