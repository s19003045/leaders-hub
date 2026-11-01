# 05 第二階段：D1 資料庫、API 與登入對應

完成日期：2026-11-01。本階段把第一階段的瀏覽器模擬資料層換成 Cloudflare D1，所有讀寫經由 Workers API，身分由 ChatGPT 登入對應到 `users` 表。頁面程式碼不變。

## 架構

```
瀏覽器（React 頁面）
  └─ lib/store.ts            只保留一份 /api/state 快照；寫入呼叫 API 後重新載入
       └─ fetch /api/*        同源 JSON，帶 cookie
Cloudflare Workers（app/api/[...path]/route.ts）
  ├─ lib/chatgpt-auth.ts     讀 Sites 的 oai-authenticated-user-* header
  ├─ lib/server/auth.ts      identify()：header Email → users 表；INITIAL_ADMIN_EMAIL 自動建立管理員；DEMO_LOGIN 示範身分
  ├─ lib/server/snapshot.ts  loadSnapshot()：D1 → Snapshot；scopeSnapshot()：依角色裁切
  ├─ lib/server/mutations.ts 所有寫入（zod 驗證 + 授權 + 樂觀鎖）
  ├─ lib/server/seed-db.ts   示範資料寫入 / 清空（SEED_DEMO_DATA=1）
  └─ db/schema.ts + drizzle/ Drizzle schema 與 migration（Sites 部署時自動套用）
Cloudflare D1（binding DB）
```

## 登入對應規則（lib/server/auth.ts）

1. `DEMO_LOGIN=1` 且帶示範 cookie → 直接以該使用者身分（只用於本機與示範站）。
2. 有 ChatGPT header → 以 Email（不分大小寫）查 `users`；首次登入把 `chatgpt_user_id` 綁到該列。
3. Email 不在名單但等於 `INITIAL_ADMIN_EMAIL` → 自動建立 admin。
4. 其他 → 未授權；登入頁顯示「此帳號尚未加入名單，請把 Email 告訴管理員」。
5. 停用的帳號（`active = 0`）視同未授權。

管理員在「學員帳號」新增成員時填入對方的 ChatGPT 登入 Email，對方登入即對應。

## 授權（伺服器端為準）

| 操作 | 規則 |
| --- | --- |
| 讀取快照 | 學員只拿到自己的表單回答、自己與自己小組的作業提交、給自己的回覆與通知；其他人的 Email 被清空；看不到操作紀錄 |
| 填表單 | 只能寫自己的回答；必填、開放／截止、是否允許修改與逾期在伺服器檢查 |
| 交作業 | 個人作業只能交自己的；分組作業必須是該組現任組員；格式與大小限制在伺服器檢查 |
| 回覆、批改、建表單、發作業、教材 | 老師／助教／管理員 |
| 小組管理 | 老師／管理員 |
| 帳號管理 | 管理員；不能移除自己的管理員身分；Email 不可重複 |
| 文章 | 作者或老師／助教／管理員可修改、刪除；草稿不能留言 |

## 多人同時提交（樂觀鎖）

`assignment_submissions.version` 每次寫入 +1。提交時前端帶上畫面載入時的 `expectedVersion`；伺服器以
`UPDATE … WHERE id = ? AND version = ?` 更新，`changes = 0` 即回 409，前端顯示「其他組員剛剛已經提交了新版本」。已用 curl 驗證：舊版本號 → 409，正確版本號 → 寫入第 2 版。

## 資料保留

- 小組成員異動不刪列：`group_members.left_at` 標記離開時間；作業提交綁定小組與實際提交者，不受名單變動影響。
- 每次正式提交一列 `submission_versions`，附件在 `assignment_files`；批改一列 `assignment_reviews`（取最新）。
- `audit_logs` 記錄建立／修改／提交／批改。

## 環境變數

| 變數 | 本機 `.dev.vars` | 正式站 |
| --- | --- | --- |
| `INITIAL_ADMIN_EMAIL` | `seedy@sites.test`（Vite 模擬登入帳號） | 你的 ChatGPT Email |
| `DEMO_LOGIN` | `1` | 留空（示範站才填 1） |
| `SEED_DEMO_DATA` | `1` | 留空（示範站才填 1） |

## 本機操作

```bash
corepack pnpm db:migrate:local
```

```bash
corepack pnpm dev
```

資料庫為空時第一個請求會自動寫入示範資料（`SEED_DEMO_DATA=1`）。要清空重來：

```bash
corepack pnpm db:reset:local
```

修改 `db/schema.ts` 後產生新 migration：

```bash
corepack pnpm db:generate
```

## D1 注意事項（實測）

- 每個 SQL statement 最多 100 個綁定參數：批次 insert 要分段（seed 每批 6 列、通知每批 10 列）。
- 沒有跨 statement 交易；關鍵一致性靠「版本條件更新」而非 transaction。
- `drizzle-orm/d1` 的 `.run()` 回傳 `meta.changes`，用來判斷條件更新是否成功。

## 已驗證

- `/api/me` 無登入 → `user: null`；示範登入 → 對應學員；Vite 模擬 ChatGPT 登入（seedy@sites.test）→ 自動建立 admin。
- 學員快照：他人 Email 為空、只含自己的提交；學員呼叫老師功能 → 403；替他人交作業 → 403。
- 表單缺必填 → 400 並列出題目；補齊 → 寫入。
- 瀏覽器：示範身分登入 → 老師後台 → 批改分組作業 → 畫面更新。

## 尚未做（第三階段）

- R2 檔案實際上傳與限時下載連結（目前只記錄檔名與大小）。
- LINE 推播。
- 老師修改表單、課程 CRUD。
