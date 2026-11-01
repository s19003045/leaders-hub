"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  ClipboardList,
  FileStack,
  Home,
  LayoutDashboard,
  Library,
  MessageSquareText,
  Settings2,
  UserCircle2,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser, useData, useHydrated } from "@/lib/store";
import { isStaff, unreadCounts } from "@/lib/selectors";
import { applyScale, useScale, type FontScale } from "@/app/providers";
import { Spinner } from "@/components/ui/spinner";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export function AppShell({ children, title, wide }: { children: React.ReactNode; title?: string; wide?: boolean }) {
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const data = useData();
  const router = useRouter();
  const pathname = usePathname();
  const scale = useScale();

  useEffect(() => {
    if (hydrated && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, user, router, pathname]);

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        <Spinner className="mr-2" /> 載入中…
      </div>
    );
  }

  const counts = unreadCounts(data, user);
  const staff = isStaff(user);

  const studentNav: NavItem[] = [
    { href: "/", label: "首頁", icon: Home },
    { href: "/assignments", label: "作業", icon: ClipboardList },
    { href: "/materials", label: "教材", icon: Library },
    { href: "/articles", label: "分享", icon: MessageSquareText },
    { href: "/me", label: "我的", icon: UserCircle2, badge: counts.notifications },
  ];
  const staffNav: NavItem[] = [
    { href: "/admin", label: "後台", icon: LayoutDashboard },
    { href: "/admin/assignments", label: "作業", icon: ClipboardList },
    { href: "/admin/forms", label: "表單", icon: FileStack },
    { href: "/articles", label: "分享", icon: MessageSquareText },
    { href: "/me", label: "我的", icon: UserCircle2, badge: counts.notifications },
  ];
  const bottomNav = staff ? staffNav : studentNav;

  const sideNav: NavItem[] = staff
    ? [
        { href: "/admin", label: "後台總覽", icon: LayoutDashboard },
        { href: "/admin/courses", label: "課程", icon: BookOpen },
        { href: "/admin/forms", label: "線上表單", icon: FileStack },
        { href: "/admin/assignments", label: "作業管理", icon: ClipboardList },
        { href: "/admin/materials", label: "教材管理", icon: Library },
        { href: "/admin/groups", label: "小組管理", icon: UsersRound },
        { href: "/admin/users", label: "學員帳號", icon: Users },
        { href: "/admin/stats", label: "統計與匯出", icon: BarChart3 },
        { href: "/articles", label: "文章分享", icon: MessageSquareText },
        { href: "/me", label: "我的", icon: UserCircle2, badge: counts.notifications },
      ]
    : [
        { href: "/", label: "首頁", icon: Home },
        { href: "/courses", label: "我的課程", icon: BookOpen },
        { href: "/forms", label: "線上表單", icon: FileStack },
        { href: "/assignments", label: "作業", icon: ClipboardList },
        { href: "/group", label: "我的小組", icon: UsersRound },
        { href: "/materials", label: "教材中心", icon: Library },
        { href: "/articles", label: "文章分享", icon: MessageSquareText },
        { href: "/me", label: "我的", icon: UserCircle2, badge: counts.notifications },
      ];

  const isActive = (href: string) => (href === "/" || href === "/admin" ? pathname === href : pathname.startsWith(href));

  const cycleScale = () => {
    const next: FontScale = scale === "md" ? "lg" : scale === "lg" ? "xl" : "md";
    applyScale(next);
  };

  return (
    <div className="min-h-dvh md:flex">
      {/* 桌面側欄 */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar md:flex md:sticky md:top-0 md:h-dvh">
        <Link href={staff ? "/admin" : "/"} className="flex items-center gap-2 px-5 py-5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-lg font-bold text-white">領</span>
          <span className="font-bold leading-tight">職場領袖<br /><span className="text-sm font-medium text-muted-foreground">學習平台</span></span>
        </Link>
        <nav className="flex-1 space-y-1 px-3">
          {sideNav.map((item) => (
            <Link key={item.href} href={item.href} className={cn("flex min-h-11 items-center gap-3 rounded-lg px-3 font-medium", isActive(item.href) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted")}>
              <item.icon className="size-5" />
              <span className="flex-1">{item.label}</span>
              {!!item.badge && <span className="rounded-full bg-destructive px-2 text-xs font-bold text-white">{item.badge}</span>}
            </Link>
          ))}
        </nav>
        <div className="border-t px-5 py-4 text-sm text-muted-foreground">
          {user.name}・{user.title ?? "學員"}
        </div>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col">
        {/* 頂欄 */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/95 px-4 backdrop-blur">
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{title ?? (staff ? "管理後台" : "職場領袖學習平台")}</h1>
          <button type="button" onClick={cycleScale} className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="切換字級" title="切換字級">
            <span className="font-bold">A<span className="text-xs">{scale === "md" ? "" : scale === "lg" ? "+" : "++"}</span></span>
          </button>
          <Link href="/notifications" className="relative flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="通知">
            <Bell className="size-5" />
            {counts.notifications > 0 && <span className="absolute top-1.5 right-1.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[11px] font-bold leading-4 text-white">{counts.notifications}</span>}
          </Link>
          <Link href="/me" className="hidden items-center gap-2 rounded-lg px-2 py-1 text-sm md:flex">
            <Settings2 className="size-4 text-muted-foreground" />
          </Link>
        </header>

        <main className={cn("mx-auto w-full flex-1 px-4 pt-4 pb-24 md:pb-8", wide ? "max-w-6xl" : "max-w-3xl")}>{children}</main>

        {/* 手機底部導覽 */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur md:hidden safe-bottom">
          <ul className="grid grid-cols-5">
            {bottomNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={cn("relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs", isActive(item.href) ? "text-primary" : "text-muted-foreground")}>
                  <item.icon className={cn("size-6", isActive(item.href) && "stroke-[2.4]")} />
                  <span className="font-medium">{item.label}</span>
                  {!!item.badge && <span className="absolute top-1 right-1/2 translate-x-4 rounded-full bg-destructive px-1.5 text-[11px] font-bold text-white">{item.badge}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
