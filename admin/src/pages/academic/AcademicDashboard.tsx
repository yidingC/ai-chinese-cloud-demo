import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarOff, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge, Button, Card, PageHeader } from "../../components/ui";
import { CalendarModal } from "../../components/CalendarModal";
import { OperatorSessionRosterModal } from "../../components/OperatorSessionRosterModal";
import { currentUser, getBookedCount, getLesson } from "../../lib/domain";
import { getAcademicSchoolId, workspaceState } from "../../lib/academicScope";
import { formatTime } from "../../lib/format";
import { usePlatformStore } from "../../store/usePlatformStore";

const DAY_MS = 86_400_000;

function dateKeyInZone(value: string | Date, timeZone: string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function wallDateInZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return new Date(Date.UTC(read("year"), read("month") - 1, read("day")));
}

function wallKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function buildCalendarDays(monthAnchor: Date) {
  const first = new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth(), 1));
  const leading = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(first.getTime() - leading * DAY_MS);
  return Array.from({ length: 42 }, (_, index) => new Date(gridStart.getTime() + index * DAY_MS));
}

function compactDay(value: string, timeZone: string, language: string) {
  return new Intl.DateTimeFormat(language, {
    timeZone,
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).format(new Date(value));
}

export function AcademicDashboard() {
  const navigate = useNavigate();
  const { state: rawState } = usePlatformStore();
  const user = currentUser(rawState);
  const schoolId = getAcademicSchoolId(rawState, user);
  const state = useMemo(() => workspaceState(rawState, schoolId), [rawState, schoolId]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => dateKeyInZone(new Date(), state.ui.timeZone));
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const wallNow = wallDateInZone(state.ui.timeZone);
    return new Date(Date.UTC(wallNow.getUTCFullYear(), wallNow.getUTCMonth(), 1));
  });
  const [rosterSessionId, setRosterSessionId] = useState<string | null>(null);

  useEffect(() => {
    const wallNow = wallDateInZone(state.ui.timeZone);
    setCalendarCursor(new Date(Date.UTC(wallNow.getUTCFullYear(), wallNow.getUTCMonth(), 1)));
    setCalendarDate(dateKeyInZone(new Date(), state.ui.timeZone));
  }, [state.ui.timeZone]);

  const school = state.schools.find((item) => item.id === schoolId);
  const published = state.sessions.filter((session) => session.status === "published");
  const now = Date.now();
  const todayKey = dateKeyInZone(new Date(), state.ui.timeZone);
  const todaySessions = published
    .filter((session) => dateKeyInZone(session.startAt, state.ui.timeZone) === todayKey)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const upcoming = published
    .filter((session) => new Date(session.endAt).getTime() >= now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const focusSession = todaySessions.find((session) => new Date(session.endAt).getTime() >= now) ?? upcoming[0];
  const focusIsToday = focusSession ? dateKeyInZone(focusSession.startAt, state.ui.timeZone) === todayKey : false;
  const upcomingPreview = upcoming.filter((session) => session.id !== focusSession?.id).slice(0, 5);
  const activeClasses = state.classes.filter((item) => item.status === "active");
  const fmtWall = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(state.ui.language, { timeZone: "UTC", ...options });
  const sessionsByDay = new Map<string, typeof published>();
  published.forEach((session) => {
    const key = dateKeyInZone(session.startAt, state.ui.timeZone);
    sessionsByDay.set(key, [...(sessionsByDay.get(key) ?? []), session]);
  });
  const calendarDays = buildCalendarDays(calendarCursor);
  const calendarMonth = calendarCursor.getUTCMonth();
  const calendarYear = calendarCursor.getUTCFullYear();
  const calendarMonthCount = published.filter((session) =>
    dateKeyInZone(session.startAt, state.ui.timeZone).startsWith(`${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}`)
  ).length;
  const calendarMonthLabel = fmtWall({ year: "numeric", month: "long" }).format(calendarCursor);
  const calendarWeekdays = calendarDays.slice(0, 7).map((day) => fmtWall({ weekday: "narrow" }).format(day));
  const focusStatus = focusSession
    ? now >= new Date(focusSession.startAt).getTime() && now <= new Date(focusSession.endAt).getTime()
      ? "进行中"
      : now < new Date(focusSession.startAt).getTime()
        ? "待开始"
        : "已结束"
    : "";
  const rosterSize = (sessionId: string) => state.sessions.find((session) => session.id === sessionId)?.roster?.length ?? 0;

  function openCalendar(date = todayKey) {
    setCalendarDate(date);
    setCalendarOpen(true);
  }

  return (
    <>
      <PageHeader
        eyebrow={`School operations · ${user.name}`}
        title={`${school?.name ?? "本校"}教学运行中心`}
      />

      <section className="operator-hero academic-hero">
        <div className="academic-hero-copy">
          <h2>本校 {activeClasses.length} 个班级，{state.students.length} 位学生</h2>
          <div className="academic-hero-actions">
            <button className="academic-hero-link" type="button" onClick={() => navigate("/academic/students")}>
              查看班级与学生 <ArrowRight size={17} />
            </button>
          </div>
        </div>

        <div className={`academic-focus-card${focusSession ? " is-clickable" : ""}`}>
          {focusSession && (
            <button
              type="button"
              className="academic-focus-card-hit"
              data-session-id={focusSession.id}
              aria-label={`在课程日历中查看 ${focusSession.title}`}
              onClick={() => navigate(`/academic/scheduling?focus=${encodeURIComponent(focusSession.id)}`)}
            />
          )}
          <div className="academic-focus-top">
            <span>{focusIsToday ? "TODAY" : "NEXT CLASS"}</span>
            <small>{focusSession ? compactDay(focusSession.startAt, state.ui.timeZone, state.ui.language) : "暂无课次"}</small>
          </div>
          {focusSession ? (
            <>
              <div className="academic-focus-time">
                {formatTime(focusSession.startAt, state.ui.timeZone, state.ui.language)}
                <span>–{formatTime(focusSession.endAt, state.ui.timeZone, state.ui.language)}</span>
              </div>
              <strong className="academic-focus-title">{focusSession.title}</strong>
              <p className="academic-focus-meta">{focusSession.className} · {state.users.find((item) => item.id === focusSession.teacherId)?.name ?? "待定教师"}</p>
              <div className="academic-focus-footer">
                <Badge tone={focusStatus === "进行中" ? "mint" : focusStatus === "待开始" ? "blue" : "neutral"}>{focusStatus}</Badge>
                <span>应到 {rosterSize(focusSession.id)} 人</span>
              </div>
            </>
          ) : (
            <>
              <strong className="academic-focus-title">近期暂无课程</strong>
              <p className="academic-focus-meta">课表由教学管理统一发布。</p>
            </>
          )}
        </div>
      </section>

      <div className="teacher-dashboard-lower">
        <Card className="teacher-upcoming-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">Upcoming classes</span>
              <h2>接下来开课</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/academic/scheduling")}>
              查看全部 <ArrowRight size={15} />
            </Button>
          </div>
          {upcomingPreview.length > 0 ? (
            <div className="teacher-upcoming-list">
              {upcomingPreview.map((session) => {
                const lesson = getLesson(state, session.lessonId);
                const teacher = state.users.find((item) => item.id === session.teacherId);
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setRosterSessionId(session.id)}
                  >
                    <span className="teacher-upcoming-time">
                      <strong>{compactDay(session.startAt, state.ui.timeZone, state.ui.language)}</strong>
                      <small>{formatTime(session.startAt, state.ui.timeZone, state.ui.language)}</small>
                    </span>
                    <span className="teacher-upcoming-copy">
                      <strong>{lesson?.coverEmoji ?? "📘"} {lesson?.title ?? session.title}</strong>
                      <small>
                        {session.className} · {teacher?.name ?? "待定教师"} · {session.roomLabel || "在线课堂"} · 应到 {session.roster?.length ?? getBookedCount(state, session.id)} 人
                      </small>
                    </span>
                    <ChevronRight size={17} className="teacher-upcoming-chevron" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="teacher-upcoming-empty">
              <span><CalendarOff size={20} /></span>
              <div>
                <strong>近期暂无后续课程</strong>
                <small>新排课后会显示在这里。</small>
              </div>
            </div>
          )}
        </Card>

        <Card className="teacher-mini-calendar-card">
          <div className="teacher-mini-calendar-head">
            <div>
              <span className="eyebrow">Calendar</span>
              <h2>课程日历</h2>
            </div>
            <span className="teacher-mini-calendar-count">本月 {calendarMonthCount} 节</span>
          </div>

          <div className="teacher-mini-calendar-toolbar">
            <button
              type="button"
              aria-label="上个月"
              onClick={() => setCalendarCursor(new Date(Date.UTC(calendarYear, calendarMonth - 1, 1)))}
            >
              <ChevronLeft size={16} />
            </button>
            <strong>{calendarMonthLabel}</strong>
            <button
              type="button"
              aria-label="下个月"
              onClick={() => setCalendarCursor(new Date(Date.UTC(calendarYear, calendarMonth + 1, 1)))}
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className="teacher-mini-calendar-today"
              onClick={() => {
                const wallNow = wallDateInZone(state.ui.timeZone);
                setCalendarCursor(new Date(Date.UTC(wallNow.getUTCFullYear(), wallNow.getUTCMonth(), 1)));
                setCalendarDate(wallKey(wallNow));
              }}
            >
              今天
            </button>
          </div>

          <div className="teacher-mini-calendar-weekdays">
            {calendarWeekdays.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
          </div>

          <div className="teacher-mini-calendar-grid">
            {calendarDays.map((day) => {
              const key = wallKey(day);
              const daySessions = sessionsByDay.get(key) ?? [];
              const label = fmtWall({ month: "long", day: "numeric", weekday: "long" }).format(day);
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={`${label}，${daySessions.length ? `${daySessions.length} 节课` : "没有课程"}`}
                  className={[
                    "teacher-mini-calendar-day",
                    day.getUTCMonth() === calendarMonth ? "" : "outside",
                    key === todayKey ? "today" : "",
                    daySessions.length > 0 ? "has-class" : ""
                  ].filter(Boolean).join(" ")}
                  onClick={() => openCalendar(key)}
                >
                  <span>{day.getUTCDate()}</span>
                  {daySessions.length > 0 && (
                    <span className="teacher-mini-calendar-dots" aria-hidden="true">
                      {daySessions.slice(0, 3).map((session) => (
                        <i key={session.id} className={new Date(session.endAt).getTime() < now ? "done" : "upcoming"} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="teacher-mini-calendar-foot"
            onClick={() => openCalendar(todayKey)}
          >
            打开完整课程日历 <ArrowRight size={15} />
          </button>
        </Card>
      </div>

      <CalendarModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        state={state}
        sessions={published}
        initialDate={calendarDate}
        title={`${school?.name ?? "本校"} · 课程日历`}
        detailSubtitle={(session) => state.users.find((item) => item.id === session.teacherId)?.name ?? ""}
        renderAction={(session) => (
          <Button size="sm" variant="soft" onClick={() => { setCalendarOpen(false); setRosterSessionId(session.id); }}>
            查看名单
          </Button>
        )}
      />

      {rosterSessionId && (
        <OperatorSessionRosterModal
          state={state}
          sessionId={rosterSessionId}
          actorId={user.id}
          readOnly
          onClose={() => setRosterSessionId(null)}
        />
      )}
    </>
  );
}
