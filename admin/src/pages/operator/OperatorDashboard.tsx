import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarCheck2,
  CalendarPlus,
  ChevronRight,
} from "lucide-react";
import { Badge, Button, Card, PageHeader } from "../../components/ui";
import { getBookedCount, getLesson } from "../../lib/domain";
import { formatDate, formatTime } from "../../lib/format";
import { usePlatformStore } from "../../store/usePlatformStore";

export function OperatorDashboard() {
  const navigate = useNavigate();
  const { state } = usePlatformStore();
  const now = Date.now();
  const activeClasses = state.classes.filter((classItem) => classItem.status === "active");
  const upcomingSessions = state.sessions
    .filter((session) => session.status === "published" && new Date(session.endAt).getTime() >= now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const todayKey = new Date(now).toLocaleDateString("en-CA", { timeZone: state.ui.timeZone });
  const todaySessions = state.sessions
    .filter((session) => session.status !== "cancelled" && new Date(session.startAt).toLocaleDateString("en-CA", { timeZone: state.ui.timeZone }) === todayKey)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const weekSessions = upcomingSessions.filter((session) => new Date(session.startAt).getTime() <= now + 7 * 24 * 60 * 60 * 1000);

  return (
    <>
      <PageHeader
        title="运营工作台"
        description={`在运营 ${activeClasses.length} 个班 · 未来 7 天 ${weekSessions.length} 节课`}
      />

      <div className="operator-workbench">
        <div className="operator-main-stack">
          <Card className="operator-upcoming-card">
            <div className="operator-section-head">
              <div>
                <span className="eyebrow">UPCOMING CLASSES</span>
                <h2>接下来开课</h2>
              </div>
              <Button size="sm" variant="ghost" onClick={() => navigate("/operator/scheduling")}>查看全部 <ArrowRight size={15} /></Button>
            </div>
            <div className="operator-upcoming-list">
              {upcomingSessions.slice(0, 5).map((session) => (
                <button key={session.id} onClick={() => navigate(`/operator/scheduling?focus=${session.id}`)}>
                  <span className="operator-upcoming-time">
                    <strong>{formatDate(session.startAt, state.ui.timeZone, state.ui.language)}</strong>
                    <small>{formatTime(session.startAt, state.ui.timeZone, state.ui.language)}</small>
                  </span>
                  <span className="operator-upcoming-copy">
                    <strong>{getLesson(state, session.lessonId)?.title ?? session.title}</strong>
                    <small>{session.className} · {state.users.find((person) => person.id === session.teacherId)?.name ?? "未分配教师"}</small>
                  </span>
                  <span className="operator-upcoming-side">
                    <Badge tone="neutral">{getBookedCount(state, session.id)}/{session.capacity}</Badge>
                    <ChevronRight size={15} />
                  </span>
                </button>
              ))}
              {upcomingSessions.length === 0 && (
                <div className="operator-empty-inline">
                  <CalendarCheck2 size={20} />
                  <div><strong>暂无未来课次</strong><small>排课后，最近的课堂会显示在这里。</small></div>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="operator-side-stack">
          <Card className="operator-today-card">
            <div className="operator-section-head">
              <div>
                <span className="eyebrow">TODAY</span>
                <h2>今天课堂</h2>
                <p>{formatDate(new Date(now).toISOString(), state.ui.timeZone, state.ui.language)}</p>
              </div>
              <Badge tone="blue">{todaySessions.length} 节</Badge>
            </div>
            <div className="operator-today-list">
              {todaySessions.map((session) => {
                const live = new Date(session.startAt).getTime() <= now && new Date(session.endAt).getTime() >= now;
                const ended = new Date(session.endAt).getTime() < now;
                return (
                  <button key={session.id} className={live ? "is-live" : ended ? "is-ended" : ""} onClick={() => navigate(`/operator/scheduling?focus=${session.id}`)}>
                    <span className="operator-today-time">{formatTime(session.startAt, state.ui.timeZone, state.ui.language)}</span>
                    <span className="operator-today-copy">
                      <strong>{getLesson(state, session.lessonId)?.title ?? session.title}</strong>
                      <small>{session.className} · {state.users.find((person) => person.id === session.teacherId)?.name ?? "未分配教师"}</small>
                    </span>
                    <Badge tone={live ? "orange" : ended ? "neutral" : "blue"}>{live ? "进行中" : ended ? "已结束" : "待开始"}</Badge>
                  </button>
                );
              })}
              {todaySessions.length === 0 && (
                <div className="operator-empty-inline compact">
                  <CalendarCheck2 size={18} />
                  <div><strong>今天没有课堂</strong><small>可以继续处理后续排课。</small></div>
                </div>
              )}
            </div>
          </Card>

          <button
            type="button"
            className="operator-schedule-cta"
            aria-label="去排课"
            onClick={() => navigate("/operator/scheduling?create=1")}
          >
            <span className="operator-schedule-cta-icon" aria-hidden="true">
              <CalendarPlus size={26} />
            </span>
            <span className="operator-schedule-cta-foot">
              <ArrowRight />
              去排课
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
