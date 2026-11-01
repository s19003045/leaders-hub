"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/app-shell";
import { StaffOnly } from "@/components/staff-only";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { PageHeader, Pill, SegmentedTabs, Section, StatTile } from "@/components/ui-bits";
import { useData } from "@/lib/store";
import { assignmentStats, courseCompletion, formStats, groupCompletion, questionStats, studentCompletion, students } from "@/lib/selectors";
import { fmtDateTime, pct } from "@/lib/format";
import { buildExportSheets, downloadCsvBundle } from "@/lib/export";

const chartConfig = { rate: { label: "完成率 %", color: "var(--chart-1)" } } satisfies ChartConfig;

export default function AdminStatsPage() {
  const data = useData();
  const [tab, setTab] = useState<"assignments" | "forms" | "students" | "export">("assignments");
  const aStats = assignmentStats(data);
  const fStats = formStats(data);
  const sc = studentCompletion(data);
  const gc = groupCompletion(data);
  const cc = courseCompletion(data);
  const late = data.assignmentSubmissions.filter((s) => s.submitStatus === "late").length;
  const [scope, setScope] = useState({ courseId: "all", anonymous: false });

  const doExport = () => {
    const sheets = buildExportSheets(data, { courseId: scope.courseId === "all" ? undefined : scope.courseId, anonymous: scope.anonymous });
    downloadCsvBundle(sheets, `職場領袖_匯出_${new Date().toISOString().slice(0, 10)}`);
    toast.success(`已匯出 ${sheets.length} 個工作表（第一階段為 CSV，第四階段改為含圖表的 Excel）`);
  };

  return (
    <AppShell title="統計與匯出" wide>
      <StaffOnly>
        <PageHeader title="統計與匯出" description="學員、作業與表單統計；可匯出 Excel" />
        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <StatTile label="總學員人數" value={students(data).length} hint={`${data.classes[0]?.name}`} />
          <StatTile label="個人作業完成率" value={`${avg(aStats.filter((s) => s.assignment.type === "individual" && isOpen(s.assignment.openAt)).map((s) => s.rate))}%`} />
          <StatTile label="分組作業完成率" value={`${avg(aStats.filter((s) => s.assignment.type === "group" && isOpen(s.assignment.openAt)).map((s) => s.rate))}%`} />
          <StatTile label="逾期提交" value={late} tone={late ? "warning" : "success"} />
        </div>
        <SegmentedTabs value={tab} onChange={setTab} options={[{ value: "assignments", label: "作業" }, { value: "forms", label: "表單" }, { value: "students", label: "學員" }, { value: "export", label: "匯出" }]} />

        {tab === "assignments" && (
          <>
            <Section title="各作業完成率">
              <div className="rounded-2xl border bg-card p-3">
                <ChartContainer config={chartConfig} className="h-56 w-full">
                  <BarChart data={aStats.filter((s) => isOpen(s.assignment.openAt)).map((s) => ({ name: s.assignment.title.replace(/：.*$/, ""), rate: s.rate }))} margin={{ left: -20, right: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="rate" fill="var(--color-rate)" radius={6} />
                  </BarChart>
                </ChartContainer>
              </div>
            </Section>
            <div className="overflow-x-auto rounded-2xl border bg-card">
              <table className="w-full min-w-[36rem] text-sm">
                <thead className="bg-muted/60 text-left"><tr><th className="px-3 py-2">作業</th><th className="px-3 py-2">類型</th><th className="px-3 py-2 text-right">應繳</th><th className="px-3 py-2 text-right">已繳</th><th className="px-3 py-2 text-right">未繳</th><th className="px-3 py-2 text-right">完成率</th></tr></thead>
                <tbody>
                  {aStats.map((s) => (
                    <tr key={s.assignment.id} className="border-t">
                      <td className="px-3 py-2">{s.assignment.title}</td>
                      <td className="px-3 py-2">{s.assignment.type === "group" ? "分組" : "個人"}</td>
                      <td className="px-3 py-2 text-right">{s.expected}{s.unit}</td>
                      <td className="px-3 py-2 text-right">{s.submitted}{s.unit}</td>
                      <td className="px-3 py-2 text-right">{s.expected - s.submitted}{s.unit}</td>
                      <td className="px-3 py-2 text-right"><Pill tone={s.rate >= 90 ? "done" : s.rate >= 60 ? "soon" : "overdue"}>{s.rate}%</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Section title="各小組完成率" className="mt-6">
              <div className="grid gap-2 sm:grid-cols-3">{gc.map((g) => <StatTile key={g.group.id} label={g.group.name} value={`${pct(g.done, g.total)}%`} hint={`${g.done}/${g.total}・組長 ${g.leader?.name ?? "未指定"}`} />)}</div>
            </Section>
            <Section title="各課程完成率">
              <div className="grid gap-2 sm:grid-cols-3">{cc.filter((c) => c.expected > 0).map((c) => <StatTile key={c.course.id} label={c.course.unit} value={`${c.rate}%`} hint={`${c.done}/${c.expected}・作業 ${c.assignments}、表單 ${c.forms}`} />)}</div>
            </Section>
          </>
        )}

        {tab === "forms" && (
          <div className="space-y-4">
            {fStats.map((s) => {
              const qs = questionStats(data, s.form);
              return (
                <div key={s.form.id} className="rounded-2xl border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2"><h3>{s.form.title}</h3><Pill tone={s.rate >= 90 ? "done" : "soon"}>{s.submitted}/{s.expected}・{s.rate}%</Pill></div>
                  <ul className="space-y-1 text-sm">
                    {qs.map((q, i) => (
                      <li key={q.question.id} className="flex flex-wrap gap-x-2">
                        <span className="text-muted-foreground">{i + 1}. {q.question.title}</span>
                        {q.kind === "rating" && <span className="font-medium text-primary">平均 {q.avg} 分</span>}
                        {q.kind === "choice" && <span className="font-medium text-primary">{Object.entries(q.counts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([o, n]) => `${o} ${pct(n, q.total)}%`).join("、")}</span>}
                        {q.kind === "text" && <span className="font-medium text-primary">{q.total} 則文字回答</span>}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 text-xs text-muted-foreground">最後提交：{(() => { const last = data.formSubmissions.filter((x) => x.formId === s.form.id && x.submittedAt).sort((a, b) => b.submittedAt!.localeCompare(a.submittedAt!))[0]; return last ? fmtDateTime(last.submittedAt!) : "—"; })()}</div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "students" && (
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="bg-muted/60 text-left"><tr><th className="px-3 py-2">學員</th><th className="px-3 py-2">小組</th><th className="px-3 py-2 text-right">表單</th><th className="px-3 py-2 text-right">個人作業</th><th className="px-3 py-2 text-right">分組作業</th><th className="px-3 py-2 text-right">逾期</th></tr></thead>
              <tbody>
                {sc.map((r) => (
                  <tr key={r.user.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{r.user.name}</td>
                    <td className="px-3 py-2">{r.group?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{r.forms.done}/{r.forms.total}</td>
                    <td className="px-3 py-2 text-right">{r.individual.done}/{r.individual.total}</td>
                    <td className="px-3 py-2 text-right">{r.group_.done}/{r.group_.total}</td>
                    <td className="px-3 py-2 text-right">{r.late ? <Pill tone="soon">{r.late}</Pill> : "0"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "export" && (
          <div className="rounded-2xl border bg-card p-4">
            <h3 className="mb-2">Excel 匯出</h3>
            <p className="mb-4 text-sm text-muted-foreground">匯出包含 8 個工作表：表單原始回答、個人作業繳交紀錄、分組作業繳交紀錄、各學員完成率、各小組完成率、各課程完成率、表單題目統計、統計圖表。匯出遵守你的資料存取權限。</p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block"><span className="mb-1 block font-medium">範圍</span>
                <select className="min-h-12 w-full rounded-lg border border-input bg-background px-3 text-base" value={scope.courseId} onChange={(e) => setScope({ ...scope, courseId: e.target.value })}>
                  <option value="all">全部資料</option>
                  {data.courses.map((c) => <option key={c.id} value={c.id}>{c.unit}・{c.title}</option>)}
                </select>
              </label>
              <label className="flex min-h-12 items-center gap-3 self-end rounded-lg border px-3"><input type="checkbox" className="size-5 accent-primary" checked={scope.anonymous} onChange={(e) => setScope({ ...scope, anonymous: e.target.checked })} /> 匿名匯出（以學員編號取代姓名）</label>
            </div>
            <Button size="lg" className="mt-4 w-full tap md:w-auto" onClick={doExport}><Download className="size-5" /> 下載匯出檔</Button>
            <p className="mt-3 text-xs text-muted-foreground">第一階段以 CSV（每個工作表一個檔案）示範資料內容；第四階段改為 ExcelJS 產生含實際圖表的 .xlsx。</p>
          </div>
        )}
      </StaffOnly>
    </AppShell>
  );
}

function isOpen(openAt: string) {
  return new Date(openAt).getTime() <= Date.now();
}
function avg(xs: number[]) {
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;
}
