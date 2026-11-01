"use client";

import { useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StaffOnly } from "@/components/staff-only";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, PageHeader, Pill } from "@/components/ui-bits";
import { store, useData } from "@/lib/store";
import { fmtFullDate, fromInputDateTime, toInputDateTime } from "@/lib/format";
import type { Course } from "@/lib/types";

const statusLabel = { upcoming: "即將開始", active: "進行中", done: "已完成" } as const;

type Draft = { id: string | null; unit: string; title: string; description: string; date: string; location: string; status: Course["status"] };

export default function AdminCoursesPage() {
  const data = useData();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const list = [...data.courses].sort((a, b) => b.date.localeCompare(a.date));
  const sel = "min-h-12 w-full rounded-lg border border-input bg-background px-3 text-base";

  const startNew = () => setDraft({ id: null, unit: `第${numberToChinese(data.courses.length + 1)}課`, title: "", description: "", date: toInputDateTime(new Date(Date.now() + 30 * 86_400_000).toISOString()), location: data.courses[0]?.location ?? "", status: "upcoming" });
  const startEdit = (c: Course) => setDraft({ id: c.id, unit: c.unit, title: c.title, description: c.description, date: toInputDateTime(c.date), location: c.location ?? "", status: c.status });

  const save = async () => {
    if (!draft) return;
    if (!draft.unit.trim() || !draft.title.trim()) return toast.error("請填寫單元與課程名稱");
    setBusy(true);
    try {
      await store.upsertCourse(draft.id, { unit: draft.unit.trim(), title: draft.title.trim(), description: draft.description.trim(), date: fromInputDateTime(draft.date), location: draft.location.trim() || undefined, status: draft.status });
      toast.success(draft.id ? "課程已更新" : "課程已建立");
      setDraft(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="課程" wide>
      <StaffOnly>
        <PageHeader title="課程" description={data.classes[0]?.name} action={<Button className="tap" onClick={startNew}><Plus className="size-5" /> 新增課程</Button>} />
        {draft && (
          <div className="mb-6 grid gap-4 rounded-2xl border border-primary/40 bg-card p-4 md:grid-cols-2">
            <Field label="單元" required><Input className="min-h-12 text-base" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="第八課" /></Field>
            <Field label="課程名稱" required><Input className="min-h-12 text-base" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
            <div className="md:col-span-2"><Field label="說明"><Textarea rows={2} className="text-base" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field></div>
            <Field label="上課時間"><input type="datetime-local" className={sel} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></Field>
            <Field label="地點"><Input className="min-h-12 text-base" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} /></Field>
            <Field label="狀態"><select className={sel} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Course["status"] })}><option value="upcoming">即將開始</option><option value="active">進行中</option><option value="done">已完成</option></select></Field>
            <div className="flex gap-2 self-end"><Button variant="outline" size="lg" className="flex-1 tap" onClick={() => setDraft(null)} disabled={busy}>取消</Button><Button size="lg" className="flex-1 tap" onClick={save} disabled={busy}>儲存</Button></div>
          </div>
        )}
        <ul className="divide-y rounded-2xl border bg-card">
          {list.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><BookOpen className="size-5" /></span>
              <span className="min-w-0 flex-1 basis-56">
                <span className="block font-medium">{c.unit}・{c.title}</span>
                <span className="block text-sm text-muted-foreground">{fmtFullDate(c.date)}・教材 {data.materials.filter((m) => m.courseId === c.id).length}・表單 {data.forms.filter((f) => f.courseId === c.id).length}・作業 {data.assignments.filter((a) => a.courseId === c.id).length}</span>
              </span>
              <Pill tone={c.status === "active" ? "primary" : c.status === "done" ? "done" : "normal"}>{statusLabel[c.status]}</Pill>
              <Button variant="outline" size="sm" onClick={() => startEdit(c)}>編輯</Button>
            </li>
          ))}
        </ul>
      </StaffOnly>
    </AppShell>
  );
}

function numberToChinese(n: number) {
  const d = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  if (n <= 10) return d[n];
  if (n < 20) return `十${d[n - 10]}`;
  return String(n);
}
