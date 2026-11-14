import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, rmSync, openSync, closeSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeBusinessDb, listBusiness } from "./business-store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const POC_ROOT = path.resolve(__dirname, "..");
export const REPO_ROOT = path.resolve(POC_ROOT, "..", "..", "..");
export const WORKSPACE = path.join(POC_ROOT, "workspace");
export const DEFAULT_HOME = process.env.AGENT_AUTOLOOP_HOME ?? path.join(process.env.USERPROFILE, ".agent-autoloop-phase0");
export const LOCK_FILE = path.join(WORKSPACE, ".poc-run.lock");

let rulesDigestBefore;

export function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function cliBin(home = DEFAULT_HOME) {
  return path.join(home, "app", "bin", "agent-autoloop.cmd");
}

export function runCli(args, { home = DEFAULT_HOME, timeout = 120_000, input } = {}) {
  const env = { ...process.env, AGENT_AUTOLOOP_HOME: home };
  const bin = cliBin(home);
  const result = spawnSync("cmd.exe", ["/d", "/s", "/c", bin, ...args], {
    env,
    encoding: "utf8",
    timeout,
    windowsHide: true,
    input,
  });
  return result;
}

export function runCliJson(args, opts) {
  const result = runCli([...args, "--json"], opts);
  if (result.status !== 0) {
    throw new Error(`agent-autoloop ${args.join(" ")} 失败:\n${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout || "{}");
}

export async function until(check, { ms = 60_000, step = 250 } = {}) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await new Promise((r) => setTimeout(r, step));
  }
  throw new Error("等待超时");
}

export function acquirePocLock() {
  mkdirSync(WORKSPACE, { recursive: true });
  if (existsSync(LOCK_FILE)) {
    let stale = false;
    try {
      const pid = Number(readFileSync(LOCK_FILE, "utf8").trim());
      if (pid && !Number.isNaN(pid)) {
        const probe = spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/NH"], { encoding: "utf8", windowsHide: true });
        if (!probe.stdout?.includes(String(pid))) stale = true;
      } else stale = true;
    } catch {
      stale = true;
    }
    if (!stale) {
      throw new Error(`另一份 POC 正在运行（锁 ${LOCK_FILE}，pid 存活）。禁止并发执行。`);
    }
    unlinkSync(LOCK_FILE);
  }
  const fd = openSync(LOCK_FILE, "wx");
  writeFileSync(fd, `${process.pid}\n`, "utf8");
  closeSync(fd);
}

export function releasePocLock() {
  try {
    if (existsSync(LOCK_FILE)) unlinkSync(LOCK_FILE);
  } catch {}
}

export function backupRules(home = DEFAULT_HOME) {
  const rulesPath = path.join(home, "rules.json");
  const backup = path.join(home, "rules.json.phase0-backup");
  if (!existsSync(rulesPath)) throw new Error(`缺少 ${rulesPath}`);
  copyFileSync(rulesPath, backup);
  rulesDigestBefore = sha256File(rulesPath);
  return { rulesPath, backup, digest: rulesDigestBefore };
}

export function restoreRules(home = DEFAULT_HOME) {
  const backup = path.join(home, "rules.json.phase0-backup");
  const rulesPath = path.join(home, "rules.json");
  if (existsSync(backup)) writeFileWithRetry(rulesPath, readFileSync(backup, "utf8"));
  if (rulesDigestBefore && existsSync(rulesPath)) {
    const after = sha256File(rulesPath);
    if (after !== rulesDigestBefore) {
      throw new Error(`rules.json 恢复后哈希不一致：before=${rulesDigestBefore} after=${after}`);
    }
  }
}

function writeFileWithRetry(filePath, body, { tries = 12, pauseMs = 250 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      writeFileSync(filePath, body, "utf8");
      return;
    } catch (err) {
      last = err;
      if (!["EBUSY", "EPERM", "EACCES"].includes(err.code)) throw err;
      spawnSync("powershell.exe", ["-NoProfile", "-Command", `Start-Sleep -Milliseconds ${pauseMs}`], { windowsHide: true });
    }
  }
  throw last;
}

export async function mergePocRules(home = DEFAULT_HOME) {
  const rulesPath = path.join(home, "rules.json");
  const rules = JSON.parse(readFileSync(rulesPath, "utf8"));
  const fragment = JSON.parse(readFileSync(path.join(POC_ROOT, "rules.poc.fragment.json"), "utf8"));
  let worker = Object.values(rules.agents).find((a) => a.worker)?.worker;
  if (!worker && rules.rules?.[0]?.to) {
    worker = rules.agents[rules.rules[0].to]?.worker;
  }
  if (!worker) throw new Error("无法从现有 rules.json 解析 worker 名");

  const agent = { ...fragment.agents["phase0-mock"] };
  agent.worker = worker;
  agent.command = [process.execPath, path.join(POC_ROOT, "mock-agent.mjs")];
  rules.agents["phase0-mock"] = agent;

  const pocRule = { ...fragment.rules[0] };
  pocRule.cwd = WORKSPACE;
  const names = new Set(rules.rules.map((r) => r.name));
  if (!names.has(pocRule.name)) rules.rules.push(pocRule);

  writeFileWithRetry(rulesPath, JSON.stringify(rules, null, 2));
  await new Promise((r) => setTimeout(r, 400));
  const check = runCli(["check", rulesPath], { home });
  if (check.status !== 0) throw new Error(`rules check 失败: ${check.stderr}`);
  return rules;
}

export function resetWorkspace() {
  closeBusinessDb();
  mkdirSync(WORKSPACE, { recursive: true });
  const store = path.join(WORKSPACE, "business-store.jsonl");
  const sqlite = path.join(WORKSPACE, "business.sqlite");
  const state = path.join(WORKSPACE, ".mock-state");
  if (existsSync(store)) rmSync(store);
  if (existsSync(sqlite)) {
    try {
      rmSync(sqlite);
    } catch {
      rmSync(sqlite, { force: true });
    }
  }
  if (existsSync(state)) rmSync(state, { recursive: true, force: true });
}

export function readBusinessStore() {
  return listBusiness(WORKSPACE);
}

export async function postEvent(payload, home = DEFAULT_HOME) {
  const configPath = path.join(home, "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const base = config.hub?.publicUrl ?? config.url ?? "http://127.0.0.1:3350";
  const res = await fetch(`${base}/v1/events`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.source.key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return res.json();
}