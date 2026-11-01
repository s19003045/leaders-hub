"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui-bits";
import { store, useCurrentUser, useHydrated } from "@/lib/store";
import { isStaff } from "@/lib/selectors";
import { roleLabel } from "@/lib/format";
import type { Role } from "@/lib/types";

interface MeResponse {
  user: { id: string; name: string; role: Role } | null;
  chatgpt: { email: string; displayName: string } | null;
  demoLogin: boolean;
  source: "chatgpt" | "demo" | "none";
}

const DEMO_PERSONAS: { id: string; name: string; role: Role; note: string }[] = [
  { id: "u-01", name: "陳建宏", role: "student", note: "科技業・專案經理・第一組組長" },
  { id: "u-06", name: "劉慧君", role: "student", note: "國小教師・第二組" },
  { id: "u-12", name: "謝怡君", role: "student", note: "社福機構主任・第三組" },
  { id: "u-teacher", name: "張文德", role: "teacher", note: "講師" },
  { id: "u-ta", name: "王美玲", role: "ta", note: "助教" },
  { id: "u-admin", name: "Gary", role: "admin", note: "系統管理員" },
];

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const next = params.get("next") || "/";

  useEffect(() => {
    if (hydrated && user) router.replace(isStaff(user) && next === "/" ? "/admin" : next);
  }, [hydrated, user, router, next]);

  useEffect(() => {
    // Sites 在 ChatGPT 登入後以 header 帶入身分；/api/me 會對應名單中的使用者
    fetch("/api/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<MeResponse>) : null))
      .then((j) => setMe(j))
      .catch(() => setMe(null));
  }, []);

  const enterDemo = async (id: string) => {
    setBusy(true);
    try {
      await store.loginDemo(id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-10">
      <div className="mb-8 text-center">
        <span className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-white">領</span>
        <h1 className="text-2xl">職場領袖學習平台</h1>
        <p className="mt-1 text-muted-foreground">課程、表單、作業、教材與分享，都在這裡。</p>
      </div>

      <div className="mb-6 rounded-2xl border bg-card p-5">
        <h2 className="mb-1 text-lg">使用 ChatGPT 帳號登入</h2>
        <p className="mb-4 text-sm text-muted-foreground">登入後系統會以你的 Email 對應名單中的身分。還沒有 ChatGPT 帳號的話，可用 Google 帳號免費註冊。</p>
        {me?.chatgpt ? (
          me.user ? (
            <Button size="lg" className="w-full tap" onClick={() => router.replace(me.user!.role === "student" ? next : "/admin")}>
              <ShieldCheck className="size-5" /> 以 {me.user.name} 的身分進入
            </Button>
          ) : (
            <div className="rounded-lg bg-warning-soft p-3 text-sm text-warning">
              已登入 ChatGPT：{me.chatgpt.email}。此帳號尚未加入名單，請把這個 Email 告訴管理員。
              <a href={`/signout-with-chatgpt?return_to=${encodeURIComponent("/login")}`} className="ml-2 underline">登出</a>
            </div>
          )
        ) : (
          <Button asChild size="lg" className="w-full tap">
            <a href={`/signin-with-chatgpt?return_to=${encodeURIComponent("/login")}`}>Sign in with ChatGPT</a>
          </Button>
        )}
      </div>

      {me?.demoLogin && (
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="mb-1 text-lg">示範身分</h2>
          <p className="mb-4 text-sm text-muted-foreground">此站已啟用示範登入（DEMO_LOGIN）。選一個身分體驗操作流程；資料存在雲端資料庫，所有人共用。</p>
          <ul className="space-y-2">
            {DEMO_PERSONAS.map((p) => (
              <li key={p.id}>
                <button type="button" disabled={busy} onClick={() => enterDemo(p.id)} className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left hover:bg-accent active:bg-accent disabled:opacity-60">
                  <Avatar name={p.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{p.name}</span>
                    <span className="block text-sm text-muted-foreground">{roleLabel[p.role]}・{p.note}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {me && !me.demoLogin && !me.chatgpt && <p className="text-center text-xs text-muted-foreground">本站只開放名單內的成員使用。</p>}
    </div>
  );
}
