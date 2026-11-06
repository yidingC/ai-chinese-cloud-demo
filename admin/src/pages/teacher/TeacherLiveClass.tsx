import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  BookOpenText,
  Check,
  Clock3,
  Eye,
  GraduationCap,
  Presentation,
  Layers3,
  Maximize2,
  Medal,
  Minimize2,
  PauseCircle,
  PlayCircle,
  Radio,
  Sparkles,
  Trophy,
  UsersRound
} from "lucide-react";
import { usePlatformStore } from "../../store/usePlatformStore";
import { currentUser, getCurrentInteractionVersion } from "../../lib/domain";
import { formatDateTime, formatRange } from "../../lib/format";
import { interactionTypeShortLabel } from "../../lib/interactionTypes";
import type { InteractionItem } from "../../domain/types";
import {
  buildTeacherLiveDemo,
  liveInteractionStatusLabel,
  setTeacherDemoMode,
  useTeacherDemoMode,
  type LiveInteractionMetric,
  type LiveInteractionStatus,
  type LiveRankingEntry,
  type TeacherLiveDemo
} from "../../lib/teacherLiveDemo";
import {
  buildTeacherLiveRoundDemo,
  type LiveRoundMetric,
  type LiveRoundParticipantRow
} from "../../lib/teacherLiveRoundDemo";
import { Avatar, Badge, Button, Card, EmptyState, Modal, PageHeader, ProgressBar, StatCard } from "../../components/ui";
import { InteractionPlayer } from "../../components/InteractionPlayer";
import { PmNote } from "../../components/PmNote";

function buildCoursewareSlides(snapshot: TeacherLiveDemo) {
  return [
    {
      id: "cover",
      kind: "cover",
      eyebrow: "AI Chinese",
      title: snapshot.lessonTitle,
      subtitle: snapshot.lessonSubtitle,
      lines: [] as string[],
      note: `${snapshot.session.roomLabel} · 课堂课件`
    },
    {
      id: "goals",
      kind: "list",
      eyebrow: "Learning goals",
      title: "今天我们会学",
      subtitle: "Belajar sapaan hari ini",
      lines: ["你好 · Halo", "早上好 · Selamat pagi", "下午好 · Selamat sore", "再见 · Sampai jumpa"],
      note: ""
    },
    {
      id: "key-phrase",
      kind: "focus",
      eyebrow: "Key phrase",
      title: "你好",
      subtitle: "nǐ hǎo",
      lines: [],
      note: "见面时最常用的问候语。"
    },
    {
      id: "dialogue",
      kind: "dialogue",
      eyebrow: "情景对话",
      title: "你好，老师好！",
      subtitle: "Halo, Bu Guru!",
      lines: ["A：你好！", "B：你好，老师好！", "A：大家好！"],
      note: ""
    },
    {
      id: "interaction",
      kind: "list",
      eyebrow: "课堂互动",
      title: "一起练一练",
      subtitle: "Ayo berlatih bersama",
      lines: snapshot.interactions.slice(0, 3).map((interaction) => interaction.title),
      note: ""
    },
    {
      id: "wrap-up",
      kind: "focus",
      eyebrow: "课堂收束",
      title: "和同桌打招呼",
      subtitle: "Halo, apa kabar?",
      lines: [],
      note: "用今天学到的问候语向同伴问好。"
    }
  ];
}

const interactionTone: Record<LiveInteractionStatus, "purple" | "mint" | "orange"> = {
  completed: "mint",
  live: "purple",
  upcoming: "orange"
};

const interactionLabelTone: Record<LiveInteractionStatus, string> = {
  completed: "done",
  live: "active",
  upcoming: "waiting"
};

const CONFETTI_COLORS = ["#6552ff", "#33b99c", "#f39549", "#e76ca7", "#54a8ef", "#f6c85f"];
const DEMO_PERFECT_CELEBRATION_LIMIT = 2;
const CONFETTI_PIECES = Array.from({ length: 64 }, (_, index) => ({
  left: (index * 37 + 11) % 100,
  drift: ((index * 43) % 260) - 130,
  delay: ((index * 17) % 10) * 0.045,
  duration: 1.5 + ((index * 13) % 9) * 0.13,
  rotation: 260 + ((index * 47) % 540),
  size: 6 + (index % 4) * 2.5,
  color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  round: index % 5 === 0
}));

type RoundCelebration =
  | { id: number; kind: "perfect"; studentName: string }
  | { id: number; kind: "complete" };

function RoundCelebrator({ round }: { round?: LiveRoundMetric }) {
  const [celebration, setCelebration] = useState<RoundCelebration | null>(null);
  const [celebrationQueue, setCelebrationQueue] = useState<RoundCelebration[]>([]);
  const celebrationSequence = useRef(0);
  const celebratedStudents = useRef<Map<string, Set<string>>>(new Map());
  const celebratedClosures = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!round || round.status === "upcoming") return;
    const events: RoundCelebration[] = [];
    const seenStudents = celebratedStudents.current.get(round.id) ?? new Set<string>();
    const perfectStudents = round.ranking.filter((row) =>
      row.roundCompleted &&
      row.itemCount > 0 &&
      row.itemResults.length === row.itemCount &&
      row.itemResults.every((item) => item.correct)
    );
    const nextPerfectStudents = perfectStudents.filter((row) => !seenStudents.has(row.studentId));
    if (nextPerfectStudents.length > 0) {
      nextPerfectStudents.forEach((row) => seenStudents.add(row.studentId));
      celebratedStudents.current.set(round.id, seenStudents);
      nextPerfectStudents.slice(0, DEMO_PERFECT_CELEBRATION_LIMIT).forEach((row) => {
        events.push({
          id: ++celebrationSequence.current,
          kind: "perfect",
          studentName: row.name
        });
      });
    }

    const isClosed = round.participantCount > 0 && round.completedCount >= round.participantCount;
    if (isClosed && !celebratedClosures.current.has(round.id)) {
      celebratedClosures.current.add(round.id);
      events.push({
        id: ++celebrationSequence.current,
        kind: "complete"
      });
    }

    if (events.length > 0) {
      setCelebrationQueue((current) => [...current, ...events]);
    }
  }, [round]);

  useEffect(() => {
    if (celebration || celebrationQueue.length === 0) return;
    setCelebration(celebrationQueue[0]);
    setCelebrationQueue((current) => current.slice(1));
  }, [celebration, celebrationQueue]);

  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(() => setCelebration(null), 3000);
    return () => window.clearTimeout(timer);
  }, [celebration]);

  if (!celebration) return null;

  const title = celebration.kind === "complete"
    ? "所有同学全部完成！"
    : `${celebration.studentName} 本轮全对！`;

  return createPortal(
    <div className="perfect-score-celebration" role="status" aria-live="polite">
      <div className="perfect-score-confetti" aria-hidden="true">
        {CONFETTI_PIECES.map((piece, index) => (
          <span
            className="perfect-score-confetti-piece"
            key={`${celebration.id}-${index}`}
            style={{
              "--confetti-left": `${piece.left}%`,
              "--confetti-drift": `${piece.drift}px`,
              "--confetti-delay": `${piece.delay}s`,
              "--confetti-duration": `${piece.duration}s`,
              "--confetti-rotation": `${piece.rotation}deg`,
              "--confetti-size": `${piece.size}px`,
              "--confetti-color": piece.color,
              "--confetti-radius": piece.round ? "50%" : "2px"
            } as CSSProperties}
          />
        ))}
      </div>
      <div className="perfect-score-toast">
        <span className="perfect-score-icon">
          {celebration.kind === "complete" ? <Check size={22} /> : <Trophy size={22} />}
        </span>
        <div>
          <strong>{title}</strong>
        </div>
        <Sparkles size={18} />
      </div>
    </div>,
    document.body
  );
}

function RankingRows({ rows, limit }: { rows: LiveRankingEntry[]; limit?: number }) {
  return (
    <PmNote block kind="规则" note="没有分数时不显示分数，改为显示完成时间。">
      <div className="live-ranking-list">
        {(limit ? rows.slice(0, limit) : rows).map((row, index) => (
          <div className="live-ranking-row" key={row.studentId}>
            <span className={`live-ranking-number rank-${index + 1}`}>{index + 1}</span>
            <Avatar label={row.avatar} size="sm" tone={index === 0 ? "orange" : index === 1 ? "blue" : "purple"} />
            <div className="live-ranking-name">
              <strong>{row.name}</strong>
              <small>{row.completedLabel}</small>
            </div>
            <b>{row.score || "--"}</b>
          </div>
        ))}
      </div>
    </PmNote>
  );
}

function InteractionCard({
  interaction,
  projected,
  onProject,
  onOpen
}: {
  interaction: LiveInteractionMetric;
  projected: boolean;
  onProject: () => void;
  onOpen: () => void;
}) {
  const completion = interaction.participantCount ? Math.round((interaction.answered / interaction.participantCount) * 100) : 0;
  return (
    <article
      className={`live-interaction-card is-${interaction.status} ${projected ? "is-projected" : ""}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <header className="live-interaction-head">
        <div className="live-interaction-title">
          <span className={`live-interaction-status status-${interactionLabelTone[interaction.status]}`}>
            {interaction.status === "live" && <span className="live-pulse-dot" />}
            {liveInteractionStatusLabel(interaction.status)}
          </span>
          <h3>{interaction.title}</h3>
          {interaction.items[0] && (
            <div className="live-interaction-type">
              <Badge tone={interactionTone[interaction.status]}>{interactionTypeShortLabel(interaction.items[0].type)}</Badge>
            </div>
          )}
        </div>
        <div className="live-interaction-count">
          <strong>{interaction.answered}</strong>
          <span>/ {interaction.participantCount} 已答</span>
        </div>
      </header>

      <div className="live-interaction-progress">
        <ProgressBar value={completion} tone={interactionTone[interaction.status]} />
        <span>{completion}%</span>
      </div>

      <div className="live-interaction-metrics">
        <div><strong>{interaction.averageScore || "--"}</strong><small>平均分</small></div>
        <div><strong>{interaction.correctRate ? `${interaction.correctRate}%` : "--"}</strong><small>正确率</small></div>
        <div><strong>{interaction.durationLabel}</strong><small>课堂进度</small></div>
      </div>

      {interaction.status !== "upcoming" ? (
        <div className="live-interaction-ranking">
          <div className="live-interaction-section-label"><Trophy size={14} /> 当前排名</div>
          <RankingRows rows={interaction.ranking} limit={3} />
        </div>
      ) : (
        <div className="live-interaction-waiting">
          <Clock3 size={16} />
          <span>待开启</span>
        </div>
      )}

      <PmNote block kind="流程" note="投影只把原题放大展示；进入直播间可切换本轮题目、实时数据和学生逐题结果。">
        <footer className="live-interaction-actions">
          <Button
            size="sm"
            variant={projected ? "soft" : "secondary"}
            onClick={(event) => {
              event.stopPropagation();
              onProject();
            }}
            disabled={interaction.status === "upcoming"}
          >
            {projected ? <Radio size={15} /> : <PlayCircle size={15} />}
            {projected ? "正在投影" : "投影这道题"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
          >
            <Eye size={15} /> 查看本轮数据
          </Button>
        </footer>
      </PmNote>
    </article>
  );
}

function LiveRoomQuestionPane({
  interaction,
  items,
  round,
  activeIndex,
  onSelectItem
}: {
  interaction: LiveInteractionMetric;
  items: InteractionItem[];
  round: LiveRoundMetric;
  activeIndex: number;
  onSelectItem: (index: number) => void;
}) {
  const currentItem = items[activeIndex] ?? items[0];

  return (
    <section className="live-room-question-pane" aria-label="本轮互动题目">
      <header className="live-room-question-head">
        <div>
          <h3>{interaction.title}</h3>
        </div>
      </header>

      <div className="live-room-question-selector" role="tablist" aria-label="本轮题目切换">
        {items.map((item, index) => {
          const correctRate = round.items[index]?.correctRate;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? "active" : ""}
              key={item.id}
              onClick={() => onSelectItem(index)}
            >
              <span>第 {index + 1} 题</span>
              <small>{typeof correctRate === "number" ? `${correctRate}% 正确` : liveInteractionStatusLabel(interaction.status)}</small>
            </button>
          );
        })}
      </div>

      {currentItem ? (
        <div className="live-room-question-player">
          <InteractionPlayer key={currentItem.id} items={[currentItem]} preview projection />
        </div>
      ) : (
        <div className="live-room-question-empty">
          <BookOpenText size={22} />
          <strong>本轮还没有配置题目</strong>
          <span>在课堂设计里添加题目后，会在这里同步展示。</span>
        </div>
      )}
    </section>
  );
}

function LiveRoundStudentRow({ row }: { row: LiveRoundParticipantRow }) {
  const answerColumns = Math.max(1, Math.min(8, row.itemCount));
  const isUnfinished = !row.roundCompleted;
  const timeLabel = isUnfinished
    ? row.answeredItemCount > 0 ? "未完成" : "- s"
    : row.speedSeconds !== null ? `${row.speedSeconds}s` : "已完成";

  return (
    <article className={`live-round-student${row.totalRank === 1 ? " is-leader" : ""}${isUnfinished ? " is-unfinished" : ""}`}>
      <span
        className="live-round-rank-badge"
        aria-label={row.totalRank ? `总榜第 ${row.totalRank} 名` : "总榜未上榜"}
      >
        {row.totalRank ?? "—"}
      </span>

      <div className="live-round-student-name" title={row.name}>
        <strong>{row.name}</strong>
      </div>

      <div className="live-round-answer-block" aria-label={`${row.name}的逐题结果`}>
        <div
          className="live-round-answer-grid"
          style={{ gridTemplateColumns: `repeat(${answerColumns}, 6px)` }}
        >
          {Array.from({ length: row.itemCount }, (_, itemIndex) => {
            const result = row.itemResults[itemIndex];
            const state = result ? (result.correct ? "correct" : "incorrect") : "pending";
            const stateLabel = result ? (result.correct ? "答对" : "答错") : "未答";
            return (
              <span
                className={`live-round-answer-dot is-${state}`}
                key={`${row.studentId}-${itemIndex}`}
                title={`第 ${itemIndex + 1} 题：${stateLabel}`}
                aria-label={`第 ${itemIndex + 1} 题：${stateLabel}`}
              />
            );
          })}
        </div>
      </div>

      <div className="live-round-score-block">
        <div className="live-round-score-number">
          <strong>{row.totalScore}</strong>
          <small>/{row.maxTotalScore}分</small>
        </div>
        <div className="live-round-score-footer">
          <small className="live-round-answer-time">
            {row.speedSeconds !== null ? <Clock3 size={12} /> : null}
            {timeLabel}
          </small>
          <div className="live-round-stars" aria-label={`已获得 ${row.starsEarned} 颗星，共 ${row.starsTotal} 颗`}>
            {Array.from({ length: row.starsTotal }, (_, index) => (
              <span className={index < row.starsEarned ? "is-earned" : ""} key={`${row.studentId}-star-${index}`}>★</span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function LiveRoomAnalytics({ round }: { round: LiveRoundMetric }) {
  const speedEntries = [...round.ranking]
    .filter((row) => row.speedSeconds !== null)
    .sort((a, b) => (a.speedSeconds ?? 0) - (b.speedSeconds ?? 0) || (a.speedRank ?? 0) - (b.speedRank ?? 0))
    .slice(0, 3);
  return (
    <aside className="live-room-analytics live-round-analytics" aria-label="本轮实时数据">
      <header className="live-room-analytics-head live-round-analytics-head">
        <div>
          <div className="live-round-heading">
            <h3>本轮实时数据</h3>
          </div>
        </div>
      </header>

      <div className="live-round-overview">
        <div className="live-round-progress">
          <div
            className={`live-round-ring ${round.completionRate === 100 ? "is-complete" : ""}`}
            style={{ background: `conic-gradient(#33b99c ${round.completionRate}%, #eeeaf8 0)` }}
            aria-label={`本轮已完成 ${round.completedCount} 人，共 ${round.participantCount} 人`}
          >
            <div>
              <small>已完成</small>
              <strong>{round.completedCount}/{round.participantCount}</strong>
            </div>
          </div>
        </div>

        <div className="live-round-speedboard">
          <div className="live-round-speedboard-head">
            <strong>速度榜</strong>
          </div>
          {speedEntries.length > 0 ? (
            <ol>
              {speedEntries.map((row, index) => (
                <li key={row.studentId}>
                  <span className={`live-round-speed-place place-${index + 1}`}>{index + 1}</span>
                  <span className="live-round-speed-name" title={row.name}>{row.name}</span>
                  <b>{row.speedSeconds}s</b>
                </li>
              ))}
            </ol>
          ) : (
            <div className="live-round-speed-empty">暂无速度记录</div>
          )}
        </div>
      </div>

      <div className="live-round-list-head">
        <PmNote
          className="live-round-list-note"
          kind="口径"
          note="左侧数字为总榜并列名次：名次 = 累计得分高于自己的人数 + 1，因此同分并列会占位，例如 4 人并列第 1 时，下一档为第 5 名；每完成一轮得 5 分。明细顺序为已完成优先，再按本轮答对题数、已答题数、首次完成用时排序，未完成置底；未开始轮次沿用上一轮顺序。"
        >
          <strong>学生实时明细</strong>
        </PmNote>
      </div>

      <div className="live-round-student-list" key={round.id}>
        {round.ranking.map((row) => <LiveRoundStudentRow key={row.studentId} row={row} />)}
      </div>
    </aside>
  );
}

export function TeacherLiveClass({ initialLiveRoomOpen = false }: { initialLiveRoomOpen?: boolean }) {
  const { sessionId = "" } = useParams();
  const navigate = useNavigate();
  const state = usePlatformStore((store) => store.state);
  const user = currentUser(state);
  const [demoMode] = useTeacherDemoMode();
  const [projectedSetId, setProjectedSetId] = useState("");
  const [projectionSetId, setProjectionSetId] = useState("");
  const [liveRoomOpen, setLiveRoomOpen] = useState(initialLiveRoomOpen);
  const [liveRoomTab, setLiveRoomTab] = useState(initialLiveRoomOpen ? "" : "courseware");
  const [liveRoomItemIndex, setLiveRoomItemIndex] = useState(0);
  const [coursewareSlideIndex, setCoursewareSlideIndex] = useState(0);
  const [liveRoomFullscreen, setLiveRoomFullscreen] = useState(false);

  const snapshot = useMemo(
    () => buildTeacherLiveDemo(state, user.id, sessionId),
    [state, user.id, sessionId]
  );
  const coursewareSlides = useMemo(() => (snapshot ? buildCoursewareSlides(snapshot) : []), [snapshot]);
  const liveRounds = useMemo(() => (snapshot ? buildTeacherLiveRoundDemo(snapshot) : []), [snapshot]);

  useEffect(() => {
    if (!snapshot) return;
    const active = snapshot.interactions.find((interaction) => interaction.status === "live") ?? snapshot.interactions[0];
    setProjectedSetId((current) => current || active?.id || "");
    setLiveRoomTab((current) => current || active?.id || "courseware");
  }, [snapshot]);

  useEffect(() => {
    if (!liveRoomOpen || liveRoomTab !== "courseware" || coursewareSlides.length === 0) return;
    setCoursewareSlideIndex(Math.min(Math.max(0, (snapshot?.courseware[0]?.currentSlide ?? 1) - 1), coursewareSlides.length - 1));
  }, [liveRoomOpen, liveRoomTab, coursewareSlides.length, snapshot]);

  if (!snapshot) {
    return <EmptyState title="没有可演示的课堂" description="当前老师没有可用的课堂数据，请先切换到有课演示。" action={<Button onClick={() => navigate("/teacher")}>返回教师首页</Button>} />;
  }

  const activeInteraction = snapshot.interactions.find((interaction) => interaction.id === projectedSetId) ?? snapshot.interactions[0];
  const liveRoomInteraction = snapshot.interactions.find((interaction) => interaction.id === liveRoomTab);
  const liveRoomRound = liveRounds.find((round) => round.id === liveRoomInteraction?.id);
  const projectionInteraction = snapshot.interactions.find((interaction) => interaction.id === projectionSetId);
  const projectionSet = state.interactionSets.find((set) => set.id === projectionSetId);
  const projectionItems = projectionSet ? getCurrentInteractionVersion(state, projectionSet)?.items ?? [] : [];
  const liveRoomSet = state.interactionSets.find((set) => set.id === liveRoomTab);
  const liveRoomItems = liveRoomSet ? getCurrentInteractionVersion(state, liveRoomSet)?.items ?? [] : [];
  const selectedCourseware = snapshot.courseware[0];
  const interactionProgress = snapshot.interactions.length
    ? Math.round((snapshot.interactions.filter((interaction) => interaction.status === "completed").length / snapshot.interactions.length) * 100)
    : 0;
  const classProgress = Math.round((snapshot.elapsedMinutes / (snapshot.elapsedMinutes + snapshot.remainingMinutes)) * 100);
  const scheduleDate = new Intl.DateTimeFormat(state.ui.language, {
    timeZone: state.ui.timeZone,
    month: "numeric",
    day: "numeric"
  }).format(new Date(snapshot.session.startAt));
  const scheduleLabel = `${scheduleDate} ${formatRange(snapshot.session.startAt, snapshot.session.endAt, state.ui.timeZone, state.ui.language)}`;

  function openLiveRoom(tab = "courseware") {
    setLiveRoomTab(tab);
    setLiveRoomItemIndex(0);
    setLiveRoomOpen(true);
  }

  function selectLiveRoomTab(tab: string) {
    setLiveRoomTab(tab);
    setLiveRoomItemIndex(0);
  }

  function closeLiveRoom() {
    setLiveRoomOpen(false);
    setLiveRoomFullscreen(false);
  }

  if (demoMode === "empty") {
    return (
      <>
        <PageHeader
          eyebrow="Live classroom"
          title="当前没有进行中的课堂"
          description="右上角切换到“有课”，即可演示老师正在上课时的实时课堂视图。"
          actions={<Button variant="secondary" onClick={() => navigate("/teacher")}><ArrowLeft size={16} /> 返回教师首页</Button>}
        />
        <section className="live-class-empty">
          <span><PauseCircle size={30} /></span>
          <div>
            <h2>课堂演示暂时关闭</h2>
            <p>切换到“有课”后，这里会显示课件、互动进度、学生作答和实时排名。</p>
          </div>
          <Button onClick={() => setTeacherDemoMode("live")}><PlayCircle size={16} /> 切换到有课演示</Button>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Live classroom · teacher view"
        title={snapshot.session.title}
        description={`${snapshot.session.className} · ${snapshot.lessonTitle} · ${snapshot.lessonSubtitle} · ${snapshot.session.roomLabel}`}
        actions={
          <Button variant="secondary" onClick={() => navigate("/teacher")}><ArrowLeft size={16} /> 返回教师首页</Button>
        }
      />

      <PmNote block kind="口径" note="课堂进度按已上课时长和课次计划时长计算。">
        <section className="live-class-banner">
          <div className="live-class-banner-main">
            <span className="live-status-pill"><span className="live-pulse-dot" /> 正在进行中</span>
            <h2>{snapshot.lessonTitle}</h2>
            <p>{snapshot.lessonDescription}</p>
            <div className="live-class-meta">
              <span><GraduationCap size={15} /> {snapshot.session.className}</span>
              <span><CalendarClock size={15} /> {scheduleLabel}</span>
              <span><UsersRound size={15} /> {snapshot.presentCount}/{snapshot.participantTotal} 人在线</span>
              <span><Layers3 size={15} /> {snapshot.interactions.length} 组互动已配置</span>
            </div>
          </div>
          <div className="live-class-banner-timer">
            <span>课堂进度</span>
            <strong>{classProgress}%</strong>
            <ProgressBar value={classProgress} tone="mint" />
            <small>已上 {snapshot.elapsedMinutes} 分钟 · 还有 {snapshot.remainingMinutes} 分钟</small>
          </div>
          <div className="live-class-banner-orbit orbit-one" />
          <div className="live-class-banner-orbit orbit-two" />
        </section>
      </PmNote>

      <section className="stat-grid stat-grid-4 live-class-stats">
        <PmNote block kind="口径" note="在线学生只统计已进入课堂的预约学生，不等同于全量报名人数。">
          <StatCard label="在线学生" value={`${snapshot.presentCount}/${snapshot.participantTotal}`} icon={<UsersRound size={19} />} tone="blue" />
        </PmNote>
        <StatCard label="已完成互动" value={`${snapshot.interactions.filter((item) => item.status === "completed").length}/${snapshot.interactions.length}`} icon={<Check size={19} />} tone="mint" progress={interactionProgress} />
        <PmNote block kind="口径" note="当前正确率取正在开放的互动，按每位在线学生的有效作答计算。">
          <StatCard label="当前正确率" value={`${snapshot.interactions.find((item) => item.status === "live")?.correctRate ?? 0}%`} icon={<BarChart3 size={19} />} tone="purple" />
        </PmNote>
        <StatCard label="平均分" value={snapshot.interactions.find((item) => item.status === "live")?.averageScore ?? "--"} icon={<Medal size={19} />} tone="orange" />
      </section>

      <div className="live-class-detail-grid">
        <div className="live-class-main-column">
          <Card className="live-courseware-card">
            <div className="card-heading">
              <div>
                <span className="eyebrow">Live room</span>
                <h2>课堂直播间</h2>
              </div>
              <Radio size={20} />
            </div>
            {selectedCourseware ? (
              <div className="live-courseware-body">
                <div className="live-courseware-icon"><Presentation size={24} /></div>
                <div className="live-courseware-copy">
                  <div className="live-courseware-title-row">
                    <strong>{selectedCourseware.material.title}</strong>
                  </div>
                  <p>{selectedCourseware.material.description}</p>
                  <div className="live-courseware-meta">
                    <span>{selectedCourseware.material.fileType.toUpperCase()}</span>
                    <span>第 {selectedCourseware.currentSlide} / {selectedCourseware.totalSlides} 页</span>
                    <span>最近更新 {selectedCourseware.material.versions.at(-1)?.sizeLabel ?? "课堂版"}</span>
                  </div>
                  <ProgressBar value={selectedCourseware.progress} tone="purple" />
                </div>
                <PmNote kind="流程" note="进入直播间后可切换课件与每轮互动，查看实时答题数据和排名。">
                  <Button variant="secondary" onClick={() => openLiveRoom("courseware")}><Eye size={16} /> 进入直播间</Button>
                </PmNote>
              </div>
            ) : (
              <div className="live-courseware-empty"><Presentation size={20} /> 暂无已关联的课中课件</div>
            )}
          </Card>
        </div>

        <aside className="live-class-side-column">
          <Card className="live-feed-card">
            <div className="card-heading">
              <div>
                <span className="eyebrow">Class pulse</span>
                <h2>课堂动态</h2>
              </div>
              <Sparkles size={19} />
            </div>
            <div className="live-feed-list">
              {snapshot.activityFeed.map((item) => (
                <div className="live-feed-row" key={item.id}>
                  <span className={`live-feed-dot tone-${item.tone}`} />
                  <div><strong>{item.label}</strong><small>{item.detail}</small></div>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </div>

      <section className="section-block live-interaction-section">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">Live interaction board</span>
            <PmNote kind="规则" note="互动按未开始、进行中、已完成流转；同一时刻只展示一个进行中的主互动。">
              <h2>实时互动进度</h2>
            </PmNote>
          </div>
        </div>
        <div className="live-interaction-grid">
          {snapshot.interactions.map((interaction) => (
            <InteractionCard
              key={interaction.id}
              interaction={interaction}
              projected={activeInteraction?.id === interaction.id}
              onProject={() => {
                setProjectedSetId(interaction.id);
                setProjectionSetId(interaction.id);
              }}
              onOpen={() => openLiveRoom(interaction.id)}
            />
          ))}
        </div>
      </section>

      <Modal
        open={Boolean(projectionInteraction)}
        title={projectionInteraction ? `投影原题 · ${projectionInteraction.title}` : "投影原题"}
        onClose={() => setProjectionSetId("")}
        width="980px"
      >
        <div className="projection-modal">
          <div className="projection-player-shell">
            <InteractionPlayer items={projectionItems} preview projection onClose={() => setProjectionSetId("")} />
          </div>
        </div>
      </Modal>

      <Modal
        open={liveRoomOpen}
        title="课堂直播间"
        onClose={closeLiveRoom}
        width="1180px"
        panelClassName="live-room-modal live-room-stage-modal"
        fullscreen={liveRoomFullscreen}
        headerExtra={
          <div className="live-room-header-actions">
            <PmNote
              kind="规则"
              note="全对提示按学生逐个出现，文案为「姓名 本轮全对！」。本轮在线参与学生全部完成并闭环时，再播放一次「所有同学全部完成！」。"
            >
              <span className="live-room-title-meta"><span className="live-pulse-dot" /> 直播中 · {snapshot.session.className}</span>
            </PmNote>
            <Button variant="secondary" size="sm" onClick={() => setLiveRoomFullscreen((value) => !value)}>
              {liveRoomFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              {liveRoomFullscreen ? "退出全屏" : "全屏投影"}
            </Button>
          </div>
        }
        footer={<Button variant="secondary" onClick={closeLiveRoom}>退出直播间</Button>}
      >
        <div className="live-room">
          <div className="live-room-tabs" role="tablist" aria-label="课堂直播间内容">
            <button
              type="button"
              role="tab"
              aria-selected={liveRoomTab === "courseware"}
              className={liveRoomTab === "courseware" ? "active" : ""}
              onClick={() => selectLiveRoomTab("courseware")}
            >
              <Presentation size={16} />
              <span>课堂课件</span>
            </button>
            {snapshot.interactions.map((interaction, index) => (
              <button
                type="button"
                role="tab"
                aria-selected={liveRoomTab === interaction.id}
                className={liveRoomTab === interaction.id ? "active" : ""}
                key={interaction.id}
                onClick={() => selectLiveRoomTab(interaction.id)}
              >
                <BarChart3 size={16} />
                <span>轮次 {index + 1}</span>
              </button>
            ))}
          </div>

          {liveRoomTab === "courseware" ? (
            <div className="courseware-deck">
              <div className="courseware-deck-toolbar">
                <span className="courseware-deck-live"><span className="live-pulse-dot" /> 正在投影</span>
                <div className="courseware-deck-toolbar-actions">
                  <span>第 {Math.min(coursewareSlideIndex + 1, coursewareSlides.length)} / {coursewareSlides.length} 页</span>
                </div>
              </div>

              {coursewareSlides[coursewareSlideIndex] && (
                <article className={`courseware-slide-canvas slide-${coursewareSlides[coursewareSlideIndex].kind}`}>
                  <span className="courseware-slide-kicker">{coursewareSlides[coursewareSlideIndex].eyebrow}</span>
                  {coursewareSlides[coursewareSlideIndex].kind === "cover" && <span className="courseware-slide-emoji">{snapshot.coverEmoji}</span>}
                  <h3>{coursewareSlides[coursewareSlideIndex].title}</h3>
                  {coursewareSlides[coursewareSlideIndex].subtitle && <p className="courseware-slide-subtitle">{coursewareSlides[coursewareSlideIndex].subtitle}</p>}
                  {coursewareSlides[coursewareSlideIndex].lines.length > 0 && (
                    <div className="courseware-slide-lines">
                      {coursewareSlides[coursewareSlideIndex].lines.map((line) => <span key={line}>{line}</span>)}
                    </div>
                  )}
                  {coursewareSlides[coursewareSlideIndex].note && <small className="courseware-slide-note">{coursewareSlides[coursewareSlideIndex].note}</small>}
                  <span className="courseware-slide-page">{coursewareSlideIndex + 1}</span>
                </article>
              )}

              <div className="courseware-deck-footer">
                <div className="courseware-thumbnails" aria-label="课件缩略页">
                  {coursewareSlides.map((slide, index) => (
                    <button
                      className={index === coursewareSlideIndex ? "active" : ""}
                      key={slide.id}
                      onClick={() => setCoursewareSlideIndex(index)}
                      title={slide.title}
                    >
                      <span>{index + 1}</span>
                      <strong>{slide.title}</strong>
                    </button>
                  ))}
                </div>
                <div className="courseware-deck-nav">
                  <Button size="icon" variant="secondary" disabled={coursewareSlideIndex === 0} onClick={() => setCoursewareSlideIndex((value) => Math.max(0, value - 1))} aria-label="上一页">
                    <ChevronLeft size={17} />
                  </Button>
                  <Button size="icon" variant="secondary" disabled={coursewareSlideIndex >= coursewareSlides.length - 1} onClick={() => setCoursewareSlideIndex((value) => Math.min(coursewareSlides.length - 1, value + 1))} aria-label="下一页">
                    <ChevronRight size={17} />
                  </Button>
                </div>
              </div>
            </div>
          ) : liveRoomInteraction && liveRoomRound ? (
            <div className="live-room-interaction-layout">
              <LiveRoomQuestionPane
                interaction={liveRoomInteraction}
                items={liveRoomItems}
                round={liveRoomRound}
                activeIndex={liveRoomItemIndex}
                onSelectItem={setLiveRoomItemIndex}
              />
              <LiveRoomAnalytics round={liveRoomRound} />
            </div>
          ) : null}
        </div>
      </Modal>

      <RoundCelebrator round={liveRoomOpen && liveRoomTab !== "courseware" ? liveRoomRound : undefined} />

    </>
  );
}
