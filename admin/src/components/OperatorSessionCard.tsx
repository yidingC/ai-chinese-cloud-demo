import type { ReactNode } from "react";
import { GraduationCap, MapPin, UsersRound } from "lucide-react";
import type { ClassSession, PlatformState } from "../domain/types";
import { getLesson, getSchoolTimeZone, getUser, sessionRuntimeStatus } from "../lib/domain";
import { formatRange, timeZoneLabel } from "../lib/format";
import { Avatar, Badge } from "./ui";

function formatMonthDay(value: string, timeZone: string, language: string) {
  return new Intl.DateTimeFormat(language, {
    timeZone,
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function formatWeekday(value: string, timeZone: string, language: string) {
  return new Intl.DateTimeFormat(language, {
    timeZone,
    weekday: "short"
  }).format(new Date(value));
}

export function OperatorSessionCard({
  state,
  session,
  actions,
  focused = false
}: {
  state: PlatformState;
  session: ClassSession;
  actions?: ReactNode;
  focused?: boolean;
}) {
  const lesson = getLesson(state, session.lessonId);
  const course = lesson
    ? state.folders.find((folder) => folder.id === lesson.folderId)
    : undefined;
  const teacher = getUser(state, session.teacherId);
  const rosterSize = session.roster?.length ?? 0;
  const timeZone = getSchoolTimeZone(state, session.schoolId);
  const runtimeStatus = sessionRuntimeStatus(session);
  const status = runtimeStatus === "cancelled"
    ? { key: "cancelled", label: "已取消", tone: "danger" as const }
    : runtimeStatus === "ended"
      ? { key: "ended", label: "已结束", tone: "neutral" as const }
      : runtimeStatus === "live"
        ? { key: "live", label: "进行中", tone: "mint" as const }
        : { key: "upcoming", label: "未开始", tone: "blue" as const };
  return (
    <article
      className={`class-session-card operator-session-card${focused ? " is-focused" : ""}`}
      data-session-id={session.id}
      tabIndex={focused ? -1 : undefined}
    >
      <span className="session-color" style={{ background: lesson?.color ?? "#6552ff" }} />
      <div className="operator-session-main">
        <div className="operator-session-time">
          <span className="operator-session-zone">{timeZoneLabel(timeZone)}</span>
          <span className="operator-session-date">
            {formatMonthDay(session.startAt, timeZone, state.ui.language)}
            <em>{formatWeekday(session.startAt, timeZone, state.ui.language)}</em>
          </span>
          <strong>{formatRange(session.startAt, session.endAt, timeZone, state.ui.language)}</strong>
        </div>
        <div className="operator-session-copy">
          <div className="operator-session-heading">
            <h3>{lesson?.title ?? session.title}</h3>
            <Badge
              tone={status.tone}
              className={`operator-session-status operator-session-status-${status.key}`}
            >
              {status.label}
            </Badge>
          </div>
          {course && <p className="operator-session-course">{course.name}</p>}
          <p className="operator-session-class"><GraduationCap size={14} /> {session.className}</p>
          <div className="operator-session-meta">
            {teacher && (
              <span className="operator-session-teacher">
                <Avatar label={teacher.avatar} size="sm" tone="orange" />
                <strong>{teacher.name}</strong>
              </span>
            )}
            <span className="operator-session-count">
              <UsersRound size={15} /> 应到 <strong>{rosterSize}</strong> 人
            </span>
            <span className="operator-session-room">
              <MapPin size={15} /> <strong>{session.roomLabel?.trim() || "未指定"}</strong>
            </span>
          </div>
        </div>
      </div>
      {actions && <div className="session-actions operator-session-actions">{actions}</div>}
    </article>
  );
}
