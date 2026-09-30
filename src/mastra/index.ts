// ============================================================================
// Mastra 应用入口配置文件
// 职责：统一初始化并导出 Mastra 实例，注册所有工作流、Agent、评分器
//       以及配置存储、日志、可观测性等基础设施
// ============================================================================

// --- Mastra 核心框架与基础设施导入 ---
import { Mastra } from "@mastra/core/mastra";           // Mastra 核心类
import { PinoLogger } from "@mastra/loggers";           // Pino 日志适配器
import { LibSQLStore } from "@mastra/libsql";           // LibSQL 持久化存储
import {
  Observability,                                         // 可观测性配置入口
  DefaultExporter,                                       // 默认导出器（写入本地存储供 Studio 使用）
  CloudExporter,                                         // 云端导出器（发送到 Mastra Cloud）
  SensitiveDataFilter,                                   // 敏感数据过滤器（脱敏密码/Token/密钥）
} from "@mastra/observability";

// --- 业务模块导入 ---
import { weatherWorkflow } from "./workflows/weather-workflow";  // 天气查询工作流
import { weatherAgent } from "./agents/weather-agent";           // 天气 Agent

// --- 评估评分器导入（用于衡量 Agent 表现） ---
import {
  toolCallAppropriatenessScorer,                    // 工具调用合理性评分器
  completenessScorer,                               // 回答完整性评分器
  translationScorer,                                // 翻译质量评分器
} from "./scorers/weather-scorer";

// --- Mastra 实例初始化与全局配置 ---
export const mastra = new Mastra({
  // 注册所有可用的工作流
  workflows: { weatherWorkflow },

  // 注册所有可用的 Agent
  agents: { weatherAgent },

  // 注册用于评估 Agent 输出质量的评分器
  scorers: {
    toolCallAppropriatenessScorer,
    completenessScorer,
    translationScorer,
  },

  // 持久化存储：使用本地 LibSQL 文件数据库
  storage: new LibSQLStore({
    id: "mastra-storage",
    url: "file:./mastra.db",                         // 存储可观测性数据、评分结果等
  }),

  // 日志配置：基于 Pino 的结构化日志
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",                                   // 日志级别：info / debug / warn / error
  }),

  // 可观测性配置：链路追踪、数据导出、敏感数据过滤
  observability: new Observability({
    configs: {
      default: {
        serviceName: "mastra",
        exporters: [
          new DefaultExporter(),                     // 链路追踪写入本地存储，供 Mastra Studio 展示
          new CloudExporter(),                       // 可选：发送到 Mastra Cloud（需配置 MASTRA_CLOUD_ACCESS_TOKEN）
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(),                 // 自动脱敏链路中的敏感字段
        ],
      },
    },
  }),
});
