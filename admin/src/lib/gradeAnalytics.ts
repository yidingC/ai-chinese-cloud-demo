import type {
  AssessmentScoreStatus,
  ClassEnrollment,
  GradeCategory,
  GradePolicy,
  InteractionType,
  Phase,
  PlatformState
} from "../domain/types";

export interface GradeDateRange {
  /** YYYY-MM-DD，按查看者时区解释。 */
  start: string;
  /** YYYY-MM-DD，包含该日。 */
  end: string;
  timeZone: string;
}

export type GradeRangePreset = "7d" | "30d" | "90d" | "custom";

export interface GradeRangeSelection extends GradeDateRange {
  preset: GradeRangePreset;
}

export interface GradeScope {
  studentId?: string;
  teacherId?: string;
  classId?: string;
  schoolId?: string;
}

export interface GradeRecord {
  id: string;
  studentId: string;
  schoolId?: string;
  category: GradeCategory;
  title: string;
  score: number | null;
  normalizedScore: number | null;
  status: AssessmentScoreStatus | "completed";
  occurredAt: string;
  classId?: string;
  lessonTitle?: string;
  phase?: Phase;
  sessionId?: string | null;
  teacherId?: string;
  sourceId: string;
  attempt?: number;
  timeSpentSeconds?: number;
  wrongItemCount?: number;
  rawScore?: number | null;
  maxScore?: number;
}

export interface GradeCategorySummary {
  category: GradeCategory;
  average: number | null;
  count: number;
  weight: number;
}

export type SkillDimensionKey = "listening" | "speaking" | "pinyin" | "vocabulary" | "grammar" | "reading";

export interface SkillRadarDimension {
  key: SkillDimensionKey;
  label: string;
  score: number | null;
  sampleCount: number;
}

export interface GradeTrendPoint {
  key: string;
  startAt: string;
  endAt: string;
  composite: number | null;
  categories: Record<GradeCategory, number | null>;
  count: number;
}

export interface StudentGradeSummary {
  studentId: string;
  name: string;
  avatar: string;
  level: string;
  classIds: string[];
  classLabel: string;
  courseLabel: string;
  composite: number | null;
  categories: Record<GradeCategory, GradeCategorySummary>;
  records: GradeRecord[];
  trend: GradeTrendPoint[];
  skillRadar: SkillRadarDimension[];
  pendingCount: number;
  absentCount: number;
  excusedCount: number;
  interactionMinutes: number;
}

export interface GradeAnalytics {
  policy: GradePolicy;
  startAt: string;
  endAt: string;
  students: StudentGradeSummary[];
  records: GradeRecord[];
  trend: GradeTrendPoint[];
  skillRadar: SkillRadarDimension[];
  compositeAverage: number | null;
  categoryAverages: Record<GradeCategory, GradeCategorySummary>;
  pendingCount: number;
  absentCount: number;
  excusedCount: number;
}

const categoryOrder: GradeCategory[] = ["interaction", "homework", "exam"];
const skillDimensionOrder: SkillDimensionKey[] = ["listening", "speaking", "pinyin", "vocabulary", "grammar", "reading"];
export const skillDimensionLabels: Record<SkillDimensionKey, string> = {
  listening: "听力",
  speaking: "口语",
  pinyin: "拼音",
  vocabulary: "词汇",
  grammar: "语法",
  reading: "阅读"
};

type SkillWeights = Partial<Record<SkillDimensionKey, number>>;

/**
 * 一套互动可能混合多种题型。首版按题型能力标签给整套得分分配权重，
 * 等单题结果接入后，可把这里的记录级估算替换为单题级统计。
 */
export const interactionSkillWeights: Record<InteractionType, SkillWeights> = {
  match: { vocabulary: 0.75, reading: 0.25 },
  memory: { vocabulary: 0.8, reading: 0.2 },
  choice: { reading: 0.55, vocabulary: 0.25, grammar: 0.2 },
  order: { grammar: 0.7, reading: 0.3 },
  fill: { grammar: 0.55, vocabulary: 0.25, reading: 0.2 },
  poll: {},
  picture: { vocabulary: 0.85, reading: 0.15 },
  "picture-match": { vocabulary: 0.8, reading: 0.2 },
  situation: { reading: 0.5, grammar: 0.3, vocabulary: 0.2 },
  dialogue: { reading: 0.5, grammar: 0.3, vocabulary: 0.2 },
  "pinyin-match": { pinyin: 0.7, vocabulary: 0.3 },
  category: { vocabulary: 0.8, reading: 0.2 },
  "word-build": { vocabulary: 0.8, grammar: 0.2 },
  correction: { grammar: 0.7, vocabulary: 0.15, reading: 0.15 },
  listening: { listening: 0.8, vocabulary: 0.2 },
  "read-aloud": { speaking: 0.55, pinyin: 0.45 },
  "picture-talk": { speaking: 0.6, vocabulary: 0.2, grammar: 0.2 },
  "open-qa": { speaking: 0.5, grammar: 0.3, vocabulary: 0.2 }
};

const broadAssessmentWeights: SkillWeights = {
  listening: 1 / 6,
  speaking: 1 / 6,
  pinyin: 1 / 6,
  vocabulary: 1 / 6,
  grammar: 1 / 6,
  reading: 1 / 6
};

function assessmentSkillWeights(title: string): SkillWeights {
  const normalized = title.trim().toLowerCase();
  if (/听力|听/.test(normalized)) return { listening: 0.8, vocabulary: 0.2 };
  if (/口语|朗读|发音|说话/.test(normalized)) return { speaking: 0.7, pinyin: 0.3 };
  if (/拼音|声调|音节/.test(normalized)) return { pinyin: 0.75, speaking: 0.25 };
  if (/词汇|词语|生词|汉字|拼字|写字/.test(normalized)) return { vocabulary: 0.8, reading: 0.2 };
  if (/语法|句子|填空|改错|排序|量词/.test(normalized)) return { grammar: 0.7, reading: 0.3 };
  if (/阅读|看图|对话|情景|理解/.test(normalized)) return { reading: 0.65, vocabulary: 0.2, grammar: 0.15 };
  return broadAssessmentWeights;
}

function buildSkillRadar(state: PlatformState, records: GradeRecord[]): SkillRadarDimension[] {
  const accumulated = Object.fromEntries(
    skillDimensionOrder.map((key) => [key, { scoreTotal: 0, weightTotal: 0, sampleCount: 0 }])
  ) as Record<SkillDimensionKey, { scoreTotal: number; weightTotal: number; sampleCount: number }>;

  const addObservation = (weights: SkillWeights, score: number) => {
    (Object.entries(weights) as Array<[SkillDimensionKey, number]>).forEach(([key, weight]) => {
      if (weight <= 0) return;
      accumulated[key].scoreTotal += score * weight;
      accumulated[key].weightTotal += weight;
      accumulated[key].sampleCount += 1;
    });
  };

  records.forEach((record) => {
    const score = countedScore(record);
    if (score === null) return;

    if (record.category !== "interaction") {
      addObservation(assessmentSkillWeights(record.title), score);
      return;
    }

    const set = state.interactionSets.find((item) => item.id === record.sourceId);
    const version = set ? state.interactionVersions.find((item) => item.id === set.currentVersionId) : undefined;
    (version?.items ?? []).forEach((item) => addObservation(interactionSkillWeights[item.type], score));
  });

  return skillDimensionOrder.map((key) => ({
    key,
    label: skillDimensionLabels[key],
    score: accumulated[key].weightTotal > 0
      ? roundScore(accumulated[key].scoreTotal / accumulated[key].weightTotal)
      : null,
    sampleCount: accumulated[key].sampleCount
  }));
}

export function dateInputInTimeZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function relativeGradeRange(timeZone: string, days: 7 | 30 | 90): GradeRangeSelection {
  const end = dateInputInTimeZone(new Date(), timeZone);
  const { year, month, day } = dateParts(end);
  const start = new Date(Date.UTC(year, month - 1, day - (days - 1))).toISOString().slice(0, 10);
  return {
    preset: `${days}d` as GradeRangePreset,
    start,
    end,
    timeZone
  };
}

export function defaultGradeRange(timeZone: string): GradeRangeSelection {
  return relativeGradeRange(timeZone, 30);
}

function roundScore(value: number) {
  return Math.round(value * 10) / 10;
}

function average(values: number[]) {
  if (!values.length) return null;
  return roundScore(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function dateParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function validDateInput(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function timeZoneOffset(timestamp: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  const asUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
  return asUtc - timestamp;
}

function zonedDateToUtc(date: string, timeZone: string) {
  const { year, month, day } = dateParts(date);
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const firstOffset = timeZoneOffset(guess, timeZone);
  const firstResult = guess - firstOffset;
  const secondOffset = timeZoneOffset(firstResult, timeZone);
  return guess - secondOffset;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function gradeRangeBounds(range: GradeDateRange) {
  const today = dateInputInTimeZone(new Date(), range.timeZone);
  let start = validDateInput(range.start) ? range.start : today;
  let end = validDateInput(range.end) ? range.end : today;
  if (start > end) [start, end] = [end, start];
  const startAt = zonedDateToUtc(start, range.timeZone);
  const endAt = zonedDateToUtc(end, range.timeZone);
  const exclusiveEndAt = zonedDateToUtc(
    new Date(Date.UTC(
      dateParts(end).year,
      dateParts(end).month - 1,
      dateParts(end).day + 1
    )).toISOString().slice(0, 10),
    range.timeZone
  );
  return {
    startAt: new Date(startAt).toISOString(),
    endAt: new Date(Math.max(startAt, exclusiveEndAt - 1)).toISOString()
  };
}

export function selectGradePolicy(state: PlatformState, at: string, schoolId?: string | null): GradePolicy {
  const sorted = [...state.gradePolicies].sort(
    (a, b) => new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime()
  );
  const atTime = new Date(at).getTime();
  const scoped = sorted.filter((policy) => policy.schoolId === (schoolId ?? null));
  if (schoolId) {
    const schoolPolicy = [...scoped].reverse().find((policy) => new Date(policy.effectiveFrom).getTime() <= atTime);
    if (schoolPolicy) return schoolPolicy;
  }
  const defaults = sorted.filter((policy) => policy.schoolId === null);
  return [...defaults].reverse().find((policy) => new Date(policy.effectiveFrom).getTime() <= atTime)
    ?? defaults[0]
    ?? sorted[0]
    ?? {
      id: "grade-policy-fallback",
      schoolId: null,
      effectiveFrom: new Date(0).toISOString(),
      weights: { interaction: 40, homework: 30, exam: 30 },
      updatedBy: "system",
      updatedAt: new Date(0).toISOString()
    };
}

function isInRange(value: string, startAt: string, endAt: string) {
  const time = new Date(value).getTime();
  return time >= new Date(startAt).getTime() && time <= new Date(endAt).getTime();
}

function sessionContext(state: PlatformState, sessionId: string | null | undefined) {
  const session = sessionId ? state.sessions.find((item) => item.id === sessionId) : undefined;
  const classGroup = session?.classId ? state.classes.find((item) => item.id === session.classId) : undefined;
  return {
    session,
    classGroup,
    classId: session?.classId,
    schoolId: session?.schoolId || classGroup?.schoolId,
    teacherId: session?.teacherId
  };
}

function enrollmentMatchesScope(enrollment: ClassEnrollment, scope: GradeScope, state: PlatformState) {
  if (enrollment.status !== "active") return false;
  if (scope.classId && enrollment.classId !== scope.classId) return false;
  if (scope.schoolId) {
    const classGroup = state.classes.find((item) => item.id === enrollment.classId);
    if (classGroup?.schoolId !== scope.schoolId) return false;
  }
  if (scope.teacherId) {
    const classGroup = state.classes.find((item) => item.id === enrollment.classId);
    if (classGroup?.teacherId !== scope.teacherId) return false;
  }
  if (scope.studentId && enrollment.studentId !== scope.studentId) return false;
  return true;
}

function studentClassIds(studentId: string, state: PlatformState) {
  return [...new Set(
    state.classEnrollments
      .filter((item) => item.studentId === studentId && item.status === "active")
      .map((item) => item.classId)
  )];
}

function orderedClassIdsForStudent(studentId: string, state: PlatformState, classIds: string[]) {
  const primaryClassId = state.students.find((item) => item.userId === studentId)?.primaryClassId;
  if (!primaryClassId || !classIds.includes(primaryClassId)) return classIds;
  return [primaryClassId, ...classIds.filter((classId) => classId !== primaryClassId)];
}

function sessionCourseLabel(state: PlatformState, sessionId: string | null | undefined) {
  const session = sessionId ? state.sessions.find((item) => item.id === sessionId) : undefined;
  if (!session) return "";
  const series = session.seriesId ? state.series.find((item) => item.id === session.seriesId) : undefined;
  return series?.title || session.title;
}

function studentCourseLabel(state: PlatformState, records: GradeRecord[]) {
  const latestSessionRecord = records.find((record) => Boolean(record.sessionId));
  if (latestSessionRecord) return sessionCourseLabel(state, latestSessionRecord.sessionId) || "未关联课程";

  const latestClassRecord = records.find((record) => Boolean(record.classId));
  if (!latestClassRecord?.classId) return "未关联课程";
  const latestSession = state.sessions
    .filter((session) => session.classId === latestClassRecord.classId && new Date(session.startAt).getTime() <= Date.now())
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())[0];
  return sessionCourseLabel(state, latestSession?.id) || "未关联课程";
}

function buildScopeStudentIds(state: PlatformState, scope: GradeScope, records: GradeRecord[]) {
  const ids = new Set<string>();
  if (scope.studentId) ids.add(scope.studentId);
  state.students.forEach((profile) => {
    if (scope.studentId && profile.userId !== scope.studentId) return;
    const enrollments = state.classEnrollments.filter((item) => item.studentId === profile.userId && enrollmentMatchesScope(item, scope, state));
    const schoolMember = !scope.schoolId || state.schoolMemberships.some(
      (item) => item.schoolId === scope.schoolId && item.userId === profile.userId && item.role === "student" && item.status === "active"
    );
    if (!scope.studentId && enrollments.length && schoolMember) ids.add(profile.userId);
  });
  records.forEach((record) => ids.add(record.studentId));
  return ids;
}

function buildInteractionRecords(state: PlatformState, range: GradeDateRange, scope: GradeScope) {
  const { startAt, endAt } = gradeRangeBounds(range);
  const attempts = state.interactionAttempts
    .filter((attempt) => isInRange(attempt.completedAt, startAt, endAt))
    .filter((attempt) => state.interactionSets.find((set) => set.id === attempt.setId)?.countsTowardGrade !== false)
    .filter((attempt) => {
      const context = sessionContext(state, attempt.sessionId);
      if (scope.studentId && attempt.studentId !== scope.studentId) return false;
      if (scope.classId && context.classId !== scope.classId) return false;
      if (scope.schoolId && context.schoolId !== scope.schoolId) return false;
      if (scope.teacherId && (context.teacherId !== scope.teacherId || !context.classId)) return false;
      return true;
    });
  const bestBySet = new Map<string, typeof attempts[number]>();
  attempts.forEach((attempt) => {
    const key = `${attempt.studentId}:${attempt.setId}`;
    const current = bestBySet.get(key);
    if (!current || attempt.score > current.score) bestBySet.set(key, attempt);
  });
  return [...bestBySet.values()].map((attempt): GradeRecord => {
    const set = state.interactionSets.find((item) => item.id === attempt.setId);
    const context = sessionContext(state, attempt.sessionId);
    const lesson = set ? state.lessons.find((item) => item.id === set.lessonId) : undefined;
    return {
      id: `interaction-${attempt.id}`,
      studentId: attempt.studentId,
      schoolId: context.schoolId,
      category: "interaction",
      title: set?.title ?? "互动练习",
      score: attempt.score,
      normalizedScore: attempt.score,
      status: "completed",
      occurredAt: attempt.completedAt,
      classId: context.classId,
      lessonTitle: lesson?.title,
      phase: attempt.phase,
      sessionId: attempt.sessionId,
      teacherId: context.teacherId,
      sourceId: attempt.setId,
      attempt: attempt.attempt,
      timeSpentSeconds: attempt.timeSpentSeconds,
      wrongItemCount: attempt.wrongItemIds.length
    };
  });
}

function buildAssessmentRecords(state: PlatformState, range: GradeDateRange, scope: GradeScope) {
  const { startAt, endAt } = gradeRangeBounds(range);
  const records: GradeRecord[] = [];
  state.assessments
    .filter((assessment) => assessment.status === "published")
    .filter((assessment) => isInRange(assessment.assessedAt, startAt, endAt))
    .filter((assessment) => {
      if (scope.classId && assessment.classId !== scope.classId) return false;
      if (scope.schoolId && assessment.schoolId !== scope.schoolId) return false;
      if (scope.teacherId && assessment.teacherId !== scope.teacherId) return false;
      return true;
    })
    .forEach((assessment) => {
      assessment.rosterStudentIds.forEach((studentId) => {
        if (scope.studentId && studentId !== scope.studentId) return;
        const score = state.assessmentScores.find(
          (item) => item.assessmentId === assessment.id && item.studentId === studentId
        );
        records.push({
          id: `assessment-${assessment.id}-${studentId}`,
          studentId,
          schoolId: assessment.schoolId,
          category: assessment.category,
          title: assessment.title,
          score: score?.score ?? null,
          normalizedScore: score?.normalizedScore ?? null,
          status: score?.status ?? "pending",
          occurredAt: assessment.assessedAt,
          classId: assessment.classId,
          teacherId: assessment.teacherId,
          sourceId: assessment.id,
          rawScore: score?.score ?? null,
          maxScore: assessment.maxScore
        });
      });
    });
  return records;
}

function countedScore(record: GradeRecord) {
  if (record.status === "graded") return typeof record.normalizedScore === "number" ? record.normalizedScore : null;
  if (record.status === "absent") return 0;
  if (record.status === "completed") return typeof record.score === "number" ? record.score : null;
  return null;
}

function categorySummary(records: GradeRecord[], policy: GradePolicy): Record<GradeCategory, GradeCategorySummary> {
  return Object.fromEntries(categoryOrder.map((category) => {
    const values = records
      .filter((record) => record.category === category)
      .map(countedScore)
      .filter((value): value is number => value !== null);
    return [category, {
      category,
      average: average(values),
      count: values.length,
      weight: policy.weights[category]
    }];
  })) as Record<GradeCategory, GradeCategorySummary>;
}

export function compositeFromCategories(categories: Record<GradeCategory, GradeCategorySummary>) {
  const available = categoryOrder.filter((category) => categories[category].count > 0 && categories[category].average !== null);
  if (!available.length) return null;
  const totalWeight = available.reduce((sum, category) => sum + categories[category].weight, 0);
  if (totalWeight <= 0) return null;
  return roundScore(
    available.reduce((sum, category) => sum + (categories[category].average ?? 0) * categories[category].weight, 0) / totalWeight
  );
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getUTCDay() || 7;
  next.setUTCDate(next.getUTCDate() - day + 1);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function trendBucket(occurredAt: string, startAt: string, endAt: string) {
  const date = new Date(occurredAt);
  const spanDays = Math.ceil((new Date(endAt).getTime() - new Date(startAt).getTime()) / 86_400_000);
  if (spanDays <= 14) {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    return { key: start.toISOString().slice(0, 10), start, end: addDays(start, 1) };
  }
  if (spanDays <= 90) {
    const start = startOfWeek(date);
    return { key: start.toISOString().slice(0, 10), start, end: addDays(start, 7) };
  }
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { key: start.toISOString().slice(0, 7), start, end };
}

function buildTrend(records: GradeRecord[], policy: GradePolicy, startAt: string, endAt: string) {
  const buckets = new Map<string, { startAt: string; endAt: string; records: GradeRecord[] }>();
  records.forEach((record) => {
    const bucket = trendBucket(record.occurredAt, startAt, endAt);
    const existing = buckets.get(bucket.key) ?? { startAt: bucket.start.toISOString(), endAt: bucket.end.toISOString(), records: [] };
    existing.records.push(record);
    buckets.set(bucket.key, existing);
  });
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, bucket]): GradeTrendPoint => {
      const categories = categorySummary(bucket.records, policy);
      return {
        key,
        startAt: bucket.startAt,
        endAt: bucket.endAt,
        composite: compositeFromCategories(categories),
        categories: Object.fromEntries(categoryOrder.map((category) => [category, categories[category].average])) as Record<GradeCategory, number | null>,
        count: bucket.records.filter((record) => countedScore(record) !== null).length
      };
    });
}

function buildAggregateTrend(students: StudentGradeSummary[], policy: GradePolicy): GradeTrendPoint[] {
  const buckets = new Map<string, { startAt: string; endAt: string; points: GradeTrendPoint[] }>();
  students.forEach((student) => {
    student.trend.forEach((point) => {
      const bucket = buckets.get(point.key) ?? { startAt: point.startAt, endAt: point.endAt, points: [] };
      bucket.points.push(point);
      buckets.set(point.key, bucket);
    });
  });

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, bucket]) => {
      const categories = Object.fromEntries(categoryOrder.map((category) => {
        const values = bucket.points
          .map((point) => point.categories[category])
          .filter((value): value is number => value !== null);
        return [category, {
          category,
          average: average(values),
          count: values.length,
          weight: policy.weights[category]
        }];
      })) as Record<GradeCategory, GradeCategorySummary>;
      return {
        key,
        startAt: bucket.startAt,
        endAt: bucket.endAt,
        composite: compositeFromCategories(categories),
        categories: Object.fromEntries(categoryOrder.map((category) => [category, categories[category].average])) as Record<GradeCategory, number | null>,
        count: bucket.points.reduce((sum, point) => sum + point.count, 0)
      };
    });
}

function buildAggregateSkillRadar(students: StudentGradeSummary[]): SkillRadarDimension[] {
  return skillDimensionOrder.map((key) => {
    const scores = students
      .map((student) => student.skillRadar.find((dimension) => dimension.key === key)?.score ?? null)
      .filter((score): score is number => score !== null);
    return {
      key,
      label: skillDimensionLabels[key],
      score: average(scores),
      sampleCount: students.reduce(
        (sum, student) => sum + (student.skillRadar.find((dimension) => dimension.key === key)?.sampleCount ?? 0),
        0
      )
    };
  });
}

export function classLabel(state: PlatformState, classIds: string[]) {
  return state.classes.find((item) => item.id === classIds[0])?.name ?? "未分班";
}

export function buildGradeAnalytics(state: PlatformState, range: GradeDateRange, scope: GradeScope = {}): GradeAnalytics {
  const bounds = gradeRangeBounds(range);
  const policy = selectGradePolicy(state, bounds.endAt, scope.schoolId);
  const records = [
    ...buildInteractionRecords(state, range, scope),
    ...buildAssessmentRecords(state, range, scope)
  ].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  const studentIds = buildScopeStudentIds(state, scope, records);
  const students = [...studentIds].map((studentId): StudentGradeSummary => {
    const user = state.users.find((item) => item.id === studentId);
    const profile = state.students.find((item) => item.userId === studentId);
    const studentRecords = records.filter((item) => item.studentId === studentId);
    const categories = categorySummary(studentRecords, policy);
    const classIds = orderedClassIdsForStudent(studentId, state, studentClassIds(studentId, state).filter((classId) => {
      if (!scope.classId && !scope.teacherId && !scope.schoolId) return true;
      const enrollment = state.classEnrollments.find((item) => item.classId === classId && item.studentId === studentId);
      return enrollment ? enrollmentMatchesScope(enrollment, scope, state) : false;
    }));
    return {
      studentId,
      name: user?.name ?? "学生",
      avatar: user?.avatar ?? "学",
      level: profile?.level ?? "未分级",
      classIds,
      classLabel: classLabel(state, classIds),
      courseLabel: studentCourseLabel(state, studentRecords),
      composite: compositeFromCategories(categories),
      categories,
      records: studentRecords,
      trend: buildTrend(studentRecords, policy, bounds.startAt, bounds.endAt),
      skillRadar: buildSkillRadar(state, studentRecords),
      pendingCount: studentRecords.filter((item) => item.status === "pending").length,
      absentCount: studentRecords.filter((item) => item.status === "absent").length,
      excusedCount: studentRecords.filter((item) => item.status === "excused").length,
      interactionMinutes: Math.round(
        studentRecords.reduce((sum, item) => sum + (item.timeSpentSeconds ?? 0), 0) / 60
      )
    };
  }).sort((a, b) => (b.composite ?? -1) - (a.composite ?? -1) || a.name.localeCompare(b.name));

  const categoryAverages = categorySummary(records, policy);
  const pendingCount = records.filter((item) => item.status === "pending").length;
  const absentCount = records.filter((item) => item.status === "absent").length;
  const excusedCount = records.filter((item) => item.status === "excused").length;
  return {
    policy,
    startAt: bounds.startAt,
    endAt: bounds.endAt,
    students,
    records,
    trend: buildAggregateTrend(students, policy),
    skillRadar: buildAggregateSkillRadar(students),
    compositeAverage: average(students.map((student) => student.composite).filter((value): value is number => value !== null)),
    categoryAverages,
    pendingCount,
    absentCount,
    excusedCount
  };
}

export function scoreTone(score: number | null | undefined) {
  if (score === null || score === undefined) return "neutral" as const;
  if (score >= 85) return "mint" as const;
  if (score >= 70) return "blue" as const;
  if (score >= 60) return "orange" as const;
  return "danger" as const;
}
