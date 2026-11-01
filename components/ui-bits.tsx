"use client";

import Link from "next/link";
import { ChevronRight, FileText, Image as ImageIcon, Link2, Music, Presentation, Video, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { dueInfo, fileHref, fileSize, type DueTone } from "@/lib/format";
import type { FileRef, MaterialType, ReviewStatus, SubmitStatus } from "@/lib/types";
import { reviewStatusLabel, submitStatusLabel } from "@/lib/format";

export function PageHeader({ title, description, action, back }: { title: string; description?: string; action?: React.ReactNode; back?: string }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link href={back} className="mb-1 inline-flex items-center gap-1 text-base text-primary">
            <ChevronRight className="size-4 rotate-180" /> 返回
          </Link>
        )}
        <h1 className="break-words">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Section({ title, children, action, className }: { title?: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("mb-6", className)}>
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between">
          {title && <h2 className="text-lg">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const toneClass: Record<DueTone, string> = {
  overdue: "bg-destructive-soft text-destructive",
  soon: "bg-warning-soft text-warning",
  normal: "bg-muted text-muted-foreground",
  done: "bg-success-soft text-success",
};

export function Pill({ tone = "normal", children, className }: { tone?: DueTone | "info" | "primary"; children: React.ReactNode; className?: string }) {
  const cls = tone === "info" ? "bg-info-soft text-info" : tone === "primary" ? "bg-primary-soft text-primary" : toneClass[tone];
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium whitespace-nowrap", cls, className)}>{children}</span>;
}

export function DueTag({ dueAt, done }: { dueAt: string; done?: boolean }) {
  if (done) return <Pill tone="done">已完成</Pill>;
  const info = dueInfo(dueAt);
  return <Pill tone={info.tone}>{info.label}</Pill>;
}

const submitTone: Record<SubmitStatus, DueTone | "info"> = {
  not_submitted: "normal",
  draft: "info",
  submitted: "done",
  late: "soon",
  resubmitted: "done",
};

export function SubmitStatusPill({ status }: { status: SubmitStatus }) {
  return <Pill tone={submitTone[status]}>{submitStatusLabel[status]}</Pill>;
}

const reviewTone: Record<ReviewStatus, DueTone | "info"> = { pending: "normal", reviewing: "info", reviewed: "done", needs_revision: "overdue" };

export function ReviewStatusPill({ status }: { status: ReviewStatus }) {
  return <Pill tone={reviewTone[status]}>{reviewStatusLabel[status]}</Pill>;
}

export function ListRow({ href, title, subtitle, right, icon: Icon, onClick, highlight }: { href?: string; title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode; icon?: LucideIcon; onClick?: () => void; highlight?: boolean }) {
  const inner = (
    <>
      {Icon && (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon className="size-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-medium leading-snug break-words">{title}</span>
        {subtitle && <span className="mt-0.5 block text-sm text-muted-foreground break-words">{subtitle}</span>}
        {right && <span className="mt-1.5 block sm:hidden">{right}</span>}
      </span>
      {right && <span className="hidden shrink-0 self-center sm:block">{right}</span>}
      {(href || onClick) && <ChevronRight className="size-5 shrink-0 self-center text-muted-foreground" />}
    </>
  );
  const cls = cn(
    "flex w-full items-start gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors min-h-16",
    (href || onClick) && "active:bg-accent hover:bg-accent/60",
    highlight && "border-primary/50 ring-1 ring-primary/20",
  );
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-card/50 px-4 py-8 text-center text-muted-foreground">
      <p className="font-medium text-foreground">{title}</p>
      {hint && <p className="mt-1 text-sm">{hint}</p>}
    </div>
  );
}

export function StatTile({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "primary" | "warning" | "success" | "destructive" }) {
  const toneCls = tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-bold leading-tight", toneCls)}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

const palette = ["#1f5f6b", "#d98b2b", "#2e7d4f", "#3a5fa8", "#b3362b", "#6b4c9a", "#0f766e"];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const idx = [...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % palette.length;
  const dim = size === "sm" ? "size-8 text-sm" : size === "lg" ? "size-14 text-xl" : "size-10 text-base";
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", dim)} style={{ background: palette[idx] }} aria-hidden>
      {name.slice(0, 1)}
    </span>
  );
}

export const materialIcon: Record<MaterialType, LucideIcon> = { pdf: FileText, doc: FileText, ppt: Presentation, image: ImageIcon, audio: Music, video: Video, link: Link2 };

export function FileChip({ file, onRemove }: { file: FileRef; onRemove?: () => void }) {
  const href = fileHref(file.id);
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-lg border bg-muted/60 px-3 py-1.5 text-sm">
      <FileText className="size-4 shrink-0 text-primary" />
      {href ? <a href={href} target="_blank" rel="noreferrer" className="truncate text-primary underline">{file.name}</a> : <span className="truncate">{file.name}</span>}
      <span className="shrink-0 text-muted-foreground">{fileSize(file.size)}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} className="ml-1 shrink-0 rounded px-1 text-muted-foreground hover:text-destructive" aria-label="移除檔案">
          ✕
        </button>
      )}
    </span>
  );
}

export function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-medium">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-sm text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function SegmentedTabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="mb-4 flex rounded-xl bg-muted p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 font-medium transition-colors", value === o.value ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}
        >
          {o.label}
          {o.count !== undefined && o.count > 0 && <span className={cn("rounded-full px-1.5 text-xs", value === o.value ? "bg-primary text-white" : "bg-border")}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
