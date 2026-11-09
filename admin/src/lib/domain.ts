import type {
  Booking,
  ClassSession,
  InteractionSet,
  InteractionVersion,
  Lesson,
  LessonMaterialRef,
  Material,
  Phase,
  PlatformUser,
  PlatformState,
  StudentProfile,
  WaitlistEntry
} from "../domain/types";

export function currentUser(state: PlatformState) {
  return state.users.find((user) => user.id === state.currentUserId) ?? state.users[0];
}

export function getUser(state: PlatformState, userId: string) {
  return state.users.find((user) => user.id === userId);
}

export function getStudent(state: PlatformState, studentId: string): StudentProfile | undefined {
  return state.students.find((item) => item.userId === studentId);
}

const DEMO_UNBOUND_STUDENT_IDS = new Set(["student-raymond", "student-laksmi"]);

/** 演示阶段按学生姓名生成稳定的 App 账号；真实数据有 appAccount 时优先使用。 */
export function studentAppAccount(user?: PlatformUser) {
  if (!user || user.role !== "student") return "";
  if (user.appAccount) return user.appAccount;
  if (DEMO_UNBOUND_STUDENT_IDS.has(user.id)) return "";
  return user.name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 18);
}

export function getLesson(state: PlatformState, lessonId: string): Lesson | undefined {
  return state.lessons.find((lesson) => lesson.id === lessonId);
}

export function getSession(state: PlatformState, sessionId: string) {
  return state.sessions.find((session) => session.id === sessionId);
}

export function getTeacherSessions(state: PlatformState, teacherId: string) {
  return state.sessions
    .filter((session) => session.teacherId === teacherId && session.status !== "cancelled")
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

export function getSchoolTimeZone(state: PlatformState, schoolId: string) {
  const school = state.schools.find((item) => item.id === schoolId);
  if (school?.timeZone) return school.timeZone;
  const memberships = state.schoolMemberships.filter(
    (membership) => membership.schoolId === schoolId && membership.status === "active"
  );
  const academic = memberships.find((membership) => membership.role === "academic");
  const member = academic ?? memberships[0];
  const user = member ? getUser(state, member.userId) : undefined;
  return user?.timeZone ?? state.ui.timeZone;
}

export function getStudentBookings(state: PlatformState, studentId: string): Booking[] {
  return state.bookings
    .filter((booking) => booking.studentId === studentId && booking.status === "booked")
    .sort((a, b) => {
      const aSession = getSession(state, a.sessionId);
      const bSession = getSession(state, b.sessionId);
      return new Date(aSession?.startAt ?? 0).getTime() - new Date(bSession?.startAt ?? 0).getTime();
    });
}

export function getBookedCount(state: PlatformState, sessionId: string) {
  return state.bookings.filter((booking) => booking.sessionId === sessionId && booking.status === "booked").length;
}

export function getWaitlist(state: PlatformState, sessionId: string) {
  return state.waitlist
    .filter((entry) => entry.status === "waiting" && (entry.sessionId === sessionId || entry.sessionIds.includes(sessionId)))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function getStudentWaitlist(state: PlatformState, studentId: string): WaitlistEntry[] {
  return state.waitlist.filter((entry) => entry.studentId === studentId && entry.status === "waiting");
}

export function isSessionBooked(state: PlatformState, studentId: string, sessionId: string) {
  return state.bookings.some((booking) => booking.studentId === studentId && booking.sessionId === sessionId && booking.status === "booked");
}

/** 已提交报名、仍在等待教学管理审核的课次。 */
export function isSessionPendingReview(state: PlatformState, studentId: string, sessionId: string) {
  return state.bookings.some((booking) => booking.studentId === studentId && booking.sessionId === sessionId && booking.status === "pending_review");
}

export function getStudentPendingReviewBookings(state: PlatformState, studentId: string): Booking[] {
  return state.bookings
    .filter((booking) => booking.studentId === studentId && booking.status === "pending_review")
    .sort((a, b) => {
      const aSession = getSession(state, a.sessionId);
      const bSession = getSession(state, b.sessionId);
      return new Date(aSession?.startAt ?? 0).getTime() - new Date(bSession?.startAt ?? 0).getTime();
    });
}

export function isSessionWaitlisted(state: PlatformState, studentId: string, sessionId: string) {
  return state.waitlist.some((entry) => entry.studentId === studentId && entry.status === "waiting" && (entry.sessionId === sessionId || entry.sessionIds.includes(sessionId)));
}

export function fillRate(state: PlatformState, session: ClassSession) {
  if (!session.capacity) return 0;
  return (getBookedCount(state, session.id) / session.capacity) * 100;
}

export function sessionPhase(session: ClassSession, phase: Phase, now = Date.now()) {
  const start = new Date(session.startAt).getTime();
  const end = new Date(session.endAt).getTime();
  if (phase === "preview") return now < end;
  if (phase === "live") return now >= start - 10 * 60_000 && now <= end + 10 * 60_000;
  return now > end;
}

export function phaseAvailabilityLabel(session: ClassSession, phase: Phase, now = Date.now()) {
  if (sessionPhase(session, phase, now)) return "open";
  const start = new Date(session.startAt).getTime();
  const end = new Date(session.endAt).getTime();
  if (phase === "preview" && now >= end) return "ended";
  if (phase === "live" && now < start - 10 * 60_000) return "upcoming";
  if (phase === "review" && now <= end) return "upcoming";
  return "locked";
}

export function getCurrentInteractionVersion(state: PlatformState, set: InteractionSet): InteractionVersion | undefined {
  return state.interactionVersions.find((version) => version.id === set.currentVersionId) ??
    state.interactionVersions
      .filter((version) => version.setId === set.id)
      .sort((a, b) => b.version - a.version)[0];
}

/**
 * 互动集是否作用于某个课次。
 * sessionIds 未设置 = 作用于该课节全部课次；设置为数组时只出现在列出的课次（空数组 = 均不出现）。
 * excludedSessionIds 用于把某一课次单独移出，不改变其它课次。
 */
export function setAppliesToSession(set: InteractionSet, sessionId?: string | null) {
  if (!sessionId) return true;
  if ((set.excludedSessionIds ?? []).includes(sessionId)) return false;
  if (!set.sessionIds) return true;
  return set.sessionIds.includes(sessionId);
}

/** 材料是否作用于某个课次：规则与互动集一致。 */
export function materialRefAppliesToSession(ref: LessonMaterialRef, sessionId?: string | null) {
  if (!sessionId) return true;
  if ((ref.excludedSessionIds ?? []).includes(sessionId)) return false;
  if (!ref.sessionIds) return true;
  return ref.sessionIds.includes(sessionId);
}

/** 同一课节下的课次，按开始时间排序。 */
export function getLessonSessions(state: PlatformState, lessonId: string, teacherId?: string) {
  return state.sessions
    .filter((session) => session.lessonId === lessonId && session.status !== "cancelled" && (!teacherId || session.teacherId === teacherId))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

/** 作用范围文案：全课节 / 指定课次。 */
export function scopeLabel(scope: { sessionIds?: string[]; excludedSessionIds?: string[] }, sessionId?: string | null) {
  if (sessionId && (scope.excludedSessionIds ?? []).includes(sessionId)) return "已从本节课移出";
  if (!scope.sessionIds) return "全课次共用";
  if (!scope.sessionIds.length) return "未配置到课次";
  return sessionId && scope.sessionIds.length === 1 && scope.sessionIds.includes(sessionId)
    ? "本节课专属"
    : `指定 ${scope.sessionIds.length} 节课次`;
}

/** 某一课次在某阶段的材料清单（含来源课节信息）。 */
export function sessionMaterials(state: PlatformState, session: ClassSession, phase: Phase) {
  return state.materialRefs
    .filter((ref) => ref.lessonId === session.lessonId && ref.phase === phase && materialRefAppliesToSession(ref, session.id))
    .sort((a, b) => a.order - b.order)
    .map((ref) => ({ ref, material: state.materials.find((material) => material.id === ref.materialId) }))
    .filter((item): item is { ref: LessonMaterialRef; material: Material } => Boolean(item.material));
}

export function setsForSession(state: PlatformState, session: ClassSession) {
  return state.interactionSets
    .filter((set) => set.lessonId === session.lessonId && setAppliesToSession(set, session.id))
    .sort((a, b) => a.order - b.order);
}

export function lessonContent(state: PlatformState, lessonId: string, phase?: Phase, sessionId?: string | null) {
  const sets = state.interactionSets
    .filter((set) => set.lessonId === lessonId && (!phase || set.phase === phase) && setAppliesToSession(set, sessionId))
    .sort((a, b) => a.order - b.order);
  const refs = state.materialRefs
    .filter((ref) => ref.lessonId === lessonId && ref.published && (!phase || ref.phase === phase))
    .filter((ref) => materialRefAppliesToSession(ref, sessionId))
    .sort((a, b) => a.order - b.order);
  return {
    sets,
    materials: refs
      .map((ref) => state.materials.find((material) => material.id === ref.materialId))
      .filter((material) => material && material.status === "published")
  };
}

/* ---- 学生端任务推送窗口 ---- */

/** 课前提前 48 小时推送、课中上课当天推送、课后在下课后 48 小时内可完成。 */
export const TASK_PUSH_WINDOW_MS = 48 * 60 * 60 * 1000;

/** 按学生所在时区取日期，用来判断“课中任务是不是今天”。 */
export function dayStamp(value: string | Date, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

/**
 * 课中互动改由学生端 App（移动端）承载，学生端网页不展示、也不推送这一档。
 * 恢复时把开关改成 true 即可（下面的取数逻辑与窗口规则都不用动）。
 */
export const SHOW_LIVE_TASKS_ON_WEB = false;

export interface StudentTaskEntry {
  phase: Phase;
  set: InteractionSet;
  session: ClassSession;
}

/**
 * 学习任务：按三个推送窗口列出学生当前该看到的互动。
 * 同一条互动同时命中多个窗口时只保留靠前的那一档（课前 → 课中 → 课后）。
 */
export function studentPushedTasks(state: PlatformState, studentId: string, now: number, timeZone: string) {
  const sessions = getStudentBookings(state, studentId)
    .map((booking) => getSession(state, booking.sessionId))
    .filter((session): session is ClassSession => Boolean(session));
  const todayStamp = dayStamp(new Date(now), timeZone);
  const sameDay = (session: ClassSession) => dayStamp(session.startAt, timeZone) === todayStamp;
  const inProgress = (session: ClassSession) =>
    new Date(session.startAt).getTime() <= now && new Date(session.endAt).getTime() >= now;

  const windows: Array<{ phase: Phase; sessions: ClassSession[] }> = [
    {
      phase: "preview",
      // 开课前 48 小时内推送，开课后收起。
      sessions: sessions
        .filter((session) => {
          const startsIn = new Date(session.startAt).getTime() - now;
          return startsIn > 0 && startsIn <= TASK_PUSH_WINDOW_MS;
        })
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    },
    {
      phase: "live",
      // 上课当天推送；跨零点还在上的课也算当天。
      sessions: sessions
        .filter((session) => sameDay(session) || inProgress(session))
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    },
    {
      phase: "review",
      // 下课后 48 小时内可完成，最近下课的一节排前面。
      sessions: sessions
        .filter((session) => {
          const endedAgo = now - new Date(session.endAt).getTime();
          return endedAgo > 0 && endedAgo <= TASK_PUSH_WINDOW_MS;
        })
        .sort((a, b) => new Date(b.endAt).getTime() - new Date(a.endAt).getTime())
    }
  ];

  const seenSetIds = new Set<string>();
  return windows.map(({ phase, sessions: windowSessions }) => ({
    phase,
    tasks: windowSessions
      .flatMap((session) =>
        lessonContent(state, session.lessonId, phase, session.id).sets.map((set) => ({ phase, set, session }))
      )
      .filter((entry) => {
        if (seenSetIds.has(entry.set.id)) return false;
        seenSetIds.add(entry.set.id);
        return true;
      })
  }));
}

/**
 * 今日任务的取数规则：每个窗口先各占 1 个位置，再按窗口顺序补到每个窗口 2 条，
 * 最后还有空位就继续往后补，总数不超过 max。
 */
export function pickTodayTasks(windows: StudentTaskEntry[][], max: number, perWindow: number) {
  const counts = windows.map((tasks) => Math.min(1, tasks.length));
  let used = counts.reduce((sum, count) => sum + count, 0);
  while (used < max) {
    let added = false;
    windows.forEach((tasks, index) => {
      if (used >= max) return;
      const limit = counts[index] < perWindow ? Math.min(perWindow, tasks.length) : tasks.length;
      if (counts[index] >= limit) return;
      counts[index] += 1;
      used += 1;
      added = true;
    });
    if (!added) break;
  }
  return windows.flatMap((tasks, index) => tasks.slice(0, counts[index]));
}

/** 学生端网页要展示的今日任务：只看课前 / 课后，课中那一档交给 App。 */
export function studentWebTasks(state: PlatformState, studentId: string, now: number, timeZone: string) {
  const windows = studentPushedTasks(state, studentId, now, timeZone);
  if (SHOW_LIVE_TASKS_ON_WEB) return windows;
  return windows.filter((window) => window.phase !== "live");
}

export function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function teacherMetrics(state: PlatformState, teacherId: string) {
  const sessions = getTeacherSessions(state, teacherId);
  const active = sessions.filter((session) => session.status === "published");
  const booked = active.reduce((sum, session) => sum + getBookedCount(state, session.id), 0);
  const capacity = active.reduce((sum, session) => sum + session.capacity, 0);
  const setIds = new Set(
    active
      .map((session) => getLesson(state, session.lessonId))
      .filter(Boolean)
      .flatMap((lesson) => state.interactionSets.filter((set) => set.lessonId === lesson!.id).map((set) => set.id))
  );
  const attempts = state.interactionAttempts.filter((attempt) => setIds.has(attempt.setId));
  return {
    sessions,
    upcoming: active.filter((session) => new Date(session.endAt).getTime() > Date.now()),
    booked,
    capacity,
    fillRate: capacity ? (booked / capacity) * 100 : 0,
    averageScore: average(attempts.map((attempt) => attempt.score)),
    completionRate: setIds.size ? Math.min(100, (attempts.length / Math.max(1, booked * setIds.size)) * 100) : 0
  };
}

export function operatorMetrics(state: PlatformState) {
  const published = state.sessions.filter((session) => session.status === "published");
  const capacity = published.reduce((sum, session) => sum + session.capacity, 0);
  const booked = published.reduce((sum, session) => sum + getBookedCount(state, session.id), 0);
  const activeWaitlist = state.waitlist.filter((entry) => entry.status === "waiting");
  const today = published.filter((session) => new Date(session.startAt).toDateString() === new Date().toDateString());
  return {
    published,
    capacity,
    booked,
    fillRate: capacity ? (booked / capacity) * 100 : 0,
    waitlist: activeWaitlist,
    today,
    students: state.students.length,
    averageDownload: average(state.materials.map((material) => material.downloadCount))
  };
}

export function studentMetrics(state: PlatformState, studentId: string) {
  const bookings = getStudentBookings(state, studentId);
  const sessions = bookings.map((booking) => getSession(state, booking.sessionId)).filter(Boolean) as ClassSession[];
  const attempts = state.interactionAttempts.filter((attempt) => attempt.studentId === studentId);
  const completedSetIds = new Set(attempts.map((attempt) => attempt.setId));
  const upcoming = sessions
    .filter((session) => new Date(session.endAt).getTime() >= Date.now())
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const past = sessions
    .filter((session) => new Date(session.endAt).getTime() < Date.now())
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  return {
    bookings,
    sessions,
    upcoming,
    past,
    attempts,
    completedSetIds,
    averageScore: average(attempts.map((attempt) => attempt.score)),
    totalStudyMinutes: Math.round(attempts.reduce((sum, attempt) => sum + attempt.timeSpentSeconds, 0) / 60)
  };
}
