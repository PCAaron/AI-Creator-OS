# P0-03：Hermes Agent POC

**状态：未开始**

## 前置条件

- [ ] 完成对 `scripts/install.ps1` 全文安全审查
- [ ] 用户授权执行安装（修改 `%LOCALAPPDATA%\hermes` 与 User PATH）
- [ ] 专用测试 `HERMES_HOME`（或官方 multi-profile 文档确认方式）
- [ ] 模型凭证：本地配置，**不得**粘贴到聊天或 Git

## 验收清单

| # | 项 | 结果 |
|---|-----|------|
| 1 | Windows 原生安装与 CLI | — |
| 2 | 非交互 `-Q` | — |
| 3 | Session 创建 / 获取 ID / 恢复 | — |
| 4 | Memory 读写 + `memory.write_approval` | — |
| 5 | Skill 创建/修改 + `skills.write_approval` | — |
| 6 | `skills.guard_agent_created` 核实 | — |
| 7 | Background Learning（配置核对） | — |
| 8 | Profile 数据隔离 | — |

## 静态依据（VERIFIED 文档）

- 非交互：`hermes chat -Q -q "..."`；测试夹具 stderr 行 `session_id: <sid>`
- 审批：`skills.write_approval` / `memory.write_approval` 见 `website/docs/user-guide/configuration.md`
- Windows：`website/docs/user-guide/windows-native.md`

**本机 Hermes CLI：UNKNOWN（未安装）**