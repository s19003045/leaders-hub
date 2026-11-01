# 08 給 ChatGPT Sites 的部署說明（可直接貼上）

把 zip 上傳到 ChatGPT 後，貼下面這段。方括號內請先換成你的資料。

---

請用 ChatGPT Sites 建置並發佈這個專案（zip 附上）。這是一個教會「職場領袖聚集」的教學管理平台，繁體中文、手機優先，約 15 位使用者。

**專案架構（與你先前匯出的 BBQ Together 專案相同）**

- Vinext 1.0.0-beta.5（Next.js App Router 風格）+ React 19 + TypeScript + Tailwind CSS 4
- 後端在 Cloudflare Workers：`worker/index.ts` → `app/api/[...path]/route.ts`
- 資料庫 Cloudflare D1（Drizzle ORM），schema 在 `db/schema.ts`，migration 在 `drizzle/`（兩個檔案，依序套用）
- 檔案儲存 Cloudflare R2（binding `BUCKET`）
- 登入使用 Sign in with ChatGPT，伺服器端讀 `oai-authenticated-user-email` header 對應 `users` 表
- 套件管理 pnpm 11.25.0（`packageManager` 已 pin），請用 `pnpm install --frozen-lockfile`

**請照做**

1. 保留 `scripts/`、`worker/`、`vite.config.ts`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`.openai/hosting.json`，不要改寫成其他框架。
2. `.openai/hosting.json` 已宣告 `"d1": "DB"`、`"r2": "BUCKET"`。建立 Site 時綁定 D1 與 R2，並補上 `project_id`。
3. 部署時把 `drizzle/0000_*.sql` 與 `drizzle/0001_*.sql` 依序套用到 D1（它們是 drizzle-kit 產生的 SQL；`drizzle/meta/_journal.json` 記錄順序）。
4. 環境變數（Sites → Settings → Environment Variables）：
   - `INITIAL_ADMIN_EMAIL` = [我的 ChatGPT 登入 Email]（第一次登入會自動成為管理員）
   - `FILE_LINK_SECRET` = [一組 32 字元以上的隨機字串]（限時下載連結用）
   - 以下三個先不填，我設定好 LINE 官方帳號後再補：`LINE_CHANNEL_ACCESS_TOKEN`、`LINE_CHANNEL_SECRET`、`LINE_GROUP_ID`
   - **不要**設定 `DEMO_LOGIN` 與 `SEED_DEMO_DATA`（這兩個只給本機與示範站用；設了任何人都能切換身分）
5. 網站存取設為「只限受邀者」（Only those invited），並啟用 Sign in with ChatGPT。先只邀請我。
6. 建置指令就是 `pnpm build`（內部呼叫 `node scripts/run-framework.mjs build`）。本機 `pnpm exec tsc --noEmit`、`pnpm lint`、`pnpm build` 都是零錯誤。

**發佈後請回報**

- 網站網址。
- `GET /api/health` 是否回 `{ "ok": true }`。
- 我用 ChatGPT 登入後 `GET /api/me` 是否回傳 `user.role = "admin"`（代表 migration 與 `INITIAL_ADMIN_EMAIL` 都正確）。
- 若建置或執行有錯，請貼完整錯誤訊息，不要自行改架構。

**已知事項，不是錯誤**

- `vinext build` 會提示「Some routes could not be classified」，可忽略。
- API 路由全部是動態（`export const dynamic = "force-dynamic"`）。
- Excel 匯出在瀏覽器端用 ExcelJS 產生，不在 Workers。
- D1 每個 statement 最多 100 個綁定參數，程式已分批寫入。
- 資料庫空的時候網站可以正常登入；管理員登入後在「學員帳號」新增成員（填對方的 ChatGPT Email），對方登入即可使用。

---

## 我（管理員）發佈後要做的事

1. 用 ChatGPT 登入一次 → 確認進入後台。
2. 後台「課程」建立第六課與之後課程；「學員帳號」逐一新增成員（姓名＋ChatGPT Email＋角色）；「小組管理」分組。
3. 「教材管理」上傳第六課簡報並勾「課前閱讀」。
4. 在 Sites 把成員的 ChatGPT 帳號加入受邀名單（或改為工作區／公開 + 登入，依你的方案）。
5. LINE：依 [docs/06-第三階段-檔案與LINE推播.md](06-第三階段-檔案與LINE推播.md) 建立官方帳號，填三個環境變數，把官方帳號加入群組取得群組 ID。
6. 在 LINE 群組置頂：網址、登入三步驟、LINE 綁定方式。

## 打包指令（在本機重新打包時用）

```bash
cd /opt/church && rm -f leaders-hub-source.zip && zip -rq leaders-hub-source.zip leaders-hub -x 'leaders-hub/node_modules/*' 'leaders-hub/dist/*' 'leaders-hub/.vinext/*' 'leaders-hub/.wrangler/*' 'leaders-hub/.sites-runtime/*' 'leaders-hub/.git/*' 'leaders-hub/.claude/*' 'leaders-hub/.dev.vars' 'leaders-hub/.env' 'leaders-hub/*.tsbuildinfo' 'leaders-hub/next-env.d.ts' && unzip -l leaders-hub-source.zip | tail -1
```
