import type { PlatformState } from "../domain/types";
import { getBookedCount, setsForSession } from "./domain";
import {
  buildGradeAnalytics,
  dateInputInTimeZone,
  gradeRangeBounds,
  type GradeCategorySummary,
  type GradeDateRange,
  type StudentGradeSummary
} from "./gradeAnalytics";

export interface TeacherPerformanceClassRow {
  classId: string;
  className: string;
  studentCount: number;
  composite: number | null;
  completionRate: number | null;
}

export interface TeacherPerformanceSummary {
  teacherId: string;
  teacherName: string;
  avatar: string;
  schoolId: string;
  classIds: string[];
  classCount: number;
  sampleSize: number;
  ranked: boolean;
  rank: number | null;
  compositeAverage: number | null;
  categories: Record<string, GradeCategorySummary>;
  completionRate: number | null;
  lowScoreCount: number;
  dataCoverage: number;
  trendDelta: number | null;
  students: StudentGradeSummary[];
  classRows: TeacherPerformanceClassRow[];
  note: string;
}

export interface TeacherRankingResult {
  teachers: TeacherPerformanceSummary[];
  eligibleCount: number;
}

function round(value: number | null) {
  return value === null ? null : Math.round(value * 10) / 10;
}

function previousRange(range: GradeDateRange): GradeDateRange {
  const bounds = gradeRangeBounds(range);
  const start = new Date(bounds.startAt).getTime();
  const end = new Date(bounds.endAt).getTime();
  const duration = Math.max(24 * 60 * 60 * 1000, end - start + 1);
  const previousEnd = start - 1;
  const previousStart = previousEnd - duration + 1;
  return {
    start: dateInputInTimeZone(new Date(previousStart), range.timeZone),
    end: dateInputInTimeZone(new Date(previousEnd), range.timeZone),
    timeZone: range.timeZone
  };
}

function completionForTeacher(state: PlatformState, teacherId: string, schoolId: string, range: GradeDateRange) {
  const { startAt, endAt } = gradeRangeBounds(range);
  const sessions = state.sessions.filter((session) => {
    if (session.teacherId !== teacherId || session.schoolId !== schoolId || session.status !== "published") return false;
    const start = new Date(session.startAt).getTime();
    return start >= new Date(startAt).getTime() && start <= new Date(endAt).getTime();
  });
  let expected = 0;
  const completed = new Set<string>();
  sessions.forEach((session) => {
    const sets = setsForSession(state, session).filter((set) => set.status === "published");
    const bookings = state.bookings.filter((booking) => booking.sessionId === session.id && booking.status === "booked");
    sets.forEach((set) => {
      bookings.forEach((booking) => {
        expected += 1;
        const attempt = state.interactionAttempts.find(
          (item) =>
            item.sessionId === session.id &&
            item.setId === set.id &&
            item.studentId === booking.studentId &&
            new Date(item.completedAt).getTime() >= new Date(startAt).getTime() &&
            new Date(item.completedAt).getTime() <= new Date(endAt).getTime()
        );
        if (attempt) completed.add(`${session.id}:${set.id}:${booking.studentId}`);
      });
    });
  });
  if (!expected) return null;
  return Math.min(100, Math.round((completed.size / expected) * 100));
}

function classRowsForTeacher(
  state: PlatformState,
  teacherId: string,
  schoolId: string,
  range: GradeDateRange,
  analyticsStudents: StudentGradeSummary[]
) {
  const classIds = [...new Set(
    state.sessions
      .filter((session) => session.teacherId === teacherId && session.schoolId === schoolId)
      .map((session) => session.classId)
      .filter(Boolean)
  )];
  return classIds.map((classId) => {
    const classAnalytics = buildGradeAnalytics(state, range, { schoolId, teacherId, classId });
    const interaction = classAnalytics.categoryAverages.interaction;
    return {
      classId,
      className: state.classes.find((item) => item.id === classId)?.name ?? "未分班",
      studentCount: analyticsStudents.filter((student) => student.classIds.includes(classId)).length,
      composite: classAnalytics.compositeAverage,
      completionRate: interaction.count ? round(interaction.average) : null
    };
  });
}

function summaryForTeacher(
  state: PlatformState,
  teacherId: string,
  schoolId: string,
  range: GradeDateRange
): TeacherPerformanceSummary {
  const teacher = state.users.find((item) => item.id === teacherId);
  const analytics = buildGradeAnalytics(state, range, { schoolId, teacherId });
  const previous = buildGradeAnalytics(state, previousRange(range), { schoolId, teacherId });
  const students = analytics.students.filter((student) => student.records.length > 0);
  const sampleSize = students.length;
  const compositeAverage = analytics.compositeAverage;
  const categories = analytics.categoryAverages;
  const completionRate = completionForTeacher(state, teacherId, schoolId, range);
  const lowScoreCount = students.filter((student) => student.composite !== null && student.composite < 60).length;
  const dataCoverage = sampleSize
    ? Math.round(
        (students.filter((student) =>
          (["interaction", "homework", "exam"] as const).every((category) => student.categories[category].count > 0)
        ).length /
          sampleSize) *
          100
      )
    : 0;
  const trendDelta =
    analytics.compositeAverage !== null && previous.compositeAverage !== null
      ? round(analytics.compositeAverage - previous.compositeAverage)
      : null;
  const classIds = [...new Set(students.flatMap((student) => student.classIds))];
  return {
    teacherId,
    teacherName: teacher?.name ?? "教师",
    avatar: teacher?.avatar ?? "师",
    schoolId,
    classIds,
    classCount: classIds.length,
    sampleSize,
    ranked: sampleSize >= 5 && compositeAverage !== null,
    rank: null,
    compositeAverage: round(compositeAverage),
    categories,
    completionRate,
    lowScoreCount,
    dataCoverage,
    trendDelta,
    students,
    classRows: classRowsForTeacher(state, teacherId, schoolId, range, students),
    note: sampleSize < 5 ? "有效学生少于 5 人，保留明细但不参与排名。" : ""
  };
}

export function buildTeacherRanking(state: PlatformState, schoolId: string, range: GradeDateRange): TeacherRankingResult {
  const teacherIds = [...new Set(
    state.schoolMemberships
      .filter((item) => item.schoolId === schoolId && item.role === "teacher" && item.status === "active")
      .map((item) => item.userId)
  )];
  const teachers = teacherIds
    .map((teacherId) => summaryForTeacher(state, teacherId, schoolId, range))
    .sort((a, b) => {
      if (a.ranked !== b.ranked) return Number(b.ranked) - Number(a.ranked);
      if (a.ranked && b.ranked) {
        return (b.compositeAverage ?? -1) - (a.compositeAverage ?? -1) ||
          (b.completionRate ?? -1) - (a.completionRate ?? -1) ||
          b.sampleSize - a.sampleSize ||
          a.teacherName.localeCompare(b.teacherName);
      }
      return b.sampleSize - a.sampleSize || a.teacherName.localeCompare(b.teacherName);
    });
  let rank = 0;
  teachers.forEach((teacher) => {
    if (teacher.ranked) {
      rank += 1;
      teacher.rank = rank;
    }
  });
  return { teachers, eligibleCount: rank };
}

export function teacherPerformanceCsv(schoolName: string, range: GradeDateRange, teachers: TeacherPerformanceSummary[]) {
  const header = ["学校", "统计开始", "统计结束", "教师", "排名", "有效学生数", "综合均分", "互动完成率", "作业均分", "考试均分", "低分学生数", "数据覆盖率", "环比变化"];
  const rows = teachers.map((teacher) => [
    schoolName,
    range.start,
    range.end,
    teacher.teacherName,
    teacher.rank ?? "样本不足",
    teacher.sampleSize,
    teacher.compositeAverage ?? "",
    teacher.completionRate ?? "",
    teacher.categories.homework.average ?? "",
    teacher.categories.exam.average ?? "",
    teacher.lowScoreCount,
    `${teacher.dataCoverage}%`,
    teacher.trendDelta ?? ""
  ]);
  return [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export function teacherHasTeachingData(state: PlatformState, teacherId: string, schoolId: string) {
  return state.sessions.some((session) => session.teacherId === teacherId && session.schoolId === schoolId && getBookedCount(state, session.id) > 0);
}
