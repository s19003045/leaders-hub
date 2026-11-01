import { AsyncLocalStorage } from "node:async_hooks";

/** 請求範圍的環境（env、網站 origin），供 notify / LINE 推播等深層函式取用，避免層層傳參。 */
export interface RequestContext {
  env: Cloudflare.Env;
  origin: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
