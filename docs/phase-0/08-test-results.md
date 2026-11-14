# Phase 0 测试结果汇总

| 日期 | 套件 | 环境 | 结果 | 证据 |
|------|------|------|------|------|
| 2026-11-14 | 主机工具链 | Win 10.0.26200 | 见 [02-windows-compatibility.md](./02-windows-compatibility.md) | Shell |
| 2026-11-14 | nvm Node 24.9.0 | Win | **通过** | `node -v` → v24.9.0 |
| 2026-11-14 | Python 3.13.16 | Win | **通过**（显式 `python3.13`） | `python3.13 --version` |
| 2026-11-14 | Python 默认 3.11.9 | Win | 记录 | `python --version`（workbench 需 3.13） |
| 2026-11-14 | agent-autoloop install + doctor | `~\.agent-autoloop-phase0` | **部分通过**（Codex 未登录） | `agent-autoloop doctor` |
| 2026-11-14 | Hermes install.ps1 | `D:\Person\_phase0-hermes-poc` | **失败记录保留**；`hermes.exe --version` **可运行** | 终端 exit 1 + CLI 输出 |
| 2026-11-14 | P0-02 `negative-tests.mjs` | phase0 Hub | **通过**（2/2） | `node negative-tests.mjs` |
| 2026-11-14 | P0-02 `run-poc.mjs` | phase0 Hub | **通过**（11/11 断言） | 见下方摘要 |
| — | P0-02 `--slow-retry` | — | **NOT TESTED** | 需 ~5min 等待 |
| — | agent-autoloop `npm test` | 上游副本 | **NOT TESTED** | — |
| — | hermes `pytest` / `-Q` | — | **NOT TESTED** | — |
| — | P0-05 自进化 Mock | — | **NOT TESTED** | — |
| — | P0-04 Hermes Adapter | — | **BLOCKED** | — |

## P0-02 集成输出摘要（2026-11-14）

```
[PASS] emit 选题事件
[PASS] 人工 answer 后继续
[PASS] 业务落库可追溯
[PASS] runs 可列出
[PASS] why 时间线
[PASS] 重复事件 duplicate=true
[PASS] 业务幂等仅一条 draft
[PASS] 失败后进入 retrying
[PASS] 重试完成（默认跳过 5min 等待）
[PASS] pause 规则
[PASS] 暂停期间无业务副作用
```

命令：`cd poc/phase-0/autoloop-mock && node run-poc.mjs`