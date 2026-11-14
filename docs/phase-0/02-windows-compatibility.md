# P0-02：Windows 环境与兼容性

执行时间：2026-11-14（本机实测命令）。

## 系统与 Shell

| 项 | 结果 | 标记 |
|----|------|------|
| OS | Microsoft Windows NT 10.0.26200.0 | VERIFIED |
| PowerShell | 5.1.26100.9818 | VERIFIED |

> **注**：PowerShell 5.1 与上游 `install.ps1` 兼容；若后续脚本要求 PS 7+，再单独验证。

## 工具链

| 工具 | 检测命令 | 版本/路径 | 上游要求 | 结论 |
|------|----------|-----------|----------|------|
| Git | `git --version` | 2.55.0.windows.5 | 需要 | **满足** |
| Node.js | `node -v`（nvm `use 24.9.0`） | **v24.9.0**（2026-11-14 已安装） | Autoloop **≥24**；workbench **22+** | **满足 Autoloop** |
| npm | `Get-Command npm` | 随 Node 22 | — | 存在 |
| Python | `python3.13 --version` / uv | **3.13.16**（uv 安装，2026-11-14） | workbench **3.13+** | **满足** |
| uv | `uv --version` | 0.13.1 | workbench 推荐 | 存在 |
| Hermes CLI | 独立 `HERMES_HOME` | `D:\Person\_phase0-hermes-poc`（v0.23.1 已检出） | POC 需要 | **失败**：PM 下载 npm/pnpm 报错 `remote representation changed during download`；`hermes.exe` 未生成 — **可重试安装** |
| Agent Autoloop | `AGENT_AUTOLOOP_HOME` 沙盒 | **`%USERPROFILE%\.agent-autoloop-phase0`**，`doctor` Node 24.9.0 OK | POC 需要 | **VERIFIED 已安装**（服务已注册） |

### nvm4w 已安装 Node 版本（`nvm list`）

- 22.14.0（当前）
- 20.19.5, 18.20.0, 16.17.0, 12.20.0
- **无 Node 24** — 安装 Autoloop 前需 `nvm install 24`（**需你确认**，属用户环境变更）

## 上游安装脚本静态审查（未执行）

### agent-autoloop `install.ps1`（VERIFIED 阅读）

- 要求 Node major ≥24，否则 `throw`
- 克隆至 `%USERPROFILE%\.agent-autoloop\app`
- 修改 **User** PATH，追加 `...\app\bin`
- 可选 `service install`（Windows 服务）— **涉及后台进程，POC 前需说明**

**风险**：拉取 GitHub、改 PATH、可能注册服务 — **未经你批准不执行**。

### hermes-agent `scripts/install.ps1`（VERIFIED 已读头部 + 参数块）

- 默认 `HermesHome` = `%LOCALAPPDATA%\hermes`；克隆源码至 `...\hermes-agent`
- 支持 `-NonInteractive`、`-Channel stable|main`、`-HermesHome` / `-InstallDir` 覆盖路径
- **无害探测**：`-ShowResolvedPaths` 仅打印将使用的路径 JSON **不执行安装**（可用于下一步审查）
- PM 阶段会拉取 Chromium、cua-driver 等（可用 `-SkipBrowser` / `-SkipComputerUse` 跳过）
- **禁止**：完整 `irm | iex` 安装须经你授权；全文 1700+ 行待继续安全审查（远程 clone、改 PATH、下载二进制）

### content-workbench

- 无 Windows 专用安装器；`uv sync` + `npm run build` — 需 Python 3.13 与 Node 22+
- **本机当前无法按上游版本要求静态启动后端**（Python 版本不足）

## 兼容性矩阵

| 组件 | Windows 官方支持 | 本机可立即 POC | 阻塞项 |
|------|------------------|----------------|--------|
| agent-autoloop | 是（install.ps1 + tests） | 否 | Node 24+；安装脚本 |
| hermes-agent | 是（windows-native 文档） | 否 | CLI 未安装；安装脚本 |
| content-workbench | 未声明 | 否 | Python 3.13；macOS 特性依赖 UNKNOWN |

## 建议的下一步（需你授权）

1. **Node**：`nvm install 24` + `nvm use 24`（仅用户级）
2. **Python**：安装 3.13 或 `uv python install 3.13`（仅项目/uv 管理，避免全局破坏）
3. **Hermes**：完成对 `scripts/install.ps1` 全文审查后，再决定是否 `iex ... -NonInteractive -Channel stable`
4. **Autoloop**：审查通过后，在用户目录执行 `install.ps1`（可先 `--no-service` 若脚本支持）

以上任一步均未在本阶段自动执行。