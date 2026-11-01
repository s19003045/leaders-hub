# 職場領袖學習平台（leaders-hub）

教會「職場領袖聚集」的教學管理平台：課程、線上表單、個人／分組作業、教材中心、文章分享、統計與匯出。
繁體中文、mobile-first，目標使用者 42～65 歲。

**目前狀態：第一～四階段完成，進入第五階段（測試與正式部署）。** 所有頁面可操作，資料存在 Cloudflare D1，讀寫經由 Workers API 並在伺服器端做角色授權；
登入以 ChatGPT 帳號（Sign in with ChatGPT）對應 `users` 表；附件上傳到 R2 並受權限保護；新內容與截止提醒推播到 LINE；
統計可匯出含 8 個工作表與圖表的 Excel。

相關文件：

- [docs/01-資訊架構與操作流程.md](docs/01-資訊架構與操作流程.md) — 網站資訊架構、頁面配置、學員／老師／個人作業／分組作業流程
- [docs/02-登入機制評估.md](docs/02-登入機制評估.md) — ChatGPT / Google / LINE 登入的可行性與建議
- [docs/03-活絡平台使用建議.md](docs/03-活絡平台使用建議.md) — 讓成員持續使用平台的機制
- [docs/04-交給ChatGPT-Sites部署.md](docs/04-交給ChatGPT-Sites部署.md) — 把程式碼交給 ChatGPT 建置與發佈的步驟與注意事項
- [docs/05-第二階段-資料庫與API.md](docs/05-第二階段-資料庫與API.md) — D1 schema、API、登入對應、授權與樂觀鎖
- [docs/06-第三階段-檔案與LINE推播.md](docs/06-第三階段-檔案與LINE推播.md) — R2 上傳與權限、限時連結、LINE 官方帳號設定與綁定、截止提醒
- [docs/07-第四階段-Excel匯出.md](docs/07-第四階段-Excel匯出.md) — ExcelJS 8 個工作表、data bar、嵌入圖表、匯出選項
- [docs/08-給ChatGPT的部署說明.md](docs/08-給ChatGPT的部署說明.md) — 可直接貼給 ChatGPT Sites 的部署說明、打包指令、發佈後管理員待辦

## 技術架構（與 ChatGPT Sites 相容）

| 層 | 技術 | 說明 |
| --- | --- | --- |
| 前端 | Vinext（Next.js App Router 風格）、React 19、TypeScript、Tailwind CSS 4、shadcn/ui（vendored） | 所有頁面為 client component |
| 後端 | Cloudflare Workers（`worker/index.ts` → `app/api/[...path]/route.ts`） | 讀寫全部經 `lib/server/*`，授權在伺服器端 |
| 資料庫 | Cloudflare D1 + Drizzle（`db/schema.ts`、`drizzle/` migration） | Sites 部署時自動套用 migration |
| 檔案 | Cloudflare R2（binding `BUCKET`，`lib/server/files.ts`） | 上傳即存 R2；下載經 `/api/files/{key}` 檢查權限，或 15 分鐘限時簽章連結 |
| 通知 | 站內通知 + LINE Messaging API（`lib/server/line.ts`、`reminders.ts`） | 公告推群組、個人事件推已綁定者；截止前 3 天／1 天惰性排程提醒 |
| 登入 | Sign in with ChatGPT（`lib/chatgpt-auth.ts` 讀取 `oai-authenticated-user-*` header → `lib/server/auth.ts` 對應 `users`） | 本機開發由 `scripts/vite/sites-vite-plugin.ts` 模擬；`DEMO_LOGIN=1` 另提供示範身分 |
| 圖表 | Recharts（統計頁）、Canvas PNG（Excel 嵌入） | |
| Excel | ExcelJS（瀏覽器端動態載入，`lib/export-xlsx.ts`） | 8 個工作表、data bar、嵌入圖表、CSV 備援 |

`scripts/`、`worker/`、`vite.config.ts`、`.openai/hosting.json`、`pnpm-workspace.yaml` 等皆沿用 Sites 匯出專案的結構，請勿改動其位置。

## 專案結構

```
app/
  layout.tsx, globals.css, providers.tsx   全域版面、主題、字級與資料層初始化
  login/                                   登入（ChatGPT 登入＋第一階段示範身分）
  page.tsx                                 學員首頁（待辦、老師回覆、小組、教材、分享）
  courses/, courses/[id]/                  我的課程、課程詳情（教材、表單、作業）
  forms/, forms/[id]/                      線上表單清單、填寫／草稿／歷史／老師回覆
  assignments/, assignments/[id]/          作業清單（個人／分組）、繳交、版本、批改結果
  materials/, materials/[id]/              教材中心、教材詳情
  articles/, articles/[id]/, articles/new/ 文章分享、留言、發布
  group/                                   我的小組
  me/, notifications/                      我的（進度、字級、登出）、通知
  admin/                                   老師／助教／管理員後台總覽
  admin/courses/                           課程
  admin/forms/, admin/forms/new/, admin/forms/[id]/        表單建立、回答檢視、題目統計、回覆
  admin/assignments/, .../new/, .../[id]/  作業發布、繳交狀態、批改
  admin/materials/                         教材上傳與管理
  admin/groups/                            小組管理（組員、組長、異動紀錄）
  admin/users/                             帳號與角色
  admin/stats/                             統計儀表板與匯出
  api/[...path]/route.ts                   Workers API 路由
components/
  app-shell.tsx        頂欄、手機底部導覽、桌面側欄、登入保護
  ui-bits.tsx          共用小元件（列、徽章、統計卡、頭像、欄位…）
  question-field.tsx   七種題型的填寫元件
  file-picker.tsx      檔案選擇（第一階段只記錄中繼資料）
  staff-only.tsx       老師／助教／管理員頁面保護
  ui/                  shadcn/ui 元件
lib/
  types.ts             領域型別（對應需求書第九章資料表）
  seed.ts              示範資料（12 位學員、3 組、7 課、表單、作業、教材、文章）
  store.ts             前端資料層：/api/state 快照 + 呼叫 API 的 actions
  selectors.ts         純函式：待辦、作業狀態、完成率、題目統計（前後端共用）
  export.ts            8 個工作表的匯出資料整理與篩選
  export-xlsx.ts       ExcelJS 組檔（樣式、data bar、圖片）
  charts-png.ts        Canvas 長條圖 → PNG
  format.ts            日期、狀態文字
  chatgpt-auth.ts      讀取 ChatGPT 登入 header
  server/
    auth.ts            identify()：ChatGPT Email → users、INITIAL_ADMIN_EMAIL、示範登入
    snapshot.ts        D1 → Snapshot，依角色裁切
    mutations.ts       所有寫入：zod 驗證、授權、樂觀鎖、LINE 推播
    files.ts           R2 上傳、讀取權限、限時簽章連結
    line.ts            LINE Messaging API 推播、webhook 驗簽、綁定代碼
    reminders.ts       截止提醒（惰性排程＋老師手動）
    seed-db.ts         示範資料寫入 / 清空
    http.ts, db.ts, context.ts  錯誤、JSON、cookie、Drizzle 連線、請求範圍環境
db/
  schema.ts            D1 Drizzle schema（22 張表）
drizzle/               migration（pnpm db:generate 產生；Sites 部署自動套用）
docs/                  規劃文件
```

## 啟動方式（本機）

需求：Node.js 22.13 以上、pnpm 11.25.0（專案已 pin；用 Corepack 即可）。

```bash
corepack pnpm install --frozen-lockfile
```

複製 `.env.example` 為 `.dev.vars`，本機建議：`DEMO_LOGIN=1`、`SEED_DEMO_DATA=1`、`INITIAL_ADMIN_EMAIL=seedy@sites.test`、`FILE_LINK_SECRET=任意長字串`（LINE 三個變數可留空）。然後建立本機 D1：

```bash
corepack pnpm db:migrate:local
```

```bash
corepack pnpm dev
```

開啟 http://localhost:5173 。資料庫為空時第一個請求會自動寫入示範資料。登入頁可選「示範身分」：

| 身分 | 可體驗 |
| --- | --- |
| 陳建宏（學員、第一組組長） | 待辦、填表單草稿、個人作業已批改、代表小組重新提交 |
| 劉慧君（學員、第二組） | 小組逾期提交、未批改狀態 |
| 謝怡君（學員、第三組） | 小組尚未提交、個人作業未交 |
| 張文德（老師） | 後台、批改、回覆表單、建立作業／表單、統計、匯出 |
| 王美玲（助教） | 後台檢視、批改協助、教材 |
| Gary（管理員） | 帳號、小組管理 |

「Sign in with ChatGPT」在本機會用模擬帳號 `seedy@sites.test`；因為它等於 `INITIAL_ADMIN_EMAIL`，首次登入會自動建立管理員帳號。正式 Sites 上才是真正的 ChatGPT 登入。
示範資料存在本機 D1；「我的 → 重設示範資料」可還原（需 `SEED_DEMO_DATA=1`），或執行 `corepack pnpm db:reset:local`。

### 檢查與建置

```bash
pnpm exec tsc --noEmit
```

```bash
pnpm lint
```

```bash
pnpm build
```

```bash
corepack pnpm check:export
```

## 開發階段

1. **第一階段（完成）**：可操作原型、模擬資料、全部頁面可切換。
2. **第二階段（完成）**：D1 migration、`/api/*` 以 Drizzle 讀寫 D1、ChatGPT 登入對應 `users.email`、伺服器端角色授權與樂觀鎖。
3. **第三階段（完成）**：R2 檔案上傳與限時連結、LINE 推播與綁定、截止提醒、課程與表單編輯。
4. **第四階段（完成）**：ExcelJS 產生含 8 個工作表、data bar 與圖表圖片的 `.xlsx`，支援課程／作業／時間／匿名篩選。
5. **第五階段**：權限、安全、上傳限制、多人操作測試後正式發佈。
