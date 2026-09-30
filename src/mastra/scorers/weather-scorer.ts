// ============================================================================
// 天气 Agent 评估评分器集合
// 职责：定义三类评分器，从不同维度评估 Weather Agent 的输出质量
//       1. 工具调用合理性（内置评分器）
//       2. 回答完整性（内置评分器）
//       3. 非英文地名翻译质量（自定义 LLM-as-Judge 评分器，4 步流水线）
// ============================================================================

// --- 依赖导入 ---
import { z } from 'zod';                                                              // Zod 模式验证，用于约束评分输出结构
import { createToolCallAccuracyScorerCode } from '@mastra/evals/scorers/prebuilt';      // 内置：工具调用准确性评分器（代码级检测）
import { createCompletenessScorer } from '@mastra/evals/scorers/prebuilt';             // 内置：回答完整性评分器（LLM 判断）
import {
  getAssistantMessageFromRunOutput,                                                     // 工具函数：从 Run 输出中提取 Assistant 消息
  getUserMessageFromRunInput,                                                           // 工具函数：从 Run 输入中提取 User 消息
} from '@mastra/evals/scorers/utils';
import { createScorer } from '@mastra/core/evals';                                        // 评分器工厂：用于构建自定义评分流水线

// ============================================================================
// 评分器 1：工具调用合理性（基于 Mastra 内置的代码检测评分器）
// 逻辑：判断 Agent 是否在需要获取天气数据时正确调用了 weatherTool
// ============================================================================
export const toolCallAppropriatenessScorer = createToolCallAccuracyScorerCode({
  expectedTool: 'weatherTool',                                                        // 预期应被调用的工具名
  strictMode: false,                                                                   // 非严格模式：允许未调用工具（如用户未给位置时先追问）
});

// ============================================================================
// 评分器 2：回答完整性（基于 Mastra 内置的 LLM-as-Judge 评分器）
// 逻辑：让 LLM 判断 Assistant 的回答是否完整覆盖了用户需求要点
// ============================================================================
export const completenessScorer = createCompletenessScorer();

// ============================================================================
// 评分器 3：非英文地名翻译质量（自定义 LLM-as-Judge 评分器，4 步流水线）
// 流水线阶段：preprocess → analyze → generateScore → generateReason
// ============================================================================
export const translationScorer = createScorer({
  id: 'translation-quality-scorer',                                                   // 评分器唯一 ID
  name: 'Translation Quality',                                                        // 评分器显示名称
  description:
    'Checks that non-English location names are translated and used correctly',      // 评分器描述
  type: 'agent',                                                                      // 评分类型：agent（使用 Agent 作为 Judge）
  // Judge 配置：由哪个 LLM 模型以什么身份执行评分
  judge: {
    model: 'openai/gpt-4o',
    instructions:
      'You are an expert evaluator of translation quality for geographic locations. ' +
      'Determine whether the user text mentions a non-English location and whether the assistant correctly uses an English translation of that location. ' +
      'Be lenient with transliteration differences and diacritics. ' +
      'Return only the structured JSON matching the provided schema.',
  },
})
  // --- 阶段 1：预处理 —— 从完整 Run 记录中提取出用户输入与助手输出的纯文本
  .preprocess(({ run }) => {
    const userText = getUserMessageFromRunInput(run.input) || '';
    const assistantText = getAssistantMessageFromRunOutput(run.output) || '';
    return { userText, assistantText };
  })
  // --- 阶段 2：分析 —— 构造 Prompt 让 Judge LLM 输出结构化分析结果
  .analyze({
    description:
      'Extract location names and detect language/translation adequacy',
    // 输出 JSON 结构约束（Zod Schema）
    outputSchema: z.object({
      nonEnglish: z.boolean(),                                                        // true = 用户输入中出现了非英文地名
      translated: z.boolean(),                                                         // true = Assistant 正确翻译了该地名
      confidence: z.number().min(0).max(1).default(1),                                 // Judge 对判断的置信度 0-1
      explanation: z.string().default(''),                                             // Judge 的判断依据文字说明
    }),
    // 构造 Judge LLM 的 Prompt 模板，注入阶段 1 的预处理结果
    createPrompt: ({ results }) => `
            You are evaluating if a weather assistant correctly handled translation of a non-English location.
            User text:
            """
            ${results.preprocessStepResult.userText}
            """
            Assistant response:
            """
            ${results.preprocessStepResult.assistantText}
            """
            Tasks:
            1) Identify if the user mentioned a location that appears non-English.
            2) If non-English, check whether the assistant used a correct English translation of that location in its response.
            3) Be lenient with transliteration differences (e.g., accents/diacritics).
            Return JSON with fields:
            {
            "nonEnglish": boolean,
            "translated": boolean,
            "confidence": number, // 0-1
            "explanation": string
            }
        `,
  })
  // --- 阶段 3：生成分数 —— 将阶段 2 的结构化分析结果映射为 0-1 的数值评分
  .generateScore(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};
    if (!r.nonEnglish) return 1;                                                      // 场景不适配（无非英文地名）：给满分（通过）
    if (r.translated)
      return Math.max(0, Math.min(1, 0.7 + 0.3 * (r.confidence ?? 1)));               // 已翻译：基础分 0.7 + 置信度加权 0.3，最高 1.0
    return 0;                                                                           // 非英文但未翻译：给 0 分（不通过）
  })
  // --- 阶段 4：生成评分理由 —— 输出人类可读的评分说明文字（用于 Studio 展示）
  .generateReason(({ results, score }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return `Translation scoring: nonEnglish=${r.nonEnglish ?? false}, translated=${r.translated ?? false}, confidence=${r.confidence ?? 0}. Score=${score}. ${r.explanation ?? ''}`;
  });

// ============================================================================
// 评分器统一导出集合
// ============================================================================
export const scorers = {
  toolCallAppropriatenessScorer,
  completenessScorer,
  translationScorer,
};
