import { beforeEach, describe, expect, it } from "vitest";
import "../admin/src/lib/platform";
import { platform } from "../admin/src/lib/platform";
import { formatDateTime } from "../admin/src/lib/format";
import { lessonContent, pickTodayTasks, studentPushedTasks, studentWebTasks } from "../admin/src/lib/domain";

describe("AI Chinese Cloud platform store", () => {
  beforeEach(() => {
    platform.resetDemo();
  });

  it("prevents duplicate bookings and sends full sessions to waitlist", () => {
    const duplicate = platform.bookSession({ studentId: "student-anisa", sessionId: "session-live" });
    expect(duplicate.ok).toBe(false);
    expect(duplicate.code).toBe("ALREADY_BOOKED");

    const full = platform.bookSession({ studentId: "student-kevin", sessionId: "session-waitlist-full" });
    expect(full.ok).toBe(false);
    expect(full.code).toBe("SESSION_FULL");

    const waitlist = platform.joinWaitlist({ studentId: "student-kevin", sessionId: "session-waitlist-full" });
    expect(waitlist.ok).toBe(true);
    expect(waitlist.data?.status).toBe("waiting");
  });

  it("keeps approval-required bookings pending until teaching management confirms", () => {
    const before = platform.getState();
    const session = before.sessions.find((item) => item.id === "session-review");
    expect(session).toBeTruthy();
    expect(session?.approvalRequired).toBe(true);
    const bookedBefore = before.bookings.filter((booking) => booking.sessionId === "session-review" && booking.status === "booked").length;

    const result = platform.bookSession({ studentId: "student-anisa", sessionId: "session-review" });
    expect(result.ok).toBe(true);
    expect(result.data?.status).toBe("pending_review");

    const after = platform.getState();
    expect(after.bookings.some((booking) => booking.studentId === "student-anisa" && booking.sessionId === "session-review" && booking.status === "pending_review")).toBe(true);
    expect(after.bookings.filter((booking) => booking.sessionId === "session-review" && booking.status === "booked")).toHaveLength(bookedBefore);
    expect(after.notifications.some((notice) => notice.userId === "student-anisa" && notice.type === "booking_pending_review" && notice.body.includes("审核"))).toBe(true);
  });

  it("automatically promotes the earliest waitlisted student after cancellation", () => {
    const before = platform.getState();
    const entry = before.waitlist.find((item) => item.id === "wait-session-waitlist-anisa");
    expect(entry?.status).toBe("waiting");

    const booking = before.bookings.find((item) => item.id === "booking-waitlist-raymond");
    expect(booking).toBeTruthy();
    const result = platform.cancelBooking({ bookingId: booking!.id, actorId: "operator-ray", force: true, reason: "测试候补转正" });
    expect(result.ok).toBe(true);

    const after = platform.getState();
    expect(after.waitlist.find((item) => item.id === entry!.id)?.status).toBe("promoted");
    expect(after.bookings.some((item) => item.studentId === "student-anisa" && item.sessionId === "session-waitlist-full" && item.status === "booked")).toBe(true);
  });

  it("enrolls a series atomically across every session", () => {
    const result = platform.enrollSeries({ studentId: "student-anisa", seriesId: "series-weekly-food" });
    expect(result.ok).toBe(true);
    const state = platform.getState();
    const bookings = state.bookings.filter((booking) => booking.studentId === "student-anisa" && booking.enrollmentId);
    expect(bookings).toHaveLength(4);
    expect(new Set(bookings.map((booking) => booking.sessionId)).size).toBe(4);
  });

  it("creates a series as multiple lessons from the same theme folder", () => {
    const start = new Date(Date.now() + 8 * 86400000);
    start.setHours(9, 0, 0, 0);
    const result = platform.createSeries({
      title: "餐厅中文 · 四周系列班",
      folderId: "folder-food-series",
      lessonIds: ["lesson-food", "lesson-food-taste", "lesson-food-drinks"],
      teacherId: "teacher-lina",
      startAt: start.toISOString(),
      intervalWeeks: 1,
      durationMinutes: 40,
      capacity: 20,
      className: "系列班创建测试"
    });
    expect(result.ok).toBe(true);

    const state = platform.getState();
    const series = state.series.find((item) => item.id === result.data!.id);
    expect(series).toBeTruthy();
    expect(series?.folderId).toBe("folder-food-series");
    expect(series?.lessonIds).toEqual(["lesson-food", "lesson-food-taste", "lesson-food-drinks"]);
    expect(series?.sessionIds).toHaveLength(3);

    const sessions = series!.sessionIds.map((id) => state.sessions.find((session) => session.id === id)!);
    expect(sessions.map((session) => session.lessonId)).toEqual(series!.lessonIds);
    expect(sessions.every((session) => session.seriesId === series!.id && session.classId === sessions[0].classId)).toBe(true);

    const gaps = sessions.slice(1).map((session, index) =>
      Math.round((new Date(session.startAt).getTime() - new Date(sessions[index].startAt).getTime()) / 86400000)
    );
    expect(gaps).toEqual([7, 7]);
  });

  it("uses the per-lesson schedule when the operator adjusts the AI draft", () => {
    const first = new Date(Date.now() + 8 * 86400000);
    first.setHours(9, 0, 0, 0);
    const second = new Date(Date.now() + 9 * 86400000);
    second.setHours(14, 30, 0, 0);
    const result = platform.createSeries({
      title: "餐厅中文 · 人工调整排期",
      folderId: "folder-food-series",
      lessonIds: ["lesson-food", "lesson-food-taste"],
      sessionSchedule: [
        { lessonId: "lesson-food", startAt: first.toISOString() },
        { lessonId: "lesson-food-taste", startAt: second.toISOString() }
      ],
      teacherId: "teacher-lina",
      startAt: first.toISOString(),
      intervalWeeks: 1,
      durationMinutes: 40,
      capacity: 20,
      className: "人工排期测试"
    });
    expect(result.ok).toBe(true);

    const state = platform.getState();
    const sessions = result.data!.sessionIds.map((id) => state.sessions.find((session) => session.id === id)!);
    expect(sessions.map((session) => session.startAt)).toEqual([first.toISOString(), second.toISOString()]);
  });

  it("rejects an invalid per-lesson schedule", () => {
    const result = platform.createSeries({
      title: "无效排期测试",
      lessonIds: ["lesson-food", "lesson-food-taste"],
      sessionSchedule: [{ lessonId: "lesson-food", startAt: "not-a-date" }],
      teacherId: "teacher-lina",
      startAt: new Date(Date.now() + 8 * 86400000).toISOString(),
      intervalWeeks: 1,
      durationMinutes: 40,
      capacity: 20
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("INVALID_SCHEDULE");
  });

  it("reschedules a whole series at once and notifies booked students", () => {
    expect(platform.enrollSeries({ studentId: "student-anisa", seriesId: "series-weekly-food" }).ok).toBe(true);
    const before = platform.getState();
    const series = before.series.find((item) => item.id === "series-weekly-food")!;
    const latest = Math.max(...before.sessions.map((session) => new Date(session.startAt).getTime()));
    const base = new Date(latest + 30 * 86400000);
    const schedule = series.sessionIds.map((sessionId, index) => ({
      sessionId,
      startAt: new Date(base.getTime() + index * 7 * 86400000).toISOString()
    }));

    const result = platform.updateSeriesSchedule({
      seriesId: series.id,
      schedule,
      actorId: "operator-ray",
      reason: "整组调整系列班时间"
    });
    expect(result.ok).toBe(true);

    const after = platform.getState();
    schedule.forEach((planned) => {
      const session = after.sessions.find((item) => item.id === planned.sessionId)!;
      const startMs = new Date(planned.startAt).getTime();
      expect(session.startAt).toBe(planned.startAt);
      expect(new Date(session.endAt).getTime() - startMs).toBe(40 * 60000);
      expect(new Date(session.bookingCloseAt).getTime()).toBe(startMs - 30 * 60000);
      expect(new Date(session.cancelCloseAt).getTime()).toBe(startMs - 2 * 60 * 60000);
    });
    expect(
      after.notifications.filter((notice) => notice.userId === "student-anisa" && notice.type === "session_updated")
    ).toHaveLength(series.sessionIds.length);
    expect(after.auditEvents[0]).toMatchObject({
      action: "update_series_schedule",
      targetType: "series",
      targetId: series.id,
      schoolId: "school-sacred-heart"
    });
  });

  it("keeps every series session unchanged when a single time conflicts", () => {
    const before = platform.getState();
    const series = before.series.find((item) => item.id === "series-weekly-food")!;
    const originalTimes = series.sessionIds.map((id) => before.sessions.find((session) => session.id === id)!.startAt);
    const latest = Math.max(...before.sessions.map((session) => new Date(session.startAt).getTime()));
    const overlapping = new Date(latest + 30 * 86400000).toISOString();

    const result = platform.updateSeriesSchedule({
      seriesId: series.id,
      schedule: series.sessionIds.map((sessionId) => ({ sessionId, startAt: overlapping })),
      actorId: "operator-ray"
    });
    expect(result).toMatchObject({ ok: false, code: "TEACHER_CONFLICT" });

    const after = platform.getState();
    expect(series.sessionIds.map((id) => after.sessions.find((session) => session.id === id)!.startAt)).toEqual(originalTimes);
  });

  it("rejects a series whose lessons come from different themes", () => {
    const start = new Date(Date.now() + 8 * 86400000);
    start.setHours(9, 0, 0, 0);
    const result = platform.createSeries({
      title: "跨主题系列班",
      lessonIds: ["lesson-food", "lesson-time"],
      teacherId: "teacher-lina",
      startAt: start.toISOString(),
      intervalWeeks: 1,
      durationMinutes: 40,
      capacity: 20
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("LESSON_THEME_MISMATCH");
  });

  it("ships the 24-session club Chinese series for an Indonesian grade-7 semester", () => {
    const state = platform.getState();
    const series = state.series.find((item) => item.id === "series-club-semester");
    expect(series).toBeTruthy();
    expect(series?.folderId).toBe("folder-club");
    expect(series?.lessonId).toBe("lesson-club-chinese");
    expect(series?.lessonIds).toHaveLength(24);
    expect(new Set(series?.lessonIds).size).toBe(24);
    expect(series?.sessionIds).toHaveLength(24);

    const sessions = series!.sessionIds.map((id) => state.sessions.find((session) => session.id === id));
    expect(sessions.every((session) => session && session.seriesId === series!.id && session.status === "published")).toBe(true);
    expect(sessions.map((session) => session!.lessonId)).toEqual(series!.lessonIds);
    expect(state.lessons.some((lesson) => lesson.id === "lesson-club-chinese")).toBe(true);

    // 每周一节：相邻课次都相差 7 天，且全部排在未来。
    const gaps = sessions.slice(1).map((session, index) =>
      Math.round((new Date(session!.startAt).getTime() - new Date(sessions[index]!.startAt).getTime()) / 86400000)
    );
    expect(new Set(gaps)).toEqual(new Set([7]));
    expect(sessions.every((session) => new Date(session!.startAt).getTime() > Date.now())).toBe(true);
  });

  it("enrolls the whole club semester when a student joins that series", () => {
    const result = platform.enrollSeries({ studentId: "student-maya", seriesId: "series-club-semester" });
    expect(result.ok).toBe(true);
    const state = platform.getState();
    const bookings = state.bookings.filter((booking) => booking.studentId === "student-maya" && booking.enrollmentId);
    expect(bookings).toHaveLength(24);
    expect(new Set(bookings.map((booking) => booking.sessionId)).size).toBe(24);
  });

  it("blocks teacher schedule conflicts", () => {
    const live = platform.getState().sessions.find((session) => session.id === "session-live")!;
    const result = platform.createSession({
      title: "冲突测试课堂",
      lessonId: "lesson-time",
      teacherId: live.teacherId,
      startAt: live.startAt,
      endAt: live.endAt,
      capacity: 20
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("TEACHER_CONFLICT");
  });

  it("creates course structure and student profiles", () => {
    const subject = platform.createSubject({ name: "文化专题" });
    expect(subject.ok).toBe(true);

    const course = platform.createCourse({ subjectId: subject.data!.id, name: "节日主题" });
    expect(course.ok).toBe(true);

    const lesson = platform.createLesson({
      folderId: course.data!.id,
      title: "春节问候",
      subtitle: "Salam Tahun Baru Imlek",
      tags: ["节日", "文化"]
    });
    expect(lesson.ok).toBe(true);
    expect(lesson.data?.status).toBe("draft");

    const student = platform.createStudent({
      name: "Nadia",
      timeZone: "Asia/Jakarta",
      learningGoal: "日常会话"
    });
    expect(student.ok).toBe(true);
    expect(platform.getState().students.some((profile) => profile.userId === student.data!.user.id)).toBe(true);
  });

  it("publishes courses only after a lesson is ready and protects referenced courses", () => {
    const subject = platform.createSubject({ name: "生命周期测试" });
    const course = platform.createCourse({ subjectId: subject.data!.id, name: "测试课程" });
    const lesson = platform.createLesson({ folderId: course.data!.id, title: "测试课节" });

    expect(platform.setCourseStatus({ courseId: course.data!.id, status: "published" })).toMatchObject({
      ok: false,
      code: "COURSE_EMPTY"
    });
    expect(platform.setLessonStatus({ lessonId: lesson.data!.id, status: "published" }).ok).toBe(true);
    expect(platform.setCourseStatus({ courseId: course.data!.id, status: "published" }).ok).toBe(true);
    expect(platform.deleteCourse({ courseId: "folder-campus" })).toMatchObject({ ok: false, code: "COURSE_IN_USE" });
    expect(platform.deleteLesson({ lessonId: "lesson-friends" })).toMatchObject({ ok: false, code: "LESSON_IN_USE" });
    expect(platform.deleteSubject({ subjectId: subject.data!.id })).toMatchObject({ ok: false, code: "SUBJECT_IN_USE" });

    expect(platform.deleteCourse({ courseId: course.data!.id }).ok).toBe(true);
    expect(platform.getState().lessons.some((item) => item.id === lesson.data!.id)).toBe(false);
    expect(platform.deleteSubject({ subjectId: subject.data!.id }).ok).toBe(true);
  });

  it("creates school staff accounts directly and rejects duplicate phone numbers", () => {
    const created = platform.createSchoolStaff({
      schoolId: "school-sacred-heart",
      role: "teacher",
      name: "测试教师",
      phone: "+62 812 7777 0101",
      note: "负责七年级中文",
      timeZone: "Asia/Jakarta",
      actorId: "operator-ray"
    });
    expect(created.ok).toBe(true);
    expect(created.data?.user).toMatchObject({
      role: "teacher",
      name: "测试教师",
      phone: "+62 812 7777 0101",
      bio: "负责七年级中文"
    });
    expect(created.data?.membership).toMatchObject({
      schoolId: "school-sacred-heart",
      userId: created.data?.user.id,
      role: "teacher",
      status: "active"
    });

    const duplicate = platform.createSchoolStaff({
      schoolId: "school-sacred-heart",
      role: "teacher",
      name: "重复手机号教师",
      phone: "+62 812 7777 0101",
      actorId: "operator-ray"
    });
    expect(duplicate.ok).toBe(false);
    expect(duplicate.code).toBe("PHONE_EXISTS");
    expect(platform.getState().users.filter((user) => user.name === "重复手机号教师")).toHaveLength(0);
  });

  it("persists school timezones when schools are created and updated", () => {
    const created = platform.createSchool({
      name: "时区测试学校",
      code: "TZ-TEST",
      timeZone: "Asia/Singapore",
      actorId: "operator-ray"
    });
    expect(created.ok).toBe(true);
    expect(created.data?.timeZone).toBe("Asia/Singapore");

    const updated = platform.updateSchool({
      schoolId: created.data!.id,
      patch: { timeZone: "Asia/Shanghai" },
      actorId: "operator-ray"
    });
    expect(updated.ok).toBe(true);
    expect(platform.getState().schools.find((school) => school.id === created.data!.id)?.timeZone).toBe("Asia/Shanghai");
  });

  it("deletes only empty schools and blocks deleting schools with history", () => {
    const created = platform.createSchool({
      name: "待删除空学校",
      code: "EMPTY-DELETE",
      actorId: "operator-ray"
    });
    expect(created.ok).toBe(true);
    expect(platform.deleteSchool({ schoolId: created.data!.id, actorId: "operator-ray" }).ok).toBe(true);
    expect(platform.getState().schools.some((school) => school.id === created.data!.id)).toBe(false);

    const schoolInUse = platform.getState().schools[0];
    const blocked = platform.deleteSchool({ schoolId: schoolInUse.id, actorId: "operator-ray" });
    expect(blocked.ok).toBe(false);
    expect(blocked.code).toBe("SCHOOL_IN_USE");
    expect(platform.getState().schools.some((school) => school.id === schoolInUse.id)).toBe(true);
  });

  it("blocks removing a teacher while they still teach an active class", () => {
    const state = platform.getState();
    const activeClass = state.classes.find((item) => item.status === "active" && item.schoolId && item.teacherId);
    expect(activeClass).toBeTruthy();

    const result = platform.saveSchoolMembership({
      schoolId: activeClass!.schoolId,
      userId: activeClass!.teacherId,
      role: "teacher",
      status: "left",
      actorId: "operator-ray"
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("TEACHER_HAS_CLASSES");

    const after = platform.getState();
    expect(after.schoolMemberships).toContainEqual(expect.objectContaining({
      schoolId: activeClass!.schoolId,
      userId: activeClass!.teacherId,
      role: "teacher",
      status: "active"
    }));
  });

  it("deletes only empty classes and requires history-bearing classes to be archived", () => {
    const created = platform.createClass({
      name: "临时空班",
      teacherId: "teacher-lina",
      schoolId: "school-demo",
      actorId: "operator-ray"
    });
    expect(created.ok).toBe(true);

    const removed = platform.deleteClass({ classId: created.data!.id, actorId: "operator-ray" });
    expect(removed.ok).toBe(true);
    expect(platform.getState().classes.some((item) => item.id === created.data!.id)).toBe(false);

    const before = platform.getState();
    const classWithHistory = before.classes.find((item) => before.classEnrollments.some((enrollment) => enrollment.classId === item.id));
    expect(classWithHistory).toBeTruthy();

    const rejected = platform.deleteClass({ classId: classWithHistory!.id, actorId: "operator-ray" });
    expect(rejected.ok).toBe(false);
    expect(rejected.code).toBe("CLASS_IN_USE");
    expect(platform.getState().classes.some((item) => item.id === classWithHistory!.id)).toBe(true);
  });

  it("keeps a student in another class when removed from only one enrollment", () => {
    const before = platform.getState();
    const studentId = "student-nadia";
    const originalClass = before.classes.find((item) =>
      before.classEnrollments.some((enrollment) =>
        enrollment.classId === item.id && enrollment.studentId === studentId && enrollment.status === "active"
      )
    );
    expect(originalClass).toBeTruthy();

    const created = platform.createClass({
      name: "跨班保留测试",
      teacherId: "teacher-lina",
      schoolId: originalClass!.schoolId,
      actorId: "operator-ray"
    });
    expect(created.ok).toBe(true);
    expect(platform.addClassMembers({ classId: created.data!.id, studentIds: [studentId], actorId: "operator-ray" }).ok).toBe(true);
    expect(platform.removeClassMember({ classId: originalClass!.id, studentId, actorId: "operator-ray" }).ok).toBe(true);

    const after = platform.getState();
    const profile = after.students.find((item) => item.userId === studentId)!;
    expect(after.classEnrollments).toContainEqual(expect.objectContaining({
      classId: created.data!.id,
      studentId,
      status: "active"
    }));
    expect(profile.primaryClassId).toBe(created.data!.id);
    expect(profile.className).toBe("跨班保留测试");
  });

  it("assigns the first class when a pending student is added to a class", () => {
    const student = platform.createStudent({
      name: "待分班演示学生",
      schoolId: "school-demo",
      actorId: "operator-ray"
    });
    expect(student.ok).toBe(true);
    const created = platform.createClass({
      name: "首次入班测试",
      teacherId: "teacher-lina",
      schoolId: "school-demo",
      actorId: "operator-ray"
    });
    expect(created.ok).toBe(true);
    expect(platform.addClassMembers({ classId: created.data!.id, studentIds: [student.data!.user.id], actorId: "operator-ray" }).ok).toBe(true);

    const profile = platform.getState().students.find((item) => item.userId === student.data!.user.id)!;
    expect(profile.primaryClassId).toBe(created.data!.id);
    expect(profile.className).toBe("首次入班测试");
  });

  it("can remove an interaction from every lesson session without deleting the design", () => {
    const before = platform.getState();
    const target = before.interactionSets.find((item) => item.id === "set-greetings-live");
    expect(target).toBeTruthy();

    const result = platform.unassignInteractionSet({ setId: target!.id, actorId: "teacher-lina" });
    expect(result.ok).toBe(true);

    const after = platform.getState();
    const stored = after.interactionSets.find((item) => item.id === target!.id);
    expect(stored).toBeTruthy();
    expect(stored?.sessionIds).toEqual([]);
  });

  it("keeps interaction versions and supports rollback", () => {
    const before = platform.getState();
    const set = before.interactionSets.find((item) => item.id === "set-greetings-preview")!;
    const versionOne = before.interactionVersions.find((version) => version.id === "ver-greetings-preview-1")!;
    expect(set.currentVersionId).not.toBe(versionOne.id);

    const result = platform.rollbackInteractionVersion({ setId: set.id, versionId: versionOne.id, actorId: "operator-ray" });
    expect(result.ok).toBe(true);
    expect(platform.getState().interactionSets.find((item) => item.id === set.id)?.currentVersionId).toBe(versionOne.id);
  });

  it("ships the four new interaction types in the demo set", () => {
    const state = platform.getState();
    const scenarioSet = state.interactionSets.find((set) => set.id === "set-greetings-scenario");
    expect(scenarioSet?.lessonId).toBe("lesson-greetings");
    const scenarioVersion = state.interactionVersions.find((version) => version.id === scenarioSet?.currentVersionId);
    expect(scenarioVersion?.items.map((item) => item.type)).toEqual(["picture", "picture-match", "situation", "dialogue"]);
  });

  it("covers every student interaction type with templates for every topic and level", () => {
    const state = platform.getState();
    const studentTypes = [
      "match",
      "memory",
      "choice",
      "order",
      "fill",
      "poll",
      "picture",
      "picture-match",
      "situation",
      "dialogue",
      "pinyin-match",
      "category",
      "word-build",
      "correction",
      "listening",
      "read-aloud",
      "picture-talk",
      "open-qa"
    ];
    const topics = [...new Set(state.interactionTemplates.map((template) => template.topic))];
    expect(topics.length).toBe(14);

    // 每种题型都要覆盖全部主题的初级 / 中级 / 高级。
    studentTypes.forEach((type) => {
      const matched = state.interactionTemplates.filter((template) => template.type === type);
      expect(matched.map((template) => template.id).length).toBe(topics.length * 3);
      topics.forEach((topic) => {
        ["beginner", "intermediate", "advanced"].forEach((level) => {
          expect(matched.some((template) => template.topic === topic && template.level === level)).toBe(true);
        });
      });
    });

    // 一道题一份内容：每套模板的 item 都要有答案字段，不能是空壳。
    state.interactionTemplates.forEach((template) => {
      expect(template.summary.length).toBeGreaterThan(0);
      expect(template.item.prompt.length).toBeGreaterThan(0);
    });
  });

  it("keeps the batch-three demo set working", () => {
    const state = platform.getState();
    const batchThreeTypes = ["pinyin-match", "category", "word-build", "correction", "listening", "read-aloud", "picture-talk", "open-qa"];

    const demoSet = state.interactionSets.find((set) => set.id === "set-greetings-batch-three");
    expect(demoSet?.lessonId).toBe("lesson-greetings");
    const demoVersion = state.interactionVersions.find((version) => version.id === demoSet?.currentVersionId);
    expect([...(demoVersion?.items.map((item) => item.type) ?? [])].sort()).toEqual([...batchThreeTypes].sort());
  });

  it("pushes student tasks in the three windows (48h before, class day, 48h after)", () => {
    const base = platform.getState();
    // 固定一个"现在"，避免测试在半夜跑时"当天"判定漂移；只留 Anisa 的一节课当被测课次。
    const now = new Date("2026-09-22T02:00:00.000Z").getTime();
    const shift = (startOffsetMinutes: number, durationMinutes: number) => {
      const state = structuredClone(base);
      state.bookings = state.bookings.filter(
        (booking) => booking.studentId === "student-anisa" && booking.sessionId === "session-live" && booking.status === "booked"
      );
      const session = state.sessions.find((item) => item.id === "session-live")!;
      session.startAt = new Date(now + startOffsetMinutes * 60_000).toISOString();
      session.endAt = new Date(now + (startOffsetMinutes + durationMinutes) * 60_000).toISOString();
      session.status = "published";
      return state;
    };
    const phasesOf = (state: typeof base) =>
      Object.fromEntries(
        studentPushedTasks(state, "student-anisa", now, "Asia/Shanghai").map(({ phase, tasks }) => [phase, tasks.map((task) => task.set.id)])
      );

    // 开课前 36 小时：命中课前窗口。
    const beforeClass = phasesOf(shift(36 * 60, 40));
    expect(beforeClass.preview).toContain("set-greetings-preview");
    expect(beforeClass.live).toHaveLength(0);
    expect(beforeClass.review).toHaveLength(0);

    // 开课前 72 小时：还在 48 小时之外，不推课前任务。
    expect(phasesOf(shift(72 * 60, 40)).preview).toHaveLength(0);

    // 正在上课：只推课中任务。
    const inClass = phasesOf(shift(-10, 40));
    expect(inClass.live).toContain("set-greetings-live");
    expect(inClass.preview).toHaveLength(0);
    expect(inClass.review).toHaveLength(0);

    // 下课后 2 小时：课前收起、课中仍算当天、课后开始推送。
    const justEnded = phasesOf(shift(-3 * 60, 60));
    expect(justEnded.preview).toHaveLength(0);
    expect(justEnded.live).toContain("set-greetings-live");
    expect(justEnded.review).toContain("set-greetings-review");

    // 下课后 3 天：三个窗口都不再推这节课的任务。
    const longAfter = phasesOf(shift(-3 * 24 * 60, 40));
    expect(longAfter.preview).toHaveLength(0);
    expect(longAfter.live).toHaveLength(0);
    expect(longAfter.review).toHaveLength(0);
  });

  it("gives the demo students tasks in every window they should see", () => {
    const state = platform.getState();
    const now = Date.now();
    const windowsOf = (studentId: string) => studentPushedTasks(state, studentId, now, "Asia/Shanghai");
    const idsOf = (studentId: string, phase: "preview" | "live" | "review") =>
      windowsOf(studentId).find((window) => window.phase === phase)!.tasks.map((task) => task.set.id);

    // Raymond：今天正在上的课（课中）+ 昨天那节（课后两条）。
    expect(idsOf("student-raymond", "live")).toContain("set-greetings-live");
    expect(idsOf("student-raymond", "review")).toEqual(["set-greetings-review", "set-greetings-review-voice"]);
    // Kevin：明天那节课的课前互动。
    expect(idsOf("student-kevin", "preview")).toContain("set-friends-preview");
    // Anisa：三档都有。
    expect(idsOf("student-anisa", "preview")).toContain("set-friends-preview");
    expect(idsOf("student-anisa", "live")).toContain("set-greetings-live");
    expect(idsOf("student-anisa", "review")).toContain("set-greetings-review");
  });

  it("hides live tasks on the student web portal because the app carries them", () => {
    const state = platform.getState();
    const now = Date.now();
    // 规则本身还算课中（老师端 / 以后的 App 会用到）。
    const rule = studentPushedTasks(state, "student-raymond", now, "Asia/Shanghai");
    expect(rule.find((window) => window.phase === "live")!.tasks.length).toBeGreaterThan(0);
    // 网页端取数时跳过这一档。
    const web = studentWebTasks(state, "student-raymond", now, "Asia/Shanghai");
    expect(web.map((window) => window.phase)).toEqual(["preview", "review"]);
    expect(web.some((window) => window.phase === "live")).toBe(false);
  });

  it("caps today's task list at four while keeping every window visible", () => {
    const entry = (id: string) => ({ phase: "preview" as never, set: { id } as never, session: {} as never });
    const pick = (windows: string[][]) => pickTodayTasks(windows.map((ids) => ids.map(entry)), 4, 2).map((item) => item.set.id);

    // 三档都有内容：每档先占一个位置，再补到 4 条。
    expect(pick([["a"], ["b", "c", "d"], ["e", "f"]])).toEqual(["a", "b", "c", "e"]);
    // 只有课中 + 课后：总量封顶 4，两档都能看到。
    expect(pick([[], ["b", "c", "d"], ["e", "f"]])).toEqual(["b", "c", "e", "f"]);
    // 只有一档有内容：最多 4 条。
    expect(pick([[], ["b", "c", "d", "e", "f"], []])).toEqual(["b", "c", "d", "e"]);
  });

  it("round-trips a category question through save and publish", () => {
    const result = platform.saveInteractionSet({
      lessonId: "lesson-greetings",
      title: "新题型保存测试",
      phase: "live",
      actorId: "teacher-lina",
      items: [
        {
          id: "item-test-category",
          type: "category",
          prompt: "把下面的词放到对应的类别里。",
          explanation: "见面和道别要分开。",
          groups: [
            { id: "group-hello", name: "见面时" },
            { id: "group-bye", name: "离开时" }
          ],
          words: [
            { id: "word-hello", text: "你好", pinyin: "nǐ hǎo", group: "group-hello" },
            { id: "word-bye", text: "再见", pinyin: "zàijiàn", group: "group-bye" }
          ]
        }
      ]
    });
    expect(result.ok).toBe(true);
    const savedSetId = result.data!.set.id;
    const saved = platform.getState();
    const version = saved.interactionVersions.find((item) => item.id === saved.interactionSets.find((set) => set.id === savedSetId)?.currentVersionId);
    expect(version?.items[0].groups?.[0].name).toBe("见面时");
    expect(version?.items[0].words?.[1].group).toBe("group-bye");
  });

  it("round-trips a picture question through save and publish", () => {
    const result = platform.saveInteractionSet({
      lessonId: "lesson-greetings",
      title: "新题型保存测试",
      phase: "live",
      actorId: "teacher-lina",
      items: [
        {
          id: "item-test-picture",
          type: "picture",
          prompt: "这是哪个时间？",
          explanation: "月亮代表晚上。",
          media: { icon: "🌙", image: "", alt: "夜晚的月亮" },
          promptPinyin: "Zhè shì nǎge shíjiān?",
          choices: [
            { id: "test-night", text: "晚上", hint: "wǎnshang", isCorrect: true },
            { id: "test-noon", text: "中午", hint: "zhōngwǔ", isCorrect: false }
          ]
        }
      ]
    });
    expect(result.ok).toBe(true);
    const savedSetId = result.data!.set.id;
    const saved = platform.getState();
    const version = saved.interactionVersions.find((item) => item.id === saved.interactionSets.find((set) => set.id === savedSetId)?.currentVersionId);
    expect(version?.items[0].media?.icon).toBe("🌙");
    expect(version?.items[0].choices?.[0].hint).toBe("wǎnshang");
  });

  it("attaches the time lesson courseware and review materials per phase", () => {
    const state = platform.getState();

    const preview = lessonContent(state, "lesson-time", "preview", "session-waitlist-full");
    const courseware = preview.materials.find((material) => material?.id === "material-time-courseware");
    expect(courseware?.kind).toBe("courseware");
    expect(courseware?.versions.find((entry) => entry.version === courseware.currentVersion)?.url).toBe(
      "/shared/demo-materials/time-courseware.html"
    );

    const review = lessonContent(state, "lesson-time", "review", "session-waitlist-full");
    const reviewIds = review.materials.map((material) => material?.id);
    expect(reviewIds).toEqual(["material-time-review-sheet", "material-time-review-audio"]);
    const sheet = review.materials[0];
    const audio = review.materials[1];
    expect(sheet?.kind).toBe("file");
    expect(sheet?.versions.at(-1)?.url).toBe("/shared/demo-materials/time-review-sheet.pdf");
    expect(audio?.fileType).toBe("wav");
    expect(audio?.versions.at(-1)?.url).toBe("/shared/demo-materials/time-review-audio.wav");

    // 课中阶段仍然不显示预习和复习材料。
    expect(lessonContent(state, "lesson-time", "live", "session-waitlist-full").materials).toHaveLength(0);
  });

  it("records attempts and keeps the best score", () => {
    platform.recordAttempt({
      setId: "set-greetings-review",
      studentId: "student-maya",
      sessionId: "session-past",
      phase: "review",
      answers: {},
      score: 60,
      timeSpentSeconds: 40,
      wrongItemIds: ["item-review-order"]
    });
    const second = platform.recordAttempt({
      setId: "set-greetings-review",
      studentId: "student-maya",
      sessionId: "session-past",
      phase: "review",
      answers: {},
      score: 90,
      timeSpentSeconds: 35,
      wrongItemIds: []
    });
    expect(second.data?.bestScore).toBe(90);
  });

  it("keeps a per-session roster snapshot with sync, manual additions and a start-time freeze", () => {
    const before = platform.getState();
    const now = Date.now();
    const target = before.sessions.find(
      (session) =>
        session.source === "single" &&
        session.status !== "cancelled" &&
        new Date(session.startAt).getTime() > now &&
        (session.roster?.length ?? 0) >= 2
    );
    expect(target).toBeDefined();
    const originalRoster = [...(target!.roster ?? [])];
    const manualStudentId = originalRoster[0].studentId;

    const removed = platform.removeSessionRosterStudent({
      sessionId: target!.id,
      studentId: manualStudentId,
      actorId: "operator-ray"
    });
    expect(removed.ok).toBe(true);
    expect(removed.data?.some((entry) => entry.studentId === manualStudentId)).toBe(false);

    const manual = platform.addSessionRosterStudents({
      sessionId: target!.id,
      studentIds: [manualStudentId],
      actorId: "operator-ray"
    });
    expect(manual.ok).toBe(true);
    expect(manual.data?.find((entry) => entry.studentId === manualStudentId)?.source).toBe("manual");
    expect(platform.removeClassMember({
      classId: target!.classId,
      studentId: manualStudentId,
      actorId: "operator-ray"
    }).ok).toBe(true);

    const createdStudent = platform.createStudent({
      name: "名单同步测试学生",
      className: "名单同步测试班",
      schoolId: target!.schoolId,
      actorId: "operator-ray"
    });
    expect(createdStudent.ok).toBe(true);
    const newMemberId = createdStudent.data!.user.id;
    const addedToClass = platform.addClassMembers({
      classId: target!.classId,
      studentIds: [newMemberId!],
      actorId: "operator-ray"
    });
    expect(addedToClass.ok).toBe(true);

    const synced = platform.syncSessionRoster({ sessionId: target!.id, actorId: "operator-ray" });
    expect(synced.ok).toBe(true);
    expect(synced.data?.some((entry) => entry.studentId === newMemberId)).toBe(true);
    expect(synced.data?.find((entry) => entry.studentId === manualStudentId)?.source).toBe("manual");

    const past = platform.getState().sessions.find((session) => new Date(session.startAt).getTime() <= Date.now());
    expect(past).toBeDefined();
    const frozen = platform.syncSessionRoster({ sessionId: past!.id, actorId: "operator-ray" });
    expect(frozen.ok).toBe(false);
    expect(frozen.code).toBe("ROSTER_FROZEN");
  });

  it("cancels without a required reason and keeps internal reasons out of student notifications", () => {
    const findCancelable = () => platform.getState().sessions.find((session) =>
      session.status !== "cancelled" &&
      platform.getState().bookings.some((booking) => booking.sessionId === session.id && booking.status === "booked")
    );

    const withoutReasonSession = findCancelable();
    expect(withoutReasonSession).toBeDefined();
    const beforeIds = new Set(platform.getState().notifications.map((notice) => notice.id));
    const withoutReason = platform.cancelSession({
      sessionId: withoutReasonSession!.id,
      actorId: "operator-ray"
    });
    expect(withoutReason.ok).toBe(true);
    expect(platform.getState().sessions.find((session) => session.id === withoutReasonSession!.id)?.status).toBe("cancelled");
    const reasonFreeNotices = platform.getState().notifications
      .filter((notice) => !beforeIds.has(notice.id) && notice.type === "session_cancelled");
    expect(reasonFreeNotices.length).toBeGreaterThan(0);
    expect(reasonFreeNotices.every((notice) => !notice.body.includes("原因"))).toBe(true);

    platform.resetDemo();
    const withReasonSession = findCancelable();
    expect(withReasonSession).toBeDefined();
    const internalReason = "内部原因：教师临时调整";
    const beforeReasonIds = new Set(platform.getState().notifications.map((notice) => notice.id));
    const withReason = platform.cancelSession({
      sessionId: withReasonSession!.id,
      actorId: "operator-ray",
      reason: internalReason
    });
    expect(withReason.ok).toBe(true);
    const after = platform.getState();
    expect(after.sessions.find((session) => session.id === withReasonSession!.id)?.cancelReason).toBe(internalReason);
    expect(after.auditEvents.find((event) => event.action === "cancel_session" && event.targetId === withReasonSession!.id)?.reason).toBe(internalReason);
    const reasonNotices = after.notifications
      .filter((notice) => !beforeReasonIds.has(notice.id) && notice.type === "session_cancelled");
    expect(reasonNotices.length).toBeGreaterThan(0);
    expect(reasonNotices.every((notice) => !notice.body.includes(internalReason) && !notice.body.includes("原因"))).toBe(true);
  });

  it("formats the same UTC time differently for Jakarta and Shanghai", () => {
    const iso = "2026-09-16T12:00:00.000Z";
    const jakarta = formatDateTime(iso, "Asia/Jakarta", "zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    const shanghai = formatDateTime(iso, "Asia/Shanghai", "zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    expect(jakarta).toContain("19:00");
    expect(shanghai).toContain("20:00");
  });
});
