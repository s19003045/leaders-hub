// 匯出工作簿的 Node 端檢查：以示範資料組出 .xlsx，再讀回驗證工作表數、列數與圖表圖片。
// 用法：node scripts/export-check.mjs [輸出路徑]
import ts from "typescript";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(".sites-runtime/export-check");
await mkdir(root, { recursive: true });
for (const file of ["lib/types.ts", "lib/seed.ts", "lib/format.ts", "lib/selectors.ts", "lib/export.ts", "lib/export-xlsx.ts"]) {
  const target = resolve(root, file.replace(/\.ts$/, ".js"));
  await mkdir(dirname(target), { recursive: true });
  const source = await readFile(file, "utf8");
  let out = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText;
  out = out.replace(/(from ['"])(\.\.?\/[^'"]+)(['"])/g, "$1$2.js$3").replace(/import\("exceljs"\)/g, `import(${JSON.stringify(pathToFileURL(resolve("node_modules/exceljs/excel.js")).href)})`);
  await writeFile(target, out);
}

const { seedSnapshot } = await import(pathToFileURL(resolve(root, "lib/seed.js")).href);
const { buildExportSheets, buildChartData, describeScope } = await import(pathToFileURL(resolve(root, "lib/export.js")).href);
const { buildWorkbook } = await import(pathToFileURL(resolve(root, "lib/export-xlsx.js")).href);

// 1x1 透明 PNG 代替瀏覽器端繪製的圖表
const PNG_1x1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const checks = [];
for (const opts of [{}, { courseId: "k-05" }, { anonymous: true }, { assignmentId: "a-05-grp" }, { from: "2026-10-01", to: "2026-10-31" }]) {
  const sheets = buildExportSheets(seedSnapshot, opts);
  const charts = buildChartData(seedSnapshot, opts).map((c) => ({ title: c.title, base64: PNG_1x1, width: 640, height: 200 }));
  const buf = await buildWorkbook(sheets, charts, { title: "職場領袖學習平台 匯出", scope: describeScope(seedSnapshot, opts), exportedBy: "export-check", exportedAt: new Date().toISOString() });
  checks.push({ opts, sheets, charts, buf });
}

const out = process.argv[2] ?? resolve(root, "export-check.xlsx");
await writeFile(out, Buffer.from(checks[0].buf));

const ExcelJS = (await import("exceljs")).default;
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(out);
const names = wb.worksheets.map((w) => w.name);
let ok = true;
const assert = (cond, msg) => { if (!cond) { ok = false; console.error("✗", msg); } else console.log("✓", msg); };
assert(names.length === 8, `8 個工作表（實際 ${names.length}）：${names.join(" | ")}`);
assert(wb.worksheets[0].rowCount > 20, `表單原始回答有資料列（${wb.worksheets[0].rowCount} 列）`);
assert(wb.worksheets[3].rowCount === 13, `各學員完成率 12 位學員（${wb.worksheets[3].rowCount - 1} 列）`);
assert(wb.worksheets[4].rowCount === 4, `各小組完成率 3 組（${wb.worksheets[4].rowCount - 1} 列）`);
const chartSheet = wb.worksheets[7];
assert(chartSheet.getImages().length === checks[0].charts.length, `統計圖表嵌入 ${chartSheet.getImages().length} 張圖片`);
assert(checks[1].sheets[0].rows.every((r, i) => i === 0 || r[1] === "第五課"), "指定課程時表單回答只含第五課");
assert(checks[2].sheets[3].rows.slice(1).every((r) => /^學員\d\d$/.test(String(r[0]))), "匿名匯出以學員編號取代姓名");
assert(checks[3].sheets[1].rows.length === 1 && checks[3].sheets[2].rows.length > 1, "指定分組作業時個人作業表為空、分組作業表有資料");
assert(checks[4].sheets[0].rows.slice(1).every((r) => String(r[6]).startsWith("10/")) && checks[4].sheets[1].rows.slice(1).every((r) => String(r[6]).startsWith("10/")), "10 月時間範圍：表單回答與作業只保留 10 月的提交");
console.log(`輸出：${out}（${Buffer.from(checks[0].buf).length} bytes）`);
await rm(resolve(root, "lib"), { recursive: true, force: true });
process.exitCode = ok ? 0 : 1;
