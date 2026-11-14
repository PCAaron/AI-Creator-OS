import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const POC_ROOT = path.resolve(__dirname, "..");
export const REPO_ROOT = path.resolve(POC_ROOT, "..", "..", "..");
export const WORKSPACE = path.join(POC_ROOT, "workspace");
export const DEFAULT_HOME = process.env.AGENT_AUTOLOOP_HOME ?? path.join(process.env.USERPROFILE, ".agent-autoloop-phase0");

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

export function backupRules(home = DEFAULT_HOME) {
  const rulesPath = path.join(home, "rules.json");
  const backup = path.join(home, "rules.json.phase0-backup");
  if (!existsSync(rulesPath)) throw new Error(`缺少 ${rulesPath}`);
  copyFileSync(rulesPath, backup);
  return { rulesPath, backup };
}

export function restoreRules(home = DEFAULT_HOME) {
  const backup = path.join(home, "rules.json.phase0-backup");
  const rulesPath = path.join(home, "rules.json");
  if (existsSync(backup)) copyFileSync(backup, rulesPath);
}

export function mergePocRules(home = DEFAULT_HOME) {
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

  writeFileSync(rulesPath, JSON.stringify(rules, null, 2), "utf8");
  const check = runCli(["check", rulesPath], { home });
  if (check.status !== 0) throw new Error(`rules check 失败: ${check.stderr}`);
  return rules;
}

export function resetWorkspace() {
  mkdirSync(WORKSPACE, { recursive: true });
  const store = path.join(WORKSPACE, "business-store.jsonl");
  const state = path.join(WORKSPACE, ".mock-state");
  if (existsSync(store)) rmSync(store);
  if (existsSync(state)) rmSync(state, { recursive: true, force: true });
}

export function readBusinessStore() {
  const store = path.join(WORKSPACE, "business-store.jsonl");
  if (!existsSync(store)) return [];
  return readFileSync(store, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}