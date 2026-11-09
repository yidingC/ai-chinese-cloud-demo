import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CalendarClock, Clock3, GraduationCap, MapPin, Pencil, Plus, UsersRound, XCircle } from "lucide-react";
import { platform } from "../../lib/platform";
import { usePlatformStore } from "../../store/usePlatformStore";
import { currentUser, getBookedCount, getLesson, getSession, getStudent, getWaitlist, getUser } from "../../lib/domain";
import { getAcademicSchoolId, workspaceState } from "../../lib/academicScope";
import { formatDate, formatRange } from "../../lib/format";
import { Avatar, Badge, Button, Card, EmptyState, Field, Modal, PageHeader, ProgressBar, Select, SourceBadge } from "../../components/ui";

export function OperatorSessionDetail({
  academic = false,
  basePath = "/operator"
}: {
  academic?: boolean;
  basePath?: string;
} = {}) {
  const { sessionId = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { state: rawState, run } = usePlatformStore();
  const user = currentUser(rawState);
  const state = academic ? workspaceState(rawState, getAcademicSchoolId(rawState, user)) : rawState;
  const session = getSession(state, sessionId);
  const lesson = session ? getLesson(state, session.lessonId) : undefined;
  const [proxyOpen, setProxyOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [proxyForm, setProxyForm] = useState({ studentId: "", force: false, reason: "" });

  if (!session || !lesson) return <EmptyState title="班次不存在" action={<Button onClick={() => navigate(`${basePath}/scheduling`)}>返回排课</Button>} />;

  const bookings = state.bookings.filter((booking) => booking.sessionId === session.id && booking.status === "booked");
  const waitlist = getWaitlist(state, session.id);
  const booked = getBookedCount(state, session.id);

  function proxyBook() {
    if (!proxyForm.studentId) return;
    const result = run(
      () =>
        platform.bookSession({
          studentId: proxyForm.studentId,
          sessionId: session!.id,
          force: proxyForm.force,
          reason: proxyForm.reason,
          source: "operator",
          actorId: user.id
        }),
      "代学生预约成功"
    );
    if (result.ok) {
      setProxyOpen(false);
      setProxyForm({ studentId: "", force: false, reason: "" });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Session operations"
        title={session.title}
        description={`${lesson.title} · ${formatDate(session.startAt, state.ui.timeZone, state.ui.language)}`}
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate(`${basePath}/scheduling`)}><ArrowLeft size={16} /> 返回排课</Button>
            <Button variant="secondary" onClick={() => navigate(`${basePath}/scheduling?edit=${session.id}`)}><Pencil size={16} /> 编辑课次</Button>
            <Button variant="danger" onClick={() => setCancelOpen(true)}><XCircle size={16} /> 取消课堂</Button>
          </>
        }
      />

      <section className="operator-session-summary">
        <div className="session-summary-icon" style={{ background: `${lesson.color}20`, color: lesson.color }}>{lesson.coverEmoji}</div>
        <div className="session-summary-main">
          <div className="session-topline">
            <Badge tone="mint">已发布</Badge>
            {session.source === "series" && <Badge tone="blue">系列班</Badge>}
            <span>{booked}/{session.capacity} 已预约</span>
          </div>
          <h2>{lesson.title}</h2>
          <p>{lesson.description}</p>
          <div className="session-meta">
            <span><GraduationCap size={15} /> {session.className}</span>
            <span><CalendarClock size={15} /> {formatRange(session.startAt, session.endAt, state.ui.timeZone, state.ui.language)}</span>
            <span><MapPin size={15} /> {session.roomLabel}</span>
            <span><UsersRound size={15} /> {waitlist.length} 人候补</span>
          </div>
        </div>
        <div className="capacity-ring">
          <strong>{Math.round((booked / session.capacity) * 100)}%</strong>
          <span>已满</span>
          <ProgressBar value={(booked / session.capacity) * 100} tone={booked >= session.capacity ? "orange" : "purple"} />
        </div>
      </section>

      <div className="dashboard-columns operator-detail-layout">
        <Card className="roster-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">Bookings</span>
              <h2>预约名单</h2>
              <p>{academic ? "学校教务可以为本校学生代约、改约或取消，并留下操作原因。" : "教学管理可以代学生预约、改约或取消，并留下操作原因。"}</p>
            </div>
            <Button onClick={() => setProxyOpen(true)}><Plus size={16} /> {t("operator.forceBook")}</Button>
          </div>
          <div className="roster-list">
            {bookings.map((booking) => {
              const student = getUser(state, booking.studentId);
              const profile = getStudent(state, booking.studentId);
              if (!student || !profile) return null;
              return (
                <article className="roster-row" key={booking.id}>
                  <Avatar label={student.avatar} tone="purple" />
                  <div><strong>{student.name}</strong><small>{profile.level} · {student.timeZone}</small></div>
                  <SourceBadge source={booking.source} />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const reasonText = window.prompt("请输入代取消原因");
                      if (reasonText) run(() => platform.cancelBooking({ bookingId: booking.id, actorId: user.id, force: true, reason: reasonText }), t("operator.proxyCancelled"));
                    }}
                  >
                    代取消
                  </Button>
                </article>
              );
            })}
            {bookings.length === 0 && <EmptyState title="暂无预约学生" />}
          </div>
        </Card>

        <Card className="waitlist-manager-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">Waitlist</span>
              <h2>候补队列</h2>
            </div>
            <Badge tone="blue">{waitlist.length}</Badge>
          </div>
          <div className="waitlist-manager-list">
            {waitlist.map((entry, index) => {
              const student = getUser(state, entry.studentId);
              return (
                <article key={entry.id}>
                  <span className="waitlist-rank">{index + 1}</span>
                  {student && <Avatar label={student.avatar} size="sm" tone="purple" />}
                  <div><strong>{student?.name}</strong><small>加入于 {formatDate(entry.createdAt, state.ui.timeZone, state.ui.language)}</small></div>
                  <Badge tone={index === 0 ? "mint" : "neutral"}>{index === 0 ? "下一位" : "等待中"}</Badge>
                </article>
              );
            })}
            {waitlist.length === 0 && <p className="muted-copy">当前没有学生候补。</p>}
          </div>
        </Card>
      </div>

      <Card className="session-timeline-card">
        <div className="card-heading">
          <div><span className="eyebrow">Policy</span><h2>预约与取消规则</h2></div>
          <Clock3 size={20} />
        </div>
        <div className="policy-grid">
          <div><span>预约截止</span><strong>{formatDate(session.bookingCloseAt, state.ui.timeZone, state.ui.language)}</strong></div>
          <div><span>学生取消截止</span><strong>{formatDate(session.cancelCloseAt, state.ui.timeZone, state.ui.language)}</strong></div>
          <div><span>候补转正</span><strong>释放空位后自动转正</strong></div>
          <div><span>预约占用</span><strong>{booked} / {session.capacity}</strong></div>
        </div>
      </Card>

      <Modal
        open={proxyOpen}
        title={t("operator.forceBook")}
        onClose={() => setProxyOpen(false)}
        footer={<div className="modal-footer-split"><small>{t("operator.forceHint")}</small><div><Button variant="ghost" onClick={() => setProxyOpen(false)}>取消</Button><Button onClick={proxyBook}>确认代约</Button></div></div>}
      >
        <div className="editor-grid">
          <Field label="选择学生" className="field-span-2">
            <Select value={proxyForm.studentId} onChange={(event) => setProxyForm((value) => ({ ...value, studentId: event.target.value }))}>
              <option value="">请选择学生</option>
              {state.students.map((profile) => {
                const student = getUser(state, profile.userId);
                return <option key={profile.userId} value={profile.userId}>{student?.name} · {profile.level}</option>;
              })}
            </Select>
          </Field>
          <label className="inline-check field-span-2">
            <input type="checkbox" checked={proxyForm.force} onChange={(event) => setProxyForm((value) => ({ ...value, force: event.target.checked }))} />
            强制预约：允许超容量或时间冲突
          </label>
          {proxyForm.force && (
            <Field label={t("common.reason")} className="field-span-2">
              <textarea className="input textarea" value={proxyForm.reason} onChange={(event) => setProxyForm((value) => ({ ...value, reason: event.target.value }))} placeholder="请填写客服记录或业务原因" />
            </Field>
          )}
        </div>
      </Modal>

      <Modal
        open={cancelOpen}
        title="取消课堂"
        onClose={() => setCancelOpen(false)}
        footer={<div className="modal-footer-split"><small>所有已预约学生都会收到通知</small><div><Button variant="ghost" onClick={() => setCancelOpen(false)}>返回</Button><Button variant="danger" onClick={() => {
          const result = run(() => platform.cancelSession({ sessionId: session.id, actorId: user.id, reason }), "课堂已取消");
          if (result.ok) setCancelOpen(false);
        }}>确认取消</Button></div></div>}
      >
        <Field label="取消原因">
          <textarea className="input textarea" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="必填，将展示给学生" />
        </Field>
      </Modal>

    </>
  );
}
