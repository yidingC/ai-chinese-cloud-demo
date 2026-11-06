import { beforeEach, describe, expect, it } from "vitest";
import "../admin/src/lib/platform";
import { platform } from "../admin/src/lib/platform";
import { buildTeacherLiveDemo } from "../admin/src/lib/teacherLiveDemo";
import { buildTeacherLiveRoundDemo, ROUND_POINTS } from "../admin/src/lib/teacherLiveRoundDemo";

describe("teacher live round demo", () => {
  beforeEach(() => {
    platform.resetDemo();
  });

  function buildRounds() {
    const state = platform.getState();
    const snapshot = buildTeacherLiveDemo(
      state,
      "teacher-lina",
      "session-live",
      new Date("2026-09-21T10:00:00+08:00").getTime()
    );
    expect(snapshot).not.toBeNull();
    return buildTeacherLiveRoundDemo(snapshot!);
  }

  it("uses one 18-person dataset for every configured round", () => {
    const rounds = buildRounds();
    const live = rounds.find((round) => round.status === "live");

    expect(rounds).toHaveLength(3);
    expect(rounds.map((round) => round.roundNumber)).toEqual([1, 2, 3]);
    expect(rounds.every((round) => round.participantCount === 18 && round.ranking.length === 18)).toBe(true);
    expect(rounds.every((round) => round.roundTotal === 3 && round.pointsPerRound === ROUND_POINTS)).toBe(true);
    expect(live?.completedCount).toBe(4);
    expect(live?.startedCount).toBe(8);
    expect(live?.notCompletedCount).toBe(14);
    expect(live?.fastestSeconds).toBeGreaterThan(0);
  });

  it("derives total score, stars and tied ranks from completed rounds", () => {
    const live = buildRounds().find((round) => round.status === "live");
    expect(live).toBeDefined();

    const completedRows = live!.ranking.filter((row) => row.roundCompleted);
    const incompleteRows = live!.ranking.filter((row) => !row.roundCompleted);

    expect(completedRows).toHaveLength(4);
    expect(completedRows.every((row) => row.roundScore === 5)).toBe(true);
    expect(completedRows.every((row) => row.totalScore === 10 && row.totalRank === 1)).toBe(true);
    expect(completedRows.every((row) => row.starsEarned === 2 && row.starsTotal === 3)).toBe(true);
    expect(incompleteRows).toHaveLength(14);
    expect(incompleteRows.every((row) => row.roundScore === 0)).toBe(true);
    expect(incompleteRows.every((row) => row.totalScore === 5 && row.totalRank === 5)).toBe(true);
    expect(incompleteRows.every((row) => row.starsEarned === 1 && row.starsTotal === 3)).toBe(true);
    expect(live!.ranking.every((row) => row.maxTotalScore === 15)).toBe(true);
    expect(live!.ranking.every((row) => row.starsEarned === row.totalScore / ROUND_POINTS)).toBe(true);
  });

  it("separates per-round speed ranks from total ranks", () => {
    const live = buildRounds().find((round) => round.status === "live");
    expect(live).toBeDefined();

    const speedRanks = live!.ranking
      .map((row) => row.speedRank)
      .filter((rank): rank is number => rank !== null)
      .sort((a, b) => a - b);

    expect(speedRanks).toEqual(Array.from({ length: 4 }, (_, index) => index + 1));
    expect(live!.ranking.filter((row) => !row.roundCompleted).every((row) => row.speedSeconds === null && row.speedRank === null)).toBe(true);
  });

  it("orders detail rows by completion, correctness and speed without changing tied total ranks", () => {
    const live = buildRounds().find((round) => round.status === "live");
    expect(live).toBeDefined();

    const firstIncompleteIndex = live!.ranking.findIndex((row) => !row.roundCompleted);
    expect(firstIncompleteIndex).toBeGreaterThan(0);
    expect(live!.ranking.slice(0, firstIncompleteIndex).every((row) => row.roundCompleted)).toBe(true);
    expect(live!.ranking.slice(firstIncompleteIndex).every((row) => !row.roundCompleted)).toBe(true);

    const completedRows = live!.ranking.slice(0, firstIncompleteIndex);
    completedRows.forEach((row, index) => {
      const next = completedRows[index + 1];
      if (!next) return;
      expect(row.correctItemCount).toBeGreaterThanOrEqual(next.correctItemCount);
      if (row.correctItemCount === next.correctItemCount) {
        expect(row.speedSeconds ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
          next.speedSeconds ?? Number.POSITIVE_INFINITY
        );
      }
    });

    const topScore = completedRows[0]?.totalScore;
    const tiedLeaders = live!.ranking.filter((row) => row.totalScore === topScore);
    expect(new Set(tiedLeaders.map((row) => row.totalRank))).toEqual(new Set([1]));
  });

  it("tracks question completion independently from correctness", () => {
    const live = buildRounds().find((round) => round.status === "live");
    expect(live).toBeDefined();

    const completedRows = live!.ranking.filter((row) => row.roundCompleted);
    expect(completedRows.every((row) => row.answeredItemCount === row.itemCount)).toBe(true);
    expect(completedRows.every((row) => row.itemResults.length === row.itemCount)).toBe(true);
    expect(completedRows.some((row) => row.itemResults.some((result) => !result.correct))).toBe(true);

    const partialRows = live!.ranking.filter((row) => row.answeredItemCount > 0 && !row.roundCompleted);
    expect(partialRows.length).toBeGreaterThan(0);
    expect(partialRows.every((row) => row.answeredItemCount < row.itemCount)).toBe(true);
    expect(partialRows.every((row) => row.itemResults.length === row.answeredItemCount)).toBe(true);
  });

  it("derives per-question accuracy from the actual responses", () => {
    const rounds = buildRounds();
    const completed = rounds.find((round) => round.status === "completed");
    const live = rounds.find((round) => round.status === "live");
    const upcoming = rounds.find((round) => round.status === "upcoming");
    expect(completed).toBeDefined();
    expect(live).toBeDefined();
    expect(upcoming).toBeDefined();

    expect(completed!.items.map((item) => item.answeredCount)).toEqual([18, 18]);
    expect(completed!.items.map((item) => item.correctRate)).toEqual([78, 83]);
    expect(live!.items.map((item) => item.answeredCount)).toEqual([8, 4, 4, 4]);
    expect(live!.items.map((item) => item.correctRate)).toEqual([88, 75, 75, 100]);
    expect(upcoming!.items.every((item) => item.answeredCount === 0 && item.correctCount === 0 && item.correctRate === null)).toBe(true);
  });

  it("uses only fully correct completed rows for the perfect-round celebration", () => {
    const live = buildRounds().find((round) => round.status === "live");
    expect(live).toBeDefined();

    const perfectRows = live!.ranking.filter((row) =>
      row.roundCompleted &&
      row.itemCount > 0 &&
      row.itemResults.length === row.itemCount &&
      row.itemResults.every((item) => item.correct)
    );

    expect(perfectRows.map((row) => row.name)).toEqual(["Anisa"]);
  });

  it("keeps upcoming rounds empty while preserving totals and the preceding row order", () => {
    const rounds = buildRounds();
    const live = rounds.find((round) => round.status === "live");
    const upcoming = rounds.find((round) => round.status === "upcoming");
    expect(upcoming).toBeDefined();
    expect(upcoming!.completedCount).toBe(0);
    expect(upcoming!.startedCount).toBe(0);
    expect(upcoming!.fastestSeconds).toBeNull();
    expect(upcoming!.ranking.every((row) => !row.roundCompleted && row.roundScore === 0)).toBe(true);
    expect(upcoming!.ranking.every((row) => row.answeredItemCount === 0 && row.itemResults.length === 0)).toBe(true);
    expect(upcoming!.ranking.every((row) => row.speedSeconds === null && row.speedRank === null)).toBe(true);
    expect(upcoming!.ranking.some((row) => row.totalScore > 0)).toBe(true);
    expect(upcoming!.ranking.map((row) => row.studentId)).toEqual(live!.ranking.map((row) => row.studentId));
  });
});
