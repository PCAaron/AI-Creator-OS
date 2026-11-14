# P0-03：Hermes Agent POC

**状态：RUNTIME PARTIAL / 安装历史失败仍成立**

## 本机实例（2026-11-14 Phase 0.2 核查）

| 项 | 值 |
|----|-----|
| 审查/测试目录 | `D:\Person\_phase0-hermes-poc` |
| 可执行文件 | `D:\Person\_phase0-hermes-poc\hermes-agent\.hermes\bin\hermes.exe` |
| `hermes --version` | **v0.23.1** (2026.9.24)；Python 3.14.9；OpenAI SDK Not installed |
| `install.ps1 -ShowResolvedPaths` | 已执行：默认解析 `HERMES_HOME`=`%LOCALAPPDATA%\hermes`（与 `D:\Person\_phase0-hermes-poc` **并存**；未改用户 PATH） |
| `install.ps1 -Manifest` | 已执行：stages JSON（`setup`/`gateway` 标记 `needs_user_input`） |
| Session / `-Q` | **NOT TESTED** |
| 历史失败 | `install.ps1` PM 阶段 npm/pnpm 下载仍记录在案 |

> **不得**将 `hermes.exe --version` 等同于 Phase 0 或 P0-04 通过。

## P0-04 启动条件

| 条件 | 状态 |
|------|------|
| 非交互 `hermes chat -Q` + Session 验证 | **BLOCKED** |
| 审批链 RUNTIME | **BLOCKED** |

**结论：P0-04 Hermes Adapter — BLOCKED（仅允许接口设计/纯单元测试）**