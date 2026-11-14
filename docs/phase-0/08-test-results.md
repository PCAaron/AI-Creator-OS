# Phase 0 测试结果汇总

| 日期 | 套件 | 环境 | 结果 | 证据 |
|------|------|------|------|------|
| 2026-11-14 | 主机工具链探测 | Win 10.0.26200 | 见 02 文档 | Shell 输出 |
| 2026-11-14 | nvm Node 24.9.0 | Win | 通过 | `node -v` |
| 2026-11-14 | uv Python 3.13.16 | Win | 通过 | `uv python list` |
| 2026-11-14 | agent-autoloop install + doctor | `AGENT_AUTOLOOP_HOME=~\.agent-autoloop-phase0` | 部分通过（Codex 未登录） | `agent-autoloop doctor` |
| 2026-11-14 | Hermes install.ps1 | `D:\Person\_phase0-hermes-poc` | **进行中** | 终端日志 |
| — | agent-autoloop `npm test` | — | **未执行** | — |
| — | hermes `pytest` | — | **未执行** | — |
| — | content-workbench `pytest` | — | **未执行** | — |
| — | P0-02～05 POC | — | **未开始** | — |