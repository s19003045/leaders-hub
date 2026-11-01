"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StaffOnly } from "@/components/staff-only";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FilePicker } from "@/components/file-picker";
import { Field, PageHeader, Pill, Section, materialIcon } from "@/components/ui-bits";
import { store, useData } from "@/lib/store";
import { courseById, userName } from "@/lib/selectors";
import { fmtDateTime, materialTypeLabel } from "@/lib/format";
import type { FileRef, MaterialType } from "@/lib/types";

const FILE_ACCEPT: Record<MaterialType, string[] | undefined> = { pdf: ["pdf"], doc: ["doc", "docx"], ppt: ["ppt", "pptx"], image: ["jpg", "jpeg", "png"], audio: ["mp3", "m4a", "wav"], video: undefined, link: undefined };

export default function AdminMaterialsPage() {
  const data = useData();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState(data.courses.find((c) => c.status === "active")?.id ?? data.courses[0]?.id ?? "");
  const [type, setType] = useState<MaterialType>("pdf");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<FileRef[]>([]);
  const [pinned, setPinned] = useState(false);
  const sel = "min-h-12 w-full rounded-lg border border-input bg-background px-3 text-base";
  const isLink = type === "link" || type === "video";

  const save = async () => {
    if (!title.trim() || !courseId) return toast.error("請填寫教材名稱與課程");
    if (isLink && !url.trim()) return toast.error("請填寫連結");
    if (!isLink && files.length === 0) return toast.error("請選擇檔案");
    try {
      await store.addMaterial({ title: title.trim(), courseId, type, description: description.trim(), url: isLink ? url.trim() : undefined, file: isLink ? undefined : files[0], pinned });
      toast.success("教材已上傳並通知學員");
      setOpen(false); setTitle(""); setDescription(""); setUrl(""); setFiles([]); setPinned(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const list = [...data.materials].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <AppShell title="教材管理" wide>
      <StaffOnly>
        <PageHeader title="教材管理" description="上傳簡報、文件、音訊或影片連結" action={<Button className="tap" onClick={() => setOpen((o) => !o)}><Plus className="size-5" /> 上傳教材</Button>} />
        {open && (
          <Section title="新增教材">
            <div className="grid gap-4 rounded-2xl border bg-card p-4 md:grid-cols-2">
              <Field label="教材名稱" required><Input className="min-h-12 text-base" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
              <Field label="課程" required><select className={sel} value={courseId} onChange={(e) => setCourseId(e.target.value)}>{data.courses.map((c) => <option key={c.id} value={c.id}>{c.unit}・{c.title}</option>)}</select></Field>
              <Field label="類型"><select className={sel} value={type} onChange={(e) => { setType(e.target.value as MaterialType); setFiles([]); }}>{(Object.keys(materialTypeLabel) as MaterialType[]).map((t) => <option key={t} value={t}>{materialTypeLabel[t]}</option>)}</select></Field>
              {isLink ? <Field label="連結" required><Input className="min-h-12 text-base" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></Field> : <Field label="檔案" required><FilePicker files={files} onChange={setFiles} accept={FILE_ACCEPT[type]} maxSizeMB={200} multiple={false} /></Field>}
              <div className="md:col-span-2"><Field label="說明"><Textarea rows={2} className="text-base" value={description} onChange={(e) => setDescription(e.target.value)} /></Field></div>
              <label className="flex min-h-12 items-center gap-3 rounded-lg border px-3 md:col-span-2"><input type="checkbox" className="size-5 accent-primary" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> 標示為「課前閱讀」，在學員首頁置頂提醒</label>
              <div className="flex gap-2 md:col-span-2"><Button variant="outline" size="lg" className="flex-1 tap" onClick={() => setOpen(false)}>取消</Button><Button size="lg" className="flex-1 tap" onClick={save}>上傳並通知</Button></div>
            </div>
          </Section>
        )}
        <ul className="divide-y rounded-2xl border bg-card">
          {list.map((m) => {
            const Icon = materialIcon[m.type];
            return (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Icon className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{m.title}</span>
                  <span className="block text-sm text-muted-foreground">{courseById(data, m.courseId)?.unit}・{materialTypeLabel[m.type]}・{userName(data, m.uploadedBy)}・{fmtDateTime(m.createdAt)}</span>
                </span>
                {m.pinned && <Pill tone="soon">課前閱讀</Pill>}
                <Button variant="ghost" size="icon" className="text-destructive" aria-label="刪除" onClick={() => { if (window.confirm(`刪除「${m.title}」？`)) store.removeMaterial(m.id).catch((e: Error) => toast.error(e.message)); }}><Trash2 className="size-5" /></Button>
              </li>
            );
          })}
        </ul>
      </StaffOnly>
    </AppShell>
  );
}
