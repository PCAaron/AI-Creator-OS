# AI Creator OS — Phase 0（架构验证与 POC）

本目录为 **Phase 0 唯一交付文档区**。正式产品代码不在此阶段实现。

## 当前进度（2026-11-14）

| 阶段 | 状态 | 说明 |
|------|------|------|
| 环境检查 | **VERIFIED（大部分）** | Node 24.9.0、Python 3.13.16；见 [02-windows-compatibility.md](./02-windows-compatibility.md) |
| P0-01 开源静态审查 | **VERIFIED** | 见 [01-open-source-audit.md](./01-open-source-audit.md) |
| P0-02 Autoloop POC | **未开始**（环境已就绪） | 沙盒 `~\.agent-autoloop-phase0`，`doctor` 已跑 |
| P0-03 Hermes POC | **阻塞：安装失败** | PM 拉取 npm/pnpm 失败，需重试 `install.ps1` 同一 `HERMES_HOME` |
| P0-04 协作 POC | **未开始** | 依赖 P0-02/03 |
| P0-05 自进化 POC | **未开始** | 见 `poc/phase-0/self-evolution/` |
| P0-06 安全架构 | **草案** | 见 [07-security-review.md](./07-security-review.md) |

状态图例：**VERIFIED** = 有命令输出或代码依据；**UNVERIFIED** = 未跑通；**ASSUMPTION** = 推断；**UNKNOWN** = 待测。

## 上游审查副本位置（项目外）

审查克隆 **不得** 放入本仓库。当前副本目录：

| 仓库 | 路径 | main HEAD（浅克隆） |
|------|------|---------------------|
| [content-workbench](https://github.com/garycaogan/content-workbench) | `D:\Person\_phase0-audit-temp\content-workbench` | `d9044c4477f136e35a061689afbe50f9f83abcd0` |
| [agent-autoloop](https://github.com/KKKKhazix/agent-autoloop) | `D:\Person\_phase0-audit-temp\agent-autoloop` | `680c80ee0821e6f6dc03b4778b43f8cb5f0463b0` |
| [hermes-agent](https://github.com/NousResearch/hermes-agent) | `D:\Person\_phase0-audit-temp\hermes-agent-clean` | `4b40ffb0ad6d7da5d3260f5e499e1691508dd4d5` |

> 注：`hermes-agent` 首次克隆至 `...\hermes-agent` 因并发 git 进程损坏，有效副本为 `hermes-agent-clean`。
>
> **安装实例与审查副本不同**：POC 安装器检出 **stable v0.23.1**（`~\.agent-autoloop-phase0\app` 为 release `55189165943b…`），静态审查仍以上表 main 浅克隆 SHA 为准。

## 文档索引

1. [01-open-source-audit.md](./01-open-source-audit.md) — 三仓库静态审查
2. [02-windows-compatibility.md](./02-windows-compatibility.md) — Windows 环境与缺口
3. [03-integration-architecture.md](./03-integration-architecture.md) — 组合架构（草案）
4. [04-autoloop-poc.md](./04-autoloop-poc.md) — Autoloop POC 计划与结果
5. [05-hermes-poc.md](./05-hermes-poc.md) — Hermes POC 计划与结果
6. [06-self-evolution-poc.md](./06-self-evolution-poc.md) — 自进化闭环
7. [07-security-review.md](./07-security-review.md) — 数据边界与安全
8. [08-test-results.md](./08-test-results.md) — 汇总测试结果
9. [09-architecture-decisions.md](./09-architecture-decisions.md) — ADR
10. [10-v0.1-backlog.md](./10-v0.1-backlog.md) — V0.1 任务书

## 执行纪律（摘要）

- 先静态审查，再运行上游安装脚本或 POC。
- 无模型凭证时不做真实 LLM 调用；Mock 须标注。
- Autoloop 为任务调度唯一权威；POC 不启用 Hermes Cron 跑相同业务任务。