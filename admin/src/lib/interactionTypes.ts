import type { InteractionType } from "../domain/types";

/** 后台各处共用一套题型中文名，避免编辑器、模板库和列表各写一份。 */
export const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  match: "连线配对",
  memory: "翻牌记忆",
  choice: "单选 / 多选",
  order: "排序",
  fill: "填空",
  poll: "投票",
  picture: "看图单选",
  "picture-match": "图片—词语连线",
  situation: "情景选择",
  dialogue: "对话补全",
  "pinyin-match": "拼音—汉字—含义匹配",
  category: "分类归组",
  "word-build": "拼字 / 组词",
  correction: "找错误 / 改错",
  listening: "听音选图 / 选词",
  "read-aloud": "跟读模仿",
  "picture-talk": "看图说话",
  "open-qa": "开放问答"
};

/** 列表等紧凑位置使用的短名。 */
export const INTERACTION_TYPE_SHORT_LABELS: Record<InteractionType, string> = {
  match: "连线",
  memory: "翻牌",
  choice: "选择",
  order: "排序",
  fill: "填空",
  poll: "投票",
  picture: "看图",
  "picture-match": "图词连线",
  situation: "情景",
  dialogue: "对话",
  "pinyin-match": "拼音匹配",
  category: "分类",
  "word-build": "组词",
  correction: "改错",
  listening: "听力",
  "read-aloud": "跟读",
  "picture-talk": "看图说",
  "open-qa": "问答"
};

export const INTERACTION_TYPES = Object.keys(INTERACTION_TYPE_LABELS) as InteractionType[];

/** 只记录参与、不参与分数的题型。其余题型都必须有标准答案并正常计分。 */
const PARTICIPATION_ONLY_TYPES = new Set<InteractionType>([
  "poll",
  "read-aloud",
  "picture-talk",
  "open-qa"
]);

export function isScorableInteractionType(type: InteractionType) {
  return !PARTICIPATION_ONLY_TYPES.has(type);
}

export function interactionTypeLabel(type: InteractionType) {
  return INTERACTION_TYPE_LABELS[type] ?? type;
}

export function interactionTypeShortLabel(type: InteractionType) {
  return INTERACTION_TYPE_SHORT_LABELS[type] ?? type;
}
