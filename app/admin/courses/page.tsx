"use client";

import { BookOpen } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StaffOnly } from "@/components/staff-only";
import { Button } from "@/components/ui/button";
import { ListRow, PageHeader, Pill } from "@/components/ui-bits";
import { useData } from "@/lib/store";
import { fmtFullDate } from "@/lib/format";

const statusLabel = { upcoming: "即將開始", active: "進行中", done: "已完成" } as const;

export default function AdminCoursesPage() {
  const data = useData();
  const list = [...data.courses].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <AppShell title="課程" wide>
      <StaffOnly>
        <PageHeader title="課程" description={data.classes[0]?.name} action={<Button onClick={() => toast.info("第一階段示範：新增課程將於第三階段開放")}>新增課程</Button>} />
        <div className="space-y-2">
          {list.map((c) => (
            <ListRow key={c.id} href={`/courses/${c.id}`} icon={BookOpen} title={`${c.unit}・${c.title}`} subtitle={`${fmtFullDate(c.date)}・教材 ${data.materials.filter((m) => m.courseId === c.id).length}・表單 ${data.forms.filter((f) => f.courseId === c.id).length}・作業 ${data.assignments.filter((a) => a.courseId === c.id).length}`} right={<Pill tone={c.status === "active" ? "primary" : c.status === "done" ? "done" : "normal"}>{statusLabel[c.status]}</Pill>} />
          ))}
        </div>
      </StaffOnly>
    </AppShell>
  );
}
