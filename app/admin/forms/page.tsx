"use client";

import Link from "next/link";
import { FileStack, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StaffOnly } from "@/components/staff-only";
import { Button } from "@/components/ui/button";
import { ListRow, PageHeader, Pill } from "@/components/ui-bits";
import { useData } from "@/lib/store";
import { formStats } from "@/lib/selectors";
import { fmtDateTime } from "@/lib/format";

export default function AdminFormsPage() {
  const data = useData();
  const stats = formStats(data).sort((a, b) => b.form.dueAt.localeCompare(a.form.dueAt));
  return (
    <AppShell title="線上表單" wide>
      <StaffOnly>
        <PageHeader title="線上表單" description="建立表單、查看回答並回覆學員" action={<Button asChild className="tap"><Link href="/admin/forms/new"><Plus className="size-5" /> 建立表單</Link></Button>} />
        <div className="space-y-2">
          {stats.map((s) => (
            <ListRow key={s.form.id} href={`/admin/forms/${s.form.id}`} icon={FileStack} title={s.form.title} subtitle={`${s.course?.unit}・開放 ${fmtDateTime(s.form.openAt)}・截止 ${fmtDateTime(s.form.dueAt)}`} right={<Pill tone={s.rate >= 90 ? "done" : s.rate >= 60 ? "soon" : "normal"}>{s.submitted}/{s.expected}</Pill>} />
          ))}
        </div>
      </StaffOnly>
    </AppShell>
  );
}
