# AGENTS.md

本文档为在此代码仓库中工作的 AI 编程助手提供指导说明。

## 项目概览

这是一个基于 TypeScript 编写的 **Mastra** 项目。Mastra 是一个使用现代 TypeScript 技术栈构建 AI 驱动应用与智能体（Agent）的开发框架。

## 常用命令

使用以下命令与项目进行交互。

### 安装依赖

```bash
npm install
```

### 开发模式

运行 `dev` 脚本启动 Mastra Studio，访问地址为 localhost:4111：

```bash
npm run dev
```

### 生产构建

运行 `build` 脚本构建生产环境可用的服务端：

```bash
npm run build
```

## 项目结构

各文件夹用于组织 Agent 相关的资源，如 Agent 定义、工具、工作流等。

| 文件夹                 | 说明                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/mastra`           | 所有 Mastra 相关代码与配置的统一入口                                                                                                       |
| `src/mastra/agents`    | 定义并配置 Agent —— 包含其行为、目标与可用工具                                                                                              |
| `src/mastra/workflows` | 定义多步工作流（Workflow），用于编排 Agent 与工具的协同执行                                                                                  |
| `src/mastra/tools`     | 创建可复用的工具函数，供 Agent 按需调用（通常与 `skills/` 中的 Skill 一一对应）                                                                |
| `src/mastra/mcp`       | （可选）实现自定义 MCP 服务端，将你的工具共享给外部 Agent 使用                                                                                |
| `src/mastra/scorers`   | （可选）定义评分器（Scorer），用于持续评估 Agent 的表现                                                                                       |
| `src/mastra/public`    | （可选）构建时该目录内容会被复制到 `.build/output` 目录下，可在运行时通过服务直接访问                                                          |
| `skills/`              | （可选）面向 AI 编码助手的 Skill 规范文件，每个子目录含 `SKILL.md`，描述工具意图、触发条件与使用方式                                           |

### 顶层文件

顶层文件定义 Mastra 项目的配置方式、构建流程，以及如何与外部环境连接。

| 文件                  | 说明                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/mastra/index.ts` | 中心入口文件，用于配置与初始化 Mastra 实例                                                                  |
| `.env.example`        | 环境变量模板 —— 复制并重命名为 `.env`，然后填入你的[模型服务商](/models)密钥                                  |
| `package.json`        | 定义项目元信息、依赖包以及可用的 npm 脚本                                                                  |
| `tsconfig.json`       | 配置 TypeScript 编译选项，如路径别名、编译设置、构建输出目录                                                |

## Mastra Skills（技能模块）

Skills 是面向两层的能力单元：
- **面向 AI 编码助手层**：存放在 `skills/<skill-name>/SKILL.md`，描述触发条件、代码位置、扩展方法，供 Cursor / Trae / Codex 等 AI 助手在修改代码时参考。
- **面向 Agent 运行时层**：通常对应 `src/mastra/tools/` 下的具体工具实现，并通过 `agents` 配置挂载，供大模型调用。

两者通过约定的命名与 `SKILL.md` 中的"配套代码位置"字段建立关联。

### 本项目已包含的 Skill 示例

| Skill 名称 | 目录 | 运行时工具 | 挂载的 Agent |
| ---------- | ---- | ---------- | ------------ |
| weather-activity-recommender（户外活动推荐） | `skills/weather-activity-recommender/` | `activityRecommenderTool`（`src/mastra/tools/activity-recommender-tool.ts`） | weather-agent |

### 使用 Skills 的典型流程

1. 激活：用户的请求命中 Skill 在 `SKILL.md` 中声明的触发条件（关键词或意图）。
2. 工具调用：Agent 的 LLM 自动选择并调用对应的运行时工具（若需天气数据则先链式调用 `weatherTool` 再传入）。
3. 输出：按照 `instructions` 中约定的格式返回中文活动建议列表。

### 新增一个 Skill 的步骤

1. 在 `skills/<your-skill-name>/` 下创建 `SKILL.md`，填写 frontmatter 与触发规则。
2. 在 `src/mastra/tools/<your-tool>.ts` 中用 `createTool` 编写配套运行时工具，提供 Zod Schema 与 `execute`。
3. 在对应 Agent 配置的 `tools` 字段中挂载工具，并补充 `instructions` 说明调用时机。

## 参考资源

- [Mastra 官方文档](https://mastra.ai/llms.txt)
- [Mastra .well-known Skills 发现服务](https://mastra.ai/.well-known/skills/index.json)
