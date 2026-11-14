# P0-01：开源代码静态审查

审查方式：浅克隆 `main` 分支至 `D:\Person\_phase0-audit-temp\`（**未**运行各仓库 `install.sh` / `install.ps1`）。结论标注 **VERIFIED**（读过源码/README/包声明）或 **UNKNOWN**（未执行运行时验证）。

---

## 能力对比矩阵（概要）

| 维度 | content-workbench | agent-autoloop | hermes-agent |
|------|-------------------|----------------|--------------|
| 核心使命 | 个人内容工作台（素材→选题→母稿→多渠道草稿） | 事件驱动 Agent 编排与人工审批 | 通用 Agent Runtime（CLI/Gateway/Skills/Memory） |
| License | MIT | MIT | MIT |
| 运行时 | Python 3.13+ / FastAPI；React+Tiptap | Node.js ≥24，TypeScript | Python（PM 管理 3.14 等）；Windows 原生安装文档齐全 |
| 持久化 | SQLite（单文件，用户数据目录） | SQLite 事件溯源 + 投影 | `HERMES_HOME` 下会话/配置/Skill/Memory |
| 审批 | 产品内人工确认发表；无通用审批卡协议 | **一级公民**（`ask` 卡、answer、resume） | Skill/Memory `write_approval`、危险命令门控 |
| 自进化 | `learning.py` 改稿习惯（非 Skill 版本注册表） | 无内置 Evolution Engine | Background learning + Skill 审批 + Curator |
| Windows | **UNVERIFIED**（README 主打 macOS） | **VERIFIED** 有 `install.ps1`、`tests/windows.test.ts` | **VERIFIED** 文档 `windows-native.md`；本机 CLI **未安装** |
| 与 Creator OS 关系 | **Adapter/参考实现**（编辑器与渠道） | **调度中台候选** | **Agent Runtime 候选** |

---

## 1. content-workbench

| 项 | 值 |
|----|-----|
| Commit SHA | `d9044c4477f136e35a061689afbe50f9f83abcd0` |
| License | MIT |
| 技术栈 | Python 3.13+、uv、FastAPI、SQLite；前端 Vite 6、React 19、Tiptap 3、`vitest` |
| 引擎要求 | `pyproject.toml`: `requires-python = ">=3.13"`；README：Node 22+、ffmpeg、Claude Code |

### 核心目录

```
content-workbench/
├── src/content_workbench/   # FastAPI 应用与业务
├── web/src/                 # 编辑器与各页面
├── tests/                   # pytest（13 个测试模块级文件）
└── deploy/                  # macOS launchd 示例
```

### 核心模块职责（可复用路径）

| 模块 | 路径 | 职责 |
|------|------|------|
| 应用入口 / API | `src/content_workbench/app.py` | HTTP API、路由聚合 |
| 数据模型 | `src/content_workbench/db.py` | SQLite schema：materials, ideas, drafts, versions, comments, edit_rounds… |
| RichEditor | `web/src/RichEditor.tsx` | Markdown ↔ Tiptap；表格/图/视频节点 |
| Comment Anchors | `web/src/commentAnchors.ts` | 划词锚点与侧栏批注 |
| 批注业务 | `src/content_workbench/comments.py` | 服务端批注与 AI 修订 |
| Draft / Revision | `db.py` `draft_versions` + `learning.py` | 版本链与改稿轮次 |
| 渠道 X | `src/content_workbench/xarticle.py`, `publish.py` | X Articles 草稿 API |
| 公众号 | `publish.py` | 草稿箱 `draft/add` |
| 知识星球 | `src/content_workbench/zsxq.py` | 网页接口存草稿（非官方开放 API） |
| 小红书 | `src/content_workbench/xhs.py` | 图文生成与导出 |
| 图片视频 | `images.py`, `clips.py`, `video.py` | 本机处理与 remote 映射 |
| 凭证 | `config.py` + `SecretStore`（见 `publish.py` 引用） | `secrets.json`，页面不落明文 |
| 改稿学习 | `src/content_workbench/learning.py` | diff 收集 → 习惯写入（非 Hermes Skill 形态） |
| LLM | `src/content_workbench/llm.py` | 调用本机 Claude Code |

### 主要数据模型（VERIFIED：`db.py`）

- **素材链**：`materials` → `ideas`（含 `quotes` JSON 用户原话）→ `drafts`
- **版本**：`draft_versions`（`origin` 区分 AI/人工）
- **批注**：`comments`（`quote`/`prefix`/`suffix` 锚点）
- **发布记录**：`publications`（`state`: sent/failed/unknown，不确定不重试）
- **改稿学习**：`edit_rounds` + `habits` 相关表（见 `learning.py`）

### 工作流机制

- **非 Agent 编排**：FastAPI + 后台 jobs（`jobs.py`），同步/异步任务在进程内完成。
- **人机环**：编辑页批注 →「按批注修改」→ LLM；发表前 UI 确认（`publish.py` 安全规则注释）。

### 持久化

- 单 SQLite 文件于 `data_dir()`（默认 `~/.local/share/content-workbench/`），权限 0700/0600（README）。

### 权限与安全

- WebAuthn passkey / Cloudflare Access（可选）
- 平台 OAuth 在 `secrets.json`
- 不自动发表；`unknown` 发布状态不自动重试

### 测试覆盖

- Python：`tests/` 约 13 模块（`test_comments.py`, `test_longform.py` 等）— **VERIFIED 存在，未在本机执行**
- 前端：`web/src/RichEditor.test.ts` + `vitest`

### Windows 兼容性

- README 安装路径以 **macOS + launchd + mlx-whisper** 为主 — **UNVERIFIED 能否完整跑通**
- 无 Windows 专用部署文档；Python/Node 部分理论上可移植，**转写/视频链路可能依赖 Apple 栈** — **UNKNOWN**

### 复用建议（对 AI Creator OS）

| 分类 | 项 |
|------|-----|
| **可直接复用（需授权/Fork 合规）** | 编辑器与批注模型思路：`RichEditor.tsx`、`commentAnchors.ts`；SQLite 草稿/版本/批注 schema 设计 |
| **Adapter 接入** | `publish.py` / `xarticle.py` / `zsxq.py` 作为「渠道草稿推送」参考实现，包在 Creator OS Platform Store 适配层后 |
| **需改造** | `learning.py`：习惯学习需对齐 Evolution Store + Skill Registry，不能照搬为 Hermes Skill |
| **自研** | 热点采集与「用户原话/热点」边界；X 热点匹配；Autoloop 审批与多 Agent 编排 |
| **不建议强依赖** | 整机产品 Fork 为 Creator OS 内核（Persona/Claude Code 强绑定；macOS 假设）；知识星球非官方接口 |

---

## 2. agent-autoloop

| 项 | 值 |
|----|-----|
| Commit SHA | `680c80ee0821e6f6dc03b4778b43f8cb5f0463b0` |
| License | MIT |
| 技术栈 | Node.js ≥24、TypeScript、`node:sqlite`、事件溯源 |
| 安装 | `install.ps1` / `install.sh` → `~/.agent-autoloop`；POC 沙盒 **`~\.agent-autoloop-phase0` 已执行**（2026-11-14） |

### 核心目录

```
agent-autoloop/
├── kernel/          # store, decide, rules, evolve, http…
├── host/            # hub 进程、服务、Windows 相关
├── worker/          # Agent 子进程执行 turn
├── protocol/        # JSON Schema 事件/回执协议
├── plugins/         # claude, codex, command, feishu, delivery…
├── tests/           # 94 个 *.test.ts（含量产级 simulation/crash）
└── sim/             # 崩溃与幂等随机测试
```

### 核心概念（VERIFIED：源码 + `protocol/schema.json`）

| 概念 | 实现要点 |
|------|----------|
| **Event** | `protocol/schema.json` `$defs.event`：`id`, `type`, `subject`, `summary`, `detail`, `link`, `hops` |
| **Rule** | `kernel/rules.ts`：`when` 为 event filter 或 cron；**`to`** 指定 agents 表中的 Agent |
| **Agent 插件** | `agents.<id>.use` 指向插件（如 `command`、`claude`），与 Rule 的 `to` 区分 |
| **Run** | Worker 执行一次 agent turn，带 `session`/`resume` |
| **Session** | Agent 插件解析 stdout（如 Claude `--session-id` / `--resume`） |
| **Receipt** | Agent 输出 JSON 块：`ask` / `notice` / `resolve` / `later` / `events` |
| **Approval Card** | `ask` 含 `title`, `text`, `options`（2–5 项）；`agent-autoloop answer` |
| **Event Sourcing** | `kernel/store.ts`：`facts` 表追加，投影 `evolve.ts` |
| **幂等/冲突** | `commit` 检测 seq 冲突；测试覆盖 concurrent-writes、simulation |
| **Retry/Resume** | README：失败后同 session 重试；`resume: true` 规则 |

### Agent 执行机制

- Hub（`host/`）根据规则 dispatch → Worker（`worker/worker.ts`）spawn agent
- **通用命令 Agent**：`plugins/command/agent.ts` — `{prompt}`, `{context}` 占位符；stdout 解析为 text/error
- **Claude 适配**：`plugins/claude/agent.ts` — `stream-json` 解析 `session_id`、`usage`、`receiptBlock`
- README **VERIFIED** 列出 Hermes：`hermes chat -Q -q {prompt}` 作为 command agent 示例

### 持久化

- SQLite：`facts` + 投影表（`kernel/evolve.ts`），仅 `store.ts` 追加

### 权限与安全

- `kernel/credentials.ts`、master-key 测试
- Worker 在规则 **`cwd` 下启动进程**（工作目录隔离，**非** OS 级沙箱）；Windows 测试关注 PowerShell 注入与路径（`tests/windows.test.ts`）

### 测试覆盖

- **VERIFIED**：94 个测试文件，含 `crash-smoke`、`simulation`、`windows.test.ts`（Windows 上才跑平台相关用例）
- **本机未执行** `npm test`

### Windows 兼容性

- `install.ps1`：检查 Node major ≥24，克隆 release tag 到 `%USERPROFILE%\.agent-autoloop`
- `worker/windows.ps1`、`tests/windows-service.test.ts` 等 — **设计上支持 Windows**
- **本机（2026-11-14）**：nvm 当前 **24.9.0**；沙盒 `agent-autoloop doctor` 通过（Codex 未登录）

### 复用建议

| 分类 | 项 |
|------|-----|
| **可直接复用** | 协议与内核思路；`plugins/command` 作为 Hermes Adapter 模板 |
| **Adapter** | 新建 `plugins/hermes/agent.ts`（或 rules 级 command + 解析 `session_id:` stderr） |
| **需改造** | 业务事件类型与 Creator OS Evidence Store 的映射；卡片 UI 与桌面/飞书通道选型 |
| **自研** | 内容域规则集、与 Draft Store 的集成 API |
| **不建议依赖** | 将内容生产 UI 塞进 Autoloop 仓库 |

---

## 3. hermes-agent

| 项 | 值 |
|----|-----|
| Commit SHA | `4b40ffb0ad6d7da5d3260f5e499e1691508dd4d5` |
| License | MIT |
| 技术栈 | Python monorepo：`hermes_cli/`, `gateway/`, `agent/`, `tools/`, `skills/`, `tests/`（体量极大） |
| CLI | **PATH 未注册**；独立目录 `D:\Person\_phase0-hermes-poc\hermes-agent\.hermes\bin\hermes.exe` **存在**（v0.23.1）；`install.ps1` 曾在 PM 下载阶段报错 **仍保留失败记录** |

### 核心目录（顶层）

| 目录 | 职责（文档+路径推断，VERIFIED 目录存在） |
|------|-------------------------------------------|
| `hermes_cli/` | CLI 入口、session mixin、TUI、`-Q` 非交互 |
| `gateway/` | 多平台网关、会话 RPC |
| `agent/` | Agent 运行时核心 |
| `tools/` | `skill_manager_tool.py`, `skills_guard.py`, memory 工具 |
| `skills/` | 内置 Skill |
| `cron/` | 定时任务（**POC 应禁用与 Autoloop 重复的业务 cron**） |
| `tests/` | 大量 Python 测试 |

### Agent / Session 机制（静态）

- CLI：`cli.py` + `CLISessionMixin`；测试夹具显示 `hermes chat -Q` 在 stderr 输出 `session_id: <sid>`（`tests/gateway/fixtures/cli_launch_policy_probe.py`）— **VERIFIED 测试文档化行为，本机未跑**
- Session 恢复：gateway RPC `session.resume`, `prompt.submit`（同文件）
- Cron session：`cron/AGENTS.md` — `skip_memory=True`，独立 session

### Memory / Skill / 审批（VERIFIED：官方 configuration.md + 源码）

| 配置键 | 说明 |
|--------|------|
| `skills.write_approval` | Skill 写入暂存 `~/.hermes/pending/skills/`，`/skills approve` |
| `memory.write_approval` | Memory 写入审批，同机制 |
| `skills.guard_agent_created` | 默认 **false**；`tools/skill_manager_tool.py` `_guard_agent_created_enabled()`；后台 review 仍可扫描 |

Profile / 隔离：

- `HERMES_HOME` 为用户数据根（安装脚本 Windows：`%LOCALAPPDATA%\hermes`）
- 多 Profile：`website/docs/user-guide/multi-profile-gateways.md`（**未通读全文**）；POC 须用 **独立 `HERMES_HOME` 或官方 multiplexer profile**，禁止猜目录

### Background Learning

- 与 Curator、`write_approval` 交叉 — 见 `website/docs/user-guide/features/curator.md`（**UNVERIFIED 运行时**）

### 测试覆盖

- 仓库含 `tests/` + `tests-js/` + `evals/` — 规模远大于另两项目 — **未在本机执行**

### Windows 兼容性

- 官方：`website/docs/user-guide/windows-native.md` — PowerShell `install.ps1`，无管理员
- **暂停项**：按纪律 **未运行** `iex (irm ...install.ps1)`（需你批准并知悉其会修改 User PATH、下载 PM 依赖）

### 复用建议

| 分类 | 项 |
|------|-----|
| **可直接复用** | Skill/Memory 审批链；CLI `-Q` 自动化；Session resume 协议（经实测固化 Adapter） |
| **Adapter** | Autoloop `command` agent + stderr/stdout Session 解析 |
| **需改造** | 将「Writer Skill 进化」映射到 Hermes pending skills + 外部 Evolution Store |
| **自研** | 评测引擎、Evidence Store 不可变层、渠道母稿模型 |
| **不建议** | POC 中启用 Hermes Cron 与 Autoloop 双调度同一业务；在生产 Skill 目录试验 |

---

## 十问预审（Phase 0 结束需定论 — 当前为 **初步 ASSUMPTION**）

| # | 问题 | 当前判断 | 信心 |
|---|------|----------|------|
| 1 | content-workbench 哪些模块值得复用？ | 编辑器/批注/草稿版本/渠道推送 **参考** | 高（代码） |
| 2 | 是否 Fork？ | **选择性 Fork 或 MIT 摘模块**，非整机 Fork | 中 |
| 3 | Autoloop 作唯一调度中台？ | **倾向 GO**，待 P0-02 | 中 |
| 4 | Hermes 作主 Runtime？ | **倾向 GO**，待 Windows 安装与 P0-03 | 低 |
| 5 | Session 谁管？ | Autoloop 记 run.session；Hermes 记 Agent session；Adapter 同步 | 中 |
| 6 | Memory/Skill 边界？ | Hermes=程序性；Creator OS 自研 Semantic/Evidence | 中 |
| 7 | Evolution 自研部分？ | 评测、留样、Registry 版本、与 habits 对齐 | 高 |
| 8 | Windows 完整运行？ | Autoloop **可能**；workbench **UNKNOWN**；Hermes 文档称支持 **UNVERIFIED** | 低 |
| 9 | 外部 API 限制？ | 小红书无发布 API；星球非官方；X Premium/计费等 — README 已写明 | 高 |
| 10 | V0.1 架构？ | 见 [03-integration-architecture.md](./03-integration-architecture.md) | 草案 |

**总 GO/NO-GO**：**暂缓** — 完成 P0-02～05 后再定论。