import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BarChart3, CalendarDays, GraduationCap, MapPin, PlayCircle, RotateCcw, Search, UsersRound } from "lucide-react";
import { usePlatformStore } from "../../store/usePlatformStore";
import {
  currentUser,
  getLesson,
  getSession,
  getStudentPendingReviewBookings,
  getUser,
  isSessionPendingReview,
  lessonContent,
  studentMetrics
} from "../../lib/domain";
import type { ClassSession, Phase, PlatformState } from "../../domain/types";
import { formatRange, timeZoneLabel } from "../../lib/format";
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, Tabs, TextInput } from "../../components/ui";
import { StudentCalendarModal } from "../../components/StudentCalendarModal";
import { SessionContentModal } from "../../components/SessionContentModal";
import "./studentSchedule.css";

type ScheduleTab = "upcoming" | "history" | "all";

function shortDateLabel(session: ClassSession, state: PlatformState) {
  return new Intl.DateTimeFormat(state.ui.language, {
    timeZone: state.ui.timeZone,
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).format(new Date(session.startAt));
}

function sessionTiming(session: ClassSession, pendingReview: boolean) {
  if (pendingReview) return { key: "pending", labelKey: "student.schedule.statusPending", tone: "orange" as const, history: false };
  const now = Date.now();
  const start = new Date(session.startAt).getTime();
  const end = new Date(session.endAt).getTime();
  if (now < start) return { key: "upcoming", labelKey: "student.schedule.statusNotStarted", tone: "blue" as const, history: false };
  if (now <= end) return { key: "live", labelKey: "student.schedule.statusLive", tone: "mint" as const, history: false };
  return { key: "ended", labelKey: "student.schedule.statusEnded", tone: "neutral" as const, history: true };
}

function StudentSessionCard({
  state,
  session,
  pendingReview,
  onPreview,
  onReview,
  onPerformance
}: {
  state: PlatformState;
  session: ClassSession;
  pendingReview: boolean;
  onPreview: () => void;
  onReview: () => void;
  onPerformance: () => void;
}) {
  const { t } = useTranslation();
  const lesson = getLesson(state, session.lessonId);
  const course = lesson
    ? state.folders.find((folder) => folder.id === lesson.folderId)
    : undefined;
  const teacher = getUser(state, session.teacherId);
  const timing = sessionTiming(session, pendingReview);
  const rosterSize = session.roster?.length ?? 0;

  return (
    <article className={`class-session-card student-session-card ${timing.history ? "is-history" : "is-upcoming"}`}>
      <span className="session-color" style={{ background: lesson?.color ?? "var(--purple)" }} />
      <div className="operator-session-main">
        <div className="operator-session-time">
          <span className="operator-session-zone">{timeZoneLabel(state.ui.timeZone)}</span>
          <span className="operator-session-date">{shortDateLabel(session, state)}</span>
          <strong>{formatRange(session.startAt, session.endAt, state.ui.timeZone, state.ui.language)}</strong>
        </div>
        <div className="operator-session-copy">
          <div className="operator-session-heading">
            <h3>{session.title}</h3>
            <Badge
              tone={timing.tone}
              className={`operator-session-status operator-session-status-${timing.key}`}
            >
              {t(timing.labelKey)}
            </Badge>
          </div>
          <p className="operator-session-course">
            {course?.name || lesson?.subtitle || lesson?.title || t("student.schedule.contentFallback")}
          </p>
          <p className="operator-session-class"><GraduationCap size={14} /> {session.className}</p>
          <div className="operator-session-meta">
            {teacher && (
              <span className="operator-session-teacher">
                <Avatar label={teacher.avatar} size="sm" tone="orange" />
                <strong>{teacher.name}</strong>
              </span>
            )}
            <span className="operator-session-count">
              <UsersRound size={15} /> {t("student.schedule.enrolled", { count: rosterSize })}
            </span>
            <span className="operator-session-room">
              <MapPin size={15} /> <strong>{session.roomLabel}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="session-actions operator-session-actions student-session-actions">
        {pendingReview ? (
          <span className="student-session-hint">{t("student.schedule.pendingHint")}</span>
        ) : timing.history ? (
          <>
            <Button size="sm" variant="primary" onClick={onReview}>
              <RotateCcw size={16} /> {t("student.review")}
            </Button>
            <Button size="sm" variant="secondary" onClick={onPerformance}>
              <BarChart3 size={16} /> {t("student.schedule.viewPerformance")}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="primary" onClick={onPreview}>
            <PlayCircle size={16} /> {t("student.prep")}
          </Button>
        )}
      </div>
    </article>
  );
}

export function StudentSchedule() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const state = usePlatformStore((store) => store.state);
  const user = currentUser(state);
  const metrics = studentMetrics(state, user.id);
  const [tab, setTab] = useState<ScheduleTab>("upcoming");
  const [query, setQuery] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [preview, setPreview] = useState<{
    phase: Phase;
    title: string;
    url?: string;
    materialId?: string;
    badgeLabel: string;
    note: string;
    lessonId: string;
    sessionId: string;
  } | null>(null);

  const pendingReviewSessions = useMemo(
    () =>
      getStudentPendingReviewBookings(state, user.id)
        .map((booking) => getSession(state, booking.sessionId))
        .filter((session): session is ClassSession =>
          Boolean(session && session.status === "published" && new Date(session.endAt).getTime() >= Date.now())
        ),
    [state, user.id]
  );

  const upcomingSessions = useMemo(
    () => [...pendingReviewSessions, ...metrics.upcoming].filter((session) => session.status !== "cancelled"),
    [metrics.upcoming, pendingReviewSessions]
  );
  const historySessions = useMemo(
    () => metrics.past.filter((session) => session.status !== "cancelled"),
    [metrics.past]
  );
  const allSessions = useMemo(() => {
    const map = new Map<string, ClassSession>();
    [...upcomingSessions, ...historySessions].forEach((session) => map.set(session.id, session));
    return [...map.values()];
  }, [historySessions, upcomingSessions]);

  const visibleSessions = useMemo(() => {
    const source = tab === "upcoming" ? upcomingSessions : tab === "history" ? historySessions : allSessions;
    const keyword = query.trim().toLowerCase();
    if (!keyword) return source;
    return source.filter((session) => {
      const lesson = getLesson(state, session.lessonId);
      const teacher = getUser(state, session.teacherId);
      return `${session.title} ${session.className} ${session.roomLabel} ${lesson?.title ?? ""} ${lesson?.subtitle ?? ""} ${teacher?.name ?? ""}`
        .toLowerCase()
        .includes(keyword);
    });
  }, [allSessions, historySessions, query, state, tab, upcomingSessions]);

  /** 打开课前 / 课后内容弹窗：课件 + 该阶段材料 + 该阶段互动都在同一个弹窗里。 */
  function openSessionContent(session: ClassSession, phase: Phase) {
    const lesson = getLesson(state, session.lessonId);
    const materials = lesson ? lessonContent(state, lesson.id, phase, session.id).materials.filter(Boolean) : [];
    const coursewareMaterial = materials.find(
      (material) => material!.kind === "courseware" && material!.versions.length > 0
    );
    const coursewareUrl = coursewareMaterial
      ? coursewareMaterial.versions.find((item) => item.version === coursewareMaterial.currentVersion)?.url ??
        coursewareMaterial.versions.at(-1)?.url
      : undefined;

    setPreview({
      phase,
      title: lesson?.title ?? session.title,
      url: coursewareUrl,
      materialId: coursewareMaterial?.id,
      badgeLabel: t("student.schedule.coursewareBadge"),
      note: t("student.schedule.coursewareNote"),
      lessonId: session.lessonId,
      sessionId: session.id
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="My learning calendar"
        title={t("student.scheduleTitle")}
        description={t("student.schedule.description")}
      />

      <Card className="student-schedule-toolbar">
        <div className="student-schedule-search">
          <Search size={17} />
          <TextInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("student.schedule.searchPlaceholder")}
            aria-label={t("student.schedule.searchAria")}
          />
        </div>
        <Button variant="secondary" onClick={() => setCalendarOpen(true)}>
          <CalendarDays size={17} /> {t("student.schedule.calendar")}
        </Button>
      </Card>

      <div className="student-schedule-tabbar">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "upcoming", label: t("student.schedule.tabUpcoming"), count: upcomingSessions.length },
            { value: "history", label: t("student.schedule.tabHistory"), count: historySessions.length },
            { value: "all", label: t("student.schedule.tabAll"), count: allSessions.length }
          ]}
        />
      </div>

      <div className="student-session-list">
        {visibleSessions.map((session) => {
          const pendingReview = isSessionPendingReview(state, user.id, session.id);
          return (
            <StudentSessionCard
              key={session.id}
              state={state}
              session={session}
              pendingReview={pendingReview}
              onPreview={() => openSessionContent(session, "preview")}
              onReview={() => openSessionContent(session, "review")}
              onPerformance={() => navigate(`/student/results?sessionId=${session.id}`)}
            />
          );
        })}
      </div>

      {visibleSessions.length === 0 && (
        <EmptyState
          title={query ? t("student.schedule.emptyMatchTitle") : tab === "history" ? t("student.schedule.emptyHistoryTitle") : t("student.schedule.emptyTitle")}
          description={query ? t("student.schedule.emptyMatchDescription") : t("student.schedule.emptyDescription")}
        />
      )}

      <StudentCalendarModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        state={state}
        sessions={metrics.sessions}
        onOpenCourseware={(session) => {
          setCalendarOpen(false);
          openSessionContent(session, new Date(session.endAt).getTime() < Date.now() ? "review" : "preview");
        }}
      />

      <SessionContentModal
        open={Boolean(preview)}
        state={state}
        phase={preview?.phase ?? "preview"}
        title={preview?.title ?? t("student.schedule.previewFallback")}
        lessonId={preview?.lessonId ?? ""}
        sessionId={preview?.sessionId ?? ""}
        coursewareUrl={preview?.url}
        coursewareMaterialId={preview?.materialId}
        coursewareBadge={preview?.badgeLabel}
        coursewareNote={preview?.note}
        onClose={() => setPreview(null)}
        onOpenLesson={() => {
          if (!preview) return;
          const target = `/student/lesson/${preview.lessonId}?sessionId=${preview.sessionId}&phase=${preview.phase}`;
          setPreview(null);
          navigate(target);
        }}
      />
    </>
  );
}
