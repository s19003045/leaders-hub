"use client";

import { useParams } from "next/navigation";
import { ClipboardList, FileStack, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DueTag, EmptyState, ListRow, PageHeader, Pill, Section, SubmitStatusPill, materialIcon } from "@/components/ui-bits";
import { useCurrentUser, useData } from "@/lib/store";
import { assignmentViewsForUser, effectiveSubmitStatus, formViewsForUser, userName } from "@/lib/selectors";
import { fmtDate, fmtFullDate, materialTypeLabel } from "@/lib/format";

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser();
  const data = useData();
  const c = data.courses.find((x) => x.id === id);
  if (!c || !user) return <AppShell title="課程"><EmptyState title="找不到課程" /></AppShell>;
  const materials = data.materials.filter((m) => m.courseId === c.id);
  const forms = formViewsForUser(data, user.id).filter((v) => v.form.courseId === c.id);
  const assignments = assignmentViewsForUser(data, user.id).filter((v) => v.assignment.courseId === c.id);

  return (
    <AppShell title={c.unit}>
      <PageHeader back="/courses" title={`${c.unit}・${c.title}`} description={c.description} />
      <div className="mb-5 rounded-2xl border bg-card p-4 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">日期</dt><dd>{fmtFullDate(c.date)}</dd>
          <dt className="text-muted-foreground">地點</dt><dd>{c.location}</dd>
          <dt className="text-muted-foreground">講師</dt><dd>{userName(data, c.teacherId)}</dd>
        </dl>
      </div>
      <Section title="教材">
        {materials.length === 0 ? <EmptyState title="尚未上傳教材" /> : <div className="space-y-2">{materials.map((m) => <ListRow key={m.id} href={`/materials/${m.id}`} icon={materialIcon[m.type]} title={m.title} subtitle={`${materialTypeLabel[m.type]}・${fmtDate(m.createdAt)}`} right={m.pinned ? <Pill tone="soon">課前閱讀</Pill> : undefined} />)}</div>}
      </Section>
      <Section title="表單">
        {forms.length === 0 ? <EmptyState title="尚無表單" /> : <div className="space-y-2">{forms.map((v) => <ListRow key={v.form.id} href={`/forms/${v.form.id}`} icon={FileStack} title={v.form.title} right={<DueTag dueAt={v.form.dueAt} done={v.submission?.status === "submitted"} />} />)}</div>}
      </Section>
      <Section title="作業">
        {assignments.length === 0 ? <EmptyState title="尚無作業" /> : <div className="space-y-2">{assignments.map((v) => <ListRow key={v.assignment.id} href={`/assignments/${v.assignment.id}`} icon={v.assignment.type === "group" ? UsersRound : ClipboardList} title={v.assignment.title} subtitle={<SubmitStatusPill status={effectiveSubmitStatus(v)} />} right={<DueTag dueAt={v.assignment.dueAt} done={!!v.submission && v.submission.versions.length > 0} />} />)}</div>}
      </Section>
    </AppShell>
  );
}
