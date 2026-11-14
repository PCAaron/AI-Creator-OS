/**
 * 业务幂等存储：SQLite UNIQUE(eventId, action) + 事务。
 * 供 mock-agent 与集成测试共用（workspace/business.sqlite）。
 */
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS business (
  eventId TEXT NOT NULL,
  action TEXT NOT NULL,
  subject TEXT,
  payload TEXT,
  at TEXT NOT NULL,
  PRIMARY KEY (eventId, action)
);
`;

let dbCache;

export function dbPathFor(cwd) {
  return `${cwd.replace(/[/\\]$/, "")}/business.sqlite`;
}

export function openBusinessDb(cwd) {
  const dbPath = dbPathFor(cwd);
  mkdirSync(dirname(dbPath), { recursive: true });
  const key = dbPath;
  if (!dbCache || dbCache.path !== key) {
    if (dbCache) try {
      dbCache.close();
    } catch {}
    dbCache = new DatabaseSync(dbPath);
    dbCache.exec("PRAGMA busy_timeout = 10000");
    dbCache.exec("PRAGMA journal_mode = WAL");
    dbCache.exec(SCHEMA);
    dbCache.path = key;
  }
  return dbCache;
}

/**
 * @returns {{ inserted: boolean, row?: object }}
 */
export function insertBusiness(cwd, { eventId, action, subject = null, extra = {} }) {
  const db = openBusinessDb(cwd);
  const at = new Date().toISOString();
  const payload = JSON.stringify(extra);
  const insert = db.prepare(
    `INSERT OR IGNORE INTO business (eventId, action, subject, payload, at) VALUES (?, ?, ?, ?, ?)`,
  );
  const info = insert.run(eventId, action, subject, payload, at);
  if (info.changes === 0) return { inserted: false };
  return {
    inserted: true,
    row: { eventId, action, subject, ...extra, at },
  };
}

export function countBusiness(cwd, eventId, action) {
  const db = openBusinessDb(cwd);
  const row = db.prepare(`SELECT COUNT(*) AS n FROM business WHERE eventId = ? AND action = ?`).get(eventId, action);
  return row?.n ?? 0;
}

export function closeBusinessDb() {
  if (dbCache) {
    try {
      dbCache.close();
    } catch {}
    dbCache = undefined;
  }
}

export function listBusiness(cwd) {
  const db = openBusinessDb(cwd);
  return db
    .prepare(`SELECT eventId, action, subject, payload, at FROM business ORDER BY at ASC`)
    .all()
    .map((r) => ({
      eventId: r.eventId,
      action: r.action,
      subject: r.subject,
      at: r.at,
      ...(r.payload ? JSON.parse(r.payload) : {}),
    }));
}