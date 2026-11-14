import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS skill_versions (
  skill_id TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL,
  body TEXT NOT NULL,
  parent_version TEXT,
  at TEXT NOT NULL,
  PRIMARY KEY (skill_id, version)
);
CREATE TABLE IF NOT EXISTS evolution_proposals (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  base_version TEXT NOT NULL,
  candidate_version TEXT NOT NULL,
  evidence_ids TEXT NOT NULL,
  proposed_changes TEXT NOT NULL,
  evaluation_results TEXT,
  approval_status TEXT NOT NULL,
  rollback_version TEXT,
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  at TEXT NOT NULL
);
`;

let db;

export function openStore(root) {
  const path = join(root, "evolution.sqlite");
  mkdirSync(dirname(path), { recursive: true });
  if (!db || db.path !== path) {
    if (db) try {
      db.close();
    } catch {}
    db = new DatabaseSync(path);
    db.exec("PRAGMA busy_timeout = 8000");
    db.exec(SCHEMA);
    db.path = path;
  }
  return db;
}

export function closeStore() {
  if (db) {
    try {
      db.close();
    } catch {}
    db = undefined;
  }
}

export function putSkillVersion(root, { skill_id, version, status, body, parent_version = null }) {
  const d = openStore(root);
  d.prepare(
    `INSERT OR REPLACE INTO skill_versions (skill_id, version, status, body, parent_version, at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(skill_id, version, status, JSON.stringify(body), parent_version, new Date().toISOString());
}

export function getSkillVersion(root, skill_id, version) {
  const row = openStore(root)
    .prepare(`SELECT * FROM skill_versions WHERE skill_id = ? AND version = ?`)
    .get(skill_id, version);
  if (!row) return null;
  return { ...row, body: JSON.parse(row.body) };
}

export function activeSkill(root, skill_id) {
  const row = openStore(root)
    .prepare(`SELECT * FROM skill_versions WHERE skill_id = ? AND status = 'active' ORDER BY at DESC LIMIT 1`)
    .get(skill_id);
  if (!row) return null;
  return { ...row, body: JSON.parse(row.body) };
}

export function saveEvidence(root, { id, kind, payload }) {
  openStore(root)
    .prepare(`INSERT OR REPLACE INTO evidence (id, kind, payload, at) VALUES (?, ?, ?, ?)`)
    .run(id, kind, JSON.stringify(payload), new Date().toISOString());
}

export function getEvidence(root, id) {
  const row = openStore(root).prepare(`SELECT * FROM evidence WHERE id = ?`).get(id);
  if (!row) return null;
  return { ...row, payload: JSON.parse(row.payload) };
}

export function saveProposal(root, proposal) {
  openStore(root)
    .prepare(
      `INSERT OR REPLACE INTO evolution_proposals (id, skill_id, base_version, candidate_version, evidence_ids, proposed_changes, evaluation_results, approval_status, rollback_version, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      proposal.id,
      proposal.skill_id,
      proposal.base_version,
      proposal.candidate_version,
      JSON.stringify(proposal.evidence_ids),
      JSON.stringify(proposal.proposed_changes),
      proposal.evaluation_results ? JSON.stringify(proposal.evaluation_results) : null,
      proposal.approval_status,
      proposal.rollback_version ?? null,
      proposal.at ?? new Date().toISOString(),
    );
}

export function getProposal(root, id) {
  const row = openStore(root).prepare(`SELECT * FROM evolution_proposals WHERE id = ?`).get(id);
  if (!row) return null;
  return {
    ...row,
    evidence_ids: JSON.parse(row.evidence_ids),
    proposed_changes: JSON.parse(row.proposed_changes),
    evaluation_results: row.evaluation_results ? JSON.parse(row.evaluation_results) : null,
  };
}