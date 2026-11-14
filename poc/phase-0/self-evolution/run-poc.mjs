#!/usr/bin/env node
/** P0-05 自进化 Mock POC — 不依赖 Hermes；评测为确定性 Mock。 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  WRITER_SKILL_ID,
  approveProposal,
  attachEvaluation,
  collectFeedback,
  createProposal,
  evaluateCandidate,
  reflect,
  rejectProposal,
  rollbackSkill,
  runHappyPath,
  seedWriterV1,
  writerSkillV10Regression,
  writerSkillV11Candidate,
} from "./lib/pipeline.mjs";
import { activeSkill, closeStore, getSkillVersion, saveEvidence } from "./lib/store.mjs";
import fixtures from "../fixtures/self-evolution-samples.json" with { type: "json" };

const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
}

const root = mkdtempSync(join(tmpdir(), "phase0-evolution-"));
try {
  // 有效改进闭环
  const happy = runHappyPath(root, fixtures);
  record("有效改进并激活", happy.active?.version === "1.1-candidate");
  assert.equal(getSkillVersion(root, WRITER_SKILL_ID, "1.0").status, "archived");

  // 退化拒绝
  const root2 = mkdtempSync(join(tmpdir(), "phase0-evolution-bad-"));
  try {
    seedWriterV1(root2);
    const fb = collectFeedback(fixtures.feedbackRegression);
    saveEvidence(root2, { id: fb.evidenceId, kind: "human_edit", payload: fb });
    const proposal = createProposal(root2, {
      baseVersion: "1.0",
      candidateBody: writerSkillV10Regression(),
      reflection: reflect(fb),
    });
    const evalBad = evaluateCandidate(root2, proposal.candidate_version, fixtures.holdoutGood);
    attachEvaluation(root2, proposal.id, evalBad);
    const p = rejectProposal(root2, proposal.id, "Mock 评测退化");
    record("退化候选被拒绝", p.approval_status === "rejected" && activeSkill(root2, WRITER_SKILL_ID)?.version === "1.0");
  } finally {
    closeStore();
    rmSync(root2, { recursive: true, force: true });
  }

  // 未批准不能激活
  const root3 = mkdtempSync(join(tmpdir(), "phase0-evolution-pend-"));
  try {
    seedWriterV1(root3);
    const fb = collectFeedback(fixtures.feedback);
    saveEvidence(root3, { id: fb.evidenceId, kind: "human_edit", payload: fb });
    const proposal = createProposal(root3, {
      baseVersion: "1.0",
      candidateBody: writerSkillV11Candidate(),
      reflection: reflect(fb),
    });
    attachEvaluation(root3, proposal.id, evaluateCandidate(root3, proposal.candidate_version, fixtures.holdoutGood));
    record("未批准保持 v1.0 激活", activeSkill(root3, WRITER_SKILL_ID)?.version === "1.0");
    assert.throws(() => approveProposal(root3, "prop-nonexistent"), /proposal/);
  } finally {
    closeStore();
    rmSync(root3, { recursive: true, force: true });
  }

  // 错误证据
  const root4 = mkdtempSync(join(tmpdir(), "phase0-evolution-ev-"));
  try {
    seedWriterV1(root4);
    const proposal = createProposal(root4, {
      baseVersion: "1.0",
      candidateBody: writerSkillV11Candidate(),
      reflection: { evidence_ids: ["ev-missing"], proposed_changes: [] },
    });
    attachEvaluation(root4, proposal.id, evaluateCandidate(root4, proposal.candidate_version, fixtures.holdoutGood));
    let blocked = false;
    try {
      approveProposal(root4, proposal.id);
    } catch (e) {
      blocked = /错误证据/.test(String(e.message));
    }
    record("错误证据阻断批准", blocked);
  } finally {
    closeStore();
    rmSync(root4, { recursive: true, force: true });
  }

  // 重复批准 + 回滚
  const root5 = mkdtempSync(join(tmpdir(), "phase0-evolution-rollback-"));
  try {
    const path = runHappyPath(root5, fixtures);
    const dup = approveProposal(root5, path.proposal.id);
    record("重复批准幂等", dup.duplicate === true);
    rollbackSkill(root5, WRITER_SKILL_ID, "1.0");
    record("回滚到 v1.0", activeSkill(root5, WRITER_SKILL_ID)?.version === "1.0");
  } finally {
    closeStore();
    rmSync(root5, { recursive: true, force: true });
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n--- 汇总 ---");
  console.log(JSON.stringify({ assertions: results.length, results, exitCode: failed.length ? 1 : 0 }, null, 2));
  process.exitCode = failed.length ? 1 : 0;
} finally {
  closeStore();
  rmSync(root, { recursive: true, force: true });
}