"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { EmptyState, ListRow, PageHeader, Pill, materialIcon } from "@/components/ui-bits";
import { useData } from "@/lib/store";
import { courseById, visibleMaterials } from "@/lib/selectors";
import { fmtDate, materialTypeLabel } from "@/lib/format";
import type { MaterialType } from "@/lib/types";

export default function MaterialsPage() {
  const data = useData();
  const [courseId, setCourseId] = useState("all");
  const [type, setType] = useState<MaterialType | "all">("all");
  const list = visibleMaterials(data).filter((m) => (courseId === "all" || m.courseId === courseId) && (type === "all" || m.type === type));
  const courses = [...data.courses].sort((a, b) => b.date.localeCompare(a.date));
  const sel = "min-h-12 rounded-lg border border-input bg-card px-3 text-base";

  return (
    <AppShell title="教材中心">
      <PageHeader title="教材中心" description="簡報、錄音、補充文件與影片連結" />
      <div className="mb-4 grid grid-cols-2 gap-2">
        <select className={sel} value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="課程">
          <option value="all">全部課程</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.unit}・{c.title}</option>)}
        </select>
        <select className={sel} value={type} onChange={(e) => setType(e.target.value as MaterialType | "all")} aria-label="類型">
          <option value="all">全部類型</option>
          {(Object.keys(materialTypeLabel) as MaterialType[]).map((t) => <option key={t} value={t}>{materialTypeLabel[t]}</option>)}
        </select>
      </div>
      {list.length === 0 ? <EmptyState title="沒有符合的教材" /> : (
        <div className="space-y-2">
          {list.map((m) => (
            <ListRow key={m.id} href={`/materials/${m.id}`} icon={materialIcon[m.type]} title={m.title} subtitle={`${courseById(data, m.courseId)?.unit ?? ""}・${materialTypeLabel[m.type]}・${fmtDate(m.createdAt)}`} right={m.pinned ? <Pill tone="soon">課前閱讀</Pill> : undefined} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
