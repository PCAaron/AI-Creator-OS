# P0-03：Hermes Agent POC

**状态：RUNTIME PARTIAL / 安装历史失败仍成立**

## 本机实例（2026-11-14）

| 项 | 值 |
|----|-----|
| `HERMES_HOME` / 安装根 | `D:\Person\_phase0-hermes-poc` |
| 可执行文件 | `...\hermes-agent\.hermes\bin\hermes.exe` |
| `hermes --version` | Hermes Agent **v0.23.1** (2026.9.24)；Python 3.14.9；OpenAI SDK Not installed |
| 全局 PATH | **`hermes` 命令不存在**（未注册 User PATH 或未完成安装收尾） |
| 历史失败 | `install.ps1` PM 阶段：`remote representation changed during download`（npm/pnpm） |
| 并发安装 | 复验时 **无** 活跃 Hermes 安装进程 |

> **不得**将「`hermes.exe` 能 `--version`」等同于 P0-03 验收完成。

## 前置条件

| # | 项 | 状态 |
|---|-----|------|
| 1 | `install.ps1` 安全审查 | **部分**（非全文） |
| 2 | 用户授权安装 | ✅ 曾授权 `D:\Person\_phase0-hermes-poc` |
| 3 | 专用 `HERMES_HOME` | ✅ |
| 4 | 模型凭证 | **无**（真实 Agent Session **NOT TESTED**） |

## 验收清单

| # | 项 | 结果 |
|---|-----|------|
| 1 | Windows 原生安装与 CLI | **PARTIAL**（二进制存在；PATH/PM 不完整） |
| 2 | 非交互 `-Q` | **NOT TESTED** |
| 3 | Session 创建 / 恢复 | **NOT TESTED** |
| 4 | Memory `write_approval` | **NOT TESTED** |
| 5 | Skill `write_approval` | **NOT TESTED** |
| 6 | `skills.guard_agent_created` | STATIC VERIFIED |
| 7 | Background Learning | STATIC / **NOT TESTED** |
| 8 | Profile 隔离 | **NOT TESTED** |

## 定点恢复顺序（未在本轮自动执行）

1. 确认无安装进程 → ✅  
2. 记录目录与 `hermes.exe` → ✅  
3. `-ShowResolvedPaths` / `-Manifest` → **待执行**（需下一轮、`install.ps1` 同目录）  
4. 官方阶段重试 PM 下载 → **待授权**  
5. 禁止：删 `HERMES_HOME`、清全局缓存、擅自改系统配置  

## P0-04 启动条件

| 条件 | 状态 |
|------|------|
| Hermes CLI 稳定可调用（PATH 或固定路径） | **PARTIAL** |
| `hermes chat -Q` 可运行并解析 **实测** Session ID | **BLOCKED** |
| 审批链运行时验证 | **BLOCKED** |

**结论：P0-04 Hermes Adapter — BLOCKED**