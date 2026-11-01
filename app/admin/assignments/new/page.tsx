"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StaffOnly } from "@/components/staff-only";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FilePicker } from "@/components/file-picker";
import { Field, PageHeader, Section } from "@/components/ui-bits";
import { store, useData } from "@/lib/store";
import { fromInputDateTime, toInputDateTime } from "@/lib/format";
import type { AssignmentType, FileRef, GradingMode } from "@/lib/types";

const FORMATS = ["pdf", "docx", "pptx", "jpg", "png", "mp3", "mp4"];

export default function NewAssignmentPage() {
  const router = useRouter();
  const data = useData();
  const active = data.courses.find((c) => c.status === "active") ?? data.courses[0];
  const [type, setType] = useState<AssignmentType>("individual");
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState(active?.id ?? "");
  const [description, setDescription] = useState("");
  const [openAt, setOpenAt] = useState(() => toInputDateTime(new Date().toISOString()));
  const [dueAt, setDueAt] = useState(() => toInputDateTime(new Date(Date.now() + 14 * 86_400_000).toISOString()));
  const [formats, setFormats] = useState<string[]>(["pdf", "docx", "jpg", "png"]);
  const [maxSizeMB, setMaxSizeMB] = useState(10);
  const [allowLate, setAllowLate] = useState(true);
  const [allowResubmit, setAllowResubmit] = useState(true);
  const [gradingMode, setGradingMode] = useState<GradingMode>("both");
  const [attachments, setAttachments] = useState<FileRef[]>([]);
  const [targetGroupIds, setTargetGroupIds] = useState<string[]>([]);
  const sel = "min-h-12 w-full rounded-lg border border-input bg-background px-3 text-base";

  const save = async () => {
    if (!title.trim() || !courseId || !description.trim()) return toast.error("請填寫作業名稱、課程與內容");
    if (formats.length === 0) return toast.error("請至少選擇一種上傳格式");
    try {
    const id = await store.createAssignment({ type, title: title.trim(), courseId, description: description.trim(), openAt: fromInputDateTime(openAt), dueAt: fromInputDateTime(dueAt), formats, maxSizeMB, allowLate, allowResubmit, gradingMode, attachments, targetGroupIds: type === "group" ? targetGroupIds : undefined });
    toast.success("作業已發布並通知學員");
    router.push(`/admin/assignments/${id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <AppShell title="發布作業" wide>
      <StaffOnly>
        <PageHeader back="/admin/assignments" title="發布作業" />
        <Section title="作業類型">
          <div className="grid grid-cols-2 gap-2">
            {(["individual", "group"] as AssignmentType[]).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)} className={`min-h-16 rounded-xl border p-3 text-left ${type === t ? "border-primary bg-primary-soft" : "bg-card"}`}>
                <div className="font-bold">{t === "individual" ? "個人作業" : "分組作業"}</div>
                <div className="text-sm text-muted-foreground">{t === "individual" ? "每位學員獨立繳交" : "一位組員代表小組提交"}</div>
              </button>
            ))}
          </div>
          {type === "group" && (
            <div className="mt-3 rounded-xl border bg-card p-3">
              <div className="mb-2 text-sm font-medium">指派小組（不選代表全部）</div>
              <div className="flex flex-wrap gap-2">
                {data.groups.map((g) => {
                  const on = targetGroupIds.includes(g.id);
                  return <button key={g.id} type="button" onClick={() => setTargetGroupIds((s) => (on ? s.filter((x) => x !== g.id) : [...s, g.id]))} className={`min-h-11 rounded-full border px-4 ${on ? "border-primary bg-primary text-white" : ""}`}>{g.name}</button>;
                })}
              </div>
            </div>
          )}
        </Section>
        <Section title="作業內容">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="作業名稱" required><Input className="min-h-12 text-base" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：第六課 個人作業：一次自然的信仰對話" /></Field>
            <Field label="所屬課程" required><select className={sel} value={courseId} onChange={(e) => setCourseId(e.target.value)}>{data.courses.map((c) => <option key={c.id} value={c.id}>{c.unit}・{c.title}</option>)}</select></Field>
            <div className="md:col-span-2"><Field label="題目與作業要求" required><Textarea rows={5} className="text-base" value={description} onChange={(e) => setDescription(e.target.value)} /></Field></div>
            <div className="md:col-span-2"><Field label="附加說明文件或範例"><FilePicker files={attachments} onChange={setAttachments} maxSizeMB={20} purpose="material" /></Field></div>
          </div>
        </Section>
        <Section title="繳交設定">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="開放時間"><input type="datetime-local" className={sel} value={openAt} onChange={(e) => setOpenAt(e.target.value)} /></Field>
            <Field label="截止時間"><input type="datetime-local" className={sel} value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></Field>
            <div className="md:col-span-2">
              <div className="mb-1.5 font-medium">上傳格式</div>
              <div className="flex flex-wrap gap-2">
                {FORMATS.map((f) => { const on = formats.includes(f); return <button key={f} type="button" onClick={() => setFormats((s) => (on ? s.filter((x) => x !== f) : [...s, f]))} className={`min-h-11 rounded-full border px-4 uppercase ${on ? "border-primary bg-primary text-white" : ""}`}>{f}</button>; })}
              </div>
            </div>
            <Field label="檔案大小限制（MB）"><Input className="min-h-12 text-base" type="number" inputMode="numeric" min={1} max={100} value={maxSizeMB} onChange={(e) => setMaxSizeMB(Number(e.target.value) || 10)} /></Field>
            <Field label="批改方式">
              <select className={sel} value={gradingMode} onChange={(e) => setGradingMode(e.target.value as GradingMode)}>
                <option value="score">評分</option><option value="comment">文字回覆</option><option value="both">評分＋文字回覆</option>
              </select>
            </Field>
            <label className="flex min-h-12 items-center gap-3 rounded-lg border px-3"><input type="checkbox" className="size-5 accent-primary" checked={allowLate} onChange={(e) => setAllowLate(e.target.checked)} /> 允許補交（逾期提交）</label>
            <label className="flex min-h-12 items-center gap-3 rounded-lg border px-3"><input type="checkbox" className="size-5 accent-primary" checked={allowResubmit} onChange={(e) => setAllowResubmit(e.target.checked)} /> 允許重新提交</label>
          </div>
        </Section>
        <div className="sticky bottom-20 z-20 flex gap-2 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur md:bottom-4">
          <Button variant="outline" size="lg" className="flex-1 tap" onClick={() => router.push("/admin/assignments")}>取消</Button>
          <Button size="lg" className="flex-1 tap" onClick={save}>發布作業</Button>
        </div>
      </StaffOnly>
    </AppShell>
  );
}
