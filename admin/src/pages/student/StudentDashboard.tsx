import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  GraduationCap,
  MapPin,
  PlayCircle,
  RotateCcw,
  TrendingUp,
  UserRound
} from "lucide-react";
import { Badge, Button, Card, PageHeader } from "../../components/ui";
import {
  currentUser,
  getLesson,
  getStudent,
  getUser,
  lessonContent,
  studentMetrics,
  studentWebTasks
} from "../../lib/domain";
import { formatDateTime } from "../../lib/format";
import { buildGradeAnalytics, defaultGradeRange } from "../../lib/gradeAnalytics";
import { usePlatformStore } from "../../store/usePlatformStore";
import { GradeTrendChart } from "../../components/GradeTrendChart";
import { InteractionSetPlayerModal } from "../../components/InteractionSetPlayerModal";
import type { ClassSession, InteractionSet } from "../../domain/types";
import "./studentDashboard.css";

const MAX_HOME_TASKS = 3;

export function StudentDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const state = usePlatformStore((store) => store.state);
  const user = currentUser(state);
  const now = Date.now();
  const metrics = studentMetrics(state, user.id);
  const profile = getStudent(state, user.id);
  const upcomingSessions = metrics.upcoming.filter(
    (session) => session.status !== "cancelled" && new Date(session.startAt).getTime() > now
  );
  const pastSessions = metrics.past.filter((session) => session.status !== "cancelled");
  const nextSession = upcomingSessions[0];
  const recentSession = pastSessions[0];
  const nextLesson = nextSession ? getLesson(state, nextSession.lessonId) : undefined;
  const recentLesson = recentSession ? getLesson(state, recentSession.lessonId) : undefined;
  const recentTeacher = recentSession ? getUser(state, recentSession.teacherId) : undefined;
  const nextTeacher = nextSession ? getUser(state, nextSession.teacherId) : undefined;

  const [activeTask, setActiveTask] = useState<{ set: InteractionSet; session: ClassSession } | null>(null);

  const learningDays = profile
    ? Math.max(1, Math.ceil((now - new Date(profile.joinedAt).getTime()) / 86_400_000))
    : 0;

  const pendingTasks = studentWebTasks(state, user.id, now, state.ui.timeZone)
    .flatMap(({ tasks }) => tasks)
    .filter(({ set }) => !metrics.completedSetIds.has(set.id));
  const previewTaskCount = pendingTasks.filter(({ phase }) => phase === "preview").length;
  const reviewTaskCount = pendingTasks.filter(({ phase }) => phase === "review").length;
  const nextPreviewTask = pendingTasks.find(
    ({ phase, session }) => phase === "preview" && session.id === nextSession?.id
  );

  const recentReviewContent = recentSession
    ? lessonContent(state, recentSession.lessonId, "review", recentSession.id)
    : { sets: [], materials: [] };
  const recentReviewCount = recentReviewContent.sets.length + recentReviewContent.materials.length;

  const gradeSummary = useMemo(() => {
    const analytics = buildGradeAnalytics(state, defaultGradeRange(state.ui.timeZone), { studentId: user.id });
    return analytics.students.find((item) => item.studentId === user.id);
  }, [state, user.id]);

  function openPreview(session: ClassSession) {
    navigate(`/student/lesson/${session.lessonId}?sessionId=${session.id}&phase=preview`);
  }

  function openReview(session: ClassSession) {
    navigate(`/student/lesson/${session.lessonId}?sessionId=${session.id}&phase=review`);
  }

  return (
    <>
      <PageHeader
        eyebrow={t("student.journey")}
        title={profile ? (
          <span className="student-home-title">
            <span className="student-home-title-greeting">{t("student.greeting", { name: user.name })}</span>
            <span className="student-home-title-progress">
              {t("student.home.learningDaysPrefix")} <strong>{learningDays}</strong> {t("student.home.learningDaysSuffix")}
            </span>
          </span>
        ) : t("student.greeting", { name: user.name })}
        description={t("student.dashboardDescription", { timezone: t("common.timezone"), timeZone: state.ui.timeZone })}
        actions={
          <div className="student-home-head-actions">
            <Badge tone="neutral">
              <CheckCircle2 size={13} /> {t("student.home.completedShort", { count: pastSessions.length })}
            </Badge>
          </div>
        }
      />

      <div className="student-home-main-grid">
        <section className="student-hero-card student-home-hero">
          <div className="student-hero-copy">
            <div className="student-home-hero-badges">
              <Badge tone="purple">
                <CalendarClock size={13} /> {t("student.nextClass")}
              </Badge>
              {nextPreviewTask && <Badge tone="mint">{t("student.home.hasPreview")}</Badge>}
            </div>
            {nextSession ? (
              <>
                <h2>{nextSession.title}</h2>
                <p className="student-home-hero-topic">
                  {nextLesson?.subtitle || nextLesson?.title || nextSession.className}
                </p>
                <div className="student-home-session-meta">
                  <span><Clock3 size={15} /> {formatDateTime(nextSession.startAt, state.ui.timeZone, state.ui.language)}</span>
                  <span><GraduationCap size={15} /> {nextSession.className}</span>
                  {nextTeacher && <span><UserRound size={15} /> {nextTeacher.name}</span>}
                  <span><MapPin size={15} /> {nextSession.roomLabel}</span>
                </div>
                <div className="student-home-hero-actions">
                  {nextPreviewTask ? (
                    <Button variant="soft" onClick={() => openPreview(nextSession)}>
                      <PlayCircle size={17} /> {t("student.home.nextPreview")} <ArrowRight size={17} />
                    </Button>
                  ) : (
                    <Button variant="soft" onClick={() => navigate("/student/schedule")}>
                      <CalendarClock size={17} /> {t("student.home.nextSchedule")} <ArrowRight size={17} />
                    </Button>
                  )}
                  {nextPreviewTask && (
                    <Button variant="ghost" onClick={() => navigate("/student/schedule")}>
                      {t("student.viewSchedule")}
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <h2>{t("student.noUpcomingTitle")}</h2>
                <p>{t("student.noUpcomingDescription")}</p>
                <Button variant="soft" onClick={() => navigate("/student/schedule")}>
                  {t("student.viewSchedule")} <ArrowRight size={17} />
                </Button>
              </>
            )}
          </div>
          <div className="student-panda-scene" aria-hidden="true">
            <span className="scene-sun" />
            <span className="scene-cloud cloud-a" />
            <span className="scene-cloud cloud-b" />
            <span className="scene-panda">🐼</span>
            <span className="scene-book">中文</span>
          </div>
        </section>

        <Card className="student-home-panel student-home-todo">
          <div className="card-heading">
            <div>
              <span className="eyebrow">{t("student.home.todoEyebrow")}</span>
              <h2>{t("student.home.todoTitle")}</h2>
              <p>{t("student.home.todoHint")}</p>
            </div>
            <div className="student-home-task-counts">
              {previewTaskCount > 0 && (
                <Badge tone="purple">{t("student.home.previewCount", { count: previewTaskCount })}</Badge>
              )}
              {reviewTaskCount > 0 && (
                <Badge tone="orange">{t("student.home.reviewCount", { count: reviewTaskCount })}</Badge>
              )}
            </div>
          </div>

          {pendingTasks.length > 0 ? (
            <div className="student-home-task-list">
              {pendingTasks.slice(0, MAX_HOME_TASKS).map(({ phase, set, session }) => {
                const lesson = getLesson(state, session.lessonId);
                return (
                  <button
                    key={set.id}
                    type="button"
                    className={`student-home-task is-${phase}`}
                    onClick={() => setActiveTask({ set, session })}
                  >
                    <span className="student-home-task-icon">
                      {phase === "preview" ? <PlayCircle size={18} /> : <RotateCcw size={18} />}
                    </span>
                    <span className="student-home-task-copy">
                      <span className="student-home-task-title">
                        <Badge tone={phase === "preview" ? "purple" : "orange"}>
                          {phase === "preview" ? t("student.home.previewLabel") : t("student.home.reviewLabel")}
                        </Badge>
                        <strong>{set.title}</strong>
                      </span>
                      <small>
                        {lesson?.title || session.title} · {formatDateTime(session.startAt, state.ui.timeZone, state.ui.language)}
                      </small>
                    </span>
                    <ChevronRight size={17} className="student-home-task-chevron" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="student-home-empty">
              <span><CheckCircle2 size={21} /></span>
              <strong>{t("student.home.todoEmpty")}</strong>
            </div>
          )}
        </Card>
      </div>

      <div className="student-home-lower-grid">
        <Card className="student-home-panel student-home-recent-panel">
          <div className="card-heading">
            <div>
              <span className="eyebrow">{t("student.home.recentEyebrow")}</span>
              <h2>{t("student.home.recentTitle")}</h2>
            </div>
            {recentSession && (
              <Badge tone="neutral">
                {formatDateTime(recentSession.startAt, state.ui.timeZone, state.ui.language)}
              </Badge>
            )}
          </div>

          {recentSession ? (
            <div className="student-home-recent">
              <div className="student-home-recent-title">
                <span className="student-home-recent-icon"><BookOpenCheck size={22} /></span>
                <div>
                  <strong>{recentSession.title}</strong>
                  <small>{recentLesson?.subtitle || recentLesson?.title || recentSession.className}</small>
                </div>
              </div>
              <div className="student-home-recent-meta">
                <span><GraduationCap size={15} /> {recentSession.className}</span>
                {recentTeacher && <span><UserRound size={15} /> {recentTeacher.name}</span>}
                <span><FileText size={15} /> {t("student.home.reviewContentCount", { count: recentReviewCount })}</span>
              </div>
              <div className="student-home-recent-actions">
                <Button variant="soft" onClick={() => openReview(recentSession)}>
                  <RotateCcw size={16} /> {t("student.home.reviewAction")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/student/results?sessionId=${recentSession.id}`)}
                >
                  <BarChart3 size={16} /> {t("student.home.performanceAction")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="student-home-empty">
              <span><BookOpenCheck size={21} /></span>
              <strong>{t("student.home.recentEmpty")}</strong>
            </div>
          )}
        </Card>

        <Card className="student-home-panel student-home-grade">
          <div className="card-heading">
            <div>
              <span className="eyebrow">{t("student.home.gradeEyebrow")}</span>
              <h2>{t("student.home.gradeTitle")}</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/student/grades")}>
              {t("student.home.viewGrades")} <ChevronRight size={16} />
            </Button>
          </div>

          {gradeSummary ? (
            <div className="student-home-grade-charts">
              <section className="student-home-grade-chart is-trend">
                <div className="student-home-chart-heading">
                  <span>{t("student.home.trendTitle")}</span>
                  <TrendingUp size={19} />
                </div>
                <GradeTrendChart points={gradeSummary.trend} timeZone={state.ui.timeZone} height={270} />
              </section>
            </div>
          ) : (
            <div className="student-home-empty">
              <span><TrendingUp size={21} /></span>
              <strong>{t("student.home.noGrade")}</strong>
            </div>
          )}
        </Card>
      </div>

      {activeTask && (
        <InteractionSetPlayerModal
          set={activeTask.set}
          sessionId={activeTask.session.id}
          phase={activeTask.set.phase}
          onClose={() => setActiveTask(null)}
        />
      )}
    </>
  );
}
