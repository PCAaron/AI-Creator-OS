#!/usr/bin/env node
/** 安全/负面：Mock Agent 单元（不连接中台） */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { closeBusinessDb, listBusiness, openBusinessDb } from "./lib/business-store.mjs";
import { isPathInside, resolveInside, safeFileToken } from "./lib/paths.mjs";

const agent = fileURLToPath(new URL("./mock-agent.mjs", import.meta.url));
const parallelWorker = fileURLToPath(new URL("./lib/parallel-idempotent-worker.mjs", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "phase0-mock-"));

function runAgent(context, cwd = dir, { extraEnv = {} } = {}) {
  mkdirSync(cwd, { recursive: true });
  const ctxPath = join(cwd, "context.json");
  writeFileSync(ctxPath, JSON.stringify(context), "utf8");
  return spawnSync(process.execPath, [agent], {
    env: { ...process.env, AGENT_AUTOLOOP_CONTEXT: ctxPath, ...extraEnv },
    cwd,
    encoding: "utf8",
  });
}

try {
  const outside = "C:\\Windows\\System32\\drivers\\etc\\hosts";
  const r1 = runAgent({
    events: [{ id: "s1", type: "creator.topic.sensitive-read", subject: "x", summary: "", detail: outside }],
    answers: [],
  });
  assert.match(r1.stdout, /拒绝访问/);
  console.log("[PASS] 阻止访问 POC 外敏感路径");

  const r2 = runAgent(
    {
      events: [{ id: "e-dup", type: "creator.topic.approval", subject: "s", summary: "t" }],
      answers: [{ title: "是否撰写该选题？", chosen: "撰写模拟初稿", choice: 0, options: ["撰写模拟初稿", "跳过"] }],
    },
    dir,
  );
  assert.match(r2.stdout, /模拟初稿/);
  const r3 = runAgent(
    {
      events: [{ id: "e-dup", type: "creator.topic.approval", subject: "s", summary: "t" }],
      answers: [{ title: "是否撰写该选题？", chosen: "撰写模拟初稿", choice: 0, options: ["撰写模拟初稿", "跳过"] }],
    },
    dir,
  );
  assert.match(r3.stdout, /幂等/);
  console.log("[PASS] 审批后业务幂等");

  const reject = runAgent({
    events: [{ id: "e-reject", type: "creator.topic.approval", subject: "s", summary: "t" }],
    answers: [{ title: "是否撰写该选题？", chosen: "跳过", choice: 1, options: ["撰写模拟初稿", "跳过"] }],
  });
  assert.match(reject.stdout, /跳过/);
  assert.equal(listBusiness(dir).filter((r) => r.eventId === "e-reject" && r.action === "draft-created").length, 0);
  console.log("[PASS] 审批拒绝不创建初稿");

  const evilId = `..\\..\\evil-${safeFileToken("x")}`;
  const stateDir = join(dir, ".mock-state");
  mkdirSync(stateDir, { recursive: true });
  resolveInside(stateDir, `fail-once-${safeFileToken(evilId)}.failed`);
  const fail1 = runAgent({
    events: [{ id: evilId, type: "creator.topic.fail-once", subject: "s", summary: "" }],
    answers: [],
  });
  assert.equal(fail1.status, 1, "首次 fail-once 必须非零退出");
  const fail2 = runAgent({
    events: [{ id: evilId, type: "creator.topic.fail-once", subject: "s", summary: "" }],
    answers: [],
  });
  assert.equal(fail2.status, 0);
  console.log("[PASS] fail-once 首次失败退出码 1；eventId 文件名无路径穿越");

  assert.equal(isPathInside(join(dir, "nested"), dir), true);
  assert.equal(isPathInside("C:\\Windows", dir), false);
  console.log("[PASS] 目录边界判断");

  openBusinessDb(dir);
  await Promise.all(
    [0, 1, 2].map(
      () =>
        new Promise((resolve, reject) => {
          const w = new Worker(parallelWorker, { workerData: { cwd: dir, eventId: "unit-parallel" } });
          w.on("error", reject);
          w.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(code))));
        }),
    ),
  );
  assert.equal(listBusiness(dir).filter((r) => r.eventId === "unit-parallel").length, 1);
  console.log("[PASS] 并行重复写入幂等");
} finally {
  closeBusinessDb();
  rmSync(dir, { recursive: true, force: true });
}