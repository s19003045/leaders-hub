import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";

export type Db = ReturnType<typeof createDb>;

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export function requireDb(env: Cloudflare.Env) {
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable. Check .openai/hosting.json (d1: \"DB\").");
  return createDb(env.DB);
}
