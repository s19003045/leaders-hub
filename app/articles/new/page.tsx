"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, PageHeader } from "@/components/ui-bits";
import { FilePicker } from "@/components/file-picker";
import { store, useData } from "@/lib/store";
import type { ArticleVisibility, FileRef } from "@/lib/types";

const CATEGORIES = ["見證分享", "資源推薦", "講師分享", "討論", "其他"];

export default function NewArticlePage() {
  const router = useRouter();
  const data = useData();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [tags, setTags] = useState("");
  const [link, setLink] = useState("");
  const [visibility, setVisibility] = useState<ArticleVisibility>("all");
  const [image, setImage] = useState<FileRef[]>([]);
  const [courseId, setCourseId] = useState(data.courses.find((c) => c.status === "active")?.id ?? data.courses[0]?.id ?? "");
  const sel = "min-h-12 w-full rounded-lg border border-input bg-background px-3 text-base";

  const save = async (asDraft: boolean) => {
    if (!title.trim() || !content.trim()) {
      toast.error("請填寫標題與內容");
      return;
    }
    try {
    const id = await store.createArticle({
      title: title.trim(),
      content: content.trim(),
      category,
      tags: tags.split(/[,，\s]+/).map((t) => t.trim()).filter(Boolean),
      visibility: asDraft ? "draft" : visibility,
      courseId: visibility === "course" ? courseId : undefined,
      classId: visibility === "class" ? data.classes[0]?.id : undefined,
      link: link.trim() || undefined,
      image: image[0],
    });
    toast.success(asDraft ? "已儲存草稿" : "文章已發布");
    router.push(`/articles/${id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <AppShell title="發布文章">
      <PageHeader back="/articles" title="發布文章" />
      <div className="space-y-4">
        <Field label="標題" required><Input className="min-h-12 text-base" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="內容" required><Textarea rows={8} className="text-base" value={content} onChange={(e) => setContent(e.target.value)} placeholder="分享你的見證、心得或資源…" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="分類"><select className={sel} value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="標籤" hint="以逗號或空白分隔"><Input className="min-h-12 text-base" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="誠信, 職場見證" /></Field>
        </div>
        <Field label="外部連結（選填）"><Input className="min-h-12 text-base" type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" /></Field>
        <Field label="圖片（選填）" hint="JPG / PNG / WebP，最大 10 MB"><FilePicker files={image} onChange={setImage} accept={["jpg", "jpeg", "png", "gif", "webp"]} maxSizeMB={10} multiple={false} purpose="article" label="選擇圖片" /></Field>
        <Field label="誰可以看到">
          <select className={sel} value={visibility} onChange={(e) => setVisibility(e.target.value as ArticleVisibility)}>
            <option value="all">全體會員</option>
            <option value="class">指定班級（{data.classes[0]?.name}）</option>
            <option value="course">指定課程</option>
          </select>
        </Field>
        {visibility === "course" && (
          <Field label="課程"><select className={sel} value={courseId} onChange={(e) => setCourseId(e.target.value)}>{data.courses.map((c) => <option key={c.id} value={c.id}>{c.unit}・{c.title}</option>)}</select></Field>
        )}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="lg" className="flex-1 tap" onClick={() => save(true)}>存成草稿</Button>
          <Button size="lg" className="flex-1 tap" onClick={() => save(false)}>發布</Button>
        </div>
      </div>
    </AppShell>
  );
}
