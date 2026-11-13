import { describe, expect, it } from "vitest";
import type { InteractionItem, InteractionType } from "../admin/src/domain/types";
import { scoreInteractionItems } from "../admin/src/lib/interactionScoring";

function item(id: string, type: InteractionType): InteractionItem {
  return { id, type, prompt: id, explanation: "" };
}

describe("interaction scoring", () => {
  it("excludes polls and speaking participation from both numerator and denominator", () => {
    const items = [
      item("choice", "choice"),
      item("fill", "fill"),
      item("poll", "poll"),
      item("read", "read-aloud"),
      item("talk", "picture-talk"),
      item("qa", "open-qa")
    ];

    expect(scoreInteractionItems(items, { choice: true, fill: false })).toEqual({
      score: 50,
      scoredItemCount: 2,
      wrongItemIds: ["fill"]
    });
  });

  it("records participation without producing a numeric score when every item is unscored", () => {
    const items = [
      item("poll", "poll"),
      item("read", "read-aloud"),
      item("talk", "picture-talk"),
      item("qa", "open-qa")
    ];

    expect(scoreInteractionItems(items, { poll: true, read: true, talk: true, qa: true })).toEqual({
      score: null,
      scoredItemCount: 0,
      wrongItemIds: []
    });
  });
});
