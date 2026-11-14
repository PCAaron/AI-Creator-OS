/**
 * Phase 0 Mock Agent — runs under Autoloop `use: "command"`.
 * 非零退出码表示失败（触发 Autoloop 重试）；cwd 内校验不等于 OS 级沙箱。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { insertBusiness } from "./lib/business-store.mjs";
import { isPathInside, resolveInside, safeFileToken } from "./lib/paths.mjs";

const MOCK_ROOT = fileURLToPath(new URL(".", import.meta.url));

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
const stateDir = join(cwd, ".mock-state");

mkdirSync(stateDir, { recursive: true });

function pendingPath(forEventId) {
  return resolveInside(stateDir, `pending-${safeFileToken(forEventId)}.json`);
}

function topicBusinessId() {
  const topic = context.events?.find((e) => e.type === "creator.topic.approval");
  if (topic?.id) return topic.id;
  if (topic?.subject) return topic.subject;
  const pending = readdirSync(stateDir).filter((f) => f.startsWith("pending-") && f.endsWith(".json"));
  if (pending.length === 1) {
    try {
      return JSON.parse(readFileSync(join(stateDir, pending[0]), "utf8")).eventId ?? eventId;
    } catch {}
  }
  return eventId;
}

function failOncePaths(forEventId) {
  const token = safeFileToken(forEventId);
  return {
    done: resolveInside(stateDir, `fail-once-${token}.done`),
    failed: resolveInside(stateDir, `fail-once-${token}.failed`),
  };
}

function fence(receipt) {
  return `\n\`\`\`agent-autoloop\n${JSON.stringify(receipt)}\n\`\`\``;
}

function recordBusiness(action, extra = {}) {
  const id = extra.eventId ?? eventId;
  const { eventId: _drop, ...rest } = extra;
  return insertBusiness(cwd, {
    eventId: id,
    action,
    subject: event?.subject ?? primaryEvent?.subject ?? null,
    extra: rest,
  });
}

function answeredTopicApproval() {
  const answers = context.answers ?? [];
  if (answers.some((a) => a.key === "topic-approve")) return true;
  return answers.some((a) => a.title === "是否撰写该选题？" && a.chosen === "撰写模拟初稿");
}

function skipTopicChosen() {
  return (context.answers ?? []).some((a) => a.title === "是否撰写该选题？" && a.chosen === "跳过");
}

function guardSensitiveRead(requestedPath) {
  const target = resolve(requestedPath);
  if (!isPathInside(target, MOCK_ROOT)) {
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
  const bizId = topicBusinessId();
  const pendingFile = pendingPath(bizId);
  if (skipTopicChosen()) {
    console.log("没事可做：人工选择跳过该选题");
    try {
      rmSync(pendingFile);
    } catch {}
    process.exit(0);
  }
  if (answeredTopicApproval()) {
    const { inserted } = recordBusiness("draft-created", {
      eventId: bizId,
      title: event?.summary ?? primaryEvent?.summary ?? "mock-draft",
    });
    if (!inserted) {
      console.log("没事可做：该选题业务已处理（幂等）");
    } else {
      try {
        rmSync(pendingFile);
      } catch {}
      console.log("已创建模拟初稿（Mock 业务落库）");
    }
  } else {
    writeFileSync(
      pendingFile,
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
              about: "若选撰写，在 business.sqlite 追加一条 draft-created。",
            },
          ],
        }),
    );
  }
  process.exit(0);
}

if (type === "creator.topic.fail-once") {
  const { done, failed } = failOncePaths(eventId);
  if (existsSync(done)) {
    console.log("没事可做：失败重试场景已完成");
    process.exit(0);
  }
  if (!existsSync(failed)) {
    writeFileSync(failed, new Date().toISOString(), "utf8");
    console.error("没跑成：模拟瞬时错误，等待中台重试");
    process.exit(1);
  }
  recordBusiness("retry-succeeded", { eventId, scenario: "fail-once", testRunId: primaryEvent?.subject ?? null });
  writeFileSync(done, "ok", "utf8");
  console.log("重试后模拟业务成功");
  process.exit(0);
}

if (type === "creator.topic.dedup-storm") {
  const { inserted } = recordBusiness("draft-created", { eventId, scenario: "dedup" });
  if (!inserted) {
    console.log("没事可做：重复事件不产生重复业务（幂等）");
  } else {
    console.log("首次处理 dedup 事件");
  }
  process.exit(0);
}

if (type === "creator.topic.pause-skip") {
  insertBusiness(cwd, {
    eventId,
    action: "pause-marker",
    subject: event?.subject ?? null,
    extra: { note: "若规则暂停时不应出现此记录" },
  });
  console.log("暂停期间不应执行 — 若看到此输出则失败");
  process.exit(0);
}

console.log(`没事可做：未知事件类型 ${type}`);
process.exit(0);