# P0-02：Agent Autoloop POC

**状态：MOCK VERIFIED（P0-02.1，2026-11-14 复验）**

环境：`AGENT_AUTOLOOP_HOME`=`%USERPROFILE%\.agent-autoloop-phase0`（**非**生产默认 `~\.agent-autoloop`）。

实现目录：`poc/phase-0/autoloop-mock/`

## 前置条件

| 项 | 状态 |
|----|------|
| Node.js 24+ | ✅ 24.9.0 |
| 独立沙盒安装 | ✅ phase0 home + Hub |
| 安装脚本审查 | ✅ 静态阅读；沙盒执行已授权 |

## P0-02.1 缺陷修复映射

| # | 要求 | 修复位置 | 测试 |
|---|------|----------|------|
| 1 | `fail-once` 首次失败非零退出 | `mock-agent.mjs`（`process.exit(1)`） | `negative-tests.mjs`、集成「失败后进入 retrying」 |
| 2 | 删除伪 PASS 重试完成 | `run-poc.mjs`（默认不测完成；`--slow-retry` 才断言） | 见 `08-test-results.md` |
| 3 | 普通测 retrying；慢速测完成 | `run-poc.mjs` | 同上 |
| 4 | 唯一 `testRunId` 关联 | `run-poc.mjs`（`subject`/`summary` 带本轮 ID） | 集成 `runs 仅匹配本轮 event` |
| 5 | 禁止跨轮次匹配 Hub | `runsForEvent` + `quarantineStaleBlockingRuns` | 集成 |
| 6 | 审批按 `eventId` 隔离 pending | `mock-agent.mjs` `pending-${safeToken}.json` | 集成「审批状态按 eventId 隔离」 |
| 7 | 审批拒绝无初稿 | `mock-agent.mjs` + 集成用例 | 集成 + `negative-tests.mjs` |
| 8 | SQLite 幂等 + 并行写 | `lib/business-store.mjs` | 集成 + `negative-tests.mjs` |
| 9 | `eventId` 文件名安全化 | `lib/paths.mjs` + `resolveInside` | `negative-tests.mjs` |
| 10 | 目录边界说明 | `lib/paths.mjs` `isPathInside`；文档声明非 OS 沙箱 | `negative-tests.mjs` |

## 测试可靠性

- 失败非零退出；`record` 均绑定断言；脚本 `finally` 恢复 `rules.json` 并校验 SHA256。
- `acquirePocLock` 禁止同沙盒并发 POC；`quarantineStaleBlockingRuns` 仅 `stop` 遗留 blocking run（不删 HERMES/AUTOLOOP 全局数据）。
- 汇总 JSON 含 `testRunId`、`assertions`、退出码。

## 可复现命令

```powershell
$env:AGENT_AUTOLOOP_HOME = "$env:USERPROFILE\.agent-autoloop-phase0"
cd D:\Person\AI-Creator-OS\poc\phase-0\autoloop-mock

node negative-tests.mjs          # 7 项单元断言
node run-poc.mjs                 # 集成（14 项记录）
node run-poc.mjs --slow-retry    # 另增「慢速：重试后完成」（约 5min）
```

## 设计说明

- Mock Agent：`use: "command"`，`node mock-agent.mjs`。
- 业务副作用：`workspace/business.sqlite`（`node:sqlite` 实验特性）。
- **`cwd` 非 OS 沙箱**；路径校验为 Mock 内守卫。

## 未完成

- P0-04 Hermes Adapter（**BLOCKED**，见 05）。
- 上游 `agent-autoloop` 全量 `npm test`（**NOT TESTED**）。
- 强杀 hub 中断恢复（**NOT TESTED**）。