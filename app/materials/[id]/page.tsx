"use client";

import { useParams } from "next/navigation";
import { Download, ExternalLink, Eye } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Pill, materialIcon } from "@/components/ui-bits";
import { useData } from "@/lib/store";
import { courseById, userName } from "@/lib/selectors";
import { fileSize, fmtDateTime, materialTypeLabel } from "@/lib/format";

export default function MaterialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const data = useData();
  const m = data.materials.find((x) => x.id === id);
  if (!m) return <AppShell title="教材"><EmptyState title="找不到教材" /></AppShell>;
  const Icon = materialIcon[m.type];
  const course = courseById(data, m.courseId);
  const mock = () => toast.info("第一階段為示範資料，正式版會開啟 R2 的限時下載連結。");

  return (
    <AppShell title={m.title}>
      <PageHeader back="/materials" title={m.title} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pill tone="primary">{materialTypeLabel[m.type]}</Pill>
        {course && <Pill tone="info">{course.unit}</Pill>}
        {m.pinned && <Pill tone="soon">課前閱讀</Pill>}
      </div>
      <div className="rounded-2xl border bg-card p-5">
        <div className="mb-4 flex items-center justify-center rounded-xl bg-primary-soft py-10 text-primary">
          <Icon className="size-16" />
        </div>
        {m.description && <p className="mb-4 whitespace-pre-wrap">{m.description}</p>}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">課程</dt><dd>{course?.unit}・{course?.title}</dd>
          <dt className="text-muted-foreground">上傳者</dt><dd>{userName(data, m.uploadedBy)}</dd>
          <dt className="text-muted-foreground">上傳時間</dt><dd>{fmtDateTime(m.createdAt)}</dd>
          {m.file && <><dt className="text-muted-foreground">檔案</dt><dd className="break-all">{m.file.name}（{fileSize(m.file.size)}）</dd></>}
        </dl>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {m.url ? (
            <Button asChild size="lg" className="flex-1 tap"><a href={m.url} target="_blank" rel="noreferrer"><ExternalLink className="size-5" /> 開啟連結</a></Button>
          ) : (
            <>
              <Button size="lg" className="flex-1 tap" onClick={mock}><Eye className="size-5" /> 線上預覽</Button>
              <Button size="lg" variant="outline" className="flex-1 tap" onClick={mock}><Download className="size-5" /> 下載</Button>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
