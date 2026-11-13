import { useEffect, useState } from "react";
import type {
  ClassSession,
  InteractionItem,
  InteractionType,
  Material,
  PlatformState
} from "../domain/types";
import { getCurrentInteractionVersion, getLesson, materialRefAppliesToSession, setsForSession } from "./domain";

export type TeacherDemoMode = "live" | "empty";
export type LiveInteractionStatus = "completed" | "live" | "upcoming";

export interface LiveRankingEntry {
  studentId: string;
  name: string;
  avatar: string;
  score: number;
  answered: number;
  completedLabel: string;
  /** 每道题的对错结果，用于课堂直播间展开学生答题明细。 */
  itemResults: Array<{ itemId: string; correct: boolean }>;
}

export interface LiveItemMetric {
  id: string;
  prompt: string;
  type: InteractionType;
  answered: number;
  correctRate: number;
  status: LiveInteractionStatus;
}

export interface LiveInteractionMetric {
  id: string;
  title: string;
  status: LiveInteractionStatus;
  answered: number;
  participantCount: number;
  averageScore: number;
  correctRate: number;
  durationLabel: string;
  ranking: LiveRankingEntry[];
  items: LiveItemMetric[];
}

export interface LiveCoursewareMetric {
  material: Material;
  progress: number;
  currentSlide: number;
  totalSlides: number;
  status: "projecting" | "ready";
}

export interface LiveTeachingStep {
  id: string;
  label: string;
  detail: string;
  status: "done" | "current" | "upcoming";
}

export interface TeacherLiveDemo {
  session: ClassSession;
  lessonTitle: string;
  lessonSubtitle: string;
  lessonDescription: string;
  coverEmoji: string;
  color: string;
  elapsedMinutes: number;
  remainingMinutes: number;
  participantTotal: number;
  presentCount: number;
  answeredCount: number;
  activeInteractionId: string;
  interactions: LiveInteractionMetric[];
  courseware: LiveCoursewareMetric[];
  teachingSteps: LiveTeachingStep[];
  activityFeed: Array<{ id: string; label: string; detail: string; tone: "mint" | "purple" | "orange" }>;
}

const DEMO_MODE_KEY = "ai-chinese-cloud-teacher-demo-mode";
const DEMO_MODE_EVENT = "aicloud:teacher-demo-mode";

function readDemoMode(): TeacherDemoMode {
  if (typeof window === "undefined") return "live";
  return window.localStorage.getItem(DEMO_MODE_KEY) === "empty" ? "empty" : "live";
}

export function setTeacherDemoMode(mode: TeacherDemoMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_MODE_KEY, mode);
  window.dispatchEvent(new CustomEvent(DEMO_MODE_EVENT, { detail: mode }));
}

export function useTeacherDemoMode() {
  const [mode, setMode] = useState<TeacherDemoMode>(readDemoMode);

  useEffect(() => {
    function sync(event?: Event) {
      const next = event instanceof CustomEvent && event.detail === "empty" ? "empty" : readDemoMode();
      setMode(next);
    }
    window.addEventListener("storage", sync);
    window.addEventListener(DEMO_MODE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(DEMO_MODE_EVENT, sync);
    };
  }, []);

  return [mode, setTeacherDemoMode] as const;
}

function statusForIndex(index: number, total: number): LiveInteractionStatus {
  if (index === 0) return "completed";
  if (index === 1 || total === 1) return "live";
  return "upcoming";
}

function statusLabel(status: LiveInteractionStatus) {
  if (status === "completed") return "已完成";
  if (status === "live") return "进行中";
  return "待开始";
}

function answeredRateFor(status: LiveInteractionStatus, index: number) {
  if (status === "completed") return 1;
  if (status === "live") return Math.max(0.52, 0.76 - index * 0.08);
  return 0;
}

function buildRanking(
  participantCount: number,
  index: number,
  status: LiveInteractionStatus,
  items: InteractionItem[]
): LiveRankingEntry[] {
  const names = [
    ["student-anisa", "Anisa", "安"],
    ["student-kevin", "Kevin Tan", "凯"],
    ["student-maya", "Maya Putri", "玛"],
    ["student-raymond", "Raymond", "雷"],
    ["student-nadia", "Nadia", "娜"],
    ["student-arif", "Arif", "阿"],
    ["student-sinta", "Sinta", "辛"],
    ["student-daniel", "Daniel", "丹"]
  ] as const;
  const base = status === "completed" ? 100 : status === "live" ? 96 : 0;
  const answered = status === "completed" ? 2 : status === "live" ? Math.max(1, 2 - index) : 0;
  return names.map(([studentId, name, avatar], studentIndex) => ({
    studentId,
    name,
    avatar,
    score: Math.max(0, Math.round(base - studentIndex * 6 - index * 2)),
    answered: Math.min(answered, studentIndex < participantCount ? answered : 0),
    completedLabel: status === "live" && studentIndex < 3 ? "刚刚提交" : status === "completed" ? "已完成" : "等待中",
    itemResults: status === "upcoming" ? [] : items.map((item, itemIndex) => ({
      itemId: item.id,
      // 演示数据中排名越靠前的学生错题越少；首名学生全部答对。
      correct: studentIndex === 0 || ((studentIndex + itemIndex + index) % 4 !== 0 && studentIndex < 6)
    }))
  }));
}

function coursewareMetrics(state: PlatformState, lessonId: string, sessionId: string, now: number): LiveCoursewareMetric[] {
  const materialIds = state.materialRefs
    .filter((ref) => ref.lessonId === lessonId && ref.published && ref.phase === "live")
    .filter((ref) => materialRefAppliesToSession(ref, sessionId))
    .sort((a, b) => a.order - b.order)
    .map((ref) => state.materials.find((material) => material.id === ref.materialId))
    .filter((material): material is Material => Boolean(material && material.status === "published"));

  return materialIds.map((material, index) => {
    const slideTotal = material.fileType === "pptx" ? 16 : 8;
    const currentSlide = Math.min(slideTotal, 6 + Math.floor((now / 60_000) % 3) + index);
    return {
      material,
      progress: Math.round((currentSlide / slideTotal) * 100),
      currentSlide,
      totalSlides: slideTotal,
      status: index === 0 ? "projecting" : "ready"
    };
  });
}

function itemMetrics(items: InteractionItem[], status: LiveInteractionStatus, participantCount: number, setIndex: number): LiveItemMetric[] {
  const rate = answeredRateFor(status, setIndex);
  return items.map((item, index) => {
    if (status === "upcoming") {
      return {
        id: item.id,
        prompt: item.prompt,
        type: item.type,
        answered: 0,
        correctRate: 0,
        status: "upcoming" as const
      };
    }
    const itemPenalty = index * 0.035;
    const answered = Math.max(0, Math.round(participantCount * Math.max(0.28, rate - itemPenalty)));
    const correctRate = Math.max(58, Math.round((status === "completed" ? 91 : 84) - index * 3 + ((index % 2) * 2)));
    return {
      id: item.id,
      prompt: item.prompt,
      type: item.type,
      answered,
      correctRate,
      status: index === Math.min(items.length - 1, 1) && status === "live" ? "live" as const : "completed" as const
    };
  });
}

export function buildTeacherLiveDemo(state: PlatformState, teacherId: string, requestedSessionId?: string, now = Date.now()): TeacherLiveDemo | null {
  const teacherSessions = state.sessions
    .filter((session) => session.teacherId === teacherId && session.status === "published")
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const base = requestedSessionId
    ? teacherSessions.find((session) => session.id === requestedSessionId)
    : teacherSessions.find((session) => session.id === "session-live") ??
      teacherSessions.find((session) => session.lessonId === "lesson-greetings") ??
      teacherSessions[0];
  if (!base) return null;

  const lesson = getLesson(state, base.lessonId);
  const liveSets = setsForSession(state, base)
    .filter((set) => set.status === "published" && set.phase === "live")
    .sort((a, b) => a.order - b.order);

  if (!lesson) return null;

  const hasLiveContent = liveSets.length > 0;
  const session: ClassSession = {
    ...base,
    capacity: hasLiveContent ? Math.max(18, base.capacity) : base.capacity,
    roomLabel: base.roomLabel || "在线课堂"
  };

  const participantTotal = hasLiveContent ? 24 : (base.roster?.length ?? 0);
  const presentCount = hasLiveContent ? 18 : 0;
  const interactions = liveSets.map((set, index) => {
    const status = statusForIndex(index, liveSets.length);
    const version = getCurrentInteractionVersion(state, set);
    const items = version?.items ?? [];
    const answered = Math.round(presentCount * answeredRateFor(status, index));
    return {
      id: set.id,
      title: set.title,
      status,
      answered,
      participantCount: presentCount,
      averageScore: status === "upcoming" ? 0 : status === "completed" ? 91 : 85,
      correctRate: status === "upcoming" ? 0 : status === "completed" ? 88 : 79,
      durationLabel: status === "completed" ? "用时 4 分 22 秒" : status === "live" ? "已开放 3 分 18 秒" : "待开启",
      ranking: buildRanking(presentCount, index, status, items),
      items: itemMetrics(items, status, presentCount, index)
    };
  });
  const activeInteractionId = interactions.find((interaction) => interaction.status === "live")?.id ?? interactions[0]?.id ?? "";
  const answeredItemCount = interactions.reduce(
    (sum, interaction) => sum + interaction.items.filter((item) => item.answered >= presentCount * 0.75).length,
    0
  );

  const teachingSteps: LiveTeachingStep[] = hasLiveContent
    ? [
        { id: "warmup", label: "热身问候", detail: "Hello / Halo，跟读问候", status: "done" },
        { id: "vocabulary", label: "词汇呈现", detail: "你好、早上好、再见", status: "done" },
        { id: "practice", label: "互动练习", detail: `${activeInteractionId ? interactions.find((item) => item.id === activeInteractionId)?.title : "课堂互动"}正在作答`, status: "current" },
        { id: "wrapup", label: "课堂收束", detail: "自我介绍和课堂投票", status: "upcoming" }
      ]
    : [];
  const durationMinutes = Math.max(
    1,
    Math.round((new Date(base.endAt).getTime() - new Date(base.startAt).getTime()) / 60_000)
  );

  return {
    session,
    lessonTitle: lesson.title,
    lessonSubtitle: lesson.subtitle,
    lessonDescription: lesson.description,
    coverEmoji: lesson.coverEmoji,
    color: lesson.color,
    elapsedMinutes: hasLiveContent ? 17 : 0,
    remainingMinutes: hasLiveContent ? 23 : durationMinutes,
    participantTotal,
    presentCount,
    answeredCount: answeredItemCount,
    activeInteractionId,
    interactions,
    courseware: coursewareMetrics(state, lesson.id, session.id, now),
    teachingSteps,
    activityFeed: hasLiveContent
      ? [
          { id: "feed-1", label: "Anisa 提交了连线互动", detail: "12 秒前", tone: "mint" },
          { id: "feed-2", label: "当前题目已开放", detail: "3 分钟前", tone: "purple" },
          { id: "feed-3", label: "Maya 完成了翻牌记忆", detail: "5 分钟前", tone: "orange" }
        ]
      : []
  };
}

export function liveInteractionStatusLabel(status: LiveInteractionStatus) {
  return statusLabel(status);
}
