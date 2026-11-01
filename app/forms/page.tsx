"use client";

import { useState } from "react";
import { FileStack } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DueTag, EmptyState, ListRow, PageHeader, Pill, SegmentedTabs } from "@/components/ui-bits";
import { useCurrentUser, useData } from "@/lib/store";
import { completedForms, formViewsForUser, pendingForms } from "@/lib/selectors";
import { fmtDateTime } from "@/lib/format";

export default function FormsPage() {
  const user = useCurrentUser();
  const data = useData();
  const [tab, setTab] = useState<"pending" | "done">("pending");
  const views = user ? formViewsForUser(data, user.id) : [];
  const pending = pendingForms(views);
  const done = completedForms(views);
  return (
    <AppShell title="線上表單">
      <PageHeader title="線上表單" description="課後回饋與課前預備問卷" />
      <SegmentedTabs value={tab} onChange={setTab} options={[{ value: "pending", label: "待填寫", count: pending.length }, { value: "done", label: "已完成", count: done.length }]} />
      {tab === "pending" ? (
        pending.length === 0 ? <EmptyState title="沒有待填寫的表單" /> : (
          <div className="space-y-2">
            {pending.map((v) => (
              <ListRow key={v.form.id} href={`/forms/${v.form.id}`} icon={FileStack} title={v.form.title} subtitle={v.submission?.status === "draft" ? "已儲存草稿，尚未送出" : v.course?.unit} right={<DueTag dueAt={v.form.dueAt} />} highlight={v.isOverdue} />
            ))}
          </div>
        )
      ) : done.length === 0 ? <EmptyState title="還沒有完成的表單" /> : (
        <div className="space-y-2">
          {done.map((v) => (
            <ListRow key={v.form.id} href={`/forms/${v.form.id}`} icon={FileStack} title={v.form.title} subtitle={`送出於 ${fmtDateTime(v.submission!.submittedAt!)}`} right={v.unreadFeedback.length > 0 ? <Pill tone="overdue">老師回覆</Pill> : v.feedback.length > 0 ? <Pill tone="done">已回覆</Pill> : undefined} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
