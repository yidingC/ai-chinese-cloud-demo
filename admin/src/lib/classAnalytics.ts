import type { ClassSession, InteractionAttempt, InteractionItem, Material, Phase, PlatformState } from "../domain/types";
import { isScorableInteractionType } from "./interactionTypes";
import { getBookedCount, getCurrentInteractionVersion, getUser, sessionMaterials, setsForSession } from "./domain";

/**
 * 学习结果页的「全班完成情况」。
 * 口径刻意不用分数：互动只有完成情况与用时；材料看有多少人播放 / 查看 / 下载，以及平均用时。
 * 原型阶段：真实提交（state.interactionAttempts）优先，其余按课次 / 内容 / 学生做确定性模拟。
 */
export type ClassContentKind = "interaction" | "material";
export type ClassContentStatus = "good" | "ok" | "weak";
export type ClassQuestionResult = "correct" | "wrong" | "unanswered" | "not-scored";

export interface ClassContentQuestion {
  id: string;
  label: string;
  prompt: string;
  type: InteractionItem["type"];
  /** 投票、语音等没有标准答案的题型只记参与，不参与正确率。 */
  scorable: boolean;
}

export interface ClassContentStudent {
  studentId: string;
  name: string;
  avatar: string;
  level: string;
  className: string;
  done: boolean;
  minutes: number;
  completedAt: string;
  /** 互动逐题结果；材料行没有题目，保持为空。 */
  questionResults?: Record<string, ClassQuestionResult>;
  /** 本次互动得分（0-100）；没有可判分题目时为空。 */
  score?: number | null;
  correctCount?: number;
  scoredCount?: number;
}

export interface ClassContentRow {
  id: string;
  kind: ClassContentKind;
  title: string;
  phase: Phase;
  /** 班级汇总时会标出这条内容来自哪节课。 */
  sessionId?: string;
  sessionTitle?: string;
  sessionClassName?: string;
  sessionStartAt?: string;
  /** 副标题：互动是题数，材料是格式与大小。 */
  detail: string;
  /** 学生端的动作：完成 / 播放 / 查看 / 下载。 */
  actionLabel: string;
  doneCount: number;
  total: number;
  rate: number;
  averageMinutes: number;
  status: ClassContentStatus;
  students: ClassContentStudent[];
  /** 互动题目；材料行没有题目。 */
  questions?: ClassContentQuestion[];
  averageScore?: number | null;
  correctRate?: number | null;
  answeredCount?: number;
}

export interface ClassAnalytics {
  rosterSize: number;
  rows: ClassContentRow[];
  interactionCount: number;
  materialCount: number;
  reachedStudents: number;
  totalActions: number;
  averageRate: number;
  averageMinutes: number;
  totalMinutes: number;
  goodCount: number;
  weakCount: number;
}

/** 稳定的字符串哈希：同一个课次 / 内容 / 学生每次刷新得到同样的模拟结果。 */
function seededRandom(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

/** 只看触达 / 完成率：≥85% 完成较好，≥60% 基本完成，其余需要关注。 */
function statusOf(rate: number): ClassContentStatus {
  if (rate >= 85) return "good";
  if (rate >= 60) return "ok";
  return "weak";
}

/** 材料类型决定学生端的动作与参考触达率 / 用时。 */
function materialProfile(material: Material) {
  const type = material.fileType;
  if (type === "wav" || type === "mp3") return { action: "播放", rate: 0.92, minMinutes: 2, maxMinutes: 7 };
  if (type === "video") return { action: "播放", rate: 0.86, minMinutes: 2, maxMinutes: 6 };
  if (type === "pptx" || type === "html") return { action: "查看", rate: 0.82, minMinutes: 2, maxMinutes: 6 };
  if (type === "png" || type === "image") return { action: "查看", rate: 0.8, minMinutes: 1, maxMinutes: 3 };
  if (type === "pdf") return { action: "查看", rate: 0.74, minMinutes: 1, maxMinutes: 4 };
  if (material.kind === "link") return { action: "查看", rate: 0.7, minMinutes: 2, maxMinutes: 5 };
  return { action: "下载", rate: 0.68, minMinutes: 1, maxMinutes: 4 };
}

function latestAttemptByStudent(attempts: InteractionAttempt[]) {
  const map = new Map<string, InteractionAttempt>();
  attempts.forEach((attempt) => {
    const current = map.get(attempt.studentId);
    const isNewer = !current
      || attempt.attempt > current.attempt
      || (attempt.attempt === current.attempt
        && new Date(attempt.completedAt).getTime() > new Date(current.completedAt).getTime());
    if (isNewer) map.set(attempt.studentId, attempt);
  });
  return map;
}

function simulatedCorrect(seed: string, ability: number, itemId: string) {
  const difficulty = 0.05 + seededRandom(`${seed}:${itemId}:difficulty`) * 0.3;
  const chance = Math.min(0.97, Math.max(0.35, ability - difficulty + 0.28));
  return seededRandom(`${seed}:${itemId}:result`) < chance;
}

export function buildClassAnalytics(state: PlatformState, session: ClassSession): ClassAnalytics {
  const roster = state.bookings
    .filter((booking) => booking.sessionId === session.id && booking.status === "booked")
    .map((booking) => {
      const user = getUser(state, booking.studentId);
      const profile = state.students.find((item) => item.userId === booking.studentId);
      return {
        studentId: booking.studentId,
        name: user?.name ?? "学生",
        avatar: user?.avatar ?? "学",
        level: profile?.level ?? "—",
        className: profile?.className ?? "待分班"
      };
    });
  const total = roster.length || getBookedCount(state, session.id);
  const sessionSets = setsForSession(state, session).filter((set) => set.status === "published");
  const sessionAttempts = state.interactionAttempts.filter((attempt) => attempt.sessionId === session.id);
  // 课中材料供老师投影或参考，不作为学生学习内容的完成口径；只统计课前和课后材料。
  const materialEntries = (["preview", "review"] as Phase[]).flatMap((phase) =>
    sessionMaterials(state, session, phase).map((entry) => ({ ...entry, phase }))
  );

  const rows: ClassContentRow[] = [];

  sessionSets.forEach((set, index) => {
    const difficulty = seededRandom(`${session.id}:${set.id}:difficulty`);
    const version = getCurrentInteractionVersion(state, set);
    const questions: ClassContentQuestion[] = (version?.items ?? []).map((item, itemIndex) => ({
      id: item.id,
      label: `Q${itemIndex + 1}`,
      prompt: item.prompt,
      type: item.type,
      scorable: isScorableInteractionType(item.type)
    }));
    const attemptsByStudent = latestAttemptByStudent(
      sessionAttempts.filter(
        (attempt) => attempt.setId === set.id && (!version || attempt.versionId === version.id)
      )
    );
    const baseRate = 0.96 - difficulty * 0.55;
    const students: ClassContentStudent[] = roster.map((member) => {
      const real = attemptsByStudent.get(member.studentId);
      const done = Boolean(real) || seededRandom(`${session.id}:${set.id}:${member.studentId}:done`) < baseRate;
      const minutes = real
        ? Math.max(1, Math.round(real.timeSpentSeconds / 60))
        : Math.max(1, Math.round(2 + seededRandom(`${session.id}:${set.id}:${member.studentId}:time`) * 7));
      const ability = 0.58 + seededRandom(`${session.id}:${set.id}:${member.studentId}:ability`) * 0.38;
      const questionResults: Record<string, ClassQuestionResult> = {};
      let correctCount = 0;
      let scoredCount = 0;
      questions.forEach((question) => {
        if (!question.scorable) {
          questionResults[question.id] = "not-scored";
          return;
        }
        if (!done) {
          questionResults[question.id] = "unanswered";
          return;
        }
        const correct = real
          ? !real.wrongItemIds.includes(question.id)
          : simulatedCorrect(`${session.id}:${set.id}:${member.studentId}`, ability, question.id);
        questionResults[question.id] = correct ? "correct" : "wrong";
        scoredCount += 1;
        if (correct) correctCount += 1;
      });
      const score = real
        ? real.score
        : scoredCount
          ? Math.round((correctCount / scoredCount) * 100)
          : null;
      return {
        ...member,
        done,
        minutes: done ? minutes : 0,
        completedAt: real?.completedAt ?? (done ? new Date(new Date(session.endAt).getTime() + (index + 1) * 6 * 60_000).toISOString() : ""),
        questionResults,
        score,
        correctCount,
        scoredCount
      };
    });
    const doneStudents = students.filter((student) => student.done);
    const rate = total ? (doneStudents.length / total) * 100 : 0;
    const scoredStudents = students.filter((student) => (student.scoredCount ?? 0) > 0);
    const correctTotal = scoredStudents.reduce((sum, student) => sum + (student.correctCount ?? 0), 0);
    const scoredTotal = scoredStudents.reduce((sum, student) => sum + (student.scoredCount ?? 0), 0);
    const averageScore = scoredStudents.length
      ? Math.round(scoredStudents.reduce((sum, student) => sum + (student.score ?? 0), 0) / scoredStudents.length)
      : null;
    const correctRate = scoredTotal ? Math.round((correctTotal / scoredTotal) * 100) : null;
    rows.push({
      id: set.id,
      kind: "interaction",
      title: set.title,
      phase: set.phase,
      detail: `${version?.items.length ?? 0} 题`,
      actionLabel: "完成",
      doneCount: doneStudents.length,
      total,
      rate,
      averageMinutes: doneStudents.length
        ? Math.round(doneStudents.reduce((sum, student) => sum + student.minutes, 0) / doneStudents.length)
        : 0,
      status: statusOf(rate),
      students,
      questions,
      averageScore,
      correctRate,
      answeredCount: scoredStudents.length
    });
  });

  materialEntries.forEach(({ material, phase }, index) => {
    const difficulty = seededRandom(`${session.id}:${material.id}:difficulty`);
    const profile = materialProfile(material);
    const baseRate = profile.rate - difficulty * 0.32;
    const sizeLabel = material.versions.find((version) => version.version === material.currentVersion)?.sizeLabel ?? "外链";
    const students: ClassContentStudent[] = roster.map((member) => {
      const done = seededRandom(`${session.id}:${material.id}:${member.studentId}:done`) < baseRate;
      const minutes = Math.max(
        profile.minMinutes,
        Math.round(profile.minMinutes + seededRandom(`${session.id}:${material.id}:${member.studentId}:time`) * (profile.maxMinutes - profile.minMinutes))
      );
      return {
        ...member,
        done,
        minutes: done ? minutes : 0,
        completedAt: done ? new Date(new Date(session.endAt).getTime() + (index + 1) * 5 * 60_000).toISOString() : ""
      };
    });
    const doneStudents = students.filter((student) => student.done);
    const rate = total ? (doneStudents.length / total) * 100 : 0;
    rows.push({
      id: material.id,
      kind: "material",
      title: material.title,
      phase,
      detail: `${(material.fileType || "file").toUpperCase()} · ${sizeLabel}`,
      actionLabel: profile.action,
      doneCount: doneStudents.length,
      total,
      rate,
      averageMinutes: doneStudents.length
        ? Math.round(doneStudents.reduce((sum, student) => sum + student.minutes, 0) / doneStudents.length)
        : 0,
      status: statusOf(rate),
      students
    });
  });

  // 展示顺序：课前 → 课中 → 课后；同一阶段里完成好的在前。
  const phaseRank: Record<Phase, number> = { preview: 0, live: 1, review: 2 };
  const sorted = [...rows].sort(
    (a, b) => phaseRank[a.phase] - phaseRank[b.phase] || b.rate - a.rate || a.title.localeCompare(b.title)
  );
  const allActions = rows.flatMap((row) => row.students.filter((student) => student.done));
  const reachedStudentIds = new Set(allActions.map((student) => student.studentId));

  return {
    rosterSize: total,
    rows: sorted,
    interactionCount: rows.filter((row) => row.kind === "interaction").length,
    materialCount: rows.filter((row) => row.kind === "material").length,
    reachedStudents: reachedStudentIds.size,
    totalActions: allActions.length,
    averageRate: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.rate, 0) / rows.length) : 0,
    averageMinutes: allActions.length
      ? Math.round(allActions.reduce((sum, student) => sum + student.minutes, 0) / allActions.length)
      : 0,
    totalMinutes: allActions.reduce((sum, student) => sum + student.minutes, 0),
    goodCount: rows.filter((row) => row.status === "good").length,
    weakCount: rows.filter((row) => row.status === "weak").length
  };
}

/** 班级汇总：把同一班级下若干已结束课次的完成情况合并成一个统计范围。 */
export function buildClassScopeAnalytics(state: PlatformState, sessions: ClassSession[]): ClassAnalytics | null {
  const ordered = [...sessions].sort(
    (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()
  );
  if (ordered.length === 0) return null;
  if (ordered.length === 1) return buildClassAnalytics(state, ordered[0]);

  const analyses = ordered.map((session) => ({ session, analytics: buildClassAnalytics(state, session) }));
  const sessionIds = new Set(ordered.map((session) => session.id));
  const rosterIds = new Set(
    state.bookings
      .filter((booking) => sessionIds.has(booking.sessionId) && booking.status === "booked")
      .map((booking) => booking.studentId)
  );
  const rows = analyses.flatMap(({ session, analytics }) =>
    analytics.rows.map((row) => ({
      ...row,
      id: `${session.id}:${row.id}`,
      sessionId: session.id,
      sessionTitle: session.title,
      sessionClassName: session.className,
      sessionStartAt: session.startAt
    }))
  );
  const phaseRank: Record<Phase, number> = { preview: 0, live: 1, review: 2 };
  rows.sort(
    (a, b) =>
      phaseRank[a.phase] - phaseRank[b.phase]
      || new Date(b.sessionStartAt ?? 0).getTime() - new Date(a.sessionStartAt ?? 0).getTime()
      || b.rate - a.rate
      || a.title.localeCompare(b.title)
  );
  const allActions = rows.flatMap((row) => row.students.filter((student) => student.done));
  const reachedStudentIds = new Set(allActions.map((student) => student.studentId));

  return {
    rosterSize: rosterIds.size || Math.max(...analyses.map(({ analytics }) => analytics.rosterSize), 0),
    rows,
    interactionCount: analyses.reduce((sum, { analytics }) => sum + analytics.interactionCount, 0),
    materialCount: analyses.reduce((sum, { analytics }) => sum + analytics.materialCount, 0),
    reachedStudents: reachedStudentIds.size,
    totalActions: allActions.length,
    averageRate: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.rate, 0) / rows.length) : 0,
    averageMinutes: allActions.length
      ? Math.round(allActions.reduce((sum, student) => sum + student.minutes, 0) / allActions.length)
      : 0,
    totalMinutes: allActions.reduce((sum, student) => sum + student.minutes, 0),
    goodCount: rows.filter((row) => row.status === "good").length,
    weakCount: rows.filter((row) => row.status === "weak").length
  };
}

export type PerformanceScope = "session" | "class" | "school";
export type SchoolPerformanceMetric = "participation" | "averageScore" | "correctRate" | "masteryRate";

export interface PerformanceColumn {
  id: string;
  title: string;
  /** 班级 / 校级矩阵里用来显示日期或阶段。 */
  sublabel?: string;
  phase?: Phase;
  sessionId?: string;
  /** 单课次矩阵里指向具体互动，点列头可以下钻。 */
  rowId?: string;
  metric?: SchoolPerformanceMetric;
}

export interface PerformanceCell {
  /** 0-100；没有可判分作答时为空。 */
  score: number | null;
  answered: number;
  correct: number;
  done: boolean;
}

export interface PerformanceRow {
  id: string;
  name: string;
  avatar: string;
  level?: string;
  className?: string;
  average: number | null;
  answeredCount: number;
  missingCount: number;
  cells: Record<string, PerformanceCell>;
}

export interface PerformanceMatrix {
  scope: PerformanceScope;
  columns: PerformanceColumn[];
  rows: PerformanceRow[];
}

export interface LearningSummary {
  /** 学生层面互动均分的均值；没有作答时为空。 */
  averageScore: number | null;
  correctRate: number | null;
  correctTotal: number;
  scoredTotal: number;
  masteryRate: number | null;
  masteryCount: number;
  scoredStudents: number;
  scorableInteractions: number;
}

function meanOf(values: number[]) {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function isScore(value: number | null | undefined): value is number {
  return typeof value === "number";
}

/** 课堂表现的「学习口径」：只用逐题对错，不掺直播间每轮固定 5 分。 */
export function buildLearningSummary(analytics: ClassAnalytics): LearningSummary {
  const scoresByStudent = new Map<string, number[]>();
  let correctTotal = 0;
  let scoredTotal = 0;
  let scorableInteractions = 0;

  analytics.rows.forEach((row) => {
    if (row.kind !== "interaction") return;
    if ((row.questions ?? []).some((question) => question.scorable)) scorableInteractions += 1;
    row.students.forEach((student) => {
      const scored = student.scoredCount ?? 0;
      if (!scored || !isScore(student.score)) return;
      const scores = scoresByStudent.get(student.studentId) ?? [];
      scores.push(student.score);
      scoresByStudent.set(student.studentId, scores);
      correctTotal += student.correctCount ?? 0;
      scoredTotal += scored;
    });
  });

  const studentAverages = [...scoresByStudent.values()].map((scores) => meanOf(scores) ?? 0);
  const masteryCount = studentAverages.filter((score) => score >= 85).length;

  return {
    averageScore: meanOf(studentAverages),
    correctRate: scoredTotal ? Math.round((correctTotal / scoredTotal) * 100) : null,
    correctTotal,
    scoredTotal,
    masteryRate: studentAverages.length ? Math.round((masteryCount / studentAverages.length) * 100) : null,
    masteryCount,
    scoredStudents: studentAverages.length,
    scorableInteractions
  };
}

function rosterMembers(analytics: ClassAnalytics) {
  const map = new Map<string, { name: string; avatar: string; level: string; className: string }>();
  analytics.rows.forEach((row) => {
    row.students.forEach((student) => {
      if (!map.has(student.studentId)) {
        map.set(student.studentId, {
          name: student.name,
          avatar: student.avatar,
          level: student.level,
          className: student.className
        });
      }
    });
  });
  return map;
}

/** 一个课次内，每名学生所有可判分互动的平均分。 */
function sessionScoresByStudent(analytics: ClassAnalytics) {
  const map = new Map<string, { scores: number[]; correct: number; scored: number; done: boolean }>();
  analytics.rows.forEach((row) => {
    if (row.kind !== "interaction") return;
    row.students.forEach((student) => {
      const entry = map.get(student.studentId) ?? { scores: [], correct: 0, scored: 0, done: false };
      if ((student.scoredCount ?? 0) > 0 && isScore(student.score)) {
        entry.scores.push(student.score);
        entry.correct += student.correctCount ?? 0;
        entry.scored += student.scoredCount ?? 0;
      }
      if (student.done) entry.done = true;
      map.set(student.studentId, entry);
    });
  });
  return map;
}

function sortPerformanceRows(rows: PerformanceRow[]) {
  return rows.sort((a, b) => {
    const left = a.average ?? Number.POSITIVE_INFINITY;
    const right = b.average ?? Number.POSITIVE_INFINITY;
    return left - right || a.name.localeCompare(b.name);
  });
}

function buildSessionPerformanceMatrix(state: PlatformState, session: ClassSession): PerformanceMatrix {
  const analytics = buildClassAnalytics(state, session);
  const interactionRows = analytics.rows.filter(
    (row) => row.kind === "interaction" && (row.questions ?? []).some((question) => question.scorable)
  );
  const columns: PerformanceColumn[] = interactionRows.map((row) => ({
    id: row.id,
    title: row.title,
    phase: row.phase,
    rowId: row.id
  }));
  const roster = rosterMembers(analytics);
  const rows: PerformanceRow[] = [...roster.entries()].map(([studentId, member]) => {
    const cells: Record<string, PerformanceCell> = {};
    const scores: number[] = [];
    let missingCount = 0;
    interactionRows.forEach((row) => {
      const student = row.students.find((item) => item.studentId === studentId);
      const scored = student?.scoredCount ?? 0;
      const score = scored > 0 && isScore(student?.score) ? student.score : null;
      cells[row.id] = {
        score,
        answered: scored,
        correct: student?.correctCount ?? 0,
        done: Boolean(student?.done)
      };
      if (score !== null) scores.push(score);
      if (!student?.done) missingCount += 1;
    });
    return {
      id: studentId,
      name: member.name,
      avatar: member.avatar,
      level: member.level,
      className: member.className,
      average: meanOf(scores),
      answeredCount: scores.length,
      missingCount,
      cells
    };
  });
  return { scope: "session", columns, rows: sortPerformanceRows(rows) };
}

function buildClassPerformanceMatrix(state: PlatformState, sessions: ClassSession[]): PerformanceMatrix {
  const ordered = [...sessions].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );
  const columns: PerformanceColumn[] = ordered.map((session) => ({
    id: session.id,
    title: session.title,
    sublabel: session.startAt,
    sessionId: session.id
  }));
  const entries = new Map<string, {
    name: string;
    avatar: string;
    level: string;
    className: string;
    sessionScores: number[];
    cells: Record<string, PerformanceCell>;
    missingCount: number;
  }>();

  ordered.forEach((session) => {
    const analytics = buildClassAnalytics(state, session);
    const scoresByStudent = sessionScoresByStudent(analytics);
    rosterMembers(analytics).forEach((member, studentId) => {
      const entry = entries.get(studentId) ?? {
        ...member,
        sessionScores: [],
        cells: {},
        missingCount: 0
      };
      const result = scoresByStudent.get(studentId);
      const score = result && result.scores.length > 0 ? meanOf(result.scores) : null;
      entry.cells[session.id] = {
        score,
        answered: result?.scored ?? 0,
        correct: result?.correct ?? 0,
        done: Boolean(result?.done)
      };
      if (score !== null) entry.sessionScores.push(score);
      if (!result?.done) entry.missingCount += 1;
      entries.set(studentId, entry);
    });
  });

  const rows: PerformanceRow[] = [...entries.entries()].map(([studentId, entry]) => ({
    id: studentId,
    name: entry.name,
    avatar: entry.avatar,
    level: entry.level,
    className: entry.className,
    average: meanOf(entry.sessionScores),
    answeredCount: entry.sessionScores.length,
    missingCount: entry.missingCount,
    cells: entry.cells
  }));
  return { scope: "class", columns, rows: sortPerformanceRows(rows) };
}

function buildSchoolPerformanceMatrix(state: PlatformState, sessions: ClassSession[]): PerformanceMatrix {
  const groups = new Map<string, { name: string; sessions: ClassSession[] }>();
  sessions.forEach((session) => {
    const key = session.classId || session.className;
    const group = groups.get(key) ?? { name: session.className, sessions: [] };
    group.sessions.push(session);
    groups.set(key, group);
  });

  const columns: PerformanceColumn[] = [
    { id: "participation", title: "", metric: "participation" },
    { id: "averageScore", title: "", metric: "averageScore" },
    { id: "correctRate", title: "", metric: "correctRate" },
    { id: "masteryRate", title: "", metric: "masteryRate" }
  ];

  const rows: PerformanceRow[] = [];
  groups.forEach((group, classId) => {
    const analytics = buildClassScopeAnalytics(state, group.sessions);
    if (!analytics) return;
    const summary = buildLearningSummary(analytics);
    const participationRate = analytics.rosterSize
      ? Math.round((analytics.reachedStudents / analytics.rosterSize) * 100)
      : 0;
    rows.push({
      id: classId,
      name: group.name,
      avatar: group.name.slice(0, 1),
      average: summary.averageScore,
      answeredCount: summary.scoredStudents,
      missingCount: 0,
      cells: {
        participation: { score: participationRate, answered: analytics.rosterSize, correct: 0, done: true },
        averageScore: { score: summary.averageScore, answered: summary.scoredStudents, correct: 0, done: true },
        correctRate: { score: summary.correctRate, answered: summary.scoredStudents, correct: 0, done: true },
        masteryRate: { score: summary.masteryRate, answered: summary.masteryCount, correct: 0, done: true }
      }
    });
  });

  return { scope: "school", columns, rows: sortPerformanceRows(rows) };
}

/**
 * 课堂表现矩阵：
 * - 单课次：学生 × 互动，格子是该次互动的答题得分；
 * - 班级汇总：学生 × 课次，格子是该课次的互动均分；
 * - 全校汇总：班级 × 四项学习指标，避免几百名学生挤在一起。
 */
export function buildPerformanceMatrix(
  state: PlatformState,
  sessions: ClassSession[],
  scope: PerformanceScope
): PerformanceMatrix {
  if (sessions.length === 0) return { scope, columns: [], rows: [] };
  if (scope === "school") return buildSchoolPerformanceMatrix(state, sessions);
  if (scope === "class") return buildClassPerformanceMatrix(state, sessions);
  return buildSessionPerformanceMatrix(state, sessions[0]);
}
