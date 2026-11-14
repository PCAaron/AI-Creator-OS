# P0-02：Agent Autoloop POC

**状态：未开始**

## 前置条件

- [ ] Node.js 24+（见 [02-windows-compatibility.md](./02-windows-compatibility.md)）
- [ ] 完成对 `install.ps1` 全文审查并获授权
- [ ] 独立 `AGENT_AUTOLOOP_HOME`（沙盒目录，非生产配置）

## 验收清单（来自任务书）

| # | 场景 | 结果 |
|---|------|------|
| 1 | 模拟内容任务事件 → Rule → Agent | — |
| 2 | Agent 提交审批 → 用户 answer → 继续 | — |
| 3 | 完整事件与 run 追溯 | — |
| 4 | 进程中断 → 重启恢复 | — |
| 5 | 重复事件 / 重复回执 | — |
| 6 | 超时 / 异常退出 / 审批延迟 / 暂停恢复 / 失败重试 | — |

## 计划命令（**未执行**）

```powershell
# 示例：仅文档化，勿在未授权时运行
# nvm install 24
# nvm use 24
# irm ... agent-autoloop install.ps1
```

实现代码目标目录：`poc/phase-0/autoloop-hermes/`（待建）