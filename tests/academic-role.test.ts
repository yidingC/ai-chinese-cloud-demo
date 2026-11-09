import { beforeEach, describe, expect, it } from "vitest";
import "../admin/src/lib/platform";
import { platform } from "../admin/src/lib/platform";
import { getAcademicSchoolId, workspaceState } from "../admin/src/lib/academicScope";
import { relativeGradeRange, selectGradePolicy } from "../admin/src/lib/gradeAnalytics";

describe("academic affairs role and school isolation", () => {
  beforeEach(() => {
    platform.resetDemo();
  });

  it("allows own-school scheduling and student operations while denying content governance", () => {
    platform.setCurrentUser("academic-shengxin");
    const before = platform.getState();
    const ownClass = before.classes.find((item) => item.schoolId === "school-sacred-heart")!;
    const otherClass = before.classes.find((item) => item.schoolId !== "school-sacred-heart")!;

    expect(platform.createLesson({ folderId: "folder-greetings", title: "教务越权课节" })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(platform.createLesson({ folderId: "folder-greetings", title: "冒用教学管理", actorId: "operator-ray" })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(platform.createSubject({ name: "教务越权科目" })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(platform.saveInteractionSet({
      lessonId: "lesson-greetings",
      title: "教务越权互动",
      phase: "preview",
      items: [{ id: "denied", type: "choice", prompt: "x", explanation: "", choices: [] }]
    })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(platform.setMaterialStatus({ materialId: "material-preview-pdf", status: "unpublished" })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(platform.updateClass({ classId: otherClass.id, patch: { name: "跨校修改" } })).toMatchObject({ ok: false, code: "OUT_OF_SCOPE" });

    const start = new Date(Date.now() + 40 * 86400000);
    const created = platform.createSession({
      title: "教务本校排课",
      lessonId: "lesson-greetings",
      teacherId: "teacher-lina",
      classId: ownClass.id,
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + 40 * 60_000).toISOString(),
      capacity: 20
    });
    expect(created.ok).toBe(true);
    expect(created.data?.schoolId).toBe("school-sacred-heart");
    expect(platform.getState().auditEvents[0].schoolId).toBe("school-sacred-heart");
  });

  it("approves only own-school pending bookings and rejects platform default policy edits", () => {
    platform.setCurrentUser("academic-shengxin");
    const before = platform.getState();
    const ownPending = before.bookings.find((item) => item.id === "booking-review-kevin")!;
    expect(ownPending.status).toBe("pending_review");
    const approved = platform.reviewBooking({ bookingId: ownPending.id, decision: "approve", reason: "本校审核通过" });
    expect(approved.ok).toBe(true);
    expect(approved.data?.status).toBe("booked");
    let state = platform.getState();
    expect(state.schoolMemberships.some((item) => item.schoolId === "school-sacred-heart" && item.userId === "student-kevin" && item.status === "active")).toBe(true);
    const reviewedSession = state.sessions.find((item) => item.id === ownPending.sessionId)!;
    expect(state.classEnrollments.some((item) => item.classId === reviewedSession.classId && item.studentId === "student-kevin" && item.status === "active")).toBe(true);
    expect(state.notifications.some((item) => item.userId === "student-kevin" && item.type === "booking_approved")).toBe(true);

    expect(platform.saveGradePolicy({
      effectiveFrom: new Date().toISOString(),
      weights: { interaction: 30, homework: 30, exam: 40 },
      schoolId: null,
      actorId: "academic-shengxin"
    })).toMatchObject({ ok: false, code: "OUT_OF_SCOPE" });

    const ownPolicy = platform.saveGradePolicy({
      effectiveFrom: new Date().toISOString(),
      weights: { interaction: 30, homework: 30, exam: 40 },
      schoolId: "school-sacred-heart",
      actorId: "academic-shengxin"
    });
    expect(ownPolicy.ok).toBe(true);
    state = platform.getState();
    expect(selectGradePolicy(state, new Date().toISOString(), "school-sacred-heart").weights).toEqual({ interaction: 30, homework: 30, exam: 40 });
    expect(selectGradePolicy(state, new Date().toISOString()).weights).toEqual({ interaction: 40, homework: 30, exam: 30 });
  });

  it("reschedules own-school series sessions and refuses other schools", () => {
    platform.setCurrentUser("academic-shengxin");
    const before = platform.getState();
    const own = before.series.find((item) => item.schoolId === "school-sacred-heart")!;
    const other = before.series.find((item) => item.schoolId !== "school-sacred-heart")!;
    const latest = Math.max(...before.sessions.map((session) => new Date(session.startAt).getTime()));
    const base = new Date(latest + 30 * 86400000);
    const schedule = own.sessionIds.map((sessionId, index) => ({
      sessionId,
      startAt: new Date(base.getTime() + index * 7 * 86400000).toISOString()
    }));

    const updated = platform.updateSeriesSchedule({
      seriesId: own.id,
      schedule,
      actorId: "academic-shengxin",
      reason: "教务调整本校系列班课次时间"
    });
    expect(updated.ok).toBe(true);
    expect(platform.getState().auditEvents[0].schoolId).toBe("school-sacred-heart");

    expect(
      platform.updateSeriesSchedule({
        seriesId: other.id,
        schedule: [{ sessionId: other.sessionIds[0], startAt: base.toISOString() }]
      })
    ).toMatchObject({ ok: false, code: "OUT_OF_SCOPE" });

    expect(
      platform.updateSeriesSchedule({
        seriesId: own.id,
        schedule: [{ sessionId: other.sessionIds[0], startAt: base.toISOString() }]
      })
    ).toMatchObject({ ok: false, code: "OUT_OF_SCOPE" });

    const after = platform.getState();
    expect(after.sessions.find((session) => session.id === other.sessionIds[0])!.startAt).toBe(
      before.sessions.find((session) => session.id === other.sessionIds[0])!.startAt
    );
  });

  it("builds a scoped academic workspace without other-school records", () => {
    platform.setCurrentUser("academic-shengxin");
    const state = platform.getState();
    const user = state.users.find((item) => item.id === "academic-shengxin")!;
    const scoped = workspaceState(state, getAcademicSchoolId(state, user));
    expect(scoped.classes.every((item) => item.schoolId === "school-sacred-heart")).toBe(true);
    expect(scoped.sessions.every((item) => item.schoolId === "school-sacred-heart")).toBe(true);
    expect(scoped.students.length).toBeGreaterThanOrEqual(5);
    expect(scoped.auditEvents.every((item) => item.schoolId === "school-sacred-heart")).toBe(true);
  });

  it("uses the school override before platform default policy", () => {
    const state = platform.getState();
    const now = new Date().toISOString();
    expect(selectGradePolicy(state, now).weights).toEqual({ interaction: 40, homework: 30, exam: 30 });
    expect(selectGradePolicy(state, now, "school-sacred-heart").weights).toEqual({ interaction: 35, homework: 35, exam: 30 });
    expect(relativeGradeRange("Asia/Jakarta", 30).timeZone).toBe("Asia/Jakarta");
  });
});
