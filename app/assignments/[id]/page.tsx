"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, History, Link2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FilePicker } from "@/components/file-picker";
import { Avatar, DueTag, EmptyState, Field, FileChip, PageHeader, Pill, ReviewStatusPill, Section, SubmitStatusPill } from "@/components/ui-bits";
import { ConflictError, store, useCurrentUser, useData } from "@/lib/store";
import { assignmentViewsForUser, effectiveSubmitStatus, userName } from "@/lib/selectors";
import { assignmentTypeLabel, fmtDateTime, fmtFullDate } from "@/lib/format";
import type { Assignment, AssignmentSubmission, FileRef } from "@/lib/types";

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser();
  const data = useData();
  const view = user ? assignmentViewsForUser(data, user.id).find((v) => v.assignment.id === id) : undefined;

  const [composing, setComposing] = useState(false);

  const sub = view?.submission;
  const latest = sub?.versions[sub.versions.length - 1];
  const subId = sub?.id;
  const unreadReview = !!view?.unreadReview;

  useEffect(() => {
    if (user && subId && unreadReview) void store.markReviewRead(subId, user.id);
  }, [user, subId, unreadReview]);

  if (!view || !user) return <AppShell title="作業"><EmptyState title="找不到作業" /></AppShell>;

  const { assignment, group } = view;
  const ownerType = assignment.type === "group" ? "group" : "user";
  const ownerId = assignment.type === "group" ? group?.id : user.id;
  const hasSubmitted = !!sub && sub.versions.length > 0;
  const canResubmit = !hasSubmitted || assignment.allowResubmit;
  const showForm = composing || (!hasSubmitted && !sub?.review);
  const status = effectiveSubmitStatus(view);

  if (assignment.type === "group" && !group) {
    return (
      <AppShell title={assignment.title}>
        <PageHeader back="/assignments" title={assignment.title} />
        <EmptyState title="你尚未被分配到小組" hint="請聯絡老師或管理員" />
      </AppShell>
    );
  }

  return (
    <AppShell title={assignment.title}>
      <PageHeader back="/assignments" title={assignment.title} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pill tone="primary">{assignmentTypeLabel[assignment.type]}</Pill>
        {group && <Pill tone="info">{group.name}</Pill>}
        <SubmitStatusPill status={status} />
        {hasSubmitted && sub && <ReviewStatusPill status={sub.reviewStatus} />}
        <DueTag dueAt={assignment.dueAt} done={hasSubmitted && sub?.reviewStatus !== "needs_revision"} />
      </div>

      <div className="mb-5 rounded-2xl border bg-card p-4">
        <h2 className="mb-1 text-lg">作業內容</h2>
        <p className="whitespace-pre-wrap">{assignment.description}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">課程</dt><dd>{view.course?.unit}</dd>
          <dt className="text-muted-foreground">截止時間</dt><dd>{fmtDateTime(assignment.dueAt)}</dd>
          <dt className="text-muted-foreground">允許補交</dt><dd>{assignment.allowLate ? "是" : "否"}</dd>
          <dt className="text-muted-foreground">允許重新提交</dt><dd>{assignment.allowResubmit ? "是" : "否"}</dd>
          <dt className="text-muted-foreground">上傳格式</dt><dd>{assignment.formats.join("、")}（最大 {assignment.maxSizeMB} MB）</dd>
        </dl>
        {assignment.attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">{assignment.attachments.map((f) => <FileChip key={f.id} file={f} />)}</div>
        )}
      </div>

      {sub?.review && (
        <div className={`mb-5 rounded-2xl border p-4 ${sub.reviewStatus === "needs_revision" ? "border-destructive/40 bg-destructive-soft/40" : "border-primary/30 bg-primary-soft/50"}`}>
          <h2 className="mb-2 text-lg">{sub.reviewStatus === "needs_revision" ? "老師要求重新提交" : "老師的批改"}</h2>
          <div className="flex items-start gap-3">
            <Avatar name={userName(data, sub.review.reviewerId)} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-muted-foreground">{userName(data, sub.review.reviewerId)}・{fmtDateTime(sub.review.reviewedAt)}</div>
              {sub.review.score !== undefined && <div className="text-2xl font-bold text-primary">{sub.review.score} 分</div>}
              <p className="whitespace-pre-wrap">{sub.review.comment}</p>
            </div>
          </div>
        </div>
      )}

      {group && (
        <Section title="小組成員">
          <div className="flex flex-wrap gap-2">
            {group.memberIds.map((mid) => (
              <span key={mid} className="inline-flex items-center gap-1.5 rounded-full border bg-card py-1 pr-3 pl-1 text-sm">
                <Avatar name={userName(data, mid)} size="sm" />{userName(data, mid)}{group.leaderId === mid && <span className="text-xs text-primary">組長</span>}
              </span>
            ))}
          </div>
          {sub?.draft && <p className="mt-2 text-sm text-muted-foreground">{userName(data, sub.draft.savedById)} 於 {fmtDateTime(sub.draft.savedAt)} 儲存了草稿，組員都可以接續編輯。</p>}
        </Section>
      )}

      {hasSubmitted && latest && !composing && (
        <Section title={`目前版本（第 ${latest.no} 版）`}>
          <div className="rounded-2xl border bg-card p-4">
            <div className="mb-2 text-sm text-muted-foreground">由 {userName(data, latest.submittedById)} 於 {fmtDateTime(latest.submittedAt)} 提交</div>
            {latest.text && <p className="whitespace-pre-wrap">{latest.text}</p>}
            {latest.link && <a href={latest.link} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-primary underline break-all"><Link2 className="size-4" />{latest.link}</a>}
            {latest.files.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{latest.files.map((f) => <FileChip key={f.id} file={f} />)}</div>}
          </div>
          {canResubmit && (
            <Button type="button" variant={sub?.reviewStatus === "needs_revision" ? "default" : "outline"} size="lg" className="mt-3 w-full tap" onClick={() => setComposing(true)}>
              重新提交新版本
            </Button>
          )}
        </Section>
      )}

      {showForm && (
        <Composer
          key={`${sub?.id ?? "new"}:${sub?.version ?? 0}`}
          assignment={assignment}
          groupName={group?.name}
          ownerType={ownerType}
          ownerId={ownerId!}
          sub={sub}
          hasSubmitted={hasSubmitted}
          composing={composing}
          onCancel={() => setComposing(false)}
          onSubmitted={() => setComposing(false)}
        />
      )}

      {sub && sub.versions.length > 1 && (
        <Section title="提交紀錄">
          <ul className="space-y-2">
            {[...sub.versions].reverse().map((v) => (
              <li key={v.no} className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3">
                <History className="mt-1 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">第 {v.no} 版{v.no === sub.versions.length && <span className="ml-2 text-xs text-primary">最新</span>}</div>
                  <div className="text-sm text-muted-foreground">{userName(data, v.submittedById)}・{fmtDateTime(v.submittedAt)}</div>
                  {v.text && <p className="mt-1 line-clamp-2 text-sm">{v.text}</p>}
                  {v.files.length > 0 && <div className="mt-1 text-sm text-muted-foreground">{v.files.map((f) => f.name).join("、")}</div>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="text-center text-xs text-muted-foreground">開放時間 {fmtFullDate(assignment.openAt)}</p>
    </AppShell>
  );
}

function Composer({ assignment, groupName, ownerType, ownerId, sub, hasSubmitted, composing, onCancel, onSubmitted }: { assignment: Assignment; groupName?: string; ownerType: "user" | "group"; ownerId: string; sub?: AssignmentSubmission; hasSubmitted: boolean; composing: boolean; onCancel: () => void; onSubmitted: () => void }) {
  // 以草稿或最新版本作為編輯起點；父層以 key 在版本變動時重置
  const latest = sub?.versions[sub.versions.length - 1];
  const src = sub?.draft ?? latest;
  const [text, setText] = useState(src?.text ?? "");
  const [link, setLink] = useState(src?.link ?? "");
  const [files, setFiles] = useState<FileRef[]>(src?.files ?? []);
  const baseVersion = sub?.version ?? null;

  const saveDraft = async () => {
    try {
      await store.saveAssignmentDraft(assignment.id, ownerType, ownerId, { text, link: link || undefined, files });
      toast.success("已儲存草稿");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const submit = async () => {
    if (!text.trim() && files.length === 0 && !link.trim()) {
      toast.error("請至少輸入文字、上傳檔案或提供連結");
      return;
    }
    try {
      await store.submitAssignment(assignment.id, ownerType, ownerId, { text, link: link || undefined, files }, baseVersion);
      toast.success(assignment.type === "group" ? `已代表${groupName}提交，所有組員都會看到。` : "作業已提交");
      onSubmitted();
    } catch (e) {
      if (e instanceof ConflictError) toast.error("其他組員剛剛已經提交了新版本，請先查看最新內容後再決定是否重新提交。", { duration: 8000 });
      else toast.error((e as Error).message);
    }
  };

  return (
    <Section title={hasSubmitted ? "重新提交" : "繳交作業"}>
      {assignment.type === "group" && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-info-soft p-3 text-sm text-info">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>你將代表 {groupName} 提交；系統會記錄實際提交者，並通知所有組員。若其他組員同時提交，系統會提醒你先查看最新版本。</span>
        </div>
      )}
      <div className="space-y-4">
        <Field label="文字內容" hint="可直接輸入，或與檔案、連結一起提交">
          <Textarea rows={6} className="text-base" value={text} onChange={(e) => setText(e.target.value)} placeholder="在這裡輸入內容…" />
        </Field>
        <Field label="上傳檔案">
          <FilePicker files={files} onChange={setFiles} accept={assignment.formats} maxSizeMB={assignment.maxSizeMB} purpose="assignment" />
        </Field>
        <Field label="外部文件連結" hint="例如 Google 文件、Canva、雲端硬碟連結">
          <Input className="min-h-12 text-base" type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
        </Field>
      </div>
      <div className="sticky bottom-20 z-20 mt-4 flex gap-2 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        {composing && hasSubmitted && <Button type="button" variant="ghost" size="lg" className="tap" onClick={onCancel}>取消</Button>}
        <Button type="button" variant="outline" size="lg" className="flex-1 tap" onClick={saveDraft}>暫存草稿</Button>
        <Button type="button" size="lg" className="flex-1 tap" onClick={submit}>{hasSubmitted ? "提交新版本" : "正式提交"}</Button>
      </div>
    </Section>
  );
}
