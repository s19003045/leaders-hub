declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    /** 第一位管理員的 ChatGPT 登入 Email（首次登入時自動建立 admin） */
    INITIAL_ADMIN_EMAIL?: string;
    /** "1" 時啟用示範身分登入（只用於本機或示範站） */
    DEMO_LOGIN?: string;
    /** "1" 時資料庫為空會自動寫入示範資料，並允許重設 */
    SEED_DEMO_DATA?: string;
  }
}
