/**
 * Phase 0 Mock Agent — runs under Autoloop `use: "command"`.
 * Reads AGENT_AUTOLOOP_CONTEXT; never calls real platforms.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MOCK_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)));

const contextPath = process.env.AGENT_AUTOLOOP_CONTEXT;
if (!contextPath) {
  console.error("缺少 AGENT_AUTOLOOP_CONTEXT");
  process.exit(2);
}

const context = JSON.parse(readFileSync(contextPath, "utf8"));
const event = context.events?.[0];
const primaryEvent =
  context.events?.find((e) => typeof e.type === "string" && e.type.startsWith("creator.topic.")) ?? event;
const type = primaryEvent?.type ?? event?.type ?? "";
const eventId = primaryEvent?.id ?? event?.id ?? "unknown";
const cwd = process.cwd();
const storePath = join(cwd, "business-store.jsonl");
const stateDir = join(cwd, ".mock-state");
const pendingPath = join(stateDir, "active-topic.json");

mkdirSync(stateDir, { recursive: true });

function pendingTopicId() {
  if (!existsSync(pendingPath)) return eventId;
  try {
    return JSON.parse(readFileSync(pendingPath, "utf8")).eventId ?? eventId;
  } catch {
    return eventId;
  }
}

function fence(receipt) {
  return `\n\`\`\`agent-autoloop\n${JSON.stringify(receipt)}\n\`\`\``;
}

function loadBusinessLines() {
  if (!existsSync(storePath)) return [];
  return readFileSync(storePath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function businessCount(eventKey, action) {
  return loadBusinessLines().filter((r) => r.eventId === eventKey && r.action === action).length;
}

function recordBusiness(action, extra = {}) {
  const id = extra.eventId ?? eventId;
  const { eventId: _drop, ...rest } = extra;
  appendFileSync(
    storePath,
    `${JSON.stringify({ eventId: id, action, subject: event?.subject ?? null, ...rest, at: new Date().toISOString() })}\n`,
    { encoding: "utf8" },
  );
}

function answeredTopicApproval() {
  const answers = context.answers ?? [];
  if (answers.some((a) => a.key === "topic-approve")) return true;
  return answers.some((a) => a.title === "是否撰写该选题？" && a.chosen === "撰写模拟初稿");
}

function skipTopicChosen() {
  return (context.answers ?? []).some((a) => a.title === "是否撰写该选题？" && a.chosen === "跳过");
}

/** 拒绝访问 POC cwd 之外的敏感路径（负面测试钩子） */
function guardSensitiveRead(requestedPath) {
  const target = resolve(requestedPath);
  const pocRoot = MOCK_ROOT;
  if (!target.startsWith(pocRoot)) {
    console.log(`没事可做：拒绝访问 POC 工作目录外的路径`);
    process.exit(0);
  }
}

if (type === "creator.topic.sensitive-read") {
  const detail = event?.detail?.trim();
  if (detail) guardSensitiveRead(detail);
  console.log("没事可做：未提供路径");
  process.exit(0);
}

if (type === "creator.topic.approval" || (answeredTopicApproval() && String(type).includes("card."))) {
  const bizId = pendingTopicId();
  if (skipTopicChosen()) {
    console.log("没事可做：人工选择跳过该选题");
    try {
      rmSync(pendingPath);
    } catch {}
    process.exit(0);
  }
  if (answeredTopicApproval()) {
    if (businessCount(bizId, "draft-created") > 0) {
      console.log("没事可做：该选题业务已处理（幂等）");
    } else {
      recordBusiness("draft-created", {
        eventId: bizId,
        title: event?.summary ?? primaryEvent?.summary ?? "mock-draft",
      });
      try {
        rmSync(pendingPath);
      } catch {}
      console.log("已创建模拟初稿（Mock 业务落库）");
    }
  } else {
    writeFileSync(
      pendingPath,
      JSON.stringify({ eventId: bizId, summary: event?.summary ?? "", at: new Date().toISOString() }),
      "utf8",
    );
    console.log(
      `模拟选题「${event?.summary ?? event?.subject}」待确认` +
        fence({
          ask: [
            {
              title: "是否撰写该选题？",
              text: "仅 Mock：不会向任何真实渠道发送内容。",
              options: ["撰写模拟初稿", "跳过"],
              recommend: 0,
              key: "topic-approve",
              about: "若选撰写，在 business-store.jsonl 追加一条 draft-created。",
            },
          ],
        }),
    );
  }
  process.exit(0);
}

if (type === "creator.topic.fail-once") {
  const flag = join(stateDir, `fail-once-${eventId}.done`);
  const failFlag = join(stateDir, `fail-once-${eventId}.failed`);
  if (existsSync(flag)) {
    console.log("没事可做：失败重试场景已完成");
    process.exit(0);
  }
  if (!existsSync(failFlag)) {
    writeFileSync(failFlag, new Date().toISOString(), "utf8");
    console.log("没跑成：模拟瞬时错误，等待中台重试");
    process.exit(0);
  }
  recordBusiness("retry-succeeded", { scenario: "fail-once" });
  writeFileSync(flag, "ok", "utf8");
  console.log("重试后模拟业务成功");
  process.exit(0);
}

if (type === "creator.topic.dedup-storm") {
  if (businessCount(eventId, "draft-created") > 0) {
    console.log("没事可做：重复事件不产生重复业务（幂等）");
  } else {
    recordBusiness("draft-created", { scenario: "dedup" });
    console.log("首次处理 dedup 事件");
  }
  process.exit(0);
}

if (type === "creator.topic.pause-skip") {
  recordBusiness("pause-marker", { note: "若规则暂停时不应出现此记录" });
  console.log("暂停期间不应执行 — 若看到此输出则失败");
  process.exit(0);
}

console.log(`没事可做：未知事件类型 ${type}`);
process.exit(0);