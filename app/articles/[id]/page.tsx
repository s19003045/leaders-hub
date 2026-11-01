"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, EmptyState, PageHeader, Pill } from "@/components/ui-bits";
import { store, useCurrentUser, useData } from "@/lib/store";
import { isStaff, userName } from "@/lib/selectors";
import { fmtDateTime } from "@/lib/format";

const visibilityLabel = { draft: "草稿（僅自己可見）", course: "指定課程可見", class: "指定班級可見", all: "全體會員可見" } as const;

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser();
  const data = useData();
  const router = useRouter();
  const a = data.articles.find((x) => x.id === id);
  const [comment, setComment] = useState("");
  if (!a || !user) return <AppShell title="文章"><EmptyState title="找不到文章" /></AppShell>;
  const canManage = a.authorId === user.id || isStaff(user);

  const send = async () => {
    if (!comment.trim()) return;
    try {
      await store.addComment(a.id, comment.trim());
      setComment("");
      toast.success("已留言");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async () => {
    if (!window.confirm("確定要刪除這篇文章嗎？")) return;
    try {
      await store.deleteArticle(a.id);
      router.push("/articles");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <AppShell title={a.title}>
      <PageHeader back="/articles" title={a.title} />
      <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Avatar name={userName(data, a.authorId)} size="sm" />
        <span>{userName(data, a.authorId)}</span><span>・{fmtDateTime(a.createdAt)}</span>
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Pill tone="primary">{a.category}</Pill>
        <Pill tone={a.visibility === "draft" ? "info" : "normal"}>{visibilityLabel[a.visibility]}</Pill>
        {a.tags.map((t) => <Pill key={t}>#{t}</Pill>)}
      </div>
      <article className="rounded-2xl border bg-card p-4">
        {a.imageUrl && <img src={a.imageUrl} alt="" className="mb-3 max-h-96 w-full rounded-xl object-cover" />}
        <p className="whitespace-pre-wrap leading-relaxed">{a.content}</p>
        {a.link && <a href={a.link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-primary underline break-all"><ExternalLink className="size-4" />{a.link}</a>}
      </article>
      {canManage && (
        <div className="mt-3 flex justify-end gap-2">
          {a.visibility === "draft" && <Button variant="outline" onClick={() => store.updateArticle(a.id, { visibility: "all" }).then(() => toast.success("已發布"), (e: Error) => toast.error(e.message))}>發布給全體會員</Button>}
          <Button variant="ghost" className="text-destructive" onClick={remove}><Trash2 className="size-4" /> 刪除</Button>
        </div>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-lg">留言（{a.comments.length}）</h2>
        <ul className="space-y-3">
          {a.comments.map((c) => (
            <li key={c.id} className="flex items-start gap-3">
              <Avatar name={userName(data, c.authorId)} size="sm" />
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-card px-4 py-2.5 border">
                <div className="text-sm text-muted-foreground">{userName(data, c.authorId)}・{fmtDateTime(c.createdAt)}</div>
                <p className="whitespace-pre-wrap">{c.content}</p>
              </div>
            </li>
          ))}
        </ul>
        {a.visibility !== "draft" && (
          <div className="mt-4 flex items-end gap-2">
            <Textarea rows={2} className="text-base" placeholder="寫下你的回應…" value={comment} onChange={(e) => setComment(e.target.value)} />
            <Button size="icon-lg" className="shrink-0" onClick={send} aria-label="送出留言"><Send className="size-5" /></Button>
          </div>
        )}
      </section>
    </AppShell>
  );
}
