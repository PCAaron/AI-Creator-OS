# AI Creator OS — Phase 0（架构验证与 POC）

本目录为 **Phase 0 唯一交付文档区**。正式产品代码不在此阶段实现。

## 当前进度（2026-11-14，本机复验）

| 工作包 | 状态 | 验收级别 | 说明 |
|--------|------|----------|------|
| 环境检查 | **大部分就绪** | RUNTIME VERIFIED | Node **24.9.0**（nvm current）；Python 默认 `python` **3.11.9**，**3.13.16** 经 `python3.13` / uv |
| P0-01 开源静态审查 | **完成** | STATIC VERIFIED | 见 [01-open-source-audit.md](./01-open-source-audit.md) |
| P0-02 Autoloop POC | **Mock 闭环通过** | MOCK VERIFIED | 沙盒 `%USERPROFILE%\.agent-autoloop-phase0`；代码 `poc/phase-0/autoloop-mock/` |
| P0-03 Hermes POC | **安装部分成功** | RUNTIME PARTIAL | `D:\Person\_phase0-hermes-poc`：`hermes.exe` v0.23.1 可执行；历史 PM npm/pnpm 下载失败仍记录在案 |
| P0-04 Hermes Adapter | **未开始** | **BLOCKED** | 需 Hermes Session/`-Q`/审批链 RUNTIME 验证 |
| P0-05 自进化 POC | **未开始** | NOT TESTED | 目录占位 `poc/phase-0/self-evolution/` |
| P0-06 安全与负面测试 | **部分** | MOCK VERIFIED（子集） | Autoloop Mock 负面用例；注入/Evidence 全量见 [07-security-review.md](./07-security-review.md) |

**Phase 0 总判定：NO-GO（进行中）** — 不得因 Hermes PM 历史失败或单项安装成功而宣称 Phase 0 完成。

### 状态图例

| 标记 | 含义 |
|------|------|
| STATIC VERIFIED | 源码/文档已核对 |
| MOCK VERIFIED | Mock 测试在本机通过（有命令输出） |
| RUNTIME VERIFIED | 真实运行时通过 |
| RUNTIME PARTIAL | 部分能力可运行，关键项仍缺 |
| BLOCKED | 有明确阻塞 |
| NOT TESTED | 尚未执行 |

## 仓库与基线

| 项 | 值 |
|----|-----|
| 远程 | https://github.com/PCAaron/AI-Creator-OS |
| 审查基线 | `main` @ `3130e72998328fde0d88f65df8fe2b02b860ad39`（本轮在该之上增量） |

## 上游审查副本位置（项目外）

审查克隆 **不得** 放入本仓库。当前副本目录：

| 仓库 | 路径 | main HEAD（浅克隆） |
|------|------|---------------------|
| [content-workbench](https://github.com/garycaogan/content-workbench) | `D:\Person\_phase0-audit-temp\content-workbench` | `d9044c4477f136e35a061689afbe50f9f83abcd0` |
| [agent-autoloop](https://github.com/KKKKhazix/agent-autoloop) | `D:\Person\_phase0-audit-temp\agent-autoloop` | `680c80ee0821e6f6dc03b4778b43f8cb5f0463b0` |
| [hermes-agent](https://github.com/NousResearch/hermes-agent) | `D:\Person\_phase0-audit-temp\hermes-agent-clean` | `4b40ffb0ad6d7da5d3260f5e499e1691508dd4d5` |

> `hermes-agent` 首次克隆至 `...\hermes-agent` 因并发 git 进程损坏，有效副本为 `hermes-agent-clean`。
>
> **安装实例与审查副本不同**：POC Autoloop 安装器检出 **stable v0.23.1 release 线**（沙盒 `app` 提交 `55189165943b…`，CLI 报告 v1.8.4）；静态审查仍以上表 main 浅克隆 SHA 为准。
>
> **Hermes**：独立 `HERMES_HOME`=`D:\Person\_phase0-hermes-poc`；`install.ps1` 曾在 PM 拉取 npm/pnpm 阶段失败，但目录内已存在 `hermes.exe`（见 P0-03）。

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
- Rule 字段 **`to`** 指向 Agent；Agent 字段 **`use`** 指向插件类型（与上游 `protocol/rules.ts` 一致）。
- **`cwd` 不是操作系统沙箱**；`command` Adapter 须叠加独立隔离手段。