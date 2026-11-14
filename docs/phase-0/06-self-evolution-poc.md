# P0-05：自进化能力 POC

**状态：未开始**（依赖 P0-03 Hermes Skill 审批链 + 自研 Evolution Store）

## 范围

- 最小 Writer Skill v1.0 + 测试 Fixture（**明确标注非真实用户文风**）
- 闭环：Feedback → Reflection → Proposal → v1.1 候选 → Evaluation → 审批 → Registry / 回滚

## 进化记录 schema（目标）

见任务书：`skill_id`, `base_version`, `candidate_version`, `evidence_ids`, `proposed_changes`, `evaluation_results`, `approval_status`, `rollback_version`

## 评测指标（须独立留出集）

- 个人风格一致性、观点可追溯性、事实准确性、结构完整性、人工修改量、渠道格式正确率
- 禁止仅用 AI 自评通过

## 实现目录

`poc/phase-0/self-evolution/`（待建）