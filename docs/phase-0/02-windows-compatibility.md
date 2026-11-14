# Phase 0：Windows 环境与兼容性

执行时间：**2026-11-14**（本机实测命令，Round 0.1 复验）。

## 系统与 Shell

| 项 | 结果 | 标记 |
|----|------|------|
| OS | Microsoft Windows NT 10.0.26200.0 | RUNTIME VERIFIED |
| PowerShell | 5.1.26100.9818 | RUNTIME VERIFIED |

## 工具链

| 工具 | 检测命令 | 版本/路径 | 上游要求 | 结论 |
|------|----------|-----------|----------|------|
| Git | `git --version` | 2.55.0.windows.5 | 需要 | **满足** |
| Node.js | `node -v`（nvm current） | **v24.9.0** | Autoloop **≥24** | **满足** |
| nvm4w | `nvm list` | 含 24.9.0（current）、22.14.0 等 | — | RUNTIME VERIFIED |
| Python（默认） | `python --version` | **3.11.9** | — | 与 workbench 3.13+ **不一致** |
| Python 3.13 | `python3.13 --version` | **3.13.16**（uv 管理） | workbench **3.13+** | **满足**（显式调用） |
| uv | `uv --version` | 0.13.1 | workbench 推荐 | 存在 |
| Hermes CLI | `D:\Person\_phase0-hermes-poc\...\hermes.exe --version` | v0.23.1；OpenAI SDK 未装 | POC 需要 | **RUNTIME PARTIAL**（全局 `hermes` 不在 PATH；PM 历史失败见 05） |
| Agent Autoloop | `AGENT_AUTOLOOP_HOME=%USERPROFILE%\.agent-autoloop-phase0` | v1.8.4 / app `55189165943b`；Hub `127.0.0.1:3350` | POC 需要 | **RUNTIME VERIFIED** |

### 进程探测（2026-11-14）

- **无**与 Hermes `install.ps1` / pnpm 下载相关的长期安装进程（`node` 多为 Cursor/tsserver）。
- **禁止**在旧安装进程仍存活时启动第二个 Hermes 安装（纪律仍有效）。

## 上游安装脚本：审查 vs 执行

| 脚本 | 静态审查 | 本机执行 | 说明 |
|------|----------|----------|------|
| agent-autoloop `install.ps1` | 已读（含 Node≥24、PATH、服务） | **已执行** → `~\.agent-autoloop-phase0` | 用户授权沙盒；非默认 `~\.agent-autoloop` |
| hermes-agent `scripts/install.ps1` | 头部+参数块已读；全文 1700+ 行 **未完成** | **部分** → `D:\Person\_phase0-hermes-poc` | 失败：`remote representation changed during download`（npm/pnpm）；**未**删目录、**未**清全局缓存 |
| content-workbench | 无 Windows 安装器 | **未执行** | 需 `uv sync` + 3.13 + Node |

## 兼容性矩阵

| 组件 | Windows 官方支持 | 本机 POC 状态 | 阻塞项 |
|------|------------------|---------------|--------|
| agent-autoloop | 是 | **Mock POC 通过** | 真实 Codex/Claude Agent 未登录 |
| hermes-agent | 是 | CLI 局部可运行 | Session/`-Q`/SDK；安装脚本全文审查 |
| content-workbench | 未声明 | 未启动 | Python 3.13 需显式；macOS 链路 UNKNOWN |

## 建议的下一步（需授权项标出）

1. **Hermes**：在确认无并发安装后，用官方 `-ShowResolvedPaths` / `-Manifest` 定点恢复 PM 阶段（**需授权**若改 PATH/下载）。
2. **Hermes POC**：`hermes chat -Q`、Session ID 提取、独立 `HERMES_HOME` 审批链 — 见 [05-hermes-poc.md](./05-hermes-poc.md)。
3. **content-workbench**：`uv sync` 用 `python3.13` — **未在本轮执行**。