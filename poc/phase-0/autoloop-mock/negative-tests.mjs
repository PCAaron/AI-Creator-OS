#!/usr/bin/env node
/** 安全/负面：Mock Agent 单元（不连接中台） */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const agent = fileURLToPath(new URL("./mock-agent.mjs", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "phase0-mock-"));

function runAgent(context, cwd = dir) {
  mkdirSync(cwd, { recursive: true });
  const ctxPath = join(cwd, "context.json");
  writeFileSync(ctxPath, JSON.stringify(context), "utf8");
  return spawnSync(process.execPath, [agent], {
    env: { ...process.env, AGENT_AUTOLOOP_CONTEXT: ctxPath },
    cwd,
    encoding: "utf8",
  });
}

try {
  const outside = "C:\\Windows\\System32\\drivers\\etc\\hosts";
  const r1 = runAgent({
    events: [
      {
        id: "s1",
        type: "creator.topic.sensitive-read",
        subject: "x",
        summary: "",
        detail: outside,
      },
    ],
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
} finally {
  rmSync(dir, { recursive: true, force: true });
}