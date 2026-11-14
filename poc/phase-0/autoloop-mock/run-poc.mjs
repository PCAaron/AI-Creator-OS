#!/usr/bin/env node
/**
 * P0-02 Autoloop Mock POC — 在 AGENT_AUTOLOOP_HOME 沙盒上跑集成场景。
 * 用法：node run-poc.mjs [--slow-retry]
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Worker } from "node:worker_threads";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { closeBusinessDb, openBusinessDb } from "./lib/business-store.mjs";
import { safeFileToken } from "./lib/paths.mjs";
import {
  DEFAULT_HOME,
  WORKSPACE,
  acquirePocLock,
  backupRules,
  mergePocRules,
  postEvent,
  readBusinessStore,
  releasePocLock,
  resetWorkspace,
  restoreRules,
  runCli,
  runCliJson,
  until,
} from "./lib/poc-env.mjs";

const slowRetry = process.argv.includes("--slow-retry");
const testRunId = `phase0-${randomUUID()}`;
let testStartedAt = 0;
const results = [];
let assertionCount = 0;

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function expect(condition, message) {
  assertionCount += 1;
  assert.ok(condition, message);
}

function runTouchesEvent(run, eventId) {
  return (run.events ?? []).some((e) => e.subject === eventId || String(e.summary ?? "").includes(eventId));
}

function listPhase0Runs() {
  const state = runCliJson(["status"]);
  const live = (state.runs ?? []).filter((r) => r.rule === "phase0-mock-topic");
  const runs = runCliJson(["runs", "phase0-mock-topic"]);
  const historical = runs.runs ?? runs ?? [];
  const byId = new Map();
  for (const r of [...live, ...historical]) byId.set(r.id ?? r.run, r);
  return [...byId.values()];
}

function runsForEvent(eventId) {
  return listPhase0Runs().filter((r) => runTouchesEvent(r, eventId));
}

async function waitRunFor(eventId) {
  return until(
    () => {
      const hit = runsForEvent(eventId).find((r) => ["done", "retrying", "running", "queued"].includes(r.state));
      return hit ?? null;
    },
    { ms: 120_000 },
  );
}

async function waitOpenAskCardForRun(run) {
  const finishedMs = Date.parse(run.finishedAt);
  return until(() => {
    const state = runCliJson(["status"]);
    const card = (state.cards ?? [])
      .filter(
        (c) => c.kind === "ask" && c.state === "open" && c.rule === "phase0-mock-topic" && Date.parse(c.createdAt) >= finishedMs - 1500,
      )
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
    return card ?? null;
  });
}

async function quarantineStaleBlockingRuns() {
  const busy = listPhase0Runs().filter((r) => ["running", "queued", "retrying"].includes(r.state));
  for (const r of busy) {
    const id = r.id ?? r.run;
    if (id) runCli(["stop", String(id)]);
    await new Promise((res) => setTimeout(res, 400));
  }
}

async function settlePhase0MockLane({ ms = 360_000 } = {}) {
  await until(
    () => {
      const s = runCliJson(["status"]);
      const busy = listPhase0Runs().some((r) => ["running", "queued", "retrying"].includes(r.state));
      return !busy && (s.totals?.queued ?? 0) === 0 && (s.totals?.retrying ?? 0) === 0;
    },
    { ms, step: 2000 },
  );
}

async function drainStalePhase0AskCards() {
  for (let round = 0; round < 12; round++) {
    const state = runCliJson(["status"]);
    const open = (state.cards ?? []).filter((c) => c.kind === "ask" && c.state === "open" && c.rule === "phase0-mock-topic");
    if (!open.length) return;
    for (const c of open) runCli(["answer", String(c.id), "2"]);
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("无法清空历史 phase0-mock-topic 审批卡片（仍有 open ask）。请先处理 Hub 卡片或单独清理沙盒。");
}

async function waitRetryingFor(eventId) {
  await until(() => {
    const s = runCliJson(["status"]);
    const mine = runsForEvent(eventId);
    return mine.some(
      (r) =>
        r.state === "retrying" ||
        (r.attempts >= 1 && r.error && ["queued", "retrying"].includes(r.state)),
    ) || (s.totals?.retrying > 0 && mine.length > 0);
  }, { ms: 45_000 });
}

async function waitRunDoneFor(eventId, summaryIncludes, { ms = 360_000 } = {}) {
  await until(() => {
    const mine = runsForEvent(eventId);
    return mine.some((r) => r.state === "done" && (!summaryIncludes || String(r.summary).includes(summaryIncludes)));
  }, { ms, step: 2000 });
}

async function main() {
  acquirePocLock();
  console.log(`testRunId=${testRunId}`);
  console.log(`AGENT_AUTOLOOP_HOME=${DEFAULT_HOME}`);
  console.log(`mode=${slowRetry ? "slow-retry" : "default"}`);
  resetWorkspace();
  backupRules();
  try {
    await mergePocRules();
    runCli(["resume", "phase0-mock-topic"]);
    await drainStalePhase0AskCards();
    quarantineStaleBlockingRuns();
    await settlePhase0MockLane({ ms: 90_000 });
    testStartedAt = Date.now();

  // 1) 审批流 + testRunId 关联
  const id1 = `topic-${testRunId}`;
  const emit = runCli([
    "emit",
    "creator.topic.approval",
    "--id",
    id1,
    "--subject",
    id1,
    "--summary",
    `${testRunId} topic-approval`,
  ]);
  record("emit 选题事件", emit.status === 0, emit.stderr?.trim() || emit.stdout?.trim());
  const run1 = await waitRunFor(id1);
  const card = run1 ? await waitOpenAskCardForRun(run1) : null;
  expect(card, "应出现与本 eventId 关联的审批卡片");
  record("审批卡片关联 eventId", Boolean(card));
  const ans = runCli(["answer", String(card.id), "1"]);
  record("人工 answer 后继续", ans.status === 0);
  await until(() => readBusinessStore().some((r) => r.eventId === id1 && r.action === "draft-created"));
  record("业务落库可追溯", readBusinessStore().some((r) => r.eventId === id1 && r.action === "draft-created"));

  const mineRuns = runsForEvent(id1);
  record("runs 仅匹配本轮 event", mineRuns.length >= 1, `count=${mineRuns.length}`);
  const runId = mineRuns[0]?.run ?? mineRuns[0]?.id;
  if (runId) {
    const why = runCli(["why", String(runId)]);
    record("why 时间线", why.status === 0);
  }

  await settlePhase0MockLane({ ms: 180_000 });

  // 1b) 审批拒绝 — 不得创建初稿
  const idReject = `reject-${testRunId}`;
  runCli(["emit", "creator.topic.approval", "--id", idReject, "--subject", idReject, "--summary", `${testRunId} reject`]);
  const runReject = await waitRunFor(idReject);
  const cardReject = runReject ? await waitOpenAskCardForRun(runReject) : null;
  expect(cardReject, "拒绝场景应有卡片");
  runCli(["answer", String(cardReject.id), "2"]);
  await new Promise((r) => setTimeout(r, 4000));
  const rejectDrafts = readBusinessStore().filter((r) => r.eventId === idReject && r.action === "draft-created");
  record("审批拒绝无初稿", rejectDrafts.length === 0, `drafts=${rejectDrafts.length}`);

  await settlePhase0MockLane({ ms: 180_000 });

  // 1c) 跨任务隔离 — 两个并行 event 各有 pending 文件
  const idA = `iso-a-${testRunId}`;
  const idB = `iso-b-${testRunId}`;
  runCli(["emit", "creator.topic.approval", "--id", idA, "--subject", idA, "--summary", `${testRunId} iso-a`]);
  runCli(["emit", "creator.topic.approval", "--id", idB, "--subject", idB, "--summary", `${testRunId} iso-b`]);
  await waitRunFor(idA);
  await waitRunFor(idB);
  const pendingA = join(WORKSPACE, ".mock-state", `pending-${safeFileToken(idA)}.json`);
  const pendingB = join(WORKSPACE, ".mock-state", `pending-${safeFileToken(idB)}.json`);
  record("审批状态按 eventId 隔离", existsSync(pendingA) && existsSync(pendingB));

  await settlePhase0MockLane({ ms: 180_000 });

  // 2) 重复事件 — 协议去重 + 业务幂等
  const idDedup = `dedup-${testRunId}`;
  const body = { id: idDedup, type: "creator.topic.dedup-storm", subject: idDedup, summary: `${testRunId} dedup` };
  const first = await postEvent(body);
  const second = await postEvent(body);
  record("重复事件 duplicate=true", second.duplicate === true, `first=${first.duplicate} second=${second.duplicate}`);
  await until(() => readBusinessStore().filter((r) => r.eventId === idDedup).length === 1, { ms: 90_000 });
  record("业务幂等仅一条 draft", readBusinessStore().filter((r) => r.eventId === idDedup).length === 1);

  // 2b) 并行重复写入 SQLite
  closeBusinessDb();
  const parallelId = `parallel-${testRunId}`;
  const script = fileURLToPath(new URL("./lib/parallel-idempotent-worker.mjs", import.meta.url));
  await Promise.all(
    [0, 1, 2, 3].map(
      () =>
        new Promise((resolve, reject) => {
          const w = new Worker(script, { workerData: { cwd: WORKSPACE, eventId: parallelId } });
          w.on("error", reject);
          w.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`worker exit ${code}`))));
        }),
    ),
  );
  closeBusinessDb();
  const parallelCount = readBusinessStore().filter((r) => r.eventId === parallelId && r.action === "draft-created").length;
  record("并行幂等仅一条", parallelCount === 1, `count=${parallelCount}`);

  await settlePhase0MockLane({ ms: 180_000 });

  // 3) 失败重试（放在审批/幂等之后，避免 5min 退避占满 worker）
  const idFail = `fail-${testRunId}`;
  runCli(["emit", "creator.topic.fail-once", "--id", idFail, "--subject", idFail, "--summary", `${testRunId} retry`]);
  await waitRetryingFor(idFail);
  const retryRun = runsForEvent(idFail).find(
    (r) => r.state === "retrying" || (r.attempts >= 1 && r.error),
  );
  record("失败后进入 retrying", Boolean(retryRun), retryRun ? `state=${retryRun.state} attempts=${retryRun.attempts}` : "无匹配 run");
  if (slowRetry) {
    await waitRunDoneFor(idFail, "重试后", { ms: 360_000 });
    const okBiz = readBusinessStore().some((r) => r.eventId === idFail && r.action === "retry-succeeded");
    record("慢速：重试后完成", okBiz);
  }

  // 4) 暂停 / 恢复
  const pause = runCli(["pause", "phase0-mock-topic", "--reason", `phase0-test-${testRunId}`]);
  record("pause 规则", pause.status === 0);
  const idPause = `pause-${testRunId}`;
  runCli(["emit", "creator.topic.pause-skip", "--id", idPause, "--subject", idPause, "--summary", `${testRunId} pause`]);
  await new Promise((r) => setTimeout(r, 3000));
  const pausedHits = readBusinessStore().filter((r) => r.action === "pause-marker" && r.eventId === idPause);
  record("暂停期间无业务副作用", pausedHits.length === 0, `markers=${pausedHits.length}`);
  runCli(["resume", "phase0-mock-topic"]);

    const failed = results.filter((r) => !r.ok);
    console.log("\n--- 汇总 ---");
    console.log(
      JSON.stringify(
        { testRunId, mode: slowRetry ? "slow-retry" : "default", assertions: assertionCount, results, exitCode: failed.length ? 1 : 0 },
        null,
        2,
      ),
    );
    process.exitCode = failed.length ? 1 : 0;
  } finally {
    restoreRules();
    releasePocLock();
  }
}

main().catch((err) => {
  console.error(err);
  try {
    restoreRules();
  } catch (e) {
    console.error(e);
  }
  releasePocLock();
  process.exit(1);
});