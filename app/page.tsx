"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BookOpen, ClipboardList, FileStack, Library, MessageSquareText, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DueTag, EmptyState, ListRow, Pill, Section } from "@/components/ui-bits";
import { useCurrentUser, useData } from "@/lib/store";
import { assignmentViewsForUser, courseById, formViewsForUser, groupOfUser, isStaff, pendingForms, userName, visibleArticles, visibleMaterials } from "@/lib/selectors";
import { fmtDate, fmtFullDate, materialTypeLabel } from "@/lib/format";
import { materialIcon } from "@/components/ui-bits";

export default function HomePage() {
  const user = useCurrentUser();
  const router = useRouter();
  useEffect(() => {
    if (user && isStaff(user)) router.replace("/admin");
  }, [user, router]);
  return (
    <AppShell>
      {user && !isStaff(user) && <StudentHome userId={user.id} />}
    </AppShell>
  );
}

function StudentHome({ userId }: { userId: string }) {
  const data = useData();
  const user = data.users.find((u) => u.id === userId)!;
  const forms = formViewsForUser(data, userId);
  const todoForms = pendingForms(forms);
  const unreadFeedback = forms.filter((v) => v.unreadFeedback.length > 0);
  const assignments = assignmentViewsForUser(data, userId);
  const todoAssignments = assignments.filter((v) => v.needsAction).sort((a, b) => a.assignment.dueAt.localeCompare(b.assignment.dueAt));
  const unreadReviews = assignments.filter((v) => v.unreadReview);
  const group = groupOfUser(data, userId);
  const nextCourse = [...data.courses].filter((c) => c.status !== "done").sort((a, b) => a.date.localeCompare(b.date))[0];
  const materials = visibleMaterials(data).slice(0, 3);
  const articles = visibleArticles(data, user).filter((a) => a.visibility !== "draft").slice(0, 3);
  const todoCount = todoForms.length + todoAssignments.length;

  return (
    <>
      <div className="mb-5">
        <p className="text-muted-foreground">{fmtFullDate(new Date().toISOString())}</p>
        <h1>{user.name}，平安</h1>
        <p className="mt-1 text-muted-foreground">{todoCount > 0 ? `你有 ${todoCount} 件待辦事項。` : "目前沒有待辦事項，感謝你的參與！"}</p>
      </div>

      {nextCourse && (
        <Link href={`/courses/${nextCourse.id}`} className="mb-6 block rounded-2xl bg-primary p-4 text-white shadow-sm active:opacity-90">
          <div className="flex items-center gap-2 text-sm opacity-90"><BookOpen className="size-4" /> 下一次聚集</div>
          <div className="mt-1 text-xl font-bold">{nextCourse.unit}・{nextCourse.title}</div>
          <div className="mt-1 text-sm opacity-90">{fmtFullDate(nextCourse.date)}・{nextCourse.location}</div>
        </Link>
      )}

      <Section title="待辦事項" action={<Link href="/assignments" className="text-sm text-primary">全部作業</Link>}>
        {todoCount === 0 ? (
          <EmptyState title="沒有待辦事項" hint="新的表單或作業發布後會顯示在這裡" />
        ) : (
          <div className="space-y-2">
            {todoForms.map((v) => (
              <ListRow key={v.form.id} href={`/forms/${v.form.id}`} icon={FileStack} title={v.form.title} subtitle={v.submission?.status === "draft" ? "已儲存草稿，尚未送出" : v.course?.unit} right={<DueTag dueAt={v.form.dueAt} />} highlight={v.isOverdue} />
            ))}
            {todoAssignments.map((v) => (
              <ListRow
                key={v.assignment.id}
                href={`/assignments/${v.assignment.id}`}
                icon={v.assignment.type === "group" ? UsersRound : ClipboardList}
                title={v.assignment.title}
                subtitle={v.submission?.reviewStatus === "needs_revision" ? "老師要求重新提交" : v.submission?.submitStatus === "draft" ? "已儲存草稿" : v.assignment.type === "group" ? `${v.group?.name ?? "小組"}作業` : "個人作業"}
                right={<DueTag dueAt={v.assignment.dueAt} />}
                highlight={v.isOverdue}
              />
            ))}
          </div>
        )}
      </Section>

      {(unreadFeedback.length > 0 || unreadReviews.length > 0) && (
        <Section title="老師回覆">
          <div className="space-y-2">
            {unreadFeedback.map((v) => (
              <ListRow key={v.form.id} href={`/forms/${v.form.id}`} icon={MessageSquareText} title={`${userName(data, v.unreadFeedback[0].authorId)} 回覆了「${v.form.title}」`} subtitle={v.unreadFeedback[0].content} right={<Pill tone="overdue">未讀</Pill>} />
            ))}
            {unreadReviews.map((v) => (
              <ListRow key={v.assignment.id} href={`/assignments/${v.assignment.id}`} icon={ClipboardList} title={`「${v.assignment.title}」已批改`} subtitle={v.submission?.review?.comment} right={<Pill tone="overdue">未讀</Pill>} />
            ))}
          </div>
        </Section>
      )}

      {group && (
        <Section title="我的小組" action={<Link href="/group" className="text-sm text-primary">查看</Link>}>
          <ListRow href="/group" icon={UsersRound} title={group.name} subtitle={group.memberIds.map((id) => userName(data, id)).join("、")} />
        </Section>
      )}

      <Section title="最新教材" action={<Link href="/materials" className="text-sm text-primary">教材中心</Link>}>
        <div className="space-y-2">
          {materials.map((m) => (
            <ListRow key={m.id} href={`/materials/${m.id}`} icon={materialIcon[m.type]} title={m.title} subtitle={`${courseById(data, m.courseId)?.unit ?? ""}・${materialTypeLabel[m.type]}・${fmtDate(m.createdAt)}`} right={m.pinned ? <Pill tone="soon">課前閱讀</Pill> : undefined} />
          ))}
        </div>
      </Section>

      <Section title="最近分享" action={<Link href="/articles" className="text-sm text-primary">更多</Link>}>
        <div className="space-y-2">
          {articles.map((a) => (
            <ListRow key={a.id} href={`/articles/${a.id}`} icon={Library} title={a.title} subtitle={`${userName(data, a.authorId)}・${a.category}・${fmtDate(a.createdAt)}`} right={a.comments.length > 0 ? <span className="text-sm text-muted-foreground">{a.comments.length} 則留言</span> : undefined} />
          ))}
        </div>
      </Section>
    </>
  );
}
