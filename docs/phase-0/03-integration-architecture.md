# P0-03：组合架构（草案）

> 状态：**ASSUMPTION + 静态推导**，待 P0-04 验证。非 V0.1 最终设计。

## 设计原则

1. **Autoloop = 唯一任务调度权威**（Event → Rule → Run → Receipt）
2. **Hermes = 可恢复 Agent Worker**（Session/Memory/Skill 在 `HERMES_HOME`）
3. **content-workbench 能力 = 库/参考**，不经 Fork 整机并入
4. **Evidence 不可变**；热点与用户观点分域存储（见 [07-security-review.md](./07-security-review.md)）

## 逻辑分层

```
┌─────────────────────────────────────────────────────────┐
│  AI Creator OS（自研）                                     │
│  Evidence / Draft / Evolution / Platform Store            │
│  渠道适配器、评测引擎、母稿模型                               │
└───────────────────────────┬─────────────────────────────┘
                            │ Events / 审批回调
┌───────────────────────────▼─────────────────────────────┐
│  agent-autoloop（调度中台）                                │
│  rules.json · hub · worker · ask/answer                   │
└───────────────────────────┬─────────────────────────────┘
                            │ Hermes Adapter (command turn)
┌───────────────────────────▼─────────────────────────────┐
│  hermes-agent（Runtime）                                     │
│  chat -Q · session_id · skills/memory write_approval         │
└─────────────────────────────────────────────────────────┘

可选 UI/编辑器层：借鉴 content-workbench 前端或 API 形态（Adapter 接入）
```

## Session 双轨（待 POC 验证）

| 层级 | 标识 | 所有者 |
|------|------|--------|
| 业务任务 | Autoloop `run_id` / event `id` | Autoloop SQLite |
| Agent 对话 | Hermes `session_id`（stderr `session_id:` 或 gateway RPC） | Hermes `HERMES_HOME` |

Adapter 须在每轮 Run 回写 `session` 字段，规则 `resume: true` 时传 `--resume` / Hermes 等价参数 — **以 P0-04 实测为准，不假定 CLI -flag 稳定性**。

## Memory / Skill 边界（目标态）

| Store | 内容 | 写入者 |
|-------|------|--------|
| Evidence Store | 用户原话、授权素材 | 仅导入管道；AI 不可覆盖 |
| Semantic Memory | 已确认事实/观点 | 人工确认 → 可同步 Hermes memory（带 approval） |
| Procedural Memory | Writer Skill 版本 | Hermes Skill + Evolution Store 元数据 |
| Draft Store | 母稿与版本 | workbench 类 API 自研 |
| Evolution Store | 提案/评测/审批/回滚 | 自研引擎；Hermes 仅存 Skill 正文 |

## Hermes 配置（POC 目标）

```yaml
# 目标 POC 配置 — UNVERIFIED 直至 P0-03 实测写入独立 HERMES_HOME
skills:
  write_approval: true
  guard_agent_created: true   # 官方支持，默认 false
memory:
  write_approval: true
```

## 不建议组合方式

- 三仓库 monorepo 硬合并
- Hermes Cron 与 Autoloop 规则同时驱动「同一篇稿子」流水线
- 让 Reflection Agent 写 Evidence Store

## 待验证项（P0-04）

- [ ] 结构化 `ask` 从 Hermes stdout 解析
- [ ] 进程 kill 后 Autoloop 恢复 + Hermes resume 同一 session
- [ ] 重复 event 不重复业务副作用（Autoloop 幂等 + 自研侧 idempotency key）