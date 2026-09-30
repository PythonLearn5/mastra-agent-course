// ============================================================================
// 户外活动推荐工具（Weather Activity Recommender Skill 的运行时实现）
// 职责：基于天气条件（温度、湿度、风速、降水、天气类型）判断每项活动是否适宜，
//       返回通过/未通过的活动列表与理由
// ============================================================================

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// 活动规则表：每项活动的判定条件与说明
// 新增活动只需在此数组追加一条即可
// ---------------------------------------------------------------------------
interface ActivityRule {
  key: string;                                                              // 活动唯一键
  name: string;                                                             // 活动显示名称（中文）
  pass: (w: WeatherInput) => boolean;                                       // 判定函数：true = 适合
  reason: string;                                                           // 判定依据文字说明
}

interface WeatherInput {
  temperature: number;                                                      // 气温（℃）
  humidity: number;                                                         // 相对湿度（%）
  windSpeed: number;                                                        // 风速（km/h）
  conditions: string;                                                       // 天气状况文本（英文，如 "Clear sky" / "Heavy rain"）
}

const ACTIVITY_RULES: ActivityRule[] = [
  {
    key: 'picnic',
    name: '野餐',
    pass: (w) => w.temperature >= 15 && w.temperature <= 28
              && w.humidity < 80
              && w.windSpeed < 20
              && !isRainy(w.conditions)
              && !isSnowy(w.conditions),
    reason: '温度 15-28℃、湿度 < 80%、风速 < 20 km/h、无雨雪',
  },
  {
    key: 'hiking',
    name: '徒步/登山',
    pass: (w) => w.temperature >= 5 && w.temperature <= 30
              && w.windSpeed < 30
              && !isHeavyRain(w.conditions)
              && !isSnowy(w.conditions),
    reason: '温度 5-30℃、风速 < 30 km/h、无暴雨/暴雪',
  },
  {
    key: 'running',
    name: '户外跑步',
    pass: (w) => w.temperature >= 0 && w.temperature <= 25
              && w.humidity < 85
              && w.windSpeed < 25
              && !isRainy(w.conditions),
    reason: '温度 0-25℃、湿度 < 85%、风速 < 25 km/h、无降雨',
  },
  {
    key: 'cycling',
    name: '骑行',
    pass: (w) => w.temperature >= 5 && w.temperature <= 32
              && w.windSpeed < 35
              && !isRainy(w.conditions)
              && !isSnowy(w.conditions),
    reason: '温度 5-32℃、风速 < 35 km/h、无雨雪',
  },
  {
    key: 'beach',
    name: '海滩/游泳',
    pass: (w) => w.temperature >= 24 && w.temperature <= 35
              && w.windSpeed < 20
              && isSunnyOrClear(w.conditions),
    reason: '温度 24-35℃、风速 < 20 km/h、晴天为主',
  },
  {
    key: 'skiing',
    name: '滑雪',
    pass: (w) => w.temperature >= -15 && w.temperature <= 2
              && (isSnowy(w.conditions) || w.temperature <= 0),
    reason: '温度 -15~2℃ 且有降雪或零下温度',
  },
  {
    key: 'photography',
    name: '户外摄影',
    pass: (w) => !isHeavyRain(w.conditions)
              && !isThunder(w.conditions)
              && w.windSpeed < 40,
    reason: '无暴雨/雷电、风速 < 40 km/h',
  },
];

// ---------------------------------------------------------------------------
// 天气状况文本判断辅助函数（基于 Open-Meteo weather_code 映射后的文本）
// ---------------------------------------------------------------------------
function isRainy(cond: string): boolean {
  return /rain|drizzle|shower/i.test(cond);
}
function isHeavyRain(cond: string): boolean {
  return /heavy rain|violent|thunderstorm/i.test(cond);
}
function isSnowy(cond: string): boolean {
  return /snow/i.test(cond);
}
function isThunder(cond: string): boolean {
  return /thunder/i.test(cond);
}
function isSunnyOrClear(cond: string): boolean {
  return /clear|sunny|mainly clear/i.test(cond);
}

// ---------------------------------------------------------------------------
// 工具定义：activity-recommender
// ---------------------------------------------------------------------------
export const activityRecommenderTool = createTool({
  id: 'activity-recommender',
  description:
    'Recommend suitable outdoor activities based on current weather conditions. ' +
    'Use this when the user asks what to do, asks for activity suggestions, ' +
    'or inquires whether an activity is possible given the weather.',
  // 输入：完整天气参数（来自 weatherTool 的输出）+ 可选活动偏好
  inputSchema: z.object({
    temperature: z.number().describe('Current temperature in Celsius'),
    humidity: z.number().describe('Relative humidity percentage (0-100)'),
    windSpeed: z.number().describe('Wind speed in km/h'),
    conditions: z.string().describe('Weather condition text, e.g. "Clear sky", "Heavy rain"'),
    preference: z
      .enum(['sport', 'leisure', 'photo', 'any'])
      .default('any')
      .describe('User preference category: sport / leisure / photo / any'),
    limit: z.number().default(3).describe('Max number of recommended activities'),
  }),
  // 输出：推荐活动列表 + 不推荐活动列表 + 总体建议
  outputSchema: z.object({
    recommended: z.array(z.object({
      name: z.string(),
      suitable: z.literal(true),
      reason: z.string(),
    })),
    notRecommended: z.array(z.object({
      name: z.string(),
      suitable: z.literal(false),
      reason: z.string(),
    })),
    summary: z.string(),
  }),
  execute: async (input) => {
    const { temperature, humidity, windSpeed, conditions, preference, limit } = input;

    const weatherInput: WeatherInput = { temperature, humidity, windSpeed, conditions };

    const all = ACTIVITY_RULES.map((rule) => ({
      name: rule.name,
      suitable: rule.pass(weatherInput),
      reason: rule.reason,
      key: rule.key,
    }));

    // 按偏好过滤（any 不过滤）
    const categoryFilter = (k: string) => {
      if (preference === 'any') return true;
      if (preference === 'sport') return ['running', 'cycling', 'hiking', 'skiing'].includes(k);
      if (preference === 'leisure') return ['picnic', 'beach', 'hiking'].includes(k);
      if (preference === 'photo') return ['photography', 'hiking', 'beach'].includes(k);
      return true;
    };

    const passed = all
      .filter((a) => a.suitable && categoryFilter(a.key))
      .slice(0, limit)
      .map(({ name, suitable, reason }) => ({ name, suitable: true as const, reason }));

    const failed = all
      .filter((a) => !a.suitable)
      .map(({ name, suitable, reason }) => ({ name, suitable: false as const, reason }));

    // 生成总结
    const summary =
      passed.length > 0
        ? `基于当前${temperature}℃、${conditions}的天气，推荐优先考虑：${passed.map((p) => p.name).join('、')}。`
        : `当前${temperature}℃、${conditions}的天气下暂无完全匹配偏好的户外活动，建议选择室内活动。`;

    return { recommended: passed, notRecommended: failed, summary };
  },
});
