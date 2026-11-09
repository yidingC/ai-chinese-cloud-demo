import { Fragment, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays, CheckCircle2, Filter, Layers3, Search, UsersRound, X } from "lucide-react";
import { platform } from "../../lib/platform";
import { usePlatformStore } from "../../store/usePlatformStore";
import {
  currentUser,
  fillRate,
  getBookedCount,
  getLesson,
  getSession,
  getWaitlist,
  isSessionBooked,
  isSessionPendingReview,
  isSessionWaitlisted,
  materialRefAppliesToSession
} from "../../lib/domain";
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Select, Tabs, TextInput } from "../../components/ui";
import { ClassSessionCard } from "../../components/ClassSessionCard";
import { SeriesSessionDots } from "../../components/SeriesSessionDots";
import { PmNote } from "../../components/PmNote";
import type { ClassSession } from "../../domain/types";
import { MaterialCard } from "../../components/MaterialCard";
import { useMaterialAudio } from "../../lib/useMaterialAudio";
import { formatDate } from "../../lib/format";

type BookingTab = "single" | "series";

export function StudentBook() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, run } = usePlatformStore();
  const user = currentUser(state);
  const [tab, setTab] = useState<BookingTab>("single");
  const { playingId, toggle: toggleAudio } = useMaterialAudio();
  const [day, setDay] = useState("all");
  const [teacherId, setTeacherId] = useState("all");
  const [folderId, setFolderId] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [bookingFeedback, setBookingFeedback] = useState<string | null>(null);

  const upcomingSessions = state.sessions
    .filter((session) => session.status === "published" && new Date(session.endAt).getTime() > Date.now())
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const dayOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ value: string; label: string; sub: string }> = [];
    upcomingSessions.forEach((session) => {
      const value = new Date(session.startAt).toDateString();
      if (seen.has(value)) return;
      seen.add(value);
      const date = new Date(session.startAt);
      options.push({
        value,
        label: new Intl.DateTimeFormat(state.ui.language, { timeZone: state.ui.timeZone, weekday: "short" }).format(date),
        sub: new Intl.DateTimeFormat(state.ui.language, { timeZone: state.ui.timeZone, month: "numeric", day: "numeric" }).format(date)
      });
    });
    return options.slice(0, 8);
  }, [state.ui.language, state.ui.timeZone, upcomingSessions]);

  const filteredSessions = upcomingSessions.filter((session) => {
    if (session.source !== "single") return false;
    const lesson = getLesson(state, session.lessonId);
    const matchesDay = day === "all" || new Date(session.startAt).toDateString() === day;
    const matchesTeacher = teacherId === "all" || session.teacherId === teacherId;
    const matchesFolder = folderId === "all" || lesson?.folderId === folderId;
    const matchesQuery = !query || session.title.toLowerCase().includes(query.toLowerCase()) || session.className.toLowerCase().includes(query.toLowerCase()) || lesson?.title.toLowerCase().includes(query.toLowerCase());
    return matchesDay && matchesTeacher && matchesFolder && matchesQuery;
  });

  const seriesList = state.series.filter((series) => series.status === "published");
  const selectedSession = selectedSessionId ? getSession(state, selectedSessionId) : undefined;
  const selectedLesson = selectedSession ? getLesson(state, selectedSession.lessonId) : undefined;

  function bookSession(sessionId: string) {
    const session = getSession(state, sessionId);
    const successMessage = session?.approvalRequired
      ? t("student.bookingPendingReviewSuccess")
      : t("student.bookingSuccess");
    const result = run(
      () => platform.bookSession({ studentId: user.id, sessionId }),
      successMessage
    );
    if (result.ok) setBookingFeedback(successMessage);
    if (result.code === "SESSION_FULL") {
      run(() => platform.joinWaitlist({ studentId: user.id, sessionId }), t("student.waitlistSuccess"));
    }
  }

  function actionForSession(sessionId: string) {
    if (isSessionBooked(state, user.id, sessionId)) {
      return <Badge tone="mint">{t("student.bookedAlready")}</Badge>;
    }
    if (isSessionPendingReview(state, user.id, sessionId)) {
      return <Badge tone="orange">{t("student.pendingReview")}</Badge>;
    }
    if (isSessionWaitlisted(state, user.id, sessionId)) {
      const entry = state.waitlist.find((item) => item.studentId === user.id && item.status === "waiting" && (item.sessionId === sessionId || item.sessionIds.includes(sessionId)));
      return (
        <Button
          variant="secondary"
          onClick={() => entry && run(() => platform.leaveWaitlist({ waitlistId: entry.id }), "已退出候补")}
        >
          {t("student.waitlisted")}
        </Button>
      );
    }
    const session = getSession(state, sessionId);
    const full = session ? getBookedCount(state, sessionId) >= session.capacity : false;
    return (
      <Button variant={full ? "secondary" : "primary"} onClick={() => bookSession(sessionId)}>
        {full ? t("student.joinWaitlist") : t("student.bookNow")}
      </Button>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Booking center"
        title={t("student.bookTitle")}
        description={t("student.bookSubtitle")}
      />

      {bookingFeedback && (
        <div className="booking-feedback" role="status">
          <CheckCircle2 size={18} />
          <span>{bookingFeedback}</span>
          <button type="button" aria-label="关闭报名提示" onClick={() => setBookingFeedback(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      <PmNote block kind="规则" note="单次班按一节课报名；系列班必须整套报名、整套候补。">
        <Card className="booking-filter-card">
        <div className="booking-tabs-row">
          <PmNote kind="规则" note="课分两种，一种是单次的，一种是一个系列的，即一套课程有很多节课。">
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { value: "single", label: t("student.single"), count: upcomingSessions.length },
                { value: "series", label: t("student.series"), count: seriesList.length }
              ]}
            />
          </PmNote>
          <div className="search-box">
            <Search size={17} />
            <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索课节、主题或教师" />
          </div>
        </div>

        {tab === "single" && (
          <>
            <div className="date-ribbon">
              <button className={day === "all" ? "active" : ""} onClick={() => setDay("all")}>
                <CalendarDays size={17} />
                <strong>全部</strong>
                <small>未来课程</small>
              </button>
              {dayOptions.map((option) => (
                <button key={option.value} className={day === option.value ? "active" : ""} onClick={() => setDay(option.value)}>
                  <strong>{option.label}</strong>
                  <small>{option.sub}</small>
                </button>
              ))}
            </div>
            <div className="inline-filters">
              <Field label="课程">
                <Select value={folderId} onChange={(event) => setFolderId(event.target.value)}>
                  <option value="all">全部课程</option>
                  {state.folders.filter((folder) => folder.status === "published").map((folder) => (
                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="教师">
                <Select value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
                  <option value="all">全部教师</option>
                  {state.users.filter((item) => item.role === "teacher").map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                  ))}
                </Select>
              </Field>
              <div className="filter-note">
                <Filter size={16} />
                <span>{filteredSessions.length} 个匹配班次</span>
              </div>
            </div>
          </>
        )}
        </Card>
      </PmNote>

      {tab === "single" ? (
        <PmNote block kind="流程" note="详情查看时间与预习材料；满员时加入候补。需审核班次报名后显示「待审核」，审核通过后才加入班级。">
          <div className="session-list">
          {filteredSessions.map((session) => {
            const remaining = Math.max(0, session.capacity - getBookedCount(state, session.id));
            const waitlist = getWaitlist(state, session.id).length;
            const pendingReview = isSessionPendingReview(state, user.id, session.id);
            const card = (
              <ClassSessionCard
                state={state}
                session={session}
                actions={
                  <>
                    <Button variant="ghost" onClick={() => setSelectedSessionId(session.id)}>
                      {t("common.details")}
                    </Button>
                    {actionForSession(session.id)}
                    <span className="action-caption">
                      {pendingReview
                        ? t("student.pendingReviewHint")
                        : remaining > 0
                          ? `${remaining} 个余位`
                          : `${waitlist} 人候补`}
                    </span>
                  </>
                }
              />
            );
            return session.id === "session-preview" ? (
              <PmNote
                key={session.id}
                block
                kind="口径"
                note="一门课至少包含：系列课的系列名、本节课的课名、一句话简介、上课时间、地点、班级人数和主讲老师。"
              >
                {card}
              </PmNote>
            ) : (
              <Fragment key={session.id}>{card}</Fragment>
            );
          })}
          {filteredSessions.length === 0 && <EmptyState title="没有匹配的班次" description="换一个日期或清空筛选条件再试试。" />}
          </div>
        </PmNote>
      ) : (
        <PmNote block kind="注意" note="系列班任一次课满员时整套进入候补；有名额后按排队顺序统一转正。">
          <div className="series-grid">
          {seriesList.map((series) => {
            const sessions = series.sessionIds
              .map((id) => getSession(state, id))
              .filter((session): session is ClassSession => Boolean(session));
            const enrolled = sessions.some((session) => session && isSessionBooked(state, user.id, session.id));
            const waitlisted = sessions.some((session) => session && isSessionWaitlisted(state, user.id, session.id));
            const full = sessions.some((session) => session && getBookedCount(state, session.id) >= session.capacity);
            const lesson = getLesson(state, series.lessonId);
            return (
              <Card className="series-card" key={series.id}>
                <div className="series-cover" style={{ background: `linear-gradient(145deg, ${lesson?.color ?? "#6552ff"}, #f3efff)` }}>
                  <span>{lesson?.coverEmoji ?? "📚"}</span>
                  <Badge tone="purple">
                    {t("student.lessonCount", { count: series.lessonIds.length })} · {t("student.sessionCount", { count: series.sessionIds.length })}
                  </Badge>
                </div>
                <div className="series-body">
                  <h2>{series.title}</h2>
                  <p>{series.description}</p>
                  <p className="series-lesson-chain">
                    {series.lessonIds.map((lessonId) => getLesson(state, lessonId)?.title).filter(Boolean).join(" → ")}
                  </p>
                  <div className="series-meta">
                    <span>
                      <Layers3 size={16} /> {formatDate(sessions[0]?.startAt ?? series.createdAt, state.ui.timeZone, state.ui.language)}
                    </span>
                    <span>
                      <UsersRound size={16} /> {series.capacity} 人 · {Math.round(fillRate(state, sessions[0]!))}% 已满
                    </span>
                  </div>
                  <p className="series-dates-note">{t("student.seriesDatesNote")}</p>
                  <SeriesSessionDots
                    sessions={sessions}
                    renderSession={(session) => (
                      <button key={session.id} onClick={() => setSelectedSessionId(session.id)}>
                        <strong>{new Intl.DateTimeFormat(state.ui.language, { timeZone: state.ui.timeZone, day: "2-digit" }).format(new Date(session.startAt))}</strong>
                        <small>{new Intl.DateTimeFormat(state.ui.language, { timeZone: state.ui.timeZone, month: "short" }).format(new Date(session.startAt))}</small>
                      </button>
                    )}
                  />
                  {enrolled ? (
                    <Badge tone="mint">{t("student.bookedAlready")}</Badge>
                  ) : (
                    <Button
                      disabled={waitlisted}
                      variant={waitlisted || full ? "secondary" : "primary"}
                      onClick={() =>
                        run(
                          () => platform.enrollSeries({ studentId: user.id, seriesId: series.id, joinAsWaitlist: full }),
                          full ? t("student.waitlistSuccess") : "系列班报名成功"
                        )
                      }
                    >
                      {waitlisted ? t("student.waitlisted") : full ? t("student.joinWaitlist") : t("student.enroll")}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
          </div>
        </PmNote>
      )}

      <Modal
        open={Boolean(selectedSession)}
        title={selectedSession?.title ?? t("common.details")}
        onClose={() => setSelectedSessionId(null)}
        width="720px"
      >
        {selectedSession && selectedLesson && (
          <div className="session-detail-modal">
            <div className="session-detail-hero" style={{ background: `linear-gradient(135deg, ${selectedLesson.color}, #ffffff)` }}>
              <span>{selectedLesson.coverEmoji}</span>
              <div>
                <Badge tone="purple">{selectedLesson.title}</Badge>
                <h3>{selectedLesson.description}</h3>
                <p>{selectedLesson.subtitle}</p>
              </div>
            </div>
            <PmNote block kind="口径" note="时间按当前学生时区显示，预约人数只统计有效预约。超过预约截止后不能再报名。">
              <div className="detail-grid">
                <div><small>上课时间</small><strong>{formatDate(selectedSession.startAt, state.ui.timeZone, state.ui.language)}</strong></div>
                <div><small>当地时区</small><strong>{state.ui.timeZone}</strong></div>
                <div><small>已预约</small><strong>{getBookedCount(state, selectedSession.id)} / {selectedSession.capacity}</strong></div>
                <div><small>预约截止</small><strong>{formatDate(selectedSession.bookingCloseAt, state.ui.timeZone, state.ui.language)}</strong></div>
                {selectedSession.approvalRequired && <div><small>报名方式</small><strong>提交后需教学管理审核</strong></div>}
              </div>
            </PmNote>
            <section className="modal-section">
              <h4>预习材料</h4>
              <div className="material-list compact-list">
                {state.materialRefs
                  .filter((ref) => ref.lessonId === selectedLesson.id && ref.phase === "preview")
                  .filter((ref) => materialRefAppliesToSession(ref, selectedSession.id))
                  .map((ref) => state.materials.find((material) => material.id === ref.materialId))
                  .filter(Boolean)
                  .map((material) => (
                    <MaterialCard
                      key={material!.id}
                      material={material!}
                      playing={playingId === material!.id}
                      onPlay={() => toggleAudio(material!)}
                    />
                  ))}
                {state.materialRefs
                  .filter((ref) => ref.lessonId === selectedLesson.id && ref.phase === "preview")
                  .filter((ref) => materialRefAppliesToSession(ref, selectedSession.id)).length === 0 && (
                  <p className="muted-copy">{t("student.noMaterials")}</p>
                )}
              </div>
            </section>
          </div>
        )}
      </Modal>
    </>
  );
}
