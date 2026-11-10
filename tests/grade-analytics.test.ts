import { beforeEach, describe, expect, it } from "vitest";
import "../admin/src/lib/platform";
import { platform } from "../admin/src/lib/platform";
import { buildGradeAnalytics, compositeFromCategories, gradeRangeBounds, relativeGradeRange, selectGradePolicy } from "../admin/src/lib/gradeAnalytics";

describe("class enrollment and formal grade store", () => {
  beforeEach(() => {
    platform.resetDemo();
  });

  it("migrates stable classes, session links, memberships, and the default policy", () => {
    const state = platform.getState();
    expect(state.classes.length).toBeGreaterThan(0);
    expect(state.sessions.every((session) => Boolean(session.classId))).toBe(true);
    expect(state.students.every((profile) => Boolean(profile.primaryClassId))).toBe(true);
    expect(state.classEnrollments.some((item) => item.classId === "class-1" && item.studentId === "student-anisa")).toBe(true);
    expect(selectGradePolicy(state, new Date().toISOString()).weights).toEqual({ interaction: 40, homework: 30, exam: 30 });
  });

  it("auto-enrolls on booking and keeps membership after removing a single member explicitly", () => {
    const session = platform.getState().sessions.find((item) => item.id === "series-session-1")!;
    const booked = platform.bookSession({ studentId: "student-kevin", sessionId: session.id });
    expect(booked.ok).toBe(true);
    let state = platform.getState();
    expect(state.classEnrollments.some((item) => item.classId === session.classId && item.studentId === "student-kevin" && item.status === "active")).toBe(true);

    const removed = platform.removeClassMember({ classId: session.classId, studentId: "student-kevin", actorId: "operator-ray" });
    expect(removed.ok).toBe(true);
    state = platform.getState();
    expect(state.classEnrollments.find((item) => item.classId === session.classId && item.studentId === "student-kevin")?.status).toBe("left");
  });

  it("snapshots the assessment roster and distinguishes pending, absent, and excused scores", () => {
    const classId = "class-1";
    const created = platform.createAssessment({
      classId,
      title: "单元成绩测试",
      category: "exam",
      maxScore: 50,
      assessedAt: new Date().toISOString(),
      actorId: "teacher-lina"
    });
    expect(created.ok).toBe(true);
    expect(created.data?.rosterStudentIds).toEqual(expect.arrayContaining(["student-anisa", "student-maya", "student-raymond"]));
    expect(created.data?.rosterStudentIds.length).toBeGreaterThanOrEqual(5);

    platform.addClassMembers({ classId, studentIds: ["student-kevin"], actorId: "operator-ray" });
    expect(platform.getState().assessments.find((item) => item.id === created.data!.id)?.rosterStudentIds).not.toContain("student-kevin");

    const saved = platform.saveAssessmentScores({
      assessmentId: created.data!.id,
      entries: [
        { studentId: "student-anisa", status: "graded", score: 45 },
        { studentId: "student-maya", status: "absent" },
        { studentId: "student-raymond", status: "excused" }
      ],
      actorId: "teacher-lina"
    });
    expect(saved.ok).toBe(true);
    expect(saved.data?.find((item) => item.studentId === "student-anisa")?.normalizedScore).toBe(90);
    expect(saved.data?.find((item) => item.studentId === "student-maya")?.normalizedScore).toBe(0);
    expect(saved.data?.find((item) => item.studentId === "student-raymond")?.normalizedScore).toBeNull();

    const archived = platform.archiveAssessment({ assessmentId: created.data!.id, actorId: "operator-ray", reason: "测试归档" });
    expect(archived.ok).toBe(true);
    expect(platform.getState().assessments.find((item) => item.id === created.data!.id)?.status).toBe("archived");
  });

  it("rejects invalid weights and records valid policy versions", () => {
    const invalid = platform.saveGradePolicy({
      effectiveFrom: new Date().toISOString(),
      weights: { interaction: 40, homework: 30, exam: 20 },
      actorId: "operator-ray"
    });
    expect(invalid.ok).toBe(false);

    const valid = platform.saveGradePolicy({
      effectiveFrom: new Date(Date.now() + 1000).toISOString(),
      weights: { interaction: 30, homework: 20, exam: 50 },
      actorId: "operator-ray"
    });
    expect(valid.ok).toBe(true);
    expect(platform.getState().gradePolicies.filter((item) => item.schoolId === null)).toHaveLength(2);
  });
});

describe("grade analytics", () => {
  beforeEach(() => {
    platform.resetDemo();
  });

  it("uses the best in-range attempt, normalizes formal scores, and isolates teacher data", () => {
    platform.recordAttempt({
      setId: "set-greetings-review",
      studentId: "student-anisa",
      sessionId: "session-past",
      phase: "review",
      answers: {},
      score: 60,
      timeSpentSeconds: 30
    });
    platform.recordAttempt({
      setId: "set-greetings-review",
      studentId: "student-anisa",
      sessionId: "session-past",
      phase: "review",
      answers: {},
      score: 92,
      timeSpentSeconds: 25
    });
    platform.recordAttempt({
      setId: "set-greetings-scenario",
      studentId: "student-anisa",
      sessionId: null,
      phase: "live",
      answers: {},
      score: 83,
      timeSpentSeconds: 40
    });

    const range = relativeGradeRange("Asia/Jakarta", 30);
    const student = buildGradeAnalytics(platform.getState(), range, { studentId: "student-anisa" }).students[0];
    const reviewScore = student.records.find((item) => item.title === "课后复习挑战")?.normalizedScore;
    expect(reviewScore).toBe(92);
    expect(student.records.some((item) => item.title === "情景演练 · 看图与对话" && item.normalizedScore === 83)).toBe(true);
    expect(student.records.find((item) => item.title === "课后复习挑战")?.lessonTitle).toBeTruthy();
    expect(student.records.find((item) => item.title === "情景演练 · 看图与对话")?.phase).toBe("live");
    expect(student.composite).not.toBeNull();
    expect(student.categories.interaction.average).not.toBeNull();
    expect(student.categories.homework.average).not.toBeNull();
    expect(student.categories.exam.average).not.toBeNull();

    const teacher = buildGradeAnalytics(platform.getState(), range, { teacherId: "teacher-lina" });
    expect(teacher.records.some((item) => item.title === "情景演练 · 看图与对话" && item.studentId === "student-anisa")).toBe(false);
    expect(teacher.compositeAverage).not.toBeNull();
  });

  it("uses the policy effective at the end of the selected range", () => {
    const now = Date.now();
    platform.saveGradePolicy({
      effectiveFrom: new Date(now - 20 * 86_400_000).toISOString(),
      weights: { interaction: 10, homework: 20, exam: 70 },
      actorId: "operator-ray"
    });
    platform.saveGradePolicy({
      effectiveFrom: new Date(now - 2 * 86_400_000).toISOString(),
      weights: { interaction: 50, homework: 25, exam: 25 },
      actorId: "operator-ray"
    });
    const range = relativeGradeRange("Asia/Jakarta", 7);
    expect(buildGradeAnalytics(platform.getState(), range, { studentId: "student-anisa" }).policy.weights).toEqual({
      interaction: 50,
      homework: 25,
      exam: 25
    });
  });

  it("keeps student class labels inside the requested school", () => {
    const state = platform.getState();
    const schoolId = "school-sacred-heart";
    const schoolClassIds = new Set(
      state.classes.filter((item) => item.schoolId === schoolId).map((item) => item.id)
    );
    const range = relativeGradeRange("Asia/Jakarta", 90);
    const analytics = buildGradeAnalytics(state, range, { schoolId });

    expect(analytics.students.length).toBeGreaterThan(0);
    analytics.students.forEach((student) => {
      expect(student.classIds.length).toBeGreaterThan(0);
      student.classIds.forEach((classId) => expect(schoolClassIds.has(classId)).toBe(true));
    });
    analytics.records.forEach((record) => {
      if (record.classId) expect(schoolClassIds.has(record.classId)).toBe(true);
    });
  });

  it("aggregates class trend and radar with equal student weighting", () => {
    const range = relativeGradeRange("Asia/Jakarta", 30);
    const analytics = buildGradeAnalytics(platform.getState(), range, { teacherId: "teacher-lina" });
    expect(analytics.trend.length).toBeGreaterThan(0);

    const firstTrend = analytics.trend[0];
    (["interaction", "homework", "exam"] as const).forEach((category) => {
      const values = analytics.students
        .map((student) => student.trend.find((point) => point.key === firstTrend.key)?.categories[category] ?? null)
        .filter((value): value is number => value !== null);
      const expected = values.length
        ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10
        : null;
      expect(firstTrend.categories[category]).toBe(expected);
    });

    const categorySummaries = Object.fromEntries((["interaction", "homework", "exam"] as const).map((category) => [
      category,
      {
        category,
        average: firstTrend.categories[category],
        count: firstTrend.categories[category] === null ? 0 : 1,
        weight: analytics.policy.weights[category]
      }
    ])) as Parameters<typeof compositeFromCategories>[0];
    expect(firstTrend.composite).toBe(compositeFromCategories(categorySummaries));

    analytics.skillRadar.forEach((dimension) => {
      const values = analytics.students
        .map((student) => student.skillRadar.find((item) => item.key === dimension.key)?.score ?? null)
        .filter((value): value is number => value !== null);
      const expected = values.length
        ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10
        : null;
      expect(dimension.score).toBe(expected);
    });
  });

  it("ships recent demo records for every grade category", () => {
    const range = relativeGradeRange("Asia/Jakarta", 7);
    const raymond = buildGradeAnalytics(platform.getState(), range, { studentId: "student-raymond" }).students[0];
    expect(raymond.categories.interaction.count).toBeGreaterThanOrEqual(3);
    expect(raymond.categories.homework.count).toBeGreaterThanOrEqual(1);
    expect(raymond.categories.exam.count).toBeGreaterThanOrEqual(2);
    expect(raymond.classLabel).toBe("周三晚 B 班");
    expect(raymond.classLabel).not.toContain("/");
    expect(raymond.courseLabel).toBe("问候复习课");
    expect(raymond.skillRadar.map((item) => item.label)).toEqual(["听力", "口语", "拼音", "词汇", "语法", "阅读"]);
    expect(raymond.skillRadar.every((item) => item.score !== null && item.sampleCount > 0)).toBe(true);
  });

  it("uses the series title as the course label when a record belongs to a series session", () => {
    platform.recordAttempt({
      setId: "set-greetings-review",
      studentId: "student-raymond",
      sessionId: "series-session-1",
      phase: "review",
      answers: {},
      score: 100,
      timeSpentSeconds: 30
    });
    const range = relativeGradeRange("Asia/Jakarta", 30);
    const raymond = buildGradeAnalytics(platform.getState(), range, { studentId: "student-raymond" }).students[0];
    expect(raymond.courseLabel).toBe("餐厅中文 · 四周系列大班课");
  });

  it("converts inclusive local dates to timezone-specific UTC boundaries", () => {
    const jakarta = gradeRangeBounds({ start: "2026-09-24", end: "2026-09-24", timeZone: "Asia/Jakarta" });
    const shanghai = gradeRangeBounds({ start: "2026-09-24", end: "2026-09-24", timeZone: "Asia/Shanghai" });
    expect(jakarta.startAt).toBe("2026-09-23T17:00:00.000Z");
    expect(jakarta.endAt).toBe("2026-09-24T16:59:59.999Z");
    expect(shanghai.startAt).toBe("2026-09-23T16:00:00.000Z");
    expect(shanghai.endAt).toBe("2026-09-24T15:59:59.999Z");
  });
});
