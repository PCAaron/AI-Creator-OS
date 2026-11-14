# Phase 0 测试结果汇总

| 日期 | 套件 | 环境 | 结果 | 证据 |
|------|------|------|------|------|
| 2026-11-14 | P0-02 `negative-tests.mjs` | phase0 Hub | **通过**（7/7） | `exit 0` |
| 2026-11-14 | P0-02 `run-poc.mjs` | phase0 Hub | **通过**（14/14） | `testRunId=phase0-00c2e7b5-…` |
| 2026-11-14 | P0-02 `run-poc.mjs --slow-retry` | phase0 Hub | **通过**（15/15 含慢速） | `testRunId=phase0-7ac9f668-…`；`exit 0`；~340s |
| 2026-11-14 | P0-05 `self-evolution/run-poc.mjs` | 临时目录 | **通过**（6/6） | `exit 0` |
| 2026-11-14 | Hermes 诊断 | `_phase0-hermes-poc` | **部分** | `--version` + `-ShowResolvedPaths` + `-Manifest` |
| — | Hermes Session / `-Q` | — | **NOT TESTED** | — |
| — | P0-04 Hermes Adapter | — | **BLOCKED** | — |

## 执行命令与退出码（Phase 0.2）

```powershell
cd D:\Person\AI-Creator-OS\poc\phase-0\autoloop-mock
node negative-tests.mjs    # exit 0
node run-poc.mjs           # exit 0
node run-poc.mjs --slow-retry  # exit 0（含「慢速：重试后完成」）

cd D:\Person\AI-Creator-OS\poc\phase-0\self-evolution
node run-poc.mjs           # exit 0

& D:\Person\_phase0-hermes-poc\hermes-agent\.hermes\bin\hermes.exe --version
powershell -File D:\Person\_phase0-hermes-poc\hermes-agent\scripts\install.ps1 -ShowResolvedPaths
powershell -File D:\Person\_phase0-hermes-poc\hermes-agent\scripts\install.ps1 -Manifest
```

## P0-02 集成摘要（default 模式）

含：审批通过/拒绝、eventId 隔离、HTTP 去重、SQLite 并行幂等、fail-once→retrying、pause 无副作用。