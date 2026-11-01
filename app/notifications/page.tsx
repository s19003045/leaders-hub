"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { EmptyState, PageHeader } from "@/components/ui-bits";
import { store, useCurrentUser, useData } from "@/lib/store";
import { fmtDateTime } from "@/lib/format";

export default function NotificationsPage() {
  const user = useCurrentUser();
  const data = useData();
  const list = user ? data.notifications.filter((n) => n.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  const unreadIds = list.filter((n) => !n.read).map((n) => n.id);

  useEffect(() => {
    const t = setTimeout(() => void store.markNotificationsRead(unreadIds), 1500);
    return () => clearTimeout(t);
  }, [unreadIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppShell title="通知">
      <PageHeader title="通知" description="新教材、老師回覆、作業批改與小組動態" />
      {list.length === 0 ? <EmptyState title="目前沒有通知" /> : (
        <ul className="space-y-2">
          {list.map((n) => (
            <li key={n.id}>
              <Link href={n.href} className={`block rounded-xl border px-4 py-3 ${n.read ? "bg-card" : "border-primary/40 bg-primary-soft/40"}`}>
                <div className="flex items-center gap-2">
                  {!n.read && <span className="size-2 rounded-full bg-primary" />}
                  <span className="font-medium">{n.title}</span>
                </div>
                <div className="text-sm text-muted-foreground">{n.body}</div>
                <div className="mt-1 text-xs text-muted-foreground">{fmtDateTime(n.createdAt)}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 rounded-xl bg-muted p-3 text-sm text-muted-foreground">新教材、新表單與作業會推播到 LINE 群組；老師回覆、批改與截止提醒會傳給已綁定 LINE 的成員（到「我的 → LINE 通知」綁定）。</p>
    </AppShell>
  );
}
