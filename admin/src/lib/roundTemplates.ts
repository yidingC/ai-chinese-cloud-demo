import type {
  InteractionRoundScenario,
  InteractionRoundTemplate,
  InteractionTemplate
} from "../domain/types";

export const ROUND_TEMPLATE_SCENARIOS: Array<{
  id: InteractionRoundScenario;
  label: string;
  description: string;
}> = [
  { id: "warmup", label: "破冰热身", description: "快速开场，聚拢注意力" },
  { id: "vocabulary", label: "词汇导入", description: "认词、匹配与听辨" },
  { id: "sentence", label: "句型操练", description: "组句、填空与纠错" },
  { id: "scenario", label: "情景应用", description: "在真实场景里使用语言" },
  { id: "review", label: "复习巩固", description: "归类、回忆与查漏补缺" },
  { id: "speaking", label: "口语表达", description: "跟读、看图说话与开放表达" }
];

export function roundTemplateScenarioLabel(scenarioId: InteractionRoundScenario | string) {
  return ROUND_TEMPLATE_SCENARIOS.find((scenario) => scenario.id === scenarioId)?.label ?? scenarioId;
}

export function countRoundTemplatesByScenario(templates: InteractionRoundTemplate[]) {
  const counts = {} as Record<InteractionRoundScenario, number>;
  ROUND_TEMPLATE_SCENARIOS.forEach((scenario) => {
    counts[scenario.id] = 0;
  });
  templates.forEach((template) => {
    counts[template.scenarioId] = (counts[template.scenarioId] ?? 0) + 1;
  });
  return counts;
}

export function roundTemplateQuestionTemplates(
  template: InteractionRoundTemplate,
  questionTemplates: InteractionTemplate[]
) {
  const byId = new Map(questionTemplates.map((item) => [item.id, item]));
  return template.itemTemplateIds
    .map((id) => byId.get(id))
    .filter((item): item is InteractionTemplate => Boolean(item));
}
