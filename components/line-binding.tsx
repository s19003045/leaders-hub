"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { store, useCurrentUser, useFeatures } from "@/lib/store";

/** 「我的」頁的 LINE 通知綁定區塊。 */
export function LineBinding() {
  const user = useCurrentUser();
  const features = useFeatures();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const issue = async () => {
    setBusy(true);
    try {
      const r = await store.lineBindCode();
      setCode(r.code);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const unbind = async () => {
    if (!window.confirm("確定要解除 LINE 通知綁定嗎？")) return;
    try {
      await store.unbindLine();
      setCode(null);
      toast.success("已解除綁定");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-1 flex items-center gap-2 font-medium"><MessageCircle className="size-5 text-success" /> LINE 通知</div>
      {!features.line ? (
        <p className="text-sm text-muted-foreground">此站尚未設定 LINE 官方帳號；設定後老師回覆、作業批改與截止提醒會直接傳到你的 LINE。</p>
      ) : user.lineBound ? (
        <>
          <p className="text-sm text-success">已綁定。老師回覆、批改結果與截止提醒會傳到你的 LINE。</p>
          <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={unbind}>解除綁定</Button>
        </>
      ) : (
        <>
          <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>先把平台的 LINE 官方帳號加為好友（連結在 LINE 群組置頂）。</li>
            <li>按下方按鈕取得 6 碼代碼。</li>
            <li>在官方帳號的聊天室直接傳送這 6 碼。</li>
          </ol>
          {code ? (
            <div className="rounded-xl bg-primary-soft p-4 text-center">
              <div className="text-sm text-muted-foreground">綁定代碼（傳給官方帳號）</div>
              <div className="text-3xl font-bold tracking-[0.3em] text-primary">{code}</div>
              <Button variant="link" size="sm" onClick={() => { navigator.clipboard?.writeText(code).then(() => toast.success("已複製")); }}>複製代碼</Button>
            </div>
          ) : (
            <Button variant="outline" size="lg" className="w-full tap" onClick={issue} disabled={busy}>產生綁定代碼</Button>
          )}
        </>
      )}
    </div>
  );
}
