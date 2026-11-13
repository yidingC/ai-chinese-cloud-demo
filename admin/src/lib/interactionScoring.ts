import type { InteractionItem } from "../domain/types";
import { isScorableInteractionType } from "./interactionTypes";

export interface InteractionScoreResult {
  score: number | null;
  scoredItemCount: number;
  wrongItemIds: string[];
}

/** 统一计分口径：投票和口语参与题不进入分子或分母。 */
export function scoreInteractionItems(
  items: InteractionItem[],
  results: Record<string, boolean | null>
): InteractionScoreResult {
  const scored = items.filter((item) => isScorableInteractionType(item.type));
  const correctCount = scored.filter((item) => results[item.id] === true).length;
  return {
    score: scored.length ? Math.round((correctCount / scored.length) * 100) : null,
    scoredItemCount: scored.length,
    wrongItemIds: scored.filter((item) => results[item.id] !== true).map((item) => item.id)
  };
}
