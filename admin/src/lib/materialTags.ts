export const MATERIAL_USAGE_TAGS = ["预习", "课堂使用", "复习"] as const;

const usageTagPriority = new Map<string, number>(MATERIAL_USAGE_TAGS.map((tag, index) => [tag, index]));

export function isMaterialUsageTag(tag: string) {
  return usageTagPriority.has(tag);
}

export function materialTagPriority(tag: string) {
  return usageTagPriority.get(tag) ?? MATERIAL_USAGE_TAGS.length;
}

/** 用途标签固定排在主题标签前，用途标签之间也按固定顺序显示。 */
export function orderMaterialTags(tags: string[]) {
  return [...tags].sort((left, right) => materialTagPriority(left) - materialTagPriority(right));
}
