# P0-02：Agent Autoloop POC

**状态：MOCK VERIFIED（2026-11-14）**

环境：`AGENT_AUTOLOOP_HOME`=`%USERPROFILE%\.agent-autoloop-phase0`（**非**生产默认 `~\.agent-autoloop`）。

实现目录：`poc/phase-0/autoloop-mock/`

## 前置条件

| 项 | 状态 |
|----|------|
| Node.js 24+ | ✅ 24.9.0 |
| 独立沙盒安装 | ✅ phase0 home + Hub |
| 安装脚本审查 | ✅ 静态阅读；沙盒执行已授权 |

## 验收清单

| # | 场景 | 结果 | 证据 |
|---|------|------|------|
| 1 | 模拟选题事件 → Rule → Mock Agent | **通过** | `creator.topic.approval` emit |
| 2 | Agent `ask` → `answer` → 继续 | **通过** | 卡片 #4 类场景；context 无 `key` 字段已适配 |
| 3 | 事件与 run 追溯 | **通过** | `runs` + `why` |
| 4 | 失败 → `retrying` | **通过** | `creator.topic.fail-once`；完整自动重试加 `--slow-retry` |
| 5 | 重复事件 | **通过** | HTTP `duplicate:true` + `business-store` 单条 |
| 6 | 暂停 / 恢复 | **通过** | `pause` 期间无 `pause-marker` 副作用 |
| 7 | 业务幂等 | **通过** | 非仅事件 ID，按 `eventId`+`action` 去重 |
| 8 | 进程中断恢复 | **部分** | 审批续跑经 Session 同一规则第二轮验证；强杀 hub **未测** |

## 可复现命令

```powershell
$env:AGENT_AUTOLOOP_HOME = "$env:USERPROFILE\.agent-autoloop-phase0"
cd D:\Person\AI-Creator-OS\poc\phase-0\autoloop-mock

node negative-tests.mjs          # 单元：路径拒绝、幂等
node run-poc.mjs                 # 集成（自动备份/恢复 rules.json）
node run-poc.mjs --slow-retry    # 可选：约 5 分钟后验证 fail-once 自动重试完成
```

### 通过用例（集成脚本断言）

- 全部 11 项 `[PASS]`（见 `08-test-results.md` 2026-11-14 记录）。

### 失败用例（人工/预期）

| 用例 | 期望 | 验证方式 |
|------|------|----------|
| 审批选「跳过」 | 无 `draft-created` | 手动 `answer` 选项 2 |
| 访问 POC 外路径 | Agent  stdout 含「拒绝访问」 | `negative-tests.mjs` |
| Hub 未启动 | `run-poc.mjs` 超时 | 停 `up` 后运行（**未自动执行**） |

## 设计说明

- Mock Agent：`use: "command"`，`node mock-agent.mjs`。
- Rule：`when.types`=`creator.topic.*`，**`to`**=`phase0-mock`。
- 业务副作用：仅 `workspace/business-store.jsonl`。
- **`cwd` 非 OS 沙箱**；敏感路径依赖 Agent 内校验 + 未来容器/ACL。

## 未完成

- P0-04 Hermes Adapter（**BLOCKED**，见 05）。
- 上游 `agent-autoloop` 全量 `npm test`（**NOT TESTED**）。
- 真实 Codex/Claude Agent 端到端（无登录）。