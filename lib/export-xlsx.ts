import type { Sheet } from "./export";

/**
 * 以 ExcelJS 組出 .xlsx：
 * - 8 個工作表，標題列粗體底色、凍結首列、自動篩選、欄寬
 * - 完成率欄位加 data bar（Excel 內建的儲存格長條）
 * - 第 8 張「統計圖表」嵌入 PNG 圖表（ExcelJS 不支援原生圖表物件）
 * 可在瀏覽器與 Node 執行（exceljs 以動態載入，避免進入首頁的 bundle）。
 */
export interface ChartImage {
  title: string;
  /** PNG 的 base64（不含 data: 前綴） */
  base64: string;
  width: number;
  height: number;
}

export interface WorkbookMeta {
  title: string;
  scope: string;
  exportedBy: string;
  exportedAt: string;
}

const HEADER_FILL = "FFE3F0F2";
const HEADER_FONT = "FF164750";

export async function buildWorkbook(sheets: Sheet[], charts: ChartImage[], meta: WorkbookMeta): Promise<ArrayBuffer> {
  // exceljs 為 CommonJS / UMD：瀏覽器（Vite）與 Node 的動態載入都可能把模組放在 default
  const mod = (await import("exceljs")) as unknown as { default?: typeof import("exceljs") } & typeof import("exceljs");
  const ExcelJS = mod.default?.Workbook ? mod.default : mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = meta.exportedBy;
  wb.created = new Date(meta.exportedAt);
  wb.title = meta.title;

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
    const [header, ...rows] = sheet.rows;
    ws.addRow(header);
    for (const r of rows) ws.addRow(r);
    ws.getRow(1).font = { bold: true, color: { argb: HEADER_FONT } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    ws.getRow(1).alignment = { vertical: "middle" };
    ws.getRow(1).height = 22;
    header.forEach((_, i) => {
      const col = ws.getColumn(i + 1);
      col.width = sheet.widths?.[i] ?? 14;
      col.alignment = { vertical: "top", wrapText: true };
    });
    if (rows.length > 0) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: header.length } };
    for (const ci of sheet.percentColumns ?? []) {
      const letter = ws.getColumn(ci + 1).letter;
      ws.getColumn(ci + 1).numFmt = '0.0"%"';
      if (rows.length > 0) {
        ws.addConditionalFormatting({
          ref: `${letter}2:${letter}${rows.length + 1}`,
          rules: [{ type: "dataBar", priority: 1, minLength: 0, maxLength: 100, cfvo: [{ type: "num", value: 0 }, { type: "num", value: 100 }], gradient: true, border: false, showValue: true }],
        });
      }
    }
    if (rows.length === 0) {
      ws.addRow(["（此範圍沒有資料）"]);
      ws.getRow(2).font = { italic: true, color: { argb: "FF55616D" } };
    }
  }

  // 第 8 張：在資料表右側嵌入圖表圖片
  const chartSheet = wb.worksheets[wb.worksheets.length - 1];
  let row = 1;
  for (const c of charts) {
    const id = wb.addImage({ base64: c.base64, extension: "png" });
    chartSheet.addImage(id, { tl: { col: 5, row: row - 1 }, ext: { width: c.width, height: c.height } });
    row += Math.ceil(c.height / 20) + 2; // 預設列高約 20px
  }

  // 封面資訊放在第 1 張最前面？保持資料表乾淨：改放在工作簿屬性與第 8 張末尾
  chartSheet.addRow([]);
  chartSheet.addRow(["匯出說明", meta.title]);
  chartSheet.addRow(["範圍", meta.scope]);
  chartSheet.addRow(["匯出者", meta.exportedBy]);
  chartSheet.addRow(["匯出時間", meta.exportedAt]);

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
