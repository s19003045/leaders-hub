"use client";

import Link from "next/link";
import { useState } from "react";
import { PenLine, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Avatar, EmptyState, PageHeader, Pill } from "@/components/ui-bits";
import { useCurrentUser, useData } from "@/lib/store";
import { userName, visibleArticles } from "@/lib/selectors";
import { fmtDate } from "@/lib/format";

export default function ArticlesPage() {
  const user = useCurrentUser();
  const data = useData();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const all = user ? visibleArticles(data, user) : [];
  const categories = Array.from(new Set(all.map((a) => a.category)));
  const list = all.filter((a) => (cat === "all" || a.category === cat) && (!q.trim() || `${a.title} ${a.content} ${a.tags.join(" ")}`.includes(q.trim())));

  return (
    <AppShell title="文章分享">
      <PageHeader title="文章分享" description="見證、資源與討論" action={<Button asChild size="lg" className="tap"><Link href="/articles/new"><PenLine className="size-5" /> 發布</Link></Button>} />
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
        <input className="min-h-12 w-full rounded-lg border border-input bg-card pr-3 pl-10 text-base" placeholder="搜尋標題、內容或標籤" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto scrollbar-none">
        {["all", ...categories].map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium ${cat === c ? "border-primary bg-primary text-white" : "bg-card"}`}>{c === "all" ? "全部" : c}</button>
        ))}
      </div>
      {list.length === 0 ? <EmptyState title="沒有符合的文章" /> : (
        <ul className="space-y-3">
          {list.map((a) => (
            <li key={a.id}>
              <Link href={`/articles/${a.id}`} className="block rounded-2xl border bg-card p-4 active:bg-accent">
                <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Avatar name={userName(data, a.authorId)} size="sm" />
                  <span>{userName(data, a.authorId)}</span>
                  <span>・{fmtDate(a.createdAt)}</span>
                  {a.visibility === "draft" && <Pill tone="info">草稿</Pill>}
                </div>
                <h2 className="text-lg leading-snug">{a.title}</h2>
                <p className="mt-1 line-clamp-2 text-muted-foreground">{a.content}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
                  <Pill tone="primary">{a.category}</Pill>
                  {a.tags.map((t) => <span key={t} className="text-muted-foreground">#{t}</span>)}
                  <span className="ml-auto text-muted-foreground">{a.comments.length} 則留言</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
