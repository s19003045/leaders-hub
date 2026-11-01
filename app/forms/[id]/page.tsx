"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Avatar, DueTag, EmptyState, PageHeader, Pill } from "@/components/ui-bits";
import { QuestionField } from "@/components/question-field";
import { store, useCurrentUser, useData } from "@/lib/store";
import { formViewsForUser, userName, type FormView } from "@/lib/selectors";
import { fmtDateTime } from "@/lib/format";
import type { AnswerValue, User } from "@/lib/types";

export default function FormFillPage() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser();
  const data = useData();
  const view = user ? formViewsForUser(data, user.id).find((v) => v.form.id === id) : undefined;
  const form = data.forms.find((f) => f.id === id);

  // 進入頁面即把老師回覆標為已讀（同步到外部 store，而非 React state）
  const unreadIds = view?.unreadFeedback.map((f) => f.id).join(",") ?? "";
  useEffect(() => {
    if (user && unreadIds) void store.markFeedbackRead(unreadIds.split(","), user.id);
  }, [user, unreadIds]);

  if (!form || !user) return <AppShell title="表單"><EmptyState title="找不到表單" /></AppShell>;
  const v: FormView = view ?? { form, course: data.courses.find((c) => c.id === form.courseId), submission: undefined, isOpen: true, isOverdue: false, feedback: [], unreadFeedback: [] };

  return (
    <AppShell title={form.title}>
      {/* key 以提交紀錄 id 為準：換表單或首次建立草稿時重置填寫狀態 */}
      <FormFill key={v.submission?.id ?? "new"} view={v} user={user} />
    </AppShell>
  );
}

function FormFill({ view, user }: { view: FormView; user: User }) {
  const data = useData();
  const router = useRouter();
  const { form, submission } = view;
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() => submission?.answers ?? {});
  const [editing, setEditing] = useState(false);
  const submitted = submission?.status === "submitted";
  const readOnly = submitted && !editing;

  const missing = useMemo(() => form.questions.filter((q) => q.required && isEmpty(answers[q.id])), [form, answers]);

  const save = async (submit: boolean) => {
    if (submit && missing.length > 0) {
      toast.error(`還有 ${missing.length} 題必填未完成：${missing.map((q) => q.title).join("、")}`);
      return;
    }
    try {
      await store.saveFormAnswers(form.id, user.id, answers, submit);
      toast.success(submit ? "已送出，謝謝你的回饋！" : "已儲存草稿");
      if (submit) {
        setEditing(false);
        router.push("/forms");
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <>
      <PageHeader back="/forms" title={form.title} description={form.description} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <DueTag dueAt={form.dueAt} done={submitted} />
        {submission?.submittedAt && <span className="text-sm text-muted-foreground">送出於 {fmtDateTime(submission.submittedAt)}</span>}
        {submission?.status === "draft" && <Pill tone="info">草稿</Pill>}
      </div>

      {view.feedback.length > 0 && (
        <div className="mb-5 rounded-2xl border border-primary/30 bg-primary-soft/50 p-4">
          <h2 className="mb-2 text-lg">老師與助教的回覆</h2>
          <ul className="space-y-3">
            {view.feedback.filter((f) => !f.questionId).map((f) => (
              <FeedbackItem key={f.id} name={userName(data, f.authorId)} content={f.content} at={f.createdAt} />
            ))}
          </ul>
        </div>
      )}

      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save(true); }}>
        {form.questions.map((q, i) => (
          <div key={q.id} className="rounded-2xl border bg-card p-4">
            <QuestionField index={i + 1} q={q} value={answers[q.id] ?? null} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} readOnly={readOnly} />
            {view.feedback.filter((f) => f.questionId === q.id).map((f) => (
              <div key={f.id} className="mt-3 rounded-lg bg-primary-soft/60 p-3">
                <FeedbackItem name={userName(data, f.authorId)} content={f.content} at={f.createdAt} compact />
              </div>
            ))}
          </div>
        ))}

        {readOnly ? (
          form.allowEdit ? (
            <Button type="button" variant="outline" size="lg" className="w-full tap" onClick={() => setEditing(true)}>修改回答</Button>
          ) : (
            <p className="text-center text-sm text-muted-foreground">此表單送出後不可修改。</p>
          )
        ) : (
          <div className="sticky bottom-20 z-20 flex gap-2 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur md:bottom-4">
            <Button type="button" variant="outline" size="lg" className="flex-1 tap" onClick={() => save(false)}>暫存草稿</Button>
            <Button type="submit" size="lg" className="flex-1 tap">{submitted ? "更新回答" : "正式送出"}</Button>
          </div>
        )}
      </form>
    </>
  );
}

function isEmpty(v: AnswerValue | undefined) {
  if (v === null || v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "number") return !(v > 0);
  return String(v).trim() === "";
}

function FeedbackItem({ name, content, at, compact }: { name: string; content: string; at: string; compact?: boolean }) {
  return (
    <li className="flex items-start gap-3 list-none">
      <Avatar name={name} size="sm" />
      <div className="min-w-0">
        <div className="text-sm text-muted-foreground">{name}・{fmtDateTime(at)}</div>
        <div className={compact ? "text-base" : ""}>{content}</div>
      </div>
    </li>
  );
}
