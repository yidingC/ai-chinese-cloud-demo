import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  UsersRound
} from "lucide-react";
import { usePlatformStore } from "../../store/usePlatformStore";
import { currentUser, getBookedCount, getLesson, sessionRuntimeStatus, teacherMetrics } from "../../lib/domain";
import { formatDate, formatRange, formatTime } from "../../lib/format";
import { buildTeacherLiveDemo, useTeacherDemoMode } from "../../lib/teacherLiveDemo";
import { Button, Card, PageHeader } from "../../components/ui";
import { PmNote } from "../../components/PmNote";

const DAY_MS = 86_400_000;

function timeZoneOffsetMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(date);
  const map: Record<string, number> = {};
  parts.forEach((part) => {
    if (part.type !== "literal") map[part.type] = Number(part.value);
  });
  const asUtc = Date.UTC(map.year, map.month - 1, map.day, map.hour % 24, map.minute, map.second);
  return (asUtc - date.getTime()) / 60_000;
}

function toCalendarWallClock(date: Date, timeZone: string) {
  return new Date(date.getTime() + timeZoneOffsetMinutes(date, timeZone) * 60_000);
}

function calendarDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function buildCalendarDays(monthAnchor: Date) {
  const year = monthAnchor.getUTCFullYear();
  const month = monthAnchor.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const leading = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(first.getTime() - leading * DAY_MS);
  return Array.from({ length: 42 }, (_, index) => new Date(gridStart.getTime() + index * DAY_MS));
}

function formatCalendarRowDate(value: string, timeZone: string, language: string) {
  return new Intl.DateTimeFormat(language, {
    timeZone,
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).format(new Date(value));
}

export function TeacherDashboard() {
  const navigate = useNavigate();
  const state = usePlatformStore((store) => store.state);
  const user = currentUser(state);
  const [demoMode] = useTeacherDemoMode();
  const now = Date.now();
  const todayKey = calendarDateKey(toCalendarWallClock(new Date(now), state.ui.timeZone));
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const wallNow = toCalendarWallClock(new Date(now), state.ui.timeZone);
    return new Date(Date.UTC(wallNow.getUTCFullYear(), wallNow.getUTCMonth(), 1));
  });
  const metrics = teacherMetrics(state, user.id);
  const liveSession = demoMode === "live"
    ? metrics.sessions.find((session) => sessionRuntimeStatus(session) === "live")
    : undefined;
  const liveDemo = liveSession ? buildTeacherLiveDemo(state, user.id, liveSession.id) : null;
  const today = metrics.upcoming.filter(
    (session) => calendarDateKey(toCalendarWallClock(new Date(session.startAt), state.ui.timeZone)) === todayKey
  );
  const liveSessionId = liveSession?.id ?? "";
  const next = metrics.sessions.find((session) => sessionRuntimeStatus(session) === "upcoming");
  const todaySessions = liveDemo
    ? [liveDemo.session, ...today.filter((session) => session.id !== liveDemo.session.id)]
    : today;
  const nextLesson = next ? getLesson(state, next.lessonId) : undefined;
  const primarySessionId = liveDemo?.session.id ?? next?.id ?? "";
  const upcomingPreview = metrics.sessions
    .filter((session) => session.id !== primarySessionId)
    .filter((session) => sessionRuntimeStatus(session) === "upcoming")
    .slice(0, 5);

  useEffect(() => {
    const wallNow = toCalendarWallClock(new Date(), state.ui.timeZone);
    setCalendarCursor(new Date(Date.UTC(wallNow.getUTCFullYear(), wallNow.getUTCMonth(), 1)));
  }, [state.ui.timeZone]);

  const calendarSessions = liveDemo
    ? [liveDemo.session, ...metrics.sessions.filter((session) => session.id !== liveDemo.session.id)]
    : metrics.sessions;
  const sessionsByDay = new Map<string, typeof calendarSessions>();
  calendarSessions.forEach((session) => {
    const key = calendarDateKey(toCalendarWallClock(new Date(session.startAt), state.ui.timeZone));
    sessionsByDay.set(key, [...(sessionsByDay.get(key) ?? []), session]);
  });
  const calendarDays = buildCalendarDays(calendarCursor);
  const calendarMonth = calendarCursor.getUTCMonth();
  const calendarYear = calendarCursor.getUTCFullYear();
  const calendarMonthCount = calendarSessions.filter((session) => {
    const wall = toCalendarWallClock(new Date(session.startAt), state.ui.timeZone);
    return wall.getUTCMonth() === calendarMonth && wall.getUTCFullYear() === calendarYear;
  }).length;
  const formatWall = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(state.ui.language, { timeZone: "UTC", ...options });
  const calendarMonthLabel = formatWall({ year: "numeric", month: "long" }).format(calendarCursor);
  const calendarWeekdays = calendarDays.slice(0, 7).map((day) => formatWall({ weekday: "narrow" }).format(day));

  return (
    <>
      <PageHeader
        eyebrow={`Teacher workspace · ${user.name}`}
        title={todaySessions.length > 0 ? `今天有 ${todaySessions.length} 节课` : "今天没有排课"}
      />

      {liveDemo ? (
        <PmNote kind="流程" block note="入口绑定当前进行中的课次；进入后所有实时数据都以该课次为上下文。">
          <div
            className="teacher-live-banner"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/teacher/live/${liveDemo.session.id}`)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              navigate(`/teacher/live/${liveDemo.session.id}`);
            }}
          >
            <div className="teacher-live-banner-main">
              <span className="teacher-live-badge"><span className="live-pulse-dot" /> 正在进行中</span>
              <h2>{liveDemo.lessonTitle}</h2>
              <p>{liveDemo.session.className} · {liveDemo.session.title} · {liveDemo.session.roomLabel} · {liveDemo.lessonSubtitle}</p>
              <div className="teacher-live-meta">
                <span><Clock3 size={14} /> 已进行 {liveDemo.elapsedMinutes} 分钟</span>
                <span><UsersRound size={14} /> {liveDemo.presentCount}/{liveDemo.participantTotal} 人在线</span>
              </div>
            </div>

            <div className="teacher-live-action">
              <span className="teacher-live-action-icon"><ArrowRight size={26} /></span>
              <span className="teacher-live-action-copy">
                <strong>去上课</strong>
                <small>进入实时课堂</small>
              </span>
            </div>
            <span className="teacher-live-orbit live-orbit-one" />
            <span className="teacher-live-orbit live-orbit-two" />
          </div>
        </PmNote>
      ) : next ? (
        <section className="teacher-next-banner">
          <div className="teacher-next-main">
            <span className="teacher-next-badge"><CalendarDays size={14} /> 下一节课</span>
            <h2>{nextLesson?.coverEmoji} {nextLesson?.title ?? next.title}</h2>
            <p>{next.className} · {next.title} · {next.roomLabel || "在线课堂"}</p>
            <div className="teacher-next-meta">
              <span>
                <Clock3 size={14} />
                {formatDate(next.startAt, state.ui.timeZone, state.ui.language)} · {formatRange(next.startAt, next.endAt, state.ui.timeZone, state.ui.language)}
              </span>
              <span><UsersRound size={14} /> 应到 {next.roster?.length ?? getBookedCount(state, next.id)} 人</span>
              <span><MapPin size={14} /> {next.roomLabel || "未指定教室"}</span>
            </div>
          </div>
          <div className="teacher-next-action">
            <span>先把材料和互动准备好</span>
            <Button size="lg" onClick={() => navigate(`/teacher/session/${next.id}/design`)}>
              备课 <ArrowRight size={17} />
            </Button>
          </div>
        </section>
      ) : (
        <section className="teacher-next-banner teacher-next-banner-empty">
          <span className="teacher-next-empty-icon"><CalendarOff size={24} /></span>
          <div>
            <h2>暂无后续排课</h2>
            <p>新的课次排好后，会在这里显示下一节课。</p>
          </div>
          <Button variant="secondary" onClick={() => navigate("/teacher/schedule")}>查看我的课表</Button>
        </section>
      )}

      <div className="teacher-dashboard-lower">
        <Card className="teacher-upcoming-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">Upcoming classes</span>
              <h2>接下来开课</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/teacher/schedule")}>
              查看全部 <ArrowRight size={15} />
            </Button>
          </div>
          {upcomingPreview.length > 0 ? (
            <div className="teacher-upcoming-list">
              {upcomingPreview.map((session) => {
                const lesson = getLesson(state, session.lessonId);
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => navigate(`/teacher/schedule?focus=${session.id}`)}
                  >
                    <span className="teacher-upcoming-time">
                      <strong>{formatCalendarRowDate(session.startAt, state.ui.timeZone, state.ui.language)}</strong>
                      <small>{formatTime(session.startAt, state.ui.timeZone, state.ui.language)}</small>
                    </span>
                    <span className="teacher-upcoming-copy">
                      <strong>{lesson?.coverEmoji} {lesson?.title ?? session.title}</strong>
                      <small>
                        {session.className} · {session.roomLabel || "在线课堂"} · 应到 {session.roster?.length ?? getBookedCount(state, session.id)} 人
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
                const wallNow = toCalendarWallClock(new Date(), state.ui.timeZone);
                setCalendarCursor(new Date(Date.UTC(wallNow.getUTCFullYear(), wallNow.getUTCMonth(), 1)));
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
              const key = calendarDateKey(day);
              const daySessions = sessionsByDay.get(key) ?? [];
              const label = formatWall({ month: "long", day: "numeric", weekday: "long" }).format(day);
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
                  onClick={() => navigate(`/teacher/schedule?calendar=${key}`)}
                >
                  <span>{day.getUTCDate()}</span>
                  {daySessions.length > 0 && (
                    <span className="teacher-mini-calendar-dots" aria-hidden="true">
                      {daySessions.slice(0, 3).map((session) => (
                        <i
                          key={session.id}
                          className={["ended", "cancelled"].includes(sessionRuntimeStatus(session)) ? "done" : "upcoming"}
                        />
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
            onClick={() => navigate(`/teacher/schedule?calendar=${todayKey}`)}
          >
            打开完整课程日历 <ArrowRight size={15} />
          </button>
        </Card>
      </div>
    </>
  );
}
