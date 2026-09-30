// ============================================================================
// 天气查询 Agent 配置文件
// 职责：定义 Weather Agent 的身份、行为规范（instructions）、
//       可用工具、评估评分策略以及记忆能力
// ============================================================================

// --- 核心模块导入 ---
import { Agent } from '@mastra/core/agent';     // Mastra Agent 基类
import { Memory } from '@mastra/memory';            // Agent 记忆模块（多轮对话上下文）
import { weatherTool } from '../tools/weather-tool'; // 天气查询工具（调用外部 API）
import { scorers } from '../scorers/weather-scorer';   // 评估评分器集合

// --- Weather Agent 实例定义 ---
export const weatherAgent = new Agent({
  id: 'weather-agent',                               // Agent 唯一标识
  name: 'Weather Agent',                           // Agent 显示名称
  // Agent 的系统提示词（System Prompt）：定义角色定位与行为规则
  instructions: `
      You are a helpful weather assistant that provides accurate weather information and can help planning activities based on the weather.

      Your primary function is to help users get weather details for specific locations. When responding:
      - Always ask for a location if none is provided
      - If the location name isn't in English, please translate it
      - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
      - Include relevant details like humidity, wind conditions, and precipitation
      - Keep responses concise but informative
      - If the user asks for activities and provides the weather forecast, suggest activities based on the weather forecast.
      - If the user asks for activities, respond in the format they request.

      Use the weatherTool to fetch current weather data.
`,
  model: 'openai/gpt-4o',                          // 使用的大模型：OpenAI GPT-4o
  tools: { weatherTool },                             // 挂载可用工具集：允许调用天气查询工具

  // --- 评估评分器配置（用于质量评估与观测）
  // sampling.rate = 1 表示对每次调用都进行评分（100% 采样率）
  scorers: {
    // 评分项 1：工具调用是否合理（是否该用工具、用对工具）
    toolCallAppropriateness: {
      scorer: scorers.toolCallAppropriatenessScorer,
      sampling: {
        type: 'ratio',
        rate: 1,
      },
    },
    // 评分项 2：回答内容是否完整（是否覆盖了所有关键信息）
    completeness: {
      scorer: scorers.completenessScorer,
      sampling: {
        type: 'ratio',
        rate: 1,
      },
    },
    // 评分项 3：非英文地名翻译质量
    translation: {
      scorer: scorers.translationScorer,
      sampling: {
        type: 'ratio',
        rate: 1,
      },
    },
  },

  memory: new Memory(),                              // 启用记忆能力，保持多轮对话上下文
});
