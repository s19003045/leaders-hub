"use client";

import Link from "next/link";
import { useState } from "react";
import { BarChart3, BookOpen, ClipboardList, FileStack, Library, Users, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StaffOnly } from "@/components/staff-only";
import { EmptyState, ListRow, PageHeader, Pill, Section, StatTile } from "@/components/ui-bits";
import { useCurrentUser, useData } from "@/lib/store";
import { assignmentStats, formStats, students, userName } from "@/lib/selectors";
import { fmtDateTime, fmtFullDate, roleLabel } from "@/lib/format";

export default function AdminHomePage() {
  const user = useCurrentUser();
  const data = useData();
  const aStats = assignmentStats(data);
  const fStats = formStats(data);
  const pendingReviews = data.assignmentSubmissions.filter((s) => s.versions.length > 0 && (s.reviewStatus === "pending" || s.reviewStatus === "reviewing"));
  const [now] = useState(() => Date.now());
  const openForms = fStats.filter((s) => new Date(s.form.openAt).getTime() <= now && new Date(s.form.dueAt).getTime() >= now - 14 * 86_400_000);
  const nextCourse = [...data.courses].filter((c) => c.status !== "done").sort((a, b) => a.date.localeCompare(b.date))[0];
  const recentLogs = data.auditLogs.slice(0, 6);
  const latestSubmissions = [...data.assignmentSubmissions].filter((s) => s.versions.length > 0).sort((a, b) => b.versions[b.versions.length - 1].submittedAt.localeCompare(a.versions[a.versions.length - 1].submittedAt)).slice(0, 5);

  return (
    <AppShell title="管理後台" wide>
      <StaffOnly>
        <PageHeader title={`${user?.name}，平安`} description={`${user ? roleLabel[user.role] : ""}後台・${data.classes[0]?.name}`} />

        <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatTile label="學員人數" value={students(data).length} hint={`${data.groups.length} 個小組`} />
          <StatTile label="待批改作業" value={pendingReviews.length} tone={pendingReviews.length ? "warning" : "success"} hint="含逾期補交" />
          <StatTile label="表單填寫率" value={`${openForms.length ? Math.round(openForms.reduce((n, s) => n + s.rate, 0) / openForms.length) : 0}%`} hint="近期開放表單平均" />
          <StatTile label="作業完成率" value={`${aStats.length ? Math.round(aStats.filter((s) => new Date(s.assignment.openAt).getTime() <= now).reduce((n, s, _, arr) => n + s.rate / arr.length, 0)) : 0}%`} hint="已開放作業平均" />
        </div>

        {nextCourse && (
          <Link href="/admin/courses" className="mb-6 block rounded-2xl bg-primary p-4 text-white">
            <div className="flex items-center gap-2 text-sm opacity-90"><BookOpen className="size-4" /> 下一次聚集</div>
            <div className="mt-1 text-xl font-bold">{nextCourse.unit}・{nextCourse.title}</div>
            <div className="mt-1 text-sm opacity-90">{fmtFullDate(nextCourse.date)}・{nextCourse.location}</div>
          </Link>
        )}

        <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-3">
          {[
            { href: "/admin/forms", label: "線上表單", icon: FileStack },
            { href: "/admin/assignments", label: "作業管理", icon: ClipboardList },
            { href: "/admin/materials", label: "教材管理", icon: Library },
            { href: "/admin/groups", label: "小組管理", icon: UsersRound },
            { href: "/admin/users", label: "學員帳號", icon: Users },
            { href: "/admin/stats", label: "統計與匯出", icon: BarChart3 },
          ].map((x) => (
            <Link key={x.href} href={x.href} className="flex min-h-20 items-center gap-3 rounded-xl border bg-card px-4 font-medium active:bg-accent">
              <x.icon className="size-6 text-primary" /> {x.label}
            </Link>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Section title="待處理">
            <div className="space-y-2">
              {aStats.filter((s) => new Date(s.assignment.openAt).getTime() <= now).map((s) => (
                <ListRow key={s.assignment.id} href={`/admin/assignments/${s.assignment.id}`} icon={s.assignment.type === "group" ? UsersRound : ClipboardList} title={s.assignment.title} subtitle={`已繳 ${s.submitted}/${s.expected} ${s.unit}・待批改 ${data.assignmentSubmissions.filter((x) => x.assignmentId === s.assignment.id && x.versions.length > 0 && x.reviewStatus === "pending").length}`} right={<Pill tone={s.rate >= 90 ? "done" : s.rate >= 60 ? "soon" : "overdue"}>{s.rate}%</Pill>} />
              ))}
              {openForms.map((s) => (
                <ListRow key={s.form.id} href={`/admin/forms/${s.form.id}`} icon={FileStack} title={s.form.title} subtitle={`已填 ${s.submitted}/${s.expected} 人・截止 ${fmtDateTime(s.form.dueAt)}`} right={<Pill tone={s.rate >= 90 ? "done" : s.rate >= 60 ? "soon" : "overdue"}>{s.rate}%</Pill>} />
              ))}
            </div>
          </Section>
          <div>
            <Section title="最新提交">
              {latestSubmissions.length === 0 ? <EmptyState title="尚無提交" /> : (
                <ul className="divide-y rounded-2xl border bg-card text-sm">
                  {latestSubmissions.map((s) => {
                    const v = s.versions[s.versions.length - 1];
                    const a = data.assignments.find((x) => x.id === s.assignmentId);
                    return (
                      <li key={s.id} className="px-4 py-2.5">
                        <Link href={`/admin/assignments/${s.assignmentId}?sub=${s.id}`} className="block">
                          <div className="font-medium">{s.ownerType === "group" ? data.groups.find((g) => g.id === s.ownerId)?.name : userName(data, s.ownerId)}{s.ownerType === "group" && <span className="text-muted-foreground">（{userName(data, v.submittedById)} 提交）</span>}</div>
                          <div className="text-muted-foreground">{a?.title}・{fmtDateTime(v.submittedAt)}</div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
            <Section title="操作紀錄">
              <ul className="space-y-1 text-sm text-muted-foreground">
                {recentLogs.map((l) => <li key={l.id}>{fmtDateTime(l.at)}・{userName(data, l.actorId)} {l.action}「{l.target}」</li>)}
              </ul>
            </Section>
          </div>
        </div>
      </StaffOnly>
    </AppShell>
  );
}
