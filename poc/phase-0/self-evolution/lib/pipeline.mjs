import { randomUUID } from "node:crypto";
import {
  activeSkill,
  getEvidence,
  getProposal,
  getSkillVersion,
  putSkillVersion,
  saveEvidence,
  saveProposal,
} from "./store.mjs";

export const WRITER_SKILL_ID = "writer-mock";

export function writerSkillV1() {
  return {
    version: "1.0",
    rules: [
      { id: "opening", text: "以第二人称开场" },
      { id: "length", text: "段落不超过两句" },
    ],
    render(draft) {
      return draft.replace(/^我/g, "你");
    },
  };
}

export function writerSkillV11Candidate() {
  return {
    version: "1.1-candidate",
    rules: [
      { id: "opening", text: "以第二人称开场" },
      { id: "length", text: "段落不超过两句" },
      { id: "cta", text: "结尾附一句 Mock 行动号召（非真实转化承诺）" },
    ],
    render(draft) {
      let out = draft.replace(/^我/g, "你");
      if (!out.includes("【Mock CTA】")) out += "\n【Mock CTA】";
      return out;
    },
  };
}

export function writerSkillV10Regression() {
  return {
    version: "1.1-bad-candidate",
    rules: [{ id: "opening", text: "必须全文大写（Mock 退化）" }],
    render(draft) {
      return draft.toUpperCase();
    },
  };
}

export function skillRuntime(version) {
  if (version === "1.0") return writerSkillV1();
  if (version === "1.1-candidate") return writerSkillV11Candidate();
  if (version === "1.1-bad-candidate") return writerSkillV10Regression();
  throw new Error(`未知 skill 版本 ${version}`);
}

export function seedWriterV1(root) {
  const body = writerSkillV1();
  putSkillVersion(root, { skill_id: WRITER_SKILL_ID, version: "1.0", status: "active", body });
  return body;
}

export function collectFeedback({ aiDraft, humanEdit, reason }) {
  const evidenceId = `ev-${randomUUID()}`;
  return {
    evidenceId,
    aiDraft,
    humanEdit,
    reason,
    diff: diffLines(aiDraft, humanEdit),
  };
}

function diffLines(a, b) {
  const left = a.split("\n");
  const right = b.split("\n");
  const out = [];
  const n = Math.max(left.length, right.length);
  for (let i = 0; i < n; i++) {
    const L = left[i] ?? "";
    const R = right[i] ?? "";
    if (L !== R) out.push({ line: i + 1, from: L, to: R });
  }
  return out;
}

export function reflect(feedback) {
  const wantsCta = feedback.diff.some((d) => d.to.includes("【Mock CTA】")) || /行动号召|结尾/i.test(feedback.reason);
  const evidence_ids = [feedback.evidenceId];
  const proposed_changes = wantsCta
    ? [{ rule_id: "cta", change: "结尾附一句 Mock 行动号召（非真实转化承诺）", evidence_ids }]
    : [{ rule_id: "opening", change: "保持第二人称", evidence_ids }];
  return { evidence_ids, proposed_changes };
}

export function createProposal(root, { baseVersion, candidateBody, reflection }) {
  const id = `prop-${randomUUID()}`;
  const proposal = {
    id,
    skill_id: WRITER_SKILL_ID,
    base_version: baseVersion,
    candidate_version: candidateBody.version,
    evidence_ids: reflection.evidence_ids,
    proposed_changes: reflection.proposed_changes,
    evaluation_results: null,
    approval_status: "pending",
    rollback_version: baseVersion,
    at: new Date().toISOString(),
  };
  putSkillVersion(root, {
    skill_id: WRITER_SKILL_ID,
    version: candidateBody.version,
    status: "candidate",
    body: candidateBody,
    parent_version: baseVersion,
  });
  saveProposal(root, proposal);
  return proposal;
}

/** 确定性 Mock 评测：非真实写作能力结论。 */
export function evaluateCandidate(root, candidateVersion, holdout) {
  const cand = getSkillVersion(root, WRITER_SKILL_ID, candidateVersion);
  if (!cand) throw new Error(`缺少候选版本 ${candidateVersion}`);
  const body = skillRuntime(candidateVersion);
  let pass = 0;
  for (const sample of holdout) {
    const out = body.render(sample.input);
    const ok = sample.expect.every((needle) => out.includes(needle));
    if (ok) pass += 1;
  }
  const score = pass / holdout.length;
  return {
    metric: "mock_holdout_match_rate",
    score,
    passed: score >= 0.8,
    disclaimer: "此为确定性 Mock 评测，不代表真实用户写作能力已提升。",
  };
}

export function attachEvaluation(root, proposalId, evaluation) {
  const p = getProposal(root, proposalId);
  if (!p) throw new Error("proposal 不存在");
  p.evaluation_results = evaluation;
  if (!evaluation.passed) p.approval_status = "rejected_auto";
  saveProposal(root, p);
  return p;
}

export function approveProposal(root, proposalId, { approver = "mock-human" } = {}) {
  const p = getProposal(root, proposalId);
  if (!p) throw new Error("proposal 不存在");
  if (p.approval_status === "approved") {
    return { duplicate: true, proposal: p };
  }
  if (!p.evaluation_results?.passed) throw new Error("评测未通过，不得批准");
  for (const ev of p.evidence_ids) {
    if (!getEvidence(root, ev)) throw new Error(`错误证据：${ev}`);
  }
  const active = activeSkill(root, WRITER_SKILL_ID);
  if (active) {
    putSkillVersion(root, {
      skill_id: WRITER_SKILL_ID,
      version: active.version,
      status: "archived",
      body: active.body,
      parent_version: active.parent_version,
    });
  }
  const cand = getSkillVersion(root, WRITER_SKILL_ID, p.candidate_version);
  putSkillVersion(root, {
    skill_id: WRITER_SKILL_ID,
    version: p.candidate_version,
    status: "active",
    body: cand.body,
    parent_version: p.base_version,
  });
  p.approval_status = "approved";
  p.approved_by = approver;
  saveProposal(root, p);
  return { duplicate: false, proposal: p };
}

export function rejectProposal(root, proposalId, reason) {
  const p = getProposal(root, proposalId);
  if (!p) throw new Error("proposal 不存在");
  p.approval_status = "rejected";
  p.rejected_reason = reason;
  saveProposal(root, p);
  putSkillVersion(root, {
    skill_id: WRITER_SKILL_ID,
    version: p.candidate_version,
    status: "rejected",
    body: getSkillVersion(root, WRITER_SKILL_ID, p.candidate_version).body,
    parent_version: p.base_version,
  });
  return p;
}

export function rollbackSkill(root, skill_id, toVersion) {
  const target = getSkillVersion(root, skill_id, toVersion);
  if (!target) throw new Error("回滚目标不存在");
  const active = activeSkill(root, skill_id);
  if (active && active.version !== toVersion) {
    putSkillVersion(root, { ...active, skill_id, status: "archived", body: active.body });
  }
  putSkillVersion(root, { skill_id, version: toVersion, status: "active", body: target.body, parent_version: target.parent_version });
  return activeSkill(root, skill_id);
}

export function runHappyPath(root, fixtures) {
  seedWriterV1(root);
  const fb = collectFeedback(fixtures.feedback);
  saveEvidence(root, { id: fb.evidenceId, kind: "human_edit", payload: fb });
  const reflection = reflect(fb);
  const proposal = createProposal(root, {
    baseVersion: "1.0",
    candidateBody: writerSkillV11Candidate(),
    reflection,
  });
  const evalResult = evaluateCandidate(root, proposal.candidate_version, fixtures.holdoutGood);
  attachEvaluation(root, proposal.id, evalResult);
  const approved = approveProposal(root, proposal.id);
  return { proposal, approved, active: activeSkill(root, WRITER_SKILL_ID) };
}