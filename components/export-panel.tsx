"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui-bits";
import { useCurrentUser, useData } from "@/lib/store";
import { buildChartData, buildExportSheets, describeScope, downloadBlob, downloadCsvBundle, type ExportOptions } from "@/lib/export";
import { renderBarChartPng } from "@/lib/charts-png";

/** 統計頁「匯出」分頁：選擇範圍後產生含 8 個工作表與圖表的 .xlsx（或 CSV 備援）。 */
export function ExportPanel() {
  const data = useData();
  const user = useCurrentUser();
  const [courseId, setCourseId] = useState("all");
  const [assignmentId, setAssignmentId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const sel = "min-h-12 w-full rounded-lg border border-input bg-background px-3 text-base";

  const opts: ExportOptions = useMemo(() => ({ courseId: courseId === "all" ? undefined : courseId, assignmentId: assignmentId === "all" ? undefined : assignmentId, from: from || undefined, to: to || undefined, anonymous }), [courseId, assignmentId, from, to, anonymous]);
  const sheets = useMemo(() => buildExportSheets(data, opts), [data, opts]);
  const charts = useMemo(() => buildChartData(data, opts), [data, opts]);
  const assignments = data.assignments.filter((a) => courseId === "all" || a.courseId === courseId);
  const baseName = `職場領袖學習平台_匯出_${new Date().toISOString().slice(0, 10)}`;

  const exportXlsx = async () => {
    setBusy(true);
    try {
      const { buildWorkbook } = await import("@/lib/export-xlsx");
      const images = charts.map((c) => {
        const png = renderBarChartPng(c);
        return { title: png.title, base64: png.dataUrl.split(",")[1], width: png.width, height: png.height };
      });
      const buffer = await buildWorkbook(sheets, images, { title: "職場領袖學習平台 匯出", scope: describeScope(data, opts), exportedBy: user?.name ?? "", exportedAt: new Date().toISOString() });
      downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${baseName}.xlsx`);
      toast.success(`已產生 Excel：8 個工作表、${images.length} 張圖表`);
    } catch (e) {
      toast.error(`匯出失敗：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4">
        <h3 className="mb-1">Excel 匯出</h3>
        <p className="mb-4 text-sm text-muted-foreground">8 個工作表：表單原始回答、個人作業繳交紀錄、分組作業繳交紀錄、各學員完成率、各小組完成率、各課程完成率、表單題目統計、統計圖表。完成率欄位附 Excel 資料橫條，圖表以圖片嵌入第 8 張工作表。匯出內容以你的資料存取權限為準。</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="課程範圍">
            <select className={sel} value={courseId} onChange={(e) => { setCourseId(e.target.value); setAssignmentId("all"); }}>
              <option value="all">全部課程</option>
              {data.courses.map((c) => <option key={c.id} value={c.id}>{c.unit}・{c.title}</option>)}
            </select>
          </Field>
          <Field label="指定作業（選填）">
            <select className={sel} value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)}>
              <option value="all">全部作業</option>
              {assignments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </Field>
          <Field label="提交時間 起（選填）"><input type="date" className={sel} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="提交時間 迄（選填）"><input type="date" className={sel} value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <label className="flex min-h-12 items-center gap-3 rounded-lg border px-3 md:col-span-2"><input type="checkbox" className="size-5 accent-primary" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> 匿名匯出（以「學員01」等編號取代姓名）</label>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button size="lg" className="flex-1 tap" onClick={exportXlsx} disabled={busy}>{busy ? <Loader2 className="size-5 animate-spin" /> : <FileSpreadsheet className="size-5" />} 下載 Excel（.xlsx）</Button>
          <Button size="lg" variant="outline" className="tap" onClick={() => { downloadCsvBundle(sheets, baseName); toast.success("已匯出 8 個 CSV"); }} disabled={busy}><Download className="size-5" /> 改下載 CSV</Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <h3 className="mb-2">預覽：{describeScope(data, opts)}</h3>
        <ul className="mb-4 grid gap-1 text-sm sm:grid-cols-2">
          {sheets.map((s) => <li key={s.name} className="flex justify-between rounded-lg bg-muted/60 px-3 py-1.5"><span>{s.name}</span><span className="text-muted-foreground">{s.rows.length - 1} 列</span></li>)}
        </ul>
        <div className="grid gap-3 md:grid-cols-2">
          {charts.map((c) => (
            <div key={c.title} className="rounded-xl border p-3">
              <div className="mb-2 text-sm font-medium">{c.title}</div>
              <ul className="space-y-1.5">
                {c.items.map((it) => (
                  <li key={it.label}>
                    <div className="flex justify-between text-sm"><span className="truncate pr-2">{it.label}</span><span className="shrink-0 text-muted-foreground">{it.value}{c.unit}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.min(100, (it.value / (c.max ?? 100)) * 100)}%` }} /></div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
