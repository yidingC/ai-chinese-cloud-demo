import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, GraduationCap } from "lucide-react";
import type { ClassSession, PlatformState } from "../domain/types";
import { getLesson, getUser } from "../lib/domain";
import { Badge, Button, Modal } from "./ui";

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

/** 把某个瞬间转换成"用户在目标时区看到的墙上时间"，用一个 UTC 字段承载它，便于按天分格。 */
function toWallClock(date: Date, timeZone: string) {
  return new Date(date.getTime() + timeZoneOffsetMinutes(date, timeZone) * 60_000);
}

function wallKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function wallDateFromKey(value?: string) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return date;
}

function buildMonthGrid(monthAnchor: Date) {
  const year = monthAnchor.getUTCFullYear();
  const month = monthAnchor.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const leading = (first.getUTCDay() + 6) % 7; // 周一作为一周第一天
  const gridStart = new Date(first.getTime() - leading * DAY_MS);
  return Array.from({ length: 42 }, (_, index) => new Date(gridStart.getTime() + index * DAY_MS));
}

/**
 * 课程日历弹窗（学生端 / 教师端共用）。
 * 左右分栏：左边按天分格的月历，右边是选中那天的课程；
 * 每节课的操作按钮由调用方通过 renderAction 决定，所以两端可以各自给不同的入口。
 */
export function CalendarModal({
  open,
  onClose,
  state,
  sessions,
  initialDate,
  title,
  detailSubtitle,
  monthNote,
  renderAction
}: {
  open: boolean;
  onClose: () => void;
  state: PlatformState;
  sessions: ClassSession[];
  initialDate?: string;
  title?: string;
  detailSubtitle?: (session: ClassSession) => ReactNode;
  monthNote?: (count: number) => string;
  renderAction: (session: ClassSession) => ReactNode;
}) {
  const { t } = useTranslation();
  const timeZone = state.ui.timeZone;
  const language = state.ui.language;
  const [cursor, setCursor] = useState(() => toWallClock(new Date(), timeZone));
  const [selectedKey, setSelectedKey] = useState(() => wallKey(toWallClock(new Date(), timeZone)));

  useEffect(() => {
    if (!open) return;
    const focusDate = wallDateFromKey(initialDate) ?? toWallClock(new Date(), timeZone);
    setCursor(new Date(Date.UTC(focusDate.getUTCFullYear(), focusDate.getUTCMonth(), 1)));
    setSelectedKey(wallKey(focusDate));
  }, [open, timeZone, initialDate]);

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, ClassSession[]>();
    [...sessions]
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .forEach((session) => {
        const key = wallKey(toWallClock(new Date(session.startAt), timeZone));
        map.set(key, [...(map.get(key) ?? []), session]);
      });
    return map;
  }, [sessions, timeZone]);

  const gridDays = buildMonthGrid(cursor);
  const todayKey = wallKey(toWallClock(new Date(), timeZone));
  const monthIndex = cursor.getUTCMonth();
  const monthCount = sessions.filter((session) => {
    const wall = toWallClock(new Date(session.startAt), timeZone);
    return wall.getUTCFullYear() === cursor.getUTCFullYear() && wall.getUTCMonth() === monthIndex;
  }).length;

  // 网格是"墙上时间"，用 UTC 格式化；真实时刻按用户时区格式化。
  const fmtWall = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(language, { timeZone: "UTC", ...options });
  const fmtZoned = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(language, { timeZone, ...options });
  const weekdays = gridDays.slice(0, 7).map((day) => fmtWall({ weekday: "short" }).format(day));
  const monthTitle = fmtWall({ year: "numeric", month: "long" }).format(cursor);
  const selectedDate = gridDays.find((day) => wallKey(day) === selectedKey) ?? cursor;
  const selectedSessions = sessionsByDay.get(selectedKey) ?? [];

  return (
    <Modal
      open={open}
      title={title ?? t("calendar.title")}
      onClose={onClose}
      width="980px"
      footer={
        <div className="calendar-legend">
          <span>
            <i className="legend-dot done" /> {t("calendar.ended")}
          </span>
          <span>
            <i className="legend-dot upcoming" /> {t("calendar.upcoming")}
          </span>
        </div>
      }
    >
      <div className="calendar-layout">
        <div className="calendar-panel">
          <div className="calendar-toolbar">
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("calendar.previousMonth")}
              onClick={() => setCursor((value) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() - 1, 1)))}
            >
              <ChevronLeft size={18} />
            </Button>
            <div>
              <strong>{monthTitle}</strong>
              <small>{monthNote ? monthNote(monthCount) : t("calendar.monthCount", { count: monthCount })}</small>
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("calendar.nextMonth")}
              onClick={() => setCursor((value) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1)))}
            >
              <ChevronRight size={18} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const now = toWallClock(new Date(), timeZone);
                setCursor(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
                setSelectedKey(wallKey(now));
              }}
            >
              {t("calendar.today")}
            </Button>
          </div>

          <div className="calendar-weekdays">
            {weekdays.map((label, index) => (
              <span key={`${label}-${index}`}>{label}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {gridDays.map((day) => {
              const key = wallKey(day);
              const daySessions = sessionsByDay.get(key) ?? [];
              const allPast = daySessions.length > 0 && daySessions.every((session) => new Date(session.endAt).getTime() < Date.now());
              return (
                <button
                  key={key}
                  className={[
                    "calendar-day",
                    day.getUTCMonth() === monthIndex ? "" : "outside",
                    key === todayKey ? "today" : "",
                    key === selectedKey ? "selected" : "",
                    daySessions.length ? "has-class" : "",
                    allPast ? "past" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setSelectedKey(key)}
                >
                  <span className="calendar-day-number">{day.getUTCDate()}</span>
                  <span className="calendar-dots">
                    {daySessions.slice(0, 3).map((session, index) => (
                      <i
                        key={session.id}
                        className={new Date(session.endAt).getTime() < Date.now() ? "dot-done" : "dot-upcoming"}
                        style={{ marginLeft: index ? 3 : 0 }}
                      />
                    ))}
                    {daySessions.length > 3 && <small>+{daySessions.length - 3}</small>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="calendar-day-detail">
          <div className="card-heading">
            <div>
              <span className="eyebrow">Selected day</span>
              <h3>{fmtWall({ month: "long", day: "numeric", weekday: "long" }).format(selectedDate)}</h3>
            </div>
            <Badge tone={selectedSessions.length ? "purple" : "blue"}>{t("calendar.sessionCount", { count: selectedSessions.length })}</Badge>
          </div>

          <div className="calendar-session-list">
            {selectedSessions.map((session) => {
              const lesson = getLesson(state, session.lessonId);
              const teacher = getUser(state, session.teacherId);
              const ended = new Date(session.endAt).getTime() < Date.now();
              return (
                <article key={session.id} className="calendar-session-item">
                  <div className="calendar-session-time">
                    <strong>{fmtZoned({ hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(session.startAt))}</strong>
                    <small>{fmtZoned({ hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(session.endAt))}</small>
                  </div>
                  <div className="calendar-session-copy">
                    <strong>{session.title}</strong>
                    <small><GraduationCap size={12} /> {session.className}</small>
                    <small>
                      {lesson?.coverEmoji} {lesson?.title}
                      {detailSubtitle ? <> · {detailSubtitle(session)}</> : <> · {teacher?.name}</>}
                    </small>
                    <div className="calendar-session-tags">
                      <Badge tone={ended ? "blue" : "mint"}>{ended ? t("calendar.ended") : t("calendar.upcoming")}</Badge>
                      {session.source === "series" && <Badge tone="purple">{t("calendar.series")}</Badge>}
                    </div>
                  </div>
                  {renderAction(session)}
                </article>
              );
            })}
            {selectedSessions.length === 0 && <p className="muted-copy">{t("calendar.noSessions")}</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
