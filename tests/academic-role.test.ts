import { beforeEach, describe, expect, it } from "vitest";
import "../admin/src/lib/platform";
import { platform } from "../admin/src/lib/platform";
import { getAcademicSchoolId, workspaceState } from "../admin/src/lib/academicScope";
import { relativeGradeRange, selectGradePolicy } from "../admin/src/lib/gradeAnalytics";

const ACADEMIC_ID = "academic-shengxin";
const SCHOOL_ID = "school-sacred-heart";

describe("academic affairs role and school isolation", () => {
  beforeEach(() => {
    platform.resetDemo();
  });

  it("allows own-school class and student intake while denying edits and operational writes", () => {
    platform.setCurrentUser("operator-ray");
    const outsiderResult = platform.createSchoolStaff({
      schoolId: "school-hope",
      role: "teacher",
      name: "外校教师",
      phone: "+62 811 0000 9911"
    });
    expect(outsiderResult.ok).toBe(true);
    const outsider = outsiderResult.data!.user;

    platform.setCurrentUser(ACADEMIC_ID);
    const before = platform.getState();
    const ownClass = before.classes.find((item) => item.schoolId === SCHOOL_ID)!;
    const otherClass = before.classes.find((item) => item.schoolId !== SCHOOL_ID)!;
    const ownStudent = before.schoolMemberships.find(
      (item) => item.schoolId === SCHOOL_ID && item.role === "student" && item.status === "active"
    )!;
    const ownSession = before.sessions.find((item) => item.schoolId === SCHOOL_ID)!;
    const ownTeacher = before.schoolMemberships.find(
      (item) => item.schoolId === SCHOOL_ID && item.role === "teacher" && item.status === "active"
    )!;

    expect(platform.createLesson({ folderId: "folder-greetings", title: "教务越权课节" })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(platform.createSubject({ name: "教务越权科目" })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(platform.updateClass({ classId: ownClass.id, patch: { name: "教务越权改班" } })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(platform.addClassMembers({ classId: ownClass.id, studentIds: [ownStudent.userId] })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(platform.updateStudent({ studentId: ownStudent.userId, patch: { level: "越权改档" } })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(platform.createSession({
      title: "教务本校排课",
      lessonId: "lesson-greetings",
      teacherId: "teacher-lina",
      classId: ownClass.id,
      startAt: new Date(Date.now() + 40 * 86_400_000).toISOString(),
      endAt: new Date(Date.now() + 40 * 86_400_000 + 40 * 60_000).toISOString(),
      capacity: 20
    })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(platform.cancelSession({ sessionId: ownSession.id, actorId: ACADEMIC_ID })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(platform.syncSessionRoster({ sessionId: ownSession.id })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(platform.reviewBooking({ bookingId: "booking-review-kevin", decision: "approve", reason: "越权审核" })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(platform.createAssessment({
      classId: ownClass.id,
      title: "教务越权考核",
      category: "exam",
      assessedAt: new Date().toISOString()
    })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(platform.saveGradePolicy({
      effectiveFrom: new Date().toISOString(),
      weights: { interaction: 30, homework: 30, exam: 40 },
      schoolId: SCHOOL_ID
    })).toMatchObject({ ok: false, code: "FORBIDDEN" });

    const beforeClasses = platform.getState().classes.length;
    const createdClass = platform.createClass({
      name: "教务新增班级",
      teacherId: ownTeacher.userId,
      schoolId: SCHOOL_ID,
      actorId: ACADEMIC_ID
    });
    expect(createdClass.ok).toBe(true);
    expect(createdClass.data?.schoolId).toBe(SCHOOL_ID);
    expect(platform.getState().classes).toHaveLength(beforeClasses + 1);
    expect(platform.createClass({
      name: "教务外校教师班",
      teacherId: outsider.id,
      schoolId: SCHOOL_ID,
      actorId: ACADEMIC_ID
    })).toMatchObject({ ok: false, code: "OUT_OF_SCOPE" });
    expect(platform.createClass({
      name: "教务跨校班级",
      teacherId: ownTeacher.userId,
      schoolId: otherClass.schoolId,
      actorId: ACADEMIC_ID
    })).toMatchObject({ ok: false, code: "OUT_OF_SCOPE" });
    expect(platform.deleteClass({
      classId: createdClass.data!.id,
      actorId: ACADEMIC_ID
    })).toMatchObject({ ok: false, code: "FORBIDDEN" });

    const beforeStudents = platform.getState().students.length;
    const created = platform.createStudent({
      name: "Sari",
      className: ownClass.name,
      schoolId: SCHOOL_ID,
      actorId: ACADEMIC_ID
    });
    expect(created.ok).toBe(true);
    expect(created.data?.profile.className).toBe(ownClass.name);
    expect(created.data?.profile.primaryClassId).toBe(ownClass.id);
    const afterCreate = platform.getState();
    expect(afterCreate.students).toHaveLength(beforeStudents + 1);
    expect(afterCreate.schoolMemberships.some(
      (item) => item.schoolId === SCHOOL_ID && item.userId === created.data!.user.id && item.role === "student" && item.status === "active"
    )).toBe(true);
    expect(afterCreate.classEnrollments.some(
      (item) => item.classId === ownClass.id && item.studentId === created.data!.user.id && item.status === "active"
    )).toBe(true);

    expect(platform.createStudent({
      name: "跨校班级",
      className: otherClass.name,
      schoolId: SCHOOL_ID
    })).toMatchObject({ ok: false, code: "OUT_OF_SCOPE" });
    expect(platform.createStudent({
      name: "跨校归属",
      className: ownClass.name,
      schoolId: otherClass.schoolId
    })).toMatchObject({ ok: false, code: "OUT_OF_SCOPE" });
    expect(platform.createStudent({
      name: "待分班学生",
      className: "待分班",
      schoolId: SCHOOL_ID
    })).toMatchObject({ ok: false, code: "OUT_OF_SCOPE" });
    expect(platform.createStudent({
      name: "外校偏好教师",
      className: ownClass.name,
      schoolId: SCHOOL_ID,
      preferredTeacherId: outsider.id
    })).toMatchObject({ ok: false, code: "OUT_OF_SCOPE" });
    expect(platform.createStudent({
      name: "冒用教学管理",
      className: ownClass.name,
      schoolId: SCHOOL_ID,
      actorId: "operator-ray"
    })).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("builds a scoped academic workspace without other-school records", () => {
    platform.setCurrentUser(ACADEMIC_ID);
    const state = platform.getState();
    const user = state.users.find((item) => item.id === ACADEMIC_ID)!;
    const scoped = workspaceState(state, getAcademicSchoolId(state, user));
    expect(scoped.classes.every((item) => item.schoolId === SCHOOL_ID)).toBe(true);
    expect(scoped.sessions.every((item) => item.schoolId === SCHOOL_ID)).toBe(true);
    expect(scoped.students.length).toBeGreaterThanOrEqual(5);
    expect(scoped.auditEvents.every((item) => item.schoolId === SCHOOL_ID)).toBe(true);
  });

  it("keeps grade policy reads scoped while the role cannot edit policies", () => {
    const state = platform.getState();
    const now = new Date().toISOString();
    expect(selectGradePolicy(state, now).weights).toEqual({ interaction: 40, homework: 30, exam: 30 });
    expect(selectGradePolicy(state, now, SCHOOL_ID).weights).toEqual({ interaction: 35, homework: 35, exam: 30 });
    expect(relativeGradeRange("Asia/Jakarta", 30).timeZone).toBe("Asia/Jakarta");
  });
});
