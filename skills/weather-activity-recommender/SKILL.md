---
name: weather-activity-recommender
description: 基于实时天气条件智能推荐户外活动的 Mastra Skill。当用户查询天气后紧接着询问"我该做什么"、"推荐活动"、"今天适合野餐吗"等意图时，应激活本技能并调用 activityRecommenderTool。关键词：weather, activity, outdoor, recommend, picnic, hiking, sports, 户外活动, 推荐
license: MIT
compatibility: Node.js 22.13.0+, Mastra v1.x
metadata: {"author":"mastra-course","version":"1.0.0","category":"Productivity & Integration"}
---

# Weather Activity Recommender Skill

面向 AI 编码助手的能力说明：当用户需要将天气数据与活动建议结合时，请遵循以下模式。

## 激活条件

触发当用户：
- 查询完天气后追加"适合做什么"、"有什么推荐活动"
- 直接询问某个地点在特定天气下能否进行某项活动（例："明天上海能野餐吗？"）
- 要求基于温度、降水、风力给出户外活动清单

不触发当：
- 仅查询纯天气数据而无活动意图
- 讨论室内活动与天气无关的场景
- 行程规划不涉及天气依赖的活动

## 配套代码位置

- Agent 运行时工具：`src/mastra/tools/activity-recommender-tool.ts`
- 接入位置：`src/mastra/agents/weather-agent.ts` 的 `tools` 字段
- 注册位置：`src/mastra/index.ts`（通过 Agent 自动暴露）

## 调用模式

```typescript
// 调用方式：通过 weatherAgent.generate()，用户自然语言触发
const result = await mastra.getAgent('weather-agent').generate(
  '北京今天适合野餐吗？如果不适合给我两个替代活动。'
);
```

Agent 会自动按以下顺序执行：
1. 调用 `weatherTool` 获取北京实时天气
2. 调用 `activityRecommenderTool` 传入天气参数与活动偏好
3. 以中文输出格式化建议

## 扩展建议

新增活动类别时，只需在 `activity-recommender-tool.ts` 的 `ACTIVITY_RULES` 数组中追加条目：
```typescript
{
  key: 'rock-climbing',
  name: '攀岩',
  pass: (w) => w.windSpeed < 15 && w.temperature >= 10,
  reason: '风速小于 15 km/h 且温度不低于 10℃'
}
```
