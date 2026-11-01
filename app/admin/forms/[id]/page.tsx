"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StaffOnly } from "@/components/staff-only";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, EmptyState, PageHeader, Pill, SegmentedTabs, Section, StatTile } from "@/components/ui-bits";
import { store, useData } from "@/lib/store";
import { questionStats, students, userName } from "@/lib/selectors";
import { fmtDateTime, pct } from "@/lib/format";
import type { AnswerValue, FileRef, FormSubmission } from "@/lib/types";

function renderAnswer(v: AnswerValue | undefined) {
  if (v === null || v === undefined || v === "") return <span className="text-muted-foreground">（未填）</span>;
  if (Array.isArray(v)) return (v as (string | FileRef)[]).map((x) => (typeof x === "string" ? x : x.name)).join("、") || <span className="text-muted-foreground">（未填）</span>;
  if (typeof v === "number") return `${v} 分`;
  return String(v);
}

export default function AdminFormDetailPage() {
  const { id } = useParams<{ id: string }>();
  const data = useData();
  const form = data.forms.find((f) => f.id === id);
  const [tab, setTab] = useState<"responses" | "stats">("responses");
  const [selected, setSelected] = useState<string | null>(null);
  if (!form) return <AppShell title="表單"><EmptyState title="找不到表單" /></AppShell>;

  const all = students(data);
  const subs = data.formSubmissions.filter((s) => s.formId === form.id);
  const submitted = subs.filter((s) => s.status === "submitted");
  const notYet = all.filter((u) => !submitted.some((s) => s.userId === u.id));
  const stats = questionStats(data, form);
  const sel = selected ? subs.find((s) => s.id === selected) : undefined;

  return (
    <AppShell title={form.title} wide>
      <StaffOnly>
        <PageHeader back="/admin/forms" title={form.title} description={`${data.courses.find((c) => c.id === form.courseId)?.unit}・截止 ${fmtDateTime(form.dueAt)}`} action={<Button asChild variant="outline"><Link href={`/admin/forms/${form.id}/edit`}>編輯</Link></Button>} />
        <div className="mb-4 grid grid-cols-3 gap-2">
          <StatTile label="已填寫" value={submitted.length} hint={`共 ${all.length} 人`} />
          <StatTile label="填寫率" value={`${pct(submitted.length, all.length)}%`} tone={pct(submitted.length, all.length) >= 90 ? "success" : "warning"} />
          <StatTile label="未填寫" value={notYet.length} tone={notYet.length ? "destructive" : "success"} />
        </div>
        <SegmentedTabs value={tab} onChange={setTab} options={[{ value: "responses", label: "學員回答" }, { value: "stats", label: "題目統計" }]} />

        {tab === "responses" && (
          <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
            <div>
              <ul className="divide-y rounded-2xl border bg-card">
                {all.map((u) => {
                  const s = subs.find((x) => x.userId === u.id);
                  const fbCount = s ? data.feedback.filter((f) => f.targetType === "form" && f.targetId === s.id).length : 0;
                  return (
                    <li key={u.id}>
                      <button type="button" disabled={!s} onClick={() => setSelected(s?.id ?? null)} className={`flex min-h-14 w-full items-center gap-3 px-3 text-left disabled:opacity-60 ${selected && s?.id === selected ? "bg-primary-soft" : ""}`}>
                        <Avatar name={u.name} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{u.name}</span>
                          <span className="block text-xs text-muted-foreground">{s?.status === "submitted" ? `送出 ${fmtDateTime(s.submittedAt!)}` : s?.status === "draft" ? "草稿" : "未填寫"}</span>
                        </span>
                        {s?.status === "submitted" ? <Pill tone={fbCount ? "done" : "normal"}>{fbCount ? `已回覆 ${fbCount}` : "未回覆"}</Pill> : <Pill tone="overdue">未填</Pill>}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {notYet.length > 0 && <Button variant="outline" className="mt-3 w-full tap" onClick={() => store.remind("form", form.id).then((r) => toast.success(`已通知 ${r.notified} 位學員${r.lineGroup ? "，並推播到 LINE 群組" : ""}${r.linePersonal ? `，LINE 個人通知 ${r.linePersonal} 位` : ""}`), (e: Error) => toast.error(e.message))}>提醒未填寫的 {notYet.length} 位學員</Button>}
            </div>
            <div>
              {sel ? <ResponseDetail sub={sel} formId={form.id} /> : <EmptyState title="點選左側學員查看回答" hint="可針對整份表單或個別題目留言" />}
            </div>
          </div>
        )}

        {tab === "stats" && (
          <div className="space-y-4">
            {stats.map((s, i) => (
              <div key={s.question.id} className="rounded-2xl border bg-card p-4">
                <h3 className="mb-2">{i + 1}. {s.question.title}</h3>
                {s.kind === "choice" && (
                  <ul className="space-y-1.5">
                    {Object.entries(s.counts).map(([o, n]) => (
                      <li key={o}>
                        <div className="flex justify-between text-sm"><span>{o}</span><span className="text-muted-foreground">{n} 人・{pct(n, s.total)}%</span></div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${pct(n, s.total)}%` }} /></div>
                      </li>
                    ))}
                  </ul>
                )}
                {s.kind === "rating" && (
                  <div>
                    <div className="mb-2 text-2xl font-bold text-primary">平均 {s.avg} 分<span className="ml-2 text-sm font-normal text-muted-foreground">（{s.total} 人）</span></div>
                    <ul className="space-y-1.5">
                      {Object.entries(s.dist).map(([k, n]) => (
                        <li key={k}>
                          <div className="flex justify-between text-sm"><span>{k} 分</span><span className="text-muted-foreground">{n} 人</span></div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-chart-2" style={{ width: `${pct(n, s.total)}%` }} /></div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {s.kind === "text" && (s.texts.length === 0 ? <p className="text-sm text-muted-foreground">尚無回答</p> : (
                  <ul className="space-y-2">
                    {s.texts.map((t) => <li key={t.userId} className="rounded-lg bg-muted/60 px-3 py-2"><span className="mr-2 text-sm font-medium text-primary">{userName(data, t.userId)}</span>{t.value}</li>)}
                  </ul>
                ))}
              </div>
            ))}
          </div>
        )}
      </StaffOnly>
    </AppShell>
  );
}

function ResponseDetail({ sub, formId }: { sub: FormSubmission; formId: string }) {
  const data = useData();
  const form = data.forms.find((f) => f.id === formId)!;
  const feedback = data.feedback.filter((f) => f.targetType === "form" && f.targetId === sub.id);
  const [text, setText] = useState("");
  const [questionId, setQuestionId] = useState("");

  const send = async () => {
    if (!text.trim()) return;
    try {
      await store.addFeedback({ targetType: "form", targetId: sub.id, questionId: questionId || undefined, content: text.trim() });
      setText("");
      setQuestionId("");
      toast.success("已送出回覆並通知學員");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4">
        <div className="mb-3 flex items-center gap-2"><Avatar name={userName(data, sub.userId)} size="sm" /><span className="font-medium">{userName(data, sub.userId)}</span><span className="text-sm text-muted-foreground">・{sub.status === "submitted" ? `送出 ${fmtDateTime(sub.submittedAt!)}` : "草稿"}</span></div>
        <ol className="space-y-3">
          {form.questions.map((q, i) => (
            <li key={q.id}>
              <div className="text-sm text-muted-foreground">{i + 1}. {q.title}</div>
              <div className="whitespace-pre-wrap">{renderAnswer(sub.answers[q.id])}</div>
              {feedback.filter((f) => f.questionId === q.id).map((f) => <div key={f.id} className="mt-1 rounded-lg bg-primary-soft/60 px-3 py-1.5 text-sm"><span className="font-medium text-primary">{userName(data, f.authorId)}：</span>{f.content}{f.readBy.includes(sub.userId) ? <span className="ml-2 text-xs text-muted-foreground">已讀</span> : <span className="ml-2 text-xs text-warning">未讀</span>}</div>)}
            </li>
          ))}
        </ol>
      </div>
      <Section title="回覆">
        {feedback.filter((f) => !f.questionId).length > 0 && (
          <ul className="mb-3 space-y-2">
            {feedback.filter((f) => !f.questionId).map((f) => <li key={f.id} className="rounded-lg bg-primary-soft/60 px-3 py-2 text-sm"><span className="font-medium text-primary">{userName(data, f.authorId)}</span>・{fmtDateTime(f.createdAt)}{f.readBy.includes(sub.userId) ? <span className="ml-2 text-xs text-muted-foreground">已讀</span> : <span className="ml-2 text-xs text-warning">未讀</span>}<div className="text-base">{f.content}</div></li>)}
          </ul>
        )}
        <select className="mb-2 min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" value={questionId} onChange={(e) => setQuestionId(e.target.value)}>
          <option value="">針對整份表單</option>
          {form.questions.map((q, i) => <option key={q.id} value={q.id}>針對第 {i + 1} 題：{q.title}</option>)}
        </select>
        <div className="flex items-end gap-2">
          <Textarea rows={3} className="text-base" placeholder="寫下給學員的回覆…" value={text} onChange={(e) => setText(e.target.value)} />
          <Button size="icon-lg" onClick={send} aria-label="送出回覆"><Send className="size-5" /></Button>
        </div>
      </Section>
    </div>
  );
}
