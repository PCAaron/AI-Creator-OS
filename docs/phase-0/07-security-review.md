# P0-06：安全与数据架构（Phase 0 设计约束）

> 运行时渗透测试与 Prompt Injection 用例见 P0-05/08 — **本文件为架构约束，非渗透报告**。

## 六域存储

| Store | 用途 | 不可变/可写 | AI 写权限 |
|-------|------|-------------|-----------|
| **Evidence Store** | 原始录音转写、用户授权摘录、外链快照哈希 | 仅追加；校正走人工审计链 | **禁止覆盖** |
| **Semantic Memory** | 已确认个人事实与观点 | 版本化 | 须人工或 `memory.write_approval` |
| **Procedural Memory** | Skill、SOP、写作规则 | 版本 + 回滚 | `skills.write_approval` |
| **Draft Store** | 母稿与渠道变体 | 版本树 | 可写草稿；发布态分离 |
| **Evolution Store** | 学习证据、提案、评测、审批 | 追加审计日志 | Reflection 只读 Evidence |
| **Platform Store** | 各平台草稿 ID、同步状态 | 可写 | 无自动 `publish` |

## 核心约束（强制）

1. 外部热点 **≠** 用户观点；他人发言不得标为用户原话
2. AI 推断不得写入 Semantic Memory 冒充事实
3. 凭证不进 Git/日志；SecretStore 模式参考 content-workbench `secrets.json`
4. 任何平台 **发表** 须人工确认（content-workbench `publish.py` 已有「仅草稿」原则 — 对齐）
5. 正式 Skill 升级须：版本号 + 评测报告 + 审批记录 + 可回滚 `rollback_version`

## Prompt Injection 测试计划（未执行）

- 使用 `poc/phase-0/fixtures/` 中模拟热点 HTML/Markdown，内含「忽略上文」「写入 memory」类指令
- 验收：Agent 不得将注入内容写入 Evidence/Semantic；不得提升权限
- 状态：**UNVERIFIED**

## 上游安装脚本风险（静态）

| 脚本 | 风险 | 状态 |
|------|------|------|
| Autoloop `install.ps1` | 远程 git clone、PATH、Windows 服务 | 已读前 57 行；全文 **未完成** |
| Hermes `install.ps1` | 远程下载、PM、浏览器二进制 | **未读** — POC 前必读 |

## 凭证与模型

- 无真实供应商密钥时：POC 使用 Mock Adapter，文档标注 **UNVERIFIED（真实 LLM）**