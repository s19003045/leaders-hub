"use client";

import Link from "next/link";

import { Bell, BookOpen, FileStack, LogOut, RotateCcw, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Avatar, ListRow, Section } from "@/components/ui-bits";
import { store, useCurrentUser, useData } from "@/lib/store";
import { groupOfUser, isStaff, studentCompletion, unreadCounts } from "@/lib/selectors";
import { roleLabel } from "@/lib/format";
import { applyScale, useScale, type FontScale } from "@/app/providers";

export default function MePage() {
  const user = useCurrentUser();
  const data = useData();
  const scale = useScale();
  if (!user) return null;
  const group = groupOfUser(data, user.id);
  const counts = unreadCounts(data, user);
  const completion = !isStaff(user) ? studentCompletion(data).find((c) => c.user.id === user.id) : undefined;

  const logout = async () => {
    await store.logout();
    // ChatGPT 登出由 Sites 平台路徑處理，需整頁導向
    window.location.assign(`/signout-with-chatgpt?return_to=${encodeURIComponent("/login")}`);
  };

  return (
    <AppShell title="我的">
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={user.name} size="lg" />
        <div>
          <h1>{user.name}</h1>
          <p className="text-muted-foreground">{roleLabel[user.role]}{user.company ? `・${user.company}` : ""}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      {completion && (
        <Section title="我的學習進度">
          <div className="grid grid-cols-3 gap-2">
            <Progress label="表單" done={completion.forms.done} total={completion.forms.total} />
            <Progress label="個人作業" done={completion.individual.done} total={completion.individual.total} />
            <Progress label="分組作業" done={completion.group_.done} total={completion.group_.total} />
          </div>
        </Section>
      )}

      <Section title="快速前往">
        <div className="space-y-2">
          <ListRow href="/notifications" icon={Bell} title="通知" right={counts.notifications > 0 ? <span className="rounded-full bg-destructive px-2 text-xs font-bold text-white">{counts.notifications}</span> : undefined} />
          {!isStaff(user) && <ListRow href="/forms" icon={FileStack} title="線上表單" subtitle="待填寫與歷史回答" />}
          {!isStaff(user) && <ListRow href="/courses" icon={BookOpen} title="我的課程" />}
          {group && <ListRow href="/group" icon={UsersRound} title={group.name} subtitle="我的小組" />}
          {isStaff(user) && <ListRow href="/admin/stats" icon={FileStack} title="統計與 Excel 匯出" />}
          {isStaff(user) && <ListRow href="/admin/groups" icon={UsersRound} title="小組管理" />}
        </div>
      </Section>

      <Section title="顯示設定">
        <div className="rounded-2xl border bg-card p-4">
          <div className="mb-2 font-medium">文字大小</div>
          <div className="flex gap-2">
            {([["md", "標準"], ["lg", "較大"], ["xl", "最大"]] as [FontScale, string][]).map(([v, label]) => (
              <button key={v} type="button" onClick={() => applyScale(v)} className={`min-h-12 flex-1 rounded-lg border font-medium ${scale === v ? "border-primary bg-primary text-white" : "bg-background"}`}>{label}</button>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">設定只保存在這支裝置。</p>
        </div>
      </Section>

      <Section title="帳號">
        <div className="space-y-2">
          <Button variant="outline" size="lg" className="w-full tap" onClick={logout}><LogOut className="size-5" /> 登出</Button>
          <Button variant="ghost" size="lg" className="w-full tap text-muted-foreground" onClick={() => store.resetDemo().then(() => toast.success("已重設為示範資料"), (e: Error) => toast.error(e.message))}><RotateCcw className="size-5" /> 重設示範資料</Button>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          正式版登入由 ChatGPT Sites 提供。<Link href="/login" className="underline">切換示範身分</Link>
        </p>
      </Section>
    </AppShell>
  );
}

function Progress({ label, done, total }: { label: string; done: number; total: number }) {
  const p = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="rounded-xl border bg-card p-3 text-center">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-xl font-bold text-primary">{done}/{total}</div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${p}%` }} /></div>
    </div>
  );
}
