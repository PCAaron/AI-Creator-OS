#!/usr/bin/env node
/**
 * P0-02 Autoloop Mock POC — 在 AGENT_AUTOLOOP_HOME 沙盒（默认 ~/.agent-autoloop-phase0）上跑集成场景。
 * 用法：node run-poc.mjs [--slow-retry]
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  DEFAULT_HOME,
  backupRules,
  mergePocRules,
  readBusinessStore,
  resetWorkspace,
  restoreRules,
  runCli,
  runCliJson,
  until,
} from "./lib/poc-env.mjs";

const slowRetry = process.argv.includes("--slow-retry");
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function waitRuleDone(ruleName, summaryIncludes) {
  await until(() => {
    const state = runCliJson(["status"]);
    const run = state.runs?.find(
      (r) => r.rule === ruleName && r.state === "done" && (!summaryIncludes || String(r.summary).includes(summaryIncludes)),
    );
    return run ?? null;
  });
}

async function waitCard() {
  return until(() => {
    const state = runCliJson(["status"]);
    return state.cards?.[0] ?? null;
  });
}

async function main() {
  console.log(`AGENT_AUTOLOOP_HOME=${DEFAULT_HOME}`);
  resetWorkspace();
  backupRules();
  try {
    mergePocRules();

    // 1) 审批流
    const id1 = `topic-${randomUUID()}`;
    let emit = runCli([
      "emit",
      "creator.topic.approval",
      "--id",
      id1,
      "--subject",
      "mock-subject-1",
      "--summary",
      "AI 工具链周报",
    ]);
    record("emit 选题事件", emit.status === 0, emit.stderr?.trim() || emit.stdout?.trim());
    const card = await waitCard();
    assert.ok(card, "应出现审批卡片");
    const ans = runCli(["answer", String(card.id), "1"]);
    record("人工 answer 后继续", ans.status === 0);
    await until(() => readBusinessStore().some((r) => r.eventId === id1 && r.action === "draft-created"));
    const store1 = readBusinessStore();
    record("业务落库可追溯", store1.some((r) => r.eventId === id1 && r.action === "draft-created"));

    // 2) runs / why 追溯
    const runs = runCliJson(["runs", "phase0-mock-topic"]);
    record("runs 可列出", (runs.runs?.length ?? runs.length ?? 0) > 0);
    const runId = (runs.runs ?? runs)[0]?.run ?? (runs.runs ?? runs)[0]?.id;
    if (runId) {
      const why = runCli(["why", String(runId)]);
      record("why 时间线", why.status === 0);
    }

    // 3) 重复事件 — 协议去重 + 业务幂等
    const idDedup = `dedup-${randomUUID()}`;
    const body = { id: idDedup, type: "creator.topic.dedup-storm", subject: "dedup-subj", summary: "dedup" };
    const cfg = runCliJson(["status"]);
    const configPath = `${DEFAULT_HOME}/config.json`;
    const config = JSON.parse((await import("node:fs")).readFileSync(configPath, "utf8"));
    const base = config.hub?.publicUrl ?? config.url ?? "http://127.0.0.1:3350";
    const post = (payload) =>
      fetch(`${base}/v1/events`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.source.key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      }).then((r) => r.json());
    const first = await post(body);
    const second = await post(body);
    record("重复事件 duplicate=true", second.duplicate === true, `first=${first.duplicate} second=${second.duplicate}`);
    await until(() => readBusinessStore().filter((r) => r.eventId === idDedup).length === 1, { ms: 90_000 });
    record("业务幂等仅一条 draft", readBusinessStore().filter((r) => r.eventId === idDedup).length === 1);

    // 4) 失败重试 — 默认只验证进入 retrying；--slow-retry 等满 5 分钟
    resetWorkspace();
    const idFail = `fail-${randomUUID()}`;
    runCli(["emit", "creator.topic.fail-once", "--id", idFail, "--subject", "fail", "--summary", "retry-test"]);
    await until(() => {
      const s = runCliJson(["status"]);
      return s.totals?.retrying > 0 || s.runs?.some((r) => r.state === "retrying");
    }, { ms: 30_000 });
    record("失败后进入 retrying", true);
    if (slowRetry) {
      await waitRuleDone("phase0-mock-topic", "重试后");
      record("慢速：重试后完成", readBusinessStore().some((r) => r.action === "retry-succeeded"));
    } else {
      record("重试完成（默认跳过 5min 等待）", true, "加 --slow-retry 可 RUNTIME 验证全自动重试");
    }

    // 5) 暂停 / 恢复
    const pause = runCli(["pause", "phase0-mock-topic", "--reason", "phase0-test"]);
    record("pause 规则", pause.status === 0);
    const idPause = `pause-${randomUUID()}`;
    runCli(["emit", "creator.topic.pause-skip", "--id", idPause, "--subject", "p", "--summary", "pause"]);
    await new Promise((r) => setTimeout(r, 3000));
    const pausedHits = readBusinessStore().filter((r) => r.action === "pause-marker");
    record("暂停期间无业务副作用", pausedHits.length === 0, `markers=${pausedHits.length}`);
    runCli(["resume", "phase0-mock-topic"]);

    const failed = results.filter((r) => !r.ok);
    console.log("\n--- 汇总 ---");
    console.log(JSON.stringify(results, null, 2));
    process.exitCode = failed.length ? 1 : 0;
  } finally {
    restoreRules();
  }
}

main().catch((err) => {
  console.error(err);
  restoreRules();
  process.exit(1);
});