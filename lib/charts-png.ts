import type { ChartData } from "./export";

/**
 * 以 Canvas 繪製水平長條圖並輸出 PNG（瀏覽器端）。
 * ExcelJS 無法建立 Excel 原生圖表物件，因此以圖片嵌入第 8 張工作表，
 * 並以儲存格的 data bar 提供可互動的數值條。
 */
export interface ChartPng {
  title: string;
  width: number; // CSS px
  height: number;
  dataUrl: string; // image/png
}

const COLORS = ["#1f5f6b", "#d98b2b", "#2e7d4f", "#3a5fa8", "#b3362b", "#6b4c9a"];

export function renderBarChartPng(chart: ChartData, opts: { width?: number; scale?: number } = {}): ChartPng {
  const width = opts.width ?? 640;
  const scale = opts.scale ?? 2;
  const rowH = 34;
  const top = 52;
  const height = top + chart.items.length * rowH + 28;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("瀏覽器不支援 Canvas");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.font = "bold 16px 'Noto Sans TC', system-ui, sans-serif";
  ctx.fillStyle = "#1b2430";
  ctx.textBaseline = "middle";
  ctx.fillText(chart.title, 16, 24);

  const labelW = 200;
  const barX = labelW + 16;
  const barMaxW = width - barX - 72;
  const max = chart.max ?? Math.max(1, ...chart.items.map((i) => i.value));

  // 格線
  ctx.strokeStyle = "#e3e7e5";
  ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const x = barX + (barMaxW * g) / 4;
    ctx.beginPath();
    ctx.moveTo(x, top - 8);
    ctx.lineTo(x, top + chart.items.length * rowH);
    ctx.stroke();
    ctx.fillStyle = "#55616d";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.round((max * g) / 4)}${chart.unit}`, x, top + chart.items.length * rowH + 12);
  }

  chart.items.forEach((item, i) => {
    const y = top + i * rowH;
    ctx.textAlign = "right";
    ctx.fillStyle = "#1b2430";
    ctx.font = "13px 'Noto Sans TC', system-ui, sans-serif";
    ctx.fillText(truncate(ctx, item.label, labelW), barX - 12, y + rowH / 2);
    const w = Math.max(2, (barMaxW * Math.min(item.value, max)) / max);
    ctx.fillStyle = COLORS[i % COLORS.length];
    roundRect(ctx, barX, y + 7, w, rowH - 14, 5);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = "#1b2430";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText(`${item.value}${chart.unit}`, barX + w + 8, y + rowH / 2);
  });

  return { title: chart.title, width, height, dataUrl: canvas.toDataURL("image/png") };
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
