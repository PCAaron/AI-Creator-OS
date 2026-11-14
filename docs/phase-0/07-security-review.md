# P0-06：安全与数据架构（Phase 0 设计约束）

> 运行时渗透测试与 Prompt Injection 用例见 POC 测试与 [08-test-results.md](./08-test-results.md) — **本文件为架构约束 + Phase 0 已测子集**。

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
3. 凭证不进 Git/日志  
4. 任何平台 **发表** 须人工确认  
5. 正式 Skill 升级须：版本号 + 评测 + 审批 + 可回滚  

## Phase 0 负面测试（已执行 / 计划）

| 场景 | 状态 | 手段 |
|------|------|------|
| Agent 访问 POC 外敏感文件 | **MOCK VERIFIED** | `mock-agent.mjs` + `negative-tests.mjs` |
| 重复事件重复业务结果 | **MOCK VERIFIED** | HTTP duplicate + SQLite `business.sqlite` UNIQUE |
| 路径穿越 / 非法 eventId 文件名 | **MOCK VERIFIED** | `lib/paths.mjs` + `negative-tests.mjs` |
| 审批拒绝仍创建初稿 | **MOCK VERIFIED** | `mock-agent.mjs` + 集成 |
| 未批准 Skill 激活（Mock） | **MOCK VERIFIED** | `self-evolution/run-poc.mjs` |
| 未确认远端副作用 | **MOCK VERIFIED**（选题 POC 无网络） | Mock 不写真实渠道 |
| 外部热点 Prompt 注入 | **NOT TESTED** | 计划用 `poc/phase-0/fixtures/` |
| 第三方发言错误归属 | **NOT TESTED** | — |
| Agent 改 Evidence Store | **NOT TESTED** | — |
| Skill 未经批准激活 | **NOT TESTED** | 依赖 Hermes |
| 未确认远端副作用自动重试 | **NOT TESTED** | — |

### Autoloop 隔离（重要）

| 说法 | 事实 |
|------|------|
| Rule `cwd` | 仅进程 **工作目录** |
| `use: command` | **无**通用 OS 沙箱；子进程继承用户权限 |
| Phase 0 实际手段 | Mock Agent 路径白名单 + 独立沙盒 Home + 无真实 API 凭据 |

## 上游安装脚本风险

| 脚本 | 风险 | 审查/执行 |
|------|------|-----------|
| Autoloop `install.ps1` | clone、PATH、Windows 服务 | 已读核心逻辑；**沙盒已执行** |
| Hermes `install.ps1` | 远程下载、PM、PATH | **部分已读**；执行 **部分成功 + 记录失败** |

## 凭证与模型

- 无真实供应商密钥：Autoloop/Hermes 真实 LLM 路径标 **NOT TESTED**。