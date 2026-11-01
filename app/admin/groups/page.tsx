"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StaffOnly } from "@/components/staff-only";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, PageHeader, Pill } from "@/components/ui-bits";
import { store, useData } from "@/lib/store";
import { groupCompletion, students, userName } from "@/lib/selectors";
import { fmtDateTime } from "@/lib/format";
import type { Group } from "@/lib/types";

export default function AdminGroupsPage() {
  const data = useData();
  const [editing, setEditing] = useState<Group | null>(null);
  const completion = groupCompletion(data);
  const unassigned = students(data).filter((u) => !data.groups.some((g) => g.memberIds.includes(u.id)));

  const startNew = () => setEditing({ id: `g-${Math.random().toString(36).slice(2, 7)}`, classId: data.classes[0].id, name: `第${data.groups.length + 1}組`, leaderId: null, memberIds: [], history: [] });

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error("請填寫小組名稱");
    if (editing.leaderId && !editing.memberIds.includes(editing.leaderId)) return toast.error("組長必須是組員之一");
    const exists = data.groups.some((g) => g.id === editing.id);
    try {
      await store.upsertGroup(editing, exists ? "更新小組名單" : "建立小組");
      toast.success("已儲存；既有作業紀錄會完整保留");
      setEditing(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <AppShell title="小組管理" wide>
      <StaffOnly>
        <PageHeader title="小組管理" description="新增小組、調整組員與組長；異動不影響已繳交的作業紀錄" action={<Button className="tap" onClick={startNew}><Plus className="size-5" /> 新增小組</Button>} />
        {unassigned.length > 0 && <div className="mb-4 rounded-xl bg-warning-soft p-3 text-sm text-warning">尚未分組：{unassigned.map((u) => u.name).join("、")}</div>}

        {editing && (
          <div className="mb-6 rounded-2xl border border-primary/40 bg-card p-4">
            <h2 className="mb-3 text-lg">{data.groups.some((g) => g.id === editing.id) ? "編輯小組" : "新增小組"}</h2>
            <label className="mb-3 block"><span className="mb-1 block font-medium">小組名稱</span><Input className="min-h-12 text-base" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
            <div className="mb-1 font-medium">組員</div>
            <ul className="mb-3 grid gap-1.5 sm:grid-cols-2">
              {students(data).map((u) => {
                const inOther = data.groups.find((g) => g.id !== editing.id && g.memberIds.includes(u.id));
                const on = editing.memberIds.includes(u.id);
                return (
                  <li key={u.id}>
                    <label className={`flex min-h-12 items-center gap-3 rounded-lg border px-3 ${on ? "border-primary bg-primary-soft" : ""}`}>
                      <input type="checkbox" className="size-5 accent-primary" checked={on} onChange={(e) => setEditing({ ...editing, memberIds: e.target.checked ? [...editing.memberIds, u.id] : editing.memberIds.filter((x) => x !== u.id), leaderId: !e.target.checked && editing.leaderId === u.id ? null : editing.leaderId })} />
                      <span className="flex-1">{u.name}</span>
                      {inOther && <span className="text-xs text-muted-foreground">{inOther.name}</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
            <label className="mb-4 block"><span className="mb-1 block font-medium">組長</span>
              <select className="min-h-12 w-full rounded-lg border border-input bg-background px-3 text-base" value={editing.leaderId ?? ""} onChange={(e) => setEditing({ ...editing, leaderId: e.target.value || null })}>
                <option value="">（未指定）</option>
                {editing.memberIds.map((id) => <option key={id} value={id}>{userName(data, id)}</option>)}
              </select>
            </label>
            <div className="flex gap-2"><Button variant="outline" size="lg" className="flex-1 tap" onClick={() => setEditing(null)}>取消</Button><Button size="lg" className="flex-1 tap" onClick={save}>儲存</Button></div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {completion.map(({ group, done, total, leader }) => (
            <div key={group.id} className="rounded-2xl border bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-lg">{group.name}</h2>
                <Pill tone={total && done === total ? "done" : "soon"}>作業 {done}/{total}</Pill>
                <Button variant="outline" size="sm" className="ml-auto" onClick={() => setEditing({ ...group })}>編輯</Button>
              </div>
              <ul className="flex flex-wrap gap-2">
                {group.memberIds.map((id) => <li key={id} className="inline-flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-sm"><Avatar name={userName(data, id)} size="sm" />{userName(data, id)}{leader?.id === id && <span className="text-xs text-primary">組長</span>}</li>)}
              </ul>
              <details className="mt-3 text-sm text-muted-foreground"><summary className="cursor-pointer">異動紀錄（{group.history.length}）</summary><ul className="mt-1 space-y-0.5">{group.history.map((h, i) => <li key={i}>{fmtDateTime(h.at)}・{h.action}・{userName(data, h.byUserId)}</li>)}</ul></details>
            </div>
          ))}
        </div>
      </StaffOnly>
    </AppShell>
  );
}
