import { beforeEach, describe, expect, it } from "vitest";
import "../admin/src/lib/platform";
import { platform } from "../admin/src/lib/platform";
import { buildTeacherLiveDemo } from "../admin/src/lib/teacherLiveDemo";

describe("teacher live classroom demo", () => {
  beforeEach(() => {
    platform.resetDemo();
  });

  it("builds a current live classroom from the teacher's configured lesson", () => {
    const state = platform.getState();
    const demo = buildTeacherLiveDemo(state, "teacher-lina", "session-live", new Date("2026-09-21T10:00:00+08:00").getTime());

    expect(demo).not.toBeNull();
    expect(demo?.session.id).toBe("session-live");
    expect(demo?.presentCount).toBe(18);
    expect(demo?.participantTotal).toBe(24);
    expect(demo?.interactions.length).toBeGreaterThanOrEqual(3);
    expect(demo?.interactions.map((interaction) => interaction.status)).toEqual(["completed", "live", "upcoming"]);
    expect(demo?.courseware[0]?.material.id).toBe("material-live-slides");
  });

  it("provides answer counts and ranking data for each live interaction", () => {
    const state = platform.getState();
    const demo = buildTeacherLiveDemo(state, "teacher-lina", "session-live", new Date("2026-09-21T10:00:00+08:00").getTime());
    const live = demo?.interactions.find((interaction) => interaction.status === "live");

    expect(live?.answered).toBeGreaterThan(0);
    expect(live?.ranking).toHaveLength(8);
    expect(live?.ranking[0].score).toBeGreaterThan(live?.ranking[4].score ?? 0);
    expect(live?.items.some((item) => item.status === "live")).toBe(true);
    expect(live?.ranking[0].itemResults).toHaveLength(live?.items.length ?? 0);
    expect(live?.ranking[0].itemResults.every((item) => item.correct)).toBe(true);
    expect(live?.ranking[3].itemResults.some((item) => !item.correct)).toBe(true);

    const upcoming = demo?.interactions.find((interaction) => interaction.status === "upcoming");
    expect(upcoming?.items.every((item) => item.answered === 0 && item.status === "upcoming")).toBe(true);
    expect(upcoming?.ranking.every((student) => student.itemResults.length === 0)).toBe(true);
  });

  it("returns null when the selected teacher has no published sessions", () => {
    const state = platform.getState();
    expect(buildTeacherLiveDemo(state, "missing-teacher", undefined, Date.now())).toBeNull();
  });

  it("keeps a blank classroom overview when the session has no live content", () => {
    const state = platform.getState();
    const demo = buildTeacherLiveDemo(state, "teacher-berenice", "club-session-1", Date.now());

    expect(demo).not.toBeNull();
    expect(demo?.session.id).toBe("club-session-1");
    expect(demo?.presentCount).toBe(0);
    expect(demo?.interactions).toHaveLength(0);
    expect(demo?.activityFeed).toHaveLength(0);
  });
});
