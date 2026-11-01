"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StaffOnly } from "@/components/staff-only";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, PageHeader, Section } from "@/components/ui-bits";
import { store, useData } from "@/lib/store";
import { fromInputDateTime, questionTypeLabel, toInputDateTime } from "@/lib/format";
import type { Question, QuestionType } from "@/lib/types";

const newQuestion = (type: QuestionType = "long"): Question => ({ id: `q-${Math.random().toString(36).slice(2, 8)}`, type, title: "", required: true, options: type === "single" || type === "multi" ? ["選項一", "選項二"] : undefined, max: type === "rating" ? 5 : undefined });

export default function NewFormPage() {
  const router = useRouter();
  const data = useData();
  const active = data.courses.find((c) => c.status === "active") ?? data.courses[0];
  const [title, setTitle] = useState(active ? `${active.unit} 課後回饋問卷` : "");
  const [description, setDescription] = useState("請於課後一週內填寫。");
  const [courseId, setCourseId] = useState(active?.id ?? "");
  const [openAt, setOpenAt] = useState(() => toInputDateTime(new Date().toISOString()));
  const [dueAt, setDueAt] = useState(() => toInputDateTime(new Date(Date.now() + 7 * 86_400_000).toISOString()));
  const [allowEdit, setAllowEdit] = useState(true);
  const [allowLate, setAllowLate] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([
    { ...newQuestion("rating"), title: "整體而言，本課對你的幫助程度" },
    { ...newQuestion("long"), title: "本課你最想記下來的一句話或一個行動" },
  ]);
  const sel = "min-h-12 w-full rounded-lg border border-input bg-background px-3 text-base";

  const update = (i: number, patch: Partial<Question>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, d: -1 | 1) => setQuestions((qs) => { const n = [...qs]; const j = i + d; if (j < 0 || j >= n.length) return qs; [n[i], n[j]] = [n[j], n[i]]; return n; });

  const save = async () => {
    if (!title.trim() || !courseId) return toast.error("請填寫表單名稱與課程");
    if (questions.length === 0 || questions.some((q) => !q.title.trim())) return toast.error("每一題都需要題目內容");
    try {
      const id = await store.createForm({ title: title.trim(), description, courseId, openAt: fromInputDateTime(openAt), dueAt: fromInputDateTime(dueAt), allowEdit, allowLate, questions });
      toast.success("表單已建立並通知學員");
      router.push(`/admin/forms/${id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <AppShell title="建立表單" wide>
      <StaffOnly>
        <PageHeader back="/admin/forms" title="建立表單" />
        <Section title="基本設定">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="表單名稱" required><Input className="min-h-12 text-base" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="所屬課程" required><select className={sel} value={courseId} onChange={(e) => setCourseId(e.target.value)}>{data.courses.map((c) => <option key={c.id} value={c.id}>{c.unit}・{c.title}</option>)}</select></Field>
            <Field label="說明"><Textarea rows={2} className="text-base" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="開放日期"><input type="datetime-local" className={sel} value={openAt} onChange={(e) => setOpenAt(e.target.value)} /></Field>
              <Field label="截止日期"><input type="datetime-local" className={sel} value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></Field>
            </div>
            <label className="flex min-h-12 items-center gap-3 rounded-lg border px-3"><input type="checkbox" className="size-5 accent-primary" checked={allowEdit} onChange={(e) => setAllowEdit(e.target.checked)} /> 允許學員修改已送出的回答</label>
            <label className="flex min-h-12 items-center gap-3 rounded-lg border px-3"><input type="checkbox" className="size-5 accent-primary" checked={allowLate} onChange={(e) => setAllowLate(e.target.checked)} /> 允許逾期提交</label>
          </div>
        </Section>

        <Section title={`題目（${questions.length}）`} action={<Button variant="outline" onClick={() => setQuestions((qs) => [...qs, newQuestion()])}><Plus className="size-4" /> 新增題目</Button>}>
          <div className="space-y-3">
            {questions.map((q, i) => (
              <div key={q.id} className="rounded-2xl border bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="font-bold text-primary">第 {i + 1} 題</span>
                  <select className="min-h-10 rounded-lg border border-input bg-background px-2 text-sm" value={q.type} onChange={(e) => { const t = e.target.value as QuestionType; update(i, { type: t, options: t === "single" || t === "multi" ? (q.options ?? ["選項一", "選項二"]) : undefined, max: t === "rating" ? 5 : undefined }); }}>
                    {(Object.keys(questionTypeLabel) as QuestionType[]).map((t) => <option key={t} value={t}>{questionTypeLabel[t]}</option>)}
                  </select>
                  <span className="ml-auto flex gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => move(i, -1)} aria-label="上移"><ArrowUp className="size-4" /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => move(i, 1)} aria-label="下移"><ArrowDown className="size-4" /></Button>
                    <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))} aria-label="刪除"><Trash2 className="size-4" /></Button>
                  </span>
                </div>
                <Input className="min-h-12 text-base" placeholder="題目內容" value={q.title} onChange={(e) => update(i, { title: e.target.value })} />
                {(q.type === "single" || q.type === "multi") && (
                  <div className="mt-2 space-y-1.5">
                    {q.options?.map((o, k) => (
                      <div key={k} className="flex gap-1.5">
                        <Input className="min-h-11 text-base" value={o} onChange={(e) => update(i, { options: q.options!.map((x, m) => (m === k ? e.target.value : x)) })} />
                        <Button variant="ghost" size="icon" onClick={() => update(i, { options: q.options!.filter((_, m) => m !== k) })} aria-label="移除選項">✕</Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => update(i, { options: [...(q.options ?? []), `選項${(q.options?.length ?? 0) + 1}`] })}>新增選項</Button>
                  </div>
                )}
                {q.type === "rating" && <div className="mt-2 text-sm text-muted-foreground">1 到 {q.max ?? 5} 分</div>}
                <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" className="size-5 accent-primary" checked={q.required} onChange={(e) => update(i, { required: e.target.checked })} /> 必填</label>
              </div>
            ))}
          </div>
        </Section>
        <div className="sticky bottom-20 z-20 flex gap-2 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur md:bottom-4">
          <Button variant="outline" size="lg" className="flex-1 tap" onClick={() => router.push("/admin/forms")}>取消</Button>
          <Button size="lg" className="flex-1 tap" onClick={save}>建立並發布</Button>
        </div>
      </StaffOnly>
    </AppShell>
  );
}
