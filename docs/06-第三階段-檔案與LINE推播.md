# 06 第三階段：R2 檔案、LINE 推播、截止提醒、課程與表單編輯

完成日期：2026-11-01。

## 1. 檔案（Cloudflare R2）

```
瀏覽器 FilePicker ──multipart──► POST /api/uploads { file, purpose }
                                   └─ 檢查格式／大小／角色 → R2 put → 回傳 FileRef { id: key, name, size, mime }
提交作業 / 新增教材 / 發布文章 ──► 引用 FileRef.id（伺服器檢查 key 必須是本人或同組組員上傳的）
讀取 ──► GET /api/files/{key}[?download=1]   登入＋權限檢查，inline 預覽或 attachment 下載
限時連結 ──► POST /api/files/link { key } → /api/files/{key}?exp=…&sig=…（15 分鐘 HMAC，可貼 LINE）
```

| 用途 `purpose` | 上限 | 格式 | 誰可上傳 |
| --- | --- | --- | --- |
| assignment | 50 MB | pdf, doc(x), ppt(x), xls(x), 圖片, mp3/m4a/mp4, txt | 所有成員 |
| material | 100 MB | 同上＋wav | 老師／助教／管理員 |
| form | 20 MB | pdf, 圖片 | 所有成員 |
| article | 10 MB | 圖片 | 所有成員 |

讀取權限（`lib/server/files.ts` canRead）：老師／助教／管理員全部；自己上傳的；教材與作業說明附件（`uploads/material/`）所有成員；作業附件限提交者本人或同組現任組員；文章圖片所有成員。

限時連結需要 `FILE_LINK_SECRET`；未設定時仍可用登入＋權限方式讀取，只是不能產生可分享的連結。

Cloudflare 免費方案單一請求上限 100 MB，教材上限因此設為 100 MB。

## 2. LINE 推播（Messaging API）

### 設定步驟

1. 在 LINE Developers 建立 Provider → Messaging API channel（會得到一個官方帳號）。
2. 取得 **Channel access token（long-lived）** 與 **Channel secret**，填入 Sites 環境變數 `LINE_CHANNEL_ACCESS_TOKEN`、`LINE_CHANNEL_SECRET`。
3. Webhook URL 設為 `https://<你的網站>/api/line/webhook`，啟用 Use webhook；關閉「自動回應訊息」。
4. 把官方帳號加入 LINE 群組（需在設定允許加入群組）。加入時 webhook 會自動回覆「群組 ID：Cxxxx」，填到 `LINE_GROUP_ID`。
5. 成員到「我的 → LINE 通知」產生 6 碼代碼，加官方帳號好友後把代碼傳給它，即完成個人綁定。

### 誰收到什麼

| 事件 | 群組（`LINE_GROUP_ID`） | 個人（已綁定者） |
| --- | --- | --- |
| 新教材、新表單、新作業、新文章 | ✔ 一則公告＋連結 | |
| 老師回覆表單、作業批改、要求重交 | | ✔ |
| 小組作業被組員提交 | | ✔ 全組 |
| 截止前 3 天／1 天提醒 | ✔ 「目前 a/b 完成」 | ✔ 尚未完成者 |
| 老師手動「提醒未填寫／未繳交」 | ✔ | ✔ 尚未完成者 |

免費方案每月 200 則推播；群組一則只算一則，個人推播依人數計。15 人規模下每月約 60～120 則。

### 截止提醒的排程

Sites 不支援背景服務，採惰性排程：任何人載入 `/api/state` 時，若距上次檢查超過 1 小時就執行 `runDueReminders()`。每個表單／作業在截止前 3 天與 1 天各提醒一次，已送出的記錄在 `app_settings`（key `reminder:{type}:{id}:{d3|d1}`）。若整整一天都沒人開網站，提醒會延後到下一個人開啟時送出；老師也可在後台手動送。

### Webhook 安全

以 `X-Line-Signature`（HMAC-SHA256，channel secret）驗簽，簽章不符回 403。只處理三種事件：`join`（回覆群組 ID）、`follow`（回覆綁定說明）、文字訊息為 6 碼代碼（完成綁定）。

## 3. 課程與表單編輯

- `POST /api/courses`、`PUT /api/courses/:id`：老師／助教／管理員可新增、修改課程（單元、名稱、說明、時間、地點、狀態）。
- `PUT /api/forms/:id`：修改表單設定；若尚無人作答可自由增刪題目，已有人作答時只能改題目文字、選項、必填與順序（避免既有回答失去對應）。後台表單頁右上「編輯」。

## 4. 已驗證（本機）

- 上傳 → 本人 200、其他學員 403、未登入 401、老師 200（透過作業附件關聯）。
- 簽章連結有效 200，竄改 sig → 401。
- 另一學員引用他人上傳的 key 提交 → 403。
- LINE webhook：正確簽章＋綁定代碼 → `lineBound: true`；錯誤簽章 → 403。
- 老師手動提醒 → 9 位未完成者收到站內通知；學員呼叫 → 403。
- 課程新增與修改；表單已有作答時新增題目 → 400，只改設定 → 成功。

## 5. 尚未做（第四階段）

- ExcelJS 產生含圖表的 `.xlsx`（目前 8 個 CSV）。
- 統計資料改由 API 彙整（目前前端由快照計算，15 人規模足夠）。
