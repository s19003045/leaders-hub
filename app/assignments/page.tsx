"use client";

import { useState } from "react";
import { ClipboardList, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DueTag, EmptyState, ListRow, PageHeader, Pill, SegmentedTabs, SubmitStatusPill } from "@/components/ui-bits";
import { useCurrentUser, useData } from "@/lib/store";
import { assignmentViewsForUser, effectiveSubmitStatus, type AssignmentView } from "@/lib/selectors";
import { reviewStatusLabel } from "@/lib/format";

export default function AssignmentsPage() {
  const user = useCurrentUser();
  const data = useData();
  const [tab, setTab] = useState<"individual" | "group">("individual");
  const views = user ? assignmentViewsForUser(data, user.id).filter((v) => v.isOpen) : [];
  const list = views.filter((v) => v.assignment.type === tab).sort((a, b) => Number(b.needsAction) - Number(a.needsAction) || b.assignment.dueAt.localeCompare(a.assignment.dueAt));
  const count = (t: "individual" | "group") => views.filter((v) => v.assignment.type === t && v.needsAction).length;

  return (
    <AppShell title="作業">
      <PageHeader title="作業" description={tab === "group" ? "小組作業由一位組員代表提交即可，所有組員都會看到狀態。" : "個人作業請於截止日前繳交。"} />
      <SegmentedTabs value={tab} onChange={setTab} options={[{ value: "individual", label: "個人作業", count: count("individual") }, { value: "group", label: "分組作業", count: count("group") }]} />
      {list.length === 0 ? <EmptyState title={tab === "group" ? "目前沒有分組作業" : "目前沒有個人作業"} /> : (
        <div className="space-y-2">
          {list.map((v) => <AssignmentRow key={v.assignment.id} v={v} />)}
        </div>
      )}
    </AppShell>
  );
}

function AssignmentRow({ v }: { v: AssignmentView }) {
  const status = effectiveSubmitStatus(v);
  const done = !!v.submission && v.submission.versions.length > 0 && v.submission.reviewStatus !== "needs_revision";
  return (
    <ListRow
      href={`/assignments/${v.assignment.id}`}
      icon={v.assignment.type === "group" ? UsersRound : ClipboardList}
      title={v.assignment.title}
      subtitle={
        <span className="flex flex-wrap items-center gap-1.5">
          <span>{v.course?.unit}</span>
          <SubmitStatusPill status={status} />
          {v.submission && v.submission.versions.length > 0 && <Pill tone={v.submission.reviewStatus === "needs_revision" ? "overdue" : v.submission.reviewStatus === "reviewed" ? "done" : "normal"}>{reviewStatusLabel[v.submission.reviewStatus]}</Pill>}
          {v.unreadReview && <Pill tone="overdue">新回覆</Pill>}
        </span>
      }
      right={<DueTag dueAt={v.assignment.dueAt} done={done} />}
      highlight={v.needsAction && v.isOverdue}
    />
  );
}
