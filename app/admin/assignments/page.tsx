"use client";

import Link from "next/link";
import { ClipboardList, Plus, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StaffOnly } from "@/components/staff-only";
import { Button } from "@/components/ui/button";
import { ListRow, PageHeader, Pill } from "@/components/ui-bits";
import { useData } from "@/lib/store";
import { assignmentStats } from "@/lib/selectors";
import { fmtDateTime } from "@/lib/format";

export default function AdminAssignmentsPage() {
  const data = useData();
  const stats = assignmentStats(data).sort((a, b) => b.assignment.dueAt.localeCompare(a.assignment.dueAt));
  return (
    <AppShell title="作業管理" wide>
      <StaffOnly>
        <PageHeader title="作業管理" description="發布個人或分組作業、批改與統計" action={<Button asChild className="tap"><Link href="/admin/assignments/new"><Plus className="size-5" /> 發布作業</Link></Button>} />
        <div className="space-y-2">
          {stats.map((s) => {
            const pending = data.assignmentSubmissions.filter((x) => x.assignmentId === s.assignment.id && x.versions.length > 0 && x.reviewStatus === "pending").length;
            return (
              <ListRow
                key={s.assignment.id}
                href={`/admin/assignments/${s.assignment.id}`}
                icon={s.assignment.type === "group" ? UsersRound : ClipboardList}
                title={s.assignment.title}
                subtitle={<span className="flex flex-wrap gap-x-2">{s.course?.unit}<span>・截止 {fmtDateTime(s.assignment.dueAt)}</span><span>・已繳 {s.submitted}/{s.expected} {s.unit}</span>{pending > 0 && <Pill tone="soon">待批改 {pending}</Pill>}</span>}
                right={<Pill tone={s.rate >= 90 ? "done" : s.rate >= 60 ? "soon" : "overdue"}>{s.rate}%</Pill>}
              />
            );
          })}
        </div>
      </StaffOnly>
    </AppShell>
  );
}
