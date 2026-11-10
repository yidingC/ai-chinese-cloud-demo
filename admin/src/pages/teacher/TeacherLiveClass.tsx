import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  BookOpenText,
  Check,
  Clock3,
  Eye,
  Presentation,
  Layers3,
  Maximize2,
  Minimize2,
  PauseCircle,
  PlayCircle,
  Square,
  Sparkles,
  Trophy
} from "lucide-react";
import { usePlatformStore } from "../../store/usePlatformStore";
import { currentUser, getCurrentInteractionVersion, getLesson, sessionRuntimeStatus } from "../../lib/domain";
import { platform } from "../../lib/platform";
import { formatDateTime, formatRange } from "../../lib/format";
import type { InteractionItem } from "../../domain/types";
import {
  buildTeacherLiveDemo,
  liveInteractionStatusLabel,
  setTeacherDemoMode,
  useTeacherDemoMode,
  type LiveInteractionMetric,
  type TeacherLiveDemo
} from "../../lib/teacherLiveDemo";
import {
  buildTeacherLiveRoundDemo,
  type LiveRoundMetric,
  type LiveRoundParticipantRow
} from "../../lib/teacherLiveRoundDemo";
import { Button, Modal, PageHeader } from "../../components/ui";
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

function classFlowMeta(interaction: LiveInteractionMetric, classEnded: boolean, classLive: boolean) {
  if (!classEnded && !classLive) return { className: "is-upcoming", label: "待开始" };
  if (interaction.status === "completed") return { className: "is-completed", label: "已完成" };
  if (classEnded) {
    return interaction.status === "live"
      ? { className: "is-incomplete", label: "未完成" }
      : { className: "is-upcoming", label: "未开始" };
  }
  return interaction.status === "live"
    ? { className: "is-live", label: "进行中" }
    : { className: "is-upcoming", label: "待开始" };
}

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
  const run = usePlatformStore((store) => store.run);
  const user = currentUser(state);
  const [demoMode] = useTeacherDemoMode();
  const [liveRoomOpen, setLiveRoomOpen] = useState(initialLiveRoomOpen);
  const [liveRoomTab, setLiveRoomTab] = useState(initialLiveRoomOpen ? "" : "courseware");
  const [liveRoomItemIndex, setLiveRoomItemIndex] = useState(0);
  const [coursewareSlideIndex, setCoursewareSlideIndex] = useState(0);
  const [liveRoomFullscreen, setLiveRoomFullscreen] = useState(initialLiveRoomOpen);

  const snapshot = useMemo(
    () => buildTeacherLiveDemo(state, user.id, sessionId),
    [state, user.id, sessionId]
  );
  const coursewareSlides = useMemo(() => (snapshot ? buildCoursewareSlides(snapshot) : []), [snapshot]);
  const liveRounds = useMemo(() => (snapshot ? buildTeacherLiveRoundDemo(snapshot) : []), [snapshot]);

  useEffect(() => {
    if (!snapshot) return;
    const active = snapshot.interactions.find((interaction) => interaction.status === "live") ?? snapshot.interactions[0];
    setLiveRoomTab((current) => current || active?.id || "courseware");
  }, [snapshot]);

  useEffect(() => {
    if (!liveRoomOpen || liveRoomTab !== "courseware" || coursewareSlides.length === 0) return;
    setCoursewareSlideIndex(Math.min(Math.max(0, (snapshot?.courseware[0]?.currentSlide ?? 1) - 1), coursewareSlides.length - 1));
  }, [liveRoomOpen, liveRoomTab, coursewareSlides.length, snapshot]);

  if (!snapshot) {
    const session = state.sessions.find((item) => item.id === sessionId);
    const lesson = session ? getLesson(state, session.lessonId) : undefined;
    return (
      <>
        <PageHeader
          eyebrow="Live classroom"
          title={lesson?.title ?? session?.title ?? "进入课堂"}
          description={session
            ? `${session.className} · ${lesson?.subtitle ?? ""} · ${formatDateTime(session.startAt, state.ui.timeZone, state.ui.language)} · ${session.roomLabel}`
            : "没有找到这节课。"}
          actions={
            <Button variant="secondary" onClick={() => navigate("/teacher/schedule")}>
              <ArrowLeft size={16} /> 返回我的课表
            </Button>
          }
        />
        <section className="live-class-empty">
          <span><BookOpenText size={30} /></span>
          <div>
            <h2>{session ? "课堂还没有准备好" : "没有找到这节课"}</h2>
            <p>{session
              ? "这节课还没有可用的课中课件或互动。先完成备课，再进入课堂。"
              : "课次可能已被取消或删除，请返回课表重新选择。"}</p>
          </div>
          {session && (
            <Button onClick={() => navigate(`/teacher/session/${session.id}/design`)}>
              <Layers3 size={16} /> 去备课
            </Button>
          )}
        </section>
      </>
    );
  }

  const liveRoomInteraction = snapshot.interactions.find((interaction) => interaction.id === liveRoomTab);
  const liveRoomRound = liveRounds.find((round) => round.id === liveRoomInteraction?.id);
  const liveRoomSet = state.interactionSets.find((set) => set.id === liveRoomTab);
  const liveRoomItems = liveRoomSet ? getCurrentInteractionVersion(state, liveRoomSet)?.items ?? [] : [];
  const runtimeStatus = sessionRuntimeStatus(snapshot.session);
  const classCancelled = runtimeStatus === "cancelled";
  const classEnded = runtimeStatus === "ended" || classCancelled;
  const classLive = runtimeStatus === "live";
  const statusLabel = classCancelled ? "已取消" : classEnded ? "已结束" : classLive ? "正在进行中" : "待开始";
  const hasClassStarted = classEnded || classLive;
  const completedInteractionCount = hasClassStarted
    ? snapshot.interactions.filter((interaction) => interaction.status === "completed").length
    : 0;
  const scheduleDate = new Intl.DateTimeFormat(state.ui.language, {
    timeZone: state.ui.timeZone,
    month: "numeric",
    day: "numeric"
  }).format(new Date(snapshot.session.startAt));
  const scheduleLabel = `${scheduleDate} ${formatRange(snapshot.session.startAt, snapshot.session.endAt, state.ui.timeZone, state.ui.language)}`;
  const liveSessionId = snapshot.session.id;

  function openLiveRoom(tab = "courseware") {
    setLiveRoomTab(tab);
    setLiveRoomItemIndex(0);
    setLiveRoomFullscreen(true);
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
          actions={<Button variant="secondary" onClick={() => navigate("/teacher/schedule")}><ArrowLeft size={16} /> 返回我的课表</Button>}
        />
        <section className="live-class-empty">
          <span><PauseCircle size={30} /></span>
          <div>
            <h2>课堂演示暂时关闭</h2>
            <p>切换到“有课”后，这里会显示课堂控制和直播间入口。</p>
          </div>
          <Button onClick={() => setTeacherDemoMode("live")}><PlayCircle size={16} /> 切换到有课演示</Button>
        </section>
      </>
    );
  }

  return (
    <>
      <div className="live-class-workspace">
        <div className="live-class-workspace-toolbar">
          <button type="button" className="live-class-console-back" onClick={() => navigate("/teacher/schedule")}>
            <ArrowLeft size={14} /> 返回我的课表
          </button>
        </div>

        <section className={`live-class-summary-card${classEnded ? " is-ended" : classLive ? " is-live" : ""}`} aria-label="课堂控制">
          <div className="live-class-summary-identity">
            <span className="live-class-console-kicker">课堂控制</span>
            <h1>{snapshot.session.title}</h1>
            <p>{snapshot.session.className} · {scheduleLabel} · {snapshot.presentCount}/{snapshot.participantTotal} 人在线</p>
          </div>
          <div className="live-class-summary-control">
            <span className={`live-class-console-status${classLive ? " is-live" : classEnded ? " is-ended" : ""}`}>
              {classLive && <span className="live-pulse-dot" />}
              {statusLabel}
            </span>
            <div className="live-class-console-actions">
              {classEnded ? (
                <Button onClick={() => navigate(`/teacher/results?sessionId=${liveSessionId}`)}>
                  <Eye size={17} /> 查看完整课堂结果
                </Button>
              ) : classLive ? (
                <Button
                  variant="danger"
                  className="live-class-console-stop"
                  onClick={() => run(() => platform.endSession({ sessionId: liveSessionId, actorId: user.id }), "课堂已结束")}
                >
                  <Square size={17} /> 结束课堂
                </Button>
              ) : (
                <Button
                  className="live-class-console-start"
                  onClick={() => run(() => platform.startSession({ sessionId: liveSessionId, actorId: user.id }), "课堂已开始")}
                >
                  <PlayCircle size={17} /> 开始上课
                </Button>
              )}
            </div>
          </div>
        </section>

        <div className="live-class-workspace-grid">
          <section className={`live-class-room-card${classLive ? " is-live" : ""}`} aria-label="课堂直播间">
              <div className="live-class-block-heading">
                <div className="live-class-block-title">
                  <span className="live-class-block-kicker">课堂直播间</span>
                  <h2>进入直播间</h2>
                </div>
                <span className="live-class-block-meta">
                  {snapshot.courseware.length} 份课件 · {snapshot.interactions.length} 轮互动
                </span>
              </div>
              <div className="live-class-room-preview">
                <div className="live-class-room-group live-class-room-deck">
                  <div className="live-class-room-group-head">
                    <span>导入课件</span>
                    <small>{snapshot.courseware.length > 0 ? "已同步到直播间" : "尚未导入"}</small>
                  </div>
                  {snapshot.courseware.length > 0 ? (
                    <>
                      {snapshot.courseware.slice(0, 2).map((item) => {
                        const isProjecting = classLive && item.status === "projecting";
                        return (
                          <div className="live-class-room-material" key={item.material.id}>
                            <span className="live-class-room-material-icon"><Presentation size={16} /></span>
                            <div className="live-class-room-material-copy">
                              <strong>{item.material.title}</strong>
                              <small>{item.material.fileType.toUpperCase()} · 共 {item.totalSlides} 页 · 当前第 {item.currentSlide} 页</small>
                            </div>
                            <span className={`live-class-room-material-status${isProjecting ? " is-projecting" : ""}`}>
                              {isProjecting ? "投影中" : "已就绪"}
                            </span>
                          </div>
                        );
                      })}
                      <div className="live-class-room-slide-strip" aria-label="课件页预览">
                        {coursewareSlides.slice(1, 4).map((slide, index) => (
                          <div className="live-class-room-slide-preview" key={slide.id}>
                            <span>{String(index + 2).padStart(2, "0")}</span>
                            <strong>{slide.title}</strong>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="live-class-room-empty">尚未导入课堂课件。</p>
                  )}
                </div>
                <div className="live-class-room-group">
                  <div className="live-class-room-group-head">
                    <span>互动轮次</span>
                    <small>预览前 {Math.min(2, snapshot.interactions.length)} 轮</small>
                  </div>
                  {snapshot.interactions.length > 0 ? (
                    <>
                      <div className="live-class-room-round-list">
                        {snapshot.interactions.slice(0, 2).map((interaction, index) => (
                          <div className="live-class-room-round" key={interaction.id}>
                            <span className="live-class-room-round-index">{index + 1}</span>
                            <div className="live-class-room-round-copy">
                              <strong>{interaction.title}</strong>
                              <small>{interaction.items.length} 道题 · {interaction.durationLabel}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                      {snapshot.interactions.length > 2 && (
                        <span className="live-class-room-more">另有 {snapshot.interactions.length - 2} 轮，进入后按课堂流程依次进行</span>
                      )}
                    </>
                  ) : (
                    <p className="live-class-room-empty">暂无互动轮次。</p>
                  )}
                </div>
              </div>
              <Button size="lg" className="live-class-room-enter" onClick={() => openLiveRoom("courseware")}>
                <Presentation size={18} /> 进入直播间
              </Button>
          </section>

          <section className="live-class-flow-card" aria-label="课堂流程">
            <div className="live-class-block-heading">
              <div className="live-class-block-title">
                <span className="live-class-block-kicker">互动轮次</span>
                <h2>课堂流程</h2>
              </div>
              <span className="live-class-block-meta">{completedInteractionCount}/{snapshot.interactions.length} 已完成</span>
            </div>
            {snapshot.interactions.length > 0 ? (
              <ol className="live-class-flow-list">
                {snapshot.interactions.map((interaction, index) => {
                  const flow = classFlowMeta(interaction, classEnded, classLive);
                  return (
                    <li className={flow.className} key={interaction.id}>
                      <span className="live-class-flow-index">{index + 1}</span>
                      <div className="live-class-flow-copy">
                        <strong>{interaction.title}</strong>
                        <small>
                          {flow.label}
                          {hasClassStarted && interaction.status !== "upcoming" && ` · ${interaction.answered}/${interaction.participantCount} 已作答`}
                        </small>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="live-class-flow-empty">暂无课中互动。</p>
            )}
            <div className="live-class-flow-overview">
              <div><span>课件</span><strong>{snapshot.courseware.length} 份</strong></div>
              <div><span>互动</span><strong>{snapshot.interactions.length} 轮</strong></div>
              <div><span>教室</span><strong>{snapshot.session.roomLabel}</strong></div>
            </div>
          </section>
        </div>
      </div>

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
              <span className="live-room-title-meta">
                {classLive && <span className="live-pulse-dot" />}
                {classEnded ? "课堂已结束" : classLive ? "直播中" : "课堂预览"} · {snapshot.session.className}
              </span>
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
