"use client";

import { UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar, DueTag, EmptyState, ListRow, PageHeader, Section, SubmitStatusPill } from "@/components/ui-bits";
import { useCurrentUser, useData } from "@/lib/store";
import { assignmentViewsForUser, effectiveSubmitStatus, groupOfUser, userById, userName } from "@/lib/selectors";
import { fmtDateTime } from "@/lib/format";

export default function GroupPage() {
  const user = useCurrentUser();
  const data = useData();
  const group = user ? groupOfUser(data, user.id) : undefined;
  if (!user) return null;
  if (!group) return <AppShell title="我的小組"><PageHeader title="我的小組" /><EmptyState title="你尚未被分配到小組" hint="請聯絡老師或管理員" /></AppShell>;
  const groupAssignments = assignmentViewsForUser(data, user.id).filter((v) => v.assignment.type === "group" && v.isOpen);

  return (
    <AppShell title={group.name}>
      <PageHeader title={group.name} description="課後小組討論與分組作業的夥伴" />
      <Section title="組員">
        <ul className="divide-y rounded-2xl border bg-card">
          {group.memberIds.map((id) => {
            const m = userById(data, id);
            if (!m) return null;
            return (
              <li key={id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={m.name} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{m.name}{group.leaderId === id && <span className="ml-2 rounded-full bg-primary-soft px-2 text-xs text-primary">組長</span>}</div>
                  <div className="text-sm text-muted-foreground">{m.company}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>
      <Section title="小組作業">
        {groupAssignments.length === 0 ? <EmptyState title="目前沒有分組作業" /> : (
          <div className="space-y-2">
            {groupAssignments.map((v) => {
              const latest = v.submission?.versions[v.submission.versions.length - 1];
              return <ListRow key={v.assignment.id} href={`/assignments/${v.assignment.id}`} icon={UsersRound} title={v.assignment.title} subtitle={<span className="flex flex-wrap items-center gap-1.5"><SubmitStatusPill status={effectiveSubmitStatus(v)} />{latest && <span>由 {userName(data, latest.submittedById)} 於 {fmtDateTime(latest.submittedAt)} 提交</span>}</span>} right={<DueTag dueAt={v.assignment.dueAt} done={!!latest} />} />;
            })}
          </div>
        )}
      </Section>
      <Section title="小組異動紀錄">
        <ul className="space-y-1 text-sm text-muted-foreground">
          {group.history.map((h, i) => <li key={i}>{fmtDateTime(h.at)}・{h.action}（{userName(data, h.byUserId)}）</li>)}
        </ul>
      </Section>
    </AppShell>
  );
}
