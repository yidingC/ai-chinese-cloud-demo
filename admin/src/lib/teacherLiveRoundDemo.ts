import type { LiveInteractionStatus, TeacherLiveDemo } from "./teacherLiveDemo";

export const ROUND_POINTS = 5;

interface DemoStudent {
  id: string;
  name: string;
  avatar: string;
}

const DEMO_STUDENTS: DemoStudent[] = [
  { id: "student-anisa", name: "Anisa", avatar: "安" },
  { id: "student-kevin", name: "Kevin Tan", avatar: "凯" },
  { id: "student-maya", name: "Maya Putri", avatar: "玛" },
  { id: "student-raymond", name: "Raymond", avatar: "雷" },
  { id: "student-nadia", name: "Nadia Putri", avatar: "娜" },
  { id: "student-arif", name: "Arif", avatar: "阿" },
  { id: "student-sinta", name: "Sinta", avatar: "辛" },
  { id: "student-daniel", name: "Daniel", avatar: "丹" },
  { id: "student-dewi", name: "Dewi Anggraini", avatar: "德" },
  { id: "student-putra", name: "Putra Santoso", avatar: "普" },
  { id: "student-laksmi", name: "Laksmi Wardani", avatar: "拉" },
  { id: "student-rio", name: "Rio Kurniawan", avatar: "里" },
  { id: "student-ayu", name: "Ayu Permata", avatar: "艾" },
  { id: "student-bayu", name: "Bayu Pratama", avatar: "巴" },
  { id: "student-citra", name: "Citra Lestari", avatar: "希" },
  { id: "student-fajar", name: "Fajar Nugroho", avatar: "法" },
  { id: "student-intan", name: "Intan Sari", avatar: "英" },
  { id: "student-yoga", name: "Yoga Saputra", avatar: "尤" }
];

const LIVE_COMPLETED_STUDENT_INDEXES = new Set([0, 1, 2, 3]);
const LIVE_STARTED_STUDENT_INDEXES = new Set([...LIVE_COMPLETED_STUDENT_INDEXES, 6, 10, 12, 15]);

export interface LiveRoundItemResult {
  itemId: string;
  correct: boolean;
}

export interface LiveRoundParticipantRow {
  studentId: string;
  name: string;
  avatar: string;
  totalRank: number | null;
  totalScore: number;
  maxTotalScore: number;
  completedRoundCount: number;
  starsEarned: number;
  starsTotal: number;
  roundScore: number;
  roundCompleted: boolean;
  speedSeconds: number | null;
  speedRank: number | null;
  answeredItemCount: number;
  correctItemCount: number;
  itemCount: number;
  itemResults: LiveRoundItemResult[];
  completionLabel: string;
}

export interface LiveRoundItemMetric {
  itemId: string;
  answeredCount: number;
  correctCount: number;
  correctRate: number | null;
}

export interface LiveRoundMetric {
  id: string;
  title: string;
  status: LiveInteractionStatus;
  roundNumber: number;
  roundTotal: number;
  participantCount: number;
  startedCount: number;
  completedCount: number;
  notCompletedCount: number;
  completionRate: number;
  fastestSeconds: number | null;
  durationLabel: string;
  elapsedLabel: string;
  pointsPerRound: number;
  ranking: LiveRoundParticipantRow[];
  items: LiveRoundItemMetric[];
}

function completedInRound(status: LiveInteractionStatus, studentIndex: number) {
  if (status === "completed") return true;
  if (status === "live") return LIVE_COMPLETED_STUDENT_INDEXES.has(studentIndex);
  return false;
}

function answeredItemCountFor(status: LiveInteractionStatus, studentIndex: number, itemCount: number) {
  if (status === "upcoming") return 0;
  if (completedInRound(status, studentIndex)) return itemCount;
  if (status === "live" && LIVE_STARTED_STUDENT_INDEXES.has(studentIndex)) return Math.min(itemCount, 1);
  return 0;
}

function speedForRound(studentIndex: number, roundIndex: number) {
  return 14 + ((studentIndex * 7 + roundIndex * 5) % 25);
}

function itemResultsFor(
  itemIds: string[],
  answeredItemCount: number,
  studentIndex: number,
  roundIndex: number
): LiveRoundItemResult[] {
  return itemIds.slice(0, answeredItemCount).map((itemId, itemIndex) => ({
    itemId,
    correct: (roundIndex === 1 && studentIndex === 0) || (studentIndex + roundIndex * 2 + itemIndex) % 5 !== 0
  }));
}

function completionLabelFor(status: LiveInteractionStatus, completed: boolean, answeredItemCount: number, itemCount: number) {
  if (status === "upcoming") return "本轮未开始";
  if (completed) return "本轮已作答完成";
  if (answeredItemCount > 0) return `答题中 ${answeredItemCount}/${itemCount} 题`;
  return "尚未作答";
}

export function buildTeacherLiveRoundDemo(snapshot: TeacherLiveDemo): LiveRoundMetric[] {
  const roundTotal = snapshot.interactions.length;
  const maxTotalScore = roundTotal * ROUND_POINTS;
  const roundCompletions = snapshot.interactions.map((interaction) =>
    DEMO_STUDENTS.map((_, studentIndex) => completedInRound(interaction.status, studentIndex))
  );
  const totalScores = DEMO_STUDENTS.map((_, studentIndex) =>
    roundCompletions.reduce((total, completions) => total + (completions[studentIndex] ? ROUND_POINTS : 0), 0)
  );
  const totalRanks = totalScores.map((score) => {
    if (score <= 0) return null;
    return totalScores.filter((otherScore) => otherScore > score).length + 1;
  });

  const roundSpeeds = snapshot.interactions.map((interaction, roundIndex) => {
    const completed = DEMO_STUDENTS
      .map((student, studentIndex) => ({
        studentId: student.id,
        studentIndex,
        seconds: completedInRound(interaction.status, studentIndex) ? speedForRound(studentIndex, roundIndex) : null
      }))
      .filter((entry): entry is typeof entry & { seconds: number } => entry.seconds !== null)
      .sort((a, b) => a.seconds - b.seconds || a.studentIndex - b.studentIndex);
    return new Map(completed.map((entry, index) => [entry.studentId, { seconds: entry.seconds, rank: index + 1 }]));
  });

  let previousRoundOrder: string[] | null = null;

  return snapshot.interactions.map((interaction, roundIndex) => {
    const itemIds = interaction.items.map((item) => item.id);
    const speeds = roundSpeeds[roundIndex];
    const rows = DEMO_STUDENTS.map((student, studentIndex) => {
      const completed = completedInRound(interaction.status, studentIndex);
      const answeredItemCount = answeredItemCountFor(interaction.status, studentIndex, itemIds.length);
      const speed = speeds.get(student.id);
      const completedRoundCount = roundCompletions.reduce(
        (total, completions) => total + (completions[studentIndex] ? 1 : 0),
        0
      );
      const itemResults = itemResultsFor(itemIds, answeredItemCount, studentIndex, roundIndex);
      return {
        studentId: student.id,
        name: student.name,
        avatar: student.avatar,
        totalRank: totalRanks[studentIndex],
        totalScore: totalScores[studentIndex],
        maxTotalScore,
        completedRoundCount,
        starsEarned: completedRoundCount,
        starsTotal: roundTotal,
        roundScore: completed ? ROUND_POINTS : 0,
        roundCompleted: completed,
        speedSeconds: speed?.seconds ?? null,
        speedRank: speed?.rank ?? null,
        answeredItemCount,
        correctItemCount: itemResults.filter((result) => result.correct).length,
        itemCount: itemIds.length,
        itemResults,
        completionLabel: completionLabelFor(interaction.status, completed, answeredItemCount, itemIds.length)
      };
    });
    const performanceOrder = [...rows].sort((a, b) =>
      Number(b.roundCompleted) - Number(a.roundCompleted) ||
      b.correctItemCount - a.correctItemCount ||
      b.answeredItemCount - a.answeredItemCount ||
      (a.speedSeconds ?? Number.POSITIVE_INFINITY) - (b.speedSeconds ?? Number.POSITIVE_INFINITY) ||
      a.name.localeCompare(b.name)
    );
    const previousOrderIndex = new Map((previousRoundOrder ?? []).map((studentId, index) => [studentId, index]));
    const ranking = interaction.status === "upcoming" && previousRoundOrder
      ? [...rows].sort((a, b) =>
          (previousOrderIndex.get(a.studentId) ?? Number.POSITIVE_INFINITY) -
          (previousOrderIndex.get(b.studentId) ?? Number.POSITIVE_INFINITY)
        )
      : performanceOrder;
    if (interaction.status !== "upcoming") {
      previousRoundOrder = performanceOrder.map((row) => row.studentId);
    }

    const completedCount = ranking.filter((row) => row.roundCompleted).length;
    const startedCount = ranking.filter((row) => row.answeredItemCount > 0).length;
    const completedSpeeds = ranking
      .map((row) => row.speedSeconds)
      .filter((seconds): seconds is number => seconds !== null);
    const items = itemIds.map((itemId, itemIndex) => {
      const results = rows
        .map((row) => row.itemResults[itemIndex])
        .filter((result): result is LiveRoundItemResult => Boolean(result));
      const correctCount = results.filter((result) => result.correct).length;
      return {
        itemId,
        answeredCount: results.length,
        correctCount,
        correctRate: results.length > 0 ? Math.round((correctCount / results.length) * 100) : null
      };
    });

    return {
      id: interaction.id,
      title: interaction.title,
      status: interaction.status,
      roundNumber: roundIndex + 1,
      roundTotal,
      participantCount: DEMO_STUDENTS.length,
      startedCount,
      completedCount,
      notCompletedCount: DEMO_STUDENTS.length - completedCount,
      completionRate: Math.round((completedCount / DEMO_STUDENTS.length) * 100),
      fastestSeconds: completedSpeeds.length > 0 ? Math.min(...completedSpeeds) : null,
      durationLabel: interaction.durationLabel,
      elapsedLabel: interaction.durationLabel.replace(/^(用时|已开放)\s*/, ""),
      pointsPerRound: ROUND_POINTS,
      ranking,
      items
    };
  });
}
