"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StaffOnly } from "@/components/staff-only";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, PageHeader, Pill } from "@/components/ui-bits";
import { store, useCurrentUser, useData } from "@/lib/store";
import { groupOfUser } from "@/lib/selectors";
import { roleLabel } from "@/lib/format";
import type { Role, User } from "@/lib/types";

export default function AdminUsersPage() {
  const data = useData();
  const me = useCurrentUser();
  const [editing, setEditing] = useState<User | null>(null);
  const canManage = me?.role === "admin";
  const list = [...data.users].sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name, "zh-Hant") : a.role === "student" ? 1 : b.role === "student" ? -1 : 0));

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.email.trim()) return toast.error("請填寫姓名與 Email");
    try {
      await store.upsertUser({ ...editing, name: editing.name.trim(), email: editing.email.trim() });
      toast.success("已儲存");
      setEditing(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <AppShell title="學員帳號" wide>
      <StaffOnly>
        <PageHeader title="學員帳號" description={canManage ? "建立帳號、分配角色、停用帳號。登入時以 Email 對應 ChatGPT 帳號。" : "助教與老師可查看名單；帳號管理限管理員。"} action={canManage ? <Button className="tap" onClick={() => setEditing({ id: `u-${Math.random().toString(36).slice(2, 7)}`, name: "", email: "", role: "student", active: true, createdAt: new Date().toISOString() })}><Plus className="size-5" /> 新增</Button> : undefined} />
        {editing && (
          <div className="mb-6 grid gap-3 rounded-2xl border border-primary/40 bg-card p-4 md:grid-cols-2">
            <label className="block"><span className="mb-1 block font-medium">姓名</span><Input className="min-h-12 text-base" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block font-medium">Email（登入對應）</span><Input className="min-h-12 text-base" type="email" inputMode="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block font-medium">角色</span><select className="min-h-12 w-full rounded-lg border border-input bg-background px-3 text-base" value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value as Role })}>{(Object.keys(roleLabel) as Role[]).map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}</select></label>
            <label className="block"><span className="mb-1 block font-medium">服務單位（選填）</span><Input className="min-h-12 text-base" value={editing.company ?? ""} onChange={(e) => setEditing({ ...editing, company: e.target.value })} /></label>
            <label className="flex min-h-12 items-center gap-3 rounded-lg border px-3"><input type="checkbox" className="size-5 accent-primary" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> 帳號啟用</label>
            <div className="flex gap-2"><Button variant="outline" size="lg" className="flex-1 tap" onClick={() => setEditing(null)}>取消</Button><Button size="lg" className="flex-1 tap" onClick={save}>儲存</Button></div>
          </div>
        )}
        <ul className="divide-y rounded-2xl border bg-card">
          {list.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar name={u.name} />
              <span className="min-w-0 flex-1 basis-56">
                <span className="block font-medium">{u.name}{!u.active && <span className="ml-2 text-xs text-destructive">已停用</span>}</span>
                <span className="block truncate text-sm text-muted-foreground">{u.email}{u.company ? `・${u.company}` : ""}{groupOfUser(data, u.id) ? `・${groupOfUser(data, u.id)!.name}` : ""}</span>
              </span>
              <Pill tone={u.role === "student" ? "normal" : "primary"}>{roleLabel[u.role]}</Pill>
              {canManage && <Button variant="outline" size="sm" onClick={() => setEditing({ ...u })}>編輯</Button>}
            </li>
          ))}
        </ul>
      </StaffOnly>
    </AppShell>
  );
}
