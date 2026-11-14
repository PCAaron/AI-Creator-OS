# 架构决策记录（ADR）

## ADR-0001：上游审查副本放在项目外

- **状态**：接受
- **日期**：2026-11-14
- **上下文**：纪律要求不得将三仓库复制入正式项目
- **决策**：审查克隆固定为 `D:\Person\_phase0-audit-temp\`，SHA 记入 `docs/phase-0/README.md`

## ADR-0002：调度权威归属 Autoloop（待 POC 确认）

- **状态**：提议
- **决策**：业务 Event 仅由 Autoloop 规则触发；Hermes Cron 不参与同一业务
- **待验证**：P0-04

## ADR-0003：Hermes 安装策略

- **状态**：接受（修订 2026-11-14）
- **决策**：专用 `HERMES_HOME`=`D:\Person\_phase0-hermes-poc` 已授权安装；**保留** PM 失败事实；定点恢复前须 `-ShowResolvedPaths` / `-Manifest` + 确认无并发安装
- **原记录**：首轮暂缓全文审查 — 仍适用「全文审查未完成」

## ADR-0004：Rule `to` 与 Agent `use`

- **状态**：接受
- **日期**：2026-11-14
- **决策**：Rule 指派字段为 **`to`**（agent id）；`agents.<id>.use` 为插件类型。文档与 POC 规则禁止混用。