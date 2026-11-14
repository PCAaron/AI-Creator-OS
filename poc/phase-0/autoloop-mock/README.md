# P0-02 Autoloop Mock POC

在 **`AGENT_AUTOLOOP_HOME`** 沙盒（本机默认 `%USERPROFILE%\.agent-autoloop-phase0`）内合并临时规则，**不**使用 `%USERPROFILE%\.agent-autoloop` 生产目录。

## 前置

- Hub 已运行（`up.pid` 存在或 `agent-autoloop status` 可达）
- Node ≥ 24（与 Autoloop 一致）
- 设置环境（可选，默认已是 phase0 沙盒）：

```powershell
$env:AGENT_AUTOLOOP_HOME = "$env:USERPROFILE\.agent-autoloop-phase0"
$env:PATH = "$env:USERPROFILE\.agent-autoloop-phase0\app\bin;$env:PATH"
```

## 命令

```powershell
cd D:\Person\AI-Creator-OS\poc\phase-0\autoloop-mock

# Mock Agent 单元（负面/幂等）
node negative-tests.mjs

# 集成（会备份/恢复 rules.json）
node run-poc.mjs

# 可选：等待 Autoloop 默认约 5 分钟后验证 fail-once 自动重试完成
node run-poc.mjs --slow-retry
```

## 产物

| 路径 | 说明 |
|------|------|
| `mock-agent.mjs` | `use: command` Mock Agent |
| `workspace/business-store.jsonl` | 模拟业务副作用（可审计） |
| `rules.json.phase0-backup` | 沙盒内规则备份（测试结束自动恢复） |

## 隔离说明

- Autoloop **`command` Adapter 不提供 OS 级沙箱**；本 POC 仅依赖 `cwd` + Agent 内路径校验（见 `negative-tests.mjs`）。生产须叠加文件系统 ACL / 容器等。