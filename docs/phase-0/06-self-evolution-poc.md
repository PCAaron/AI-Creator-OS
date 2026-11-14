# P0-05：自进化能力 POC

**状态：MOCK VERIFIED（与 Hermes 解耦，2026-11-14）**

**不得**将确定性 Mock 评测表述为真实用户写作能力已提升。

## 范围

目录：`poc/phase-0/self-evolution/`

闭环（合成数据）：

1. Writer Skill **v1.0**（`lib/pipeline.mjs`）
2. AI 初稿 / 人工改稿 / 修改理由（`fixtures/self-evolution-samples.json`）
3. **Feedback Collector** — 行级 diff
4. **Reflection** — 带 `evidence_ids` 的规则候选
5. **Evolution Proposal** — SQLite `evolution_proposals`
6. **v1.1 Candidate** — `status=candidate`，不覆盖 `active`
7. **Evaluation** — 留出集 `holdoutGood`；指标 `mock_holdout_match_rate`
8. **Approval Gate** — `approveProposal` / `rejectProposal`
9. **Skill Registry** — `skill_versions` 版本化
10. **Rollback** — `rollbackSkill`

## 自动测试（`run-poc.mjs`）

| 场景 | 断言 |
|------|------|
| 有效改进 | 批准后 `active`=`1.1-candidate` |
| 退化拒绝 | 大写候选评测失败 → `rejected` |
| 未批准不激活 | 仍为 v1.0 |
| 错误证据 | 批准抛错 |
| 重复批准 | `duplicate:true` |
| 回滚 | 恢复 v1.0 |

```powershell
cd D:\Person\AI-Creator-OS\poc\phase-0\self-evolution
node run-poc.mjs
```

## 进化记录 schema

`skill_id`, `base_version`, `candidate_version`, `evidence_ids`, `proposed_changes`, `evaluation_results`, `approval_status`, `rollback_version` — 见 `lib/store.mjs`。