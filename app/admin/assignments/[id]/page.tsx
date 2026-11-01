"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Download, Eye, Link2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StaffOnly } from "@/components/staff-only";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, EmptyState, FileChip, PageHeader, Pill, ReviewStatusPill, StatTile, SubmitStatusPill } from "@/components/ui-bits";
import { store, useData } from "@/lib/store";
import { assignmentStats, students, userName } from "@/lib/selectors";
import { fmtDateTime } from "@/lib/format";
import type { AssignmentSubmission } from "@/lib/types";

interface Row {
  key: string;
  label: string;
  members?: string[];
  sub?: AssignmentSubmission;
}

export default function AdminAssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const data = useData();
  const a = data.assignments.find((x) => x.id === id);
  const [picked, setSelected] = useState<string | null>(null);
  const selected = picked ?? params.get("sub");
  if (!a) return <AppShell title="作業"><EmptyState title="找不到作業" /></AppShell>;

  const stat = assignmentStats(data).find((s) => s.assignment.id === a.id)!;
  const rows: Row[] =
    a.type === "group"
      ? data.groups.filter((g) => !a.targetGroupIds?.length || a.targetGroupIds.includes(g.id)).map((g) => ({ key: g.id, label: g.name, members: g.memberIds.map((m) => userName(data, m)), sub: data.assignmentSubmissions.find((s) => s.assignmentId === a.id && s.ownerType === "group" && s.ownerId === g.id) }))
      : students(data).map((u) => ({ key: u.id, label: u.name, sub: data.assignmentSubmissions.find((s) => s.assignmentId === a.id && s.ownerType === "user" && s.ownerId === u.id) }));
  const notSubmitted = rows.filter((r) => !r.sub || r.sub.versions.length === 0);
  const sel = rows.find((r) => r.sub?.id === selected);

  return (
    <AppShell title={a.title} wide>
      <StaffOnly>
        <PageHeader back="/admin/assignments" title={a.title} description={`${stat.course?.unit}・${a.type === "group" ? "分組作業" : "個人作業"}・截止 ${fmtDateTime(a.dueAt)}`} />
        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatTile label="應繳" value={`${stat.expected} ${stat.unit}`} />
          <StatTile label="已繳" value={`${stat.submitted} ${stat.unit}`} tone="success" hint={stat.late ? `含逾期 ${stat.late}` : undefined} />
          <StatTile label="未繳" value={`${stat.expected - stat.submitted} ${stat.unit}`} tone={stat.expected - stat.submitted ? "destructive" : "success"} />
          <StatTile label="完成率" value={`${stat.rate}%`} tone={stat.rate >= 90 ? "success" : "warning"} />
        </div>
        <div className="grid gap-4 md:grid-cols-[20rem_1fr]">
          <div>
            <ul className="divide-y rounded-2xl border bg-card">
              {rows.map((r) => {
                const has = !!r.sub && r.sub.versions.length > 0;
                return (
                  <li key={r.key}>
                    <button type="button" disabled={!has} onClick={() => setSelected(r.sub!.id)} className={`flex min-h-14 w-full items-center gap-3 px-3 text-left disabled:opacity-60 ${selected && r.sub?.id === selected ? "bg-primary-soft" : ""}`}>
                      <Avatar name={r.label} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{r.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{r.members ? r.members.join("、") : has ? fmtDateTime(r.sub!.versions[r.sub!.versions.length - 1].submittedAt) : "尚未繳交"}</span>
                      </span>
                      {has ? <ReviewStatusPill status={r.sub!.reviewStatus} /> : <SubmitStatusPill status={r.sub?.submitStatus ?? "not_submitted"} />}
                    </button>
                  </li>
                );
              })}
            </ul>
            {notSubmitted.length > 0 && <Button variant="outline" className="mt-3 w-full tap" onClick={() => toast.success(`已提醒 ${notSubmitted.map((r) => r.label).join("、")}（示範）`)}>提醒未繳交的 {notSubmitted.length} {stat.unit}</Button>}
          </div>
          <div>{sel?.sub ? <GradePanel key={sel.sub.id} sub={sel.sub} gradingMode={a.gradingMode} label={sel.label} /> : <EmptyState title="點選左側查看並批改作業" />}</div>
        </div>
      </StaffOnly>
    </AppShell>
  );
}

function GradePanel({ sub, gradingMode, label }: { sub: AssignmentSubmission; gradingMode: "score" | "comment" | "both"; label: string }) {
  const data = useData();
  const latest = sub.versions[sub.versions.length - 1];
  const [score, setScore] = useState<string>(sub.review?.score?.toString() ?? "");
  const [comment, setComment] = useState(sub.review?.comment ?? "");
  const mock = () => toast.info("第一階段為示範資料，正式版會開啟 R2 限時連結。");

  const save = async (requestResubmit: boolean) => {
    if (gradingMode !== "comment" && !requestResubmit && score === "") return toast.error("請輸入分數");
    if (!comment.trim() && (gradingMode !== "score" || requestResubmit)) return toast.error("請輸入評語");
    try {
      await store.reviewAssignment(sub.id, { score: gradingMode === "comment" || score === "" ? undefined : Number(score), comment: comment.trim(), requestResubmit });
      toast.success(requestResubmit ? "已要求重新提交並通知" : "已完成批改並通知");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-bold">{label}</span>
          <SubmitStatusPill status={sub.submitStatus} />
          <ReviewStatusPill status={sub.reviewStatus} />
          <span className="text-sm text-muted-foreground">第 {latest.no} 版・{userName(data, latest.submittedById)} 於 {fmtDateTime(latest.submittedAt)} 提交</span>
        </div>
        {latest.text && <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3">{latest.text}</p>}
        {latest.link && <a href={latest.link} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-primary underline break-all"><Link2 className="size-4" />{latest.link}</a>}
        {latest.files.length > 0 && (
          <div className="mt-3 space-y-2">
            {latest.files.map((f) => (
              <div key={f.id} className="flex flex-wrap items-center gap-2">
                <FileChip file={f} />
                <Button size="sm" variant="outline" onClick={mock}><Eye className="size-4" /> 預覽</Button>
                <Button size="sm" variant="outline" onClick={mock}><Download className="size-4" /> 下載</Button>
              </div>
            ))}
          </div>
        )}
        {sub.versions.length > 1 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-primary">查看先前 {sub.versions.length - 1} 個版本</summary>
            <ul className="mt-2 space-y-2">
              {sub.versions.slice(0, -1).reverse().map((v) => <li key={v.no} className="rounded-lg border px-3 py-2"><div className="text-muted-foreground">第 {v.no} 版・{userName(data, v.submittedById)}・{fmtDateTime(v.submittedAt)}</div><div className="line-clamp-3">{v.text}</div></li>)}
            </ul>
          </details>
        )}
      </div>
      <div className="rounded-2xl border bg-card p-4">
        <h3 className="mb-3">批改{sub.ownerType === "group" && <span className="ml-2 text-sm font-normal text-muted-foreground">整組共同回覆</span>}</h3>
        {sub.review && <div className="mb-3 text-sm text-muted-foreground">上次批改：{userName(data, sub.review.reviewerId)}・{fmtDateTime(sub.review.reviewedAt)}・{sub.review.readBy.length > 1 ? "學員已讀" : "學員未讀"}</div>}
        <div className="grid gap-3 md:grid-cols-[8rem_1fr]">
          {gradingMode !== "comment" && <label className="block"><span className="mb-1 block font-medium">分數</span><Input type="number" inputMode="numeric" min={0} max={100} className="min-h-12 text-base" value={score} onChange={(e) => setScore(e.target.value)} /></label>}
          <label className="block md:col-span-1"><span className="mb-1 block font-medium">評語</span><Textarea rows={4} className="text-base" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="寫下給學員的回覆…" /></label>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button size="lg" className="flex-1 tap" onClick={() => save(false)}>完成批改</Button>
          <Button size="lg" variant="outline" className="flex-1 tap" onClick={() => save(true)}>要求重新提交</Button>
        </div>
        {sub.ownerType === "group" && <p className="mt-2 text-xs text-muted-foreground">分組作業預設整組共同評分與回覆；個別組員評分為未來擴充。</p>}
      </div>
      <Pill tone="normal">版本 {sub.version}</Pill>
    </div>
  );
}
