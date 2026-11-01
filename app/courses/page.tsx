"use client";

import { BookOpen } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ListRow, PageHeader, Pill } from "@/components/ui-bits";
import { useData } from "@/lib/store";
import { fmtFullDate } from "@/lib/format";

const statusLabel = { upcoming: "即將開始", active: "進行中", done: "已完成" } as const;

export default function CoursesPage() {
  const data = useData();
  const list = [...data.courses].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <AppShell title="我的課程">
      <PageHeader title="我的課程" description={data.classes[0]?.name} />
      <div className="space-y-2">
        {list.map((c) => (
          <ListRow key={c.id} href={`/courses/${c.id}`} icon={BookOpen} title={`${c.unit}・${c.title}`} subtitle={fmtFullDate(c.date)} right={<Pill tone={c.status === "active" ? "primary" : c.status === "done" ? "done" : "normal"}>{statusLabel[c.status]}</Pill>} />
        ))}
      </div>
    </AppShell>
  );
}
