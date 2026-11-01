# 04 交給 ChatGPT Sites 建置與發佈

## 打包

把整個專案目錄壓成 zip（排除 `node_modules`、`dist`、`.vinext`、`.wrangler`、`.sites-runtime`、`.env*`）：

```bash
cd /opt/church && zip -r leaders-hub-source.zip leaders-hub -x 'leaders-hub/node_modules/*' 'leaders-hub/dist/*' 'leaders-hub/.vinext/*' 'leaders-hub/.wrangler/*' 'leaders-hub/.sites-runtime/*' 'leaders-hub/.env*' 'leaders-hub/.claude/*'
```

## 給 ChatGPT 的說明（可直接貼）

> 這是一個以 ChatGPT Sites 範本（Vinext + React + TypeScript + Cloudflare Workers）建立的專案，結構與你匯出的 BBQ Together 專案相同。請用 Sites 建置並發佈：
> 1. 保留 `scripts/`、`worker/`、`vite.config.ts`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`，用 `pnpm install --frozen-lockfile` 安裝。
> 2. `.openai/hosting.json` 已宣告 D1 binding `DB` 與 R2 binding `BUCKET`，請在建立 Site 時綁定並補上 `project_id`。`drizzle/` 內的 migration 請在部署時套用到 D1（Drizzle 產生的 SQL）。
> 3. 網站存取請設為「只限受邀者」，並啟用 Sign in with ChatGPT。
> 4. 環境變數：`INITIAL_ADMIN_EMAIL` 填我的 ChatGPT 登入 Email。若這是給大家看的示範站，另外加 `DEMO_LOGIN=1` 與 `SEED_DEMO_DATA=1`；正式站請勿設定這兩個。
> 5. 發佈後請回報網址，以及我用 ChatGPT 登入後 `/api/me` 是否回傳我的帳號且 `role` 為 `admin`。

## 發佈後驗證清單

- [ ] 手機開啟首頁 → `/login` → Sign in with ChatGPT 成功回到 `/login`，顯示「已登入 ChatGPT：xxx@…」。
- [ ] `/api/health` 回傳 `{ ok: true }`；`/api/me` 登入後回傳 `user.role = "admin"`（表示 migration 與 `INITIAL_ADMIN_EMAIL` 都正確）。
- [ ] 後台「學員帳號」新增一位成員（填對方 ChatGPT Email），請對方登入確認能進入。
- [ ] 以示範身分進入學員首頁、作業頁、表單頁；老師身分進入後台與統計。
- [ ] 字級切換、底部導覽在 iPhone / Android 正常。
- [ ] 分享連結到 LINE 群組後，點開能直接到登入頁。

## 已知的 Sites 限制與對應

| 限制 | 本專案做法 |
| --- | --- |
| 正式環境是 Workers，不是 Node 常駐伺服器 | API 全部在 `app/api/[...path]/route.ts`，無狀態；不使用 Node 專屬模組 |
| 無原始 TCP，資料庫只能用 D1 | `db/schema.ts` 為 D1（SQLite）設計；JSON 欄位以 text 儲存 |
| 無背景服務 | 提醒推播採惰性排程或管理員手動觸發（見 03 文件） |
| 128 MB 記憶體 | Excel 匯出在瀏覽器端產生（ExcelJS），不在 Workers |
| 私人附件 | 存 R2，下載時由 API 檢查權限後回傳限時連結 |
| 外部 OAuth 未驗證 | 第一版使用 Sign in with ChatGPT（見 02 文件） |

## 之後更新 schema 時

1. 修改 `db/schema.ts` → `corepack pnpm db:generate` 產生新的 `drizzle/000N_*.sql`。
2. 本機 `corepack pnpm db:migrate:local` 測試。
3. 連同程式碼交給 ChatGPT，請它在部署時套用新 migration（不要手動改正式資料庫）。
