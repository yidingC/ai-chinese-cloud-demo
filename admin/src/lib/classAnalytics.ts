import type { ClassSession, InteractionAttempt, InteractionItem, Material, Phase, PlatformState } from "../domain/types";
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

const scorableInteractionTypes = new Set<InteractionItem["type"]>([
  "match",
  "memory",
  "choice",
  "order",
  "fill",
  "picture",
  "picture-match",
  "situation",
  "dialogue",
  "pinyin-match",
  "category",
  "word-build",
  "correction",
  "listening"
]);

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
      scorable: scorableInteractionTypes.has(item.type)
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
      const score = scoredCount
        ? real?.score ?? Math.round((correctCount / scoredCount) * 100)
        : real?.score ?? null;
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
