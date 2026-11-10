import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BarChart3, CalendarClock, ChevronRight, Clock3, GraduationCap, MapPin, Search, TrendingUp, UserRound, UsersRound } from "lucide-react";
import { usePlatformStore } from "../../store/usePlatformStore";
import { currentUser, getTeacherSessions, getUser, sessionRuntimeStatus } from "../../lib/domain";
import { getAcademicSchoolId, workspaceState } from "../../lib/academicScope";
import { buildClassAnalytics, type ClassAnalytics, type ClassContentRow, type ClassContentStudent } from "../../lib/classAnalytics";
import { formatDateTime, formatRange } from "../../lib/format";
import { Avatar, Badge, Card, EmptyState, Modal, PageHeader, ProgressBar, Select, StatCard, TextInput } from "../../components/ui";
import { PmNote } from "../../components/PmNote";
import type { ClassSession, Phase, PlatformState } from "../../domain/types";

const statusMeta = {
  good: { labelKey: "results.legendGood", tone: "mint" as const },
  ok: { labelKey: "results.legendOk", tone: "blue" as const },
  weak: { labelKey: "results.legendWeak", tone: "orange" as const }
};

const phaseRank: Record<Phase, number> = { preview: 0, live: 1, review: 2 };

interface StudentItem {
  id: string;
  kind: ClassContentRow["kind"];
  title: string;
  phase: Phase;
  detail: string;
  actionLabel: string;
  done: boolean;
  minutes: number;
  completedAt: string;
}

interface StudentDetailRow {
  studentId: string;
  name: string;
  avatar: string;
  level: string;
  className: string;
  doneCount: number;
  total: number;
  minutes: number;
  lastAt: string;
  items: StudentItem[];
}

/** 从内容维度翻转成学生维度：每个学生完成了哪些项、用了多久。 */
function buildStudentRows(analytics: ClassAnalytics): StudentDetailRow[] {
  const map = new Map<string, StudentDetailRow>();
  analytics.rows.forEach((row) => {
    row.students.forEach((student: ClassContentStudent) => {
      const entry = map.get(student.studentId) ?? {
        studentId: student.studentId,
        name: student.name,
        avatar: student.avatar,
        level: student.level,
        className: student.className,
        doneCount: 0,
        total: 0,
        minutes: 0,
        lastAt: "",
        items: []
      };
      entry.total += 1;
      if (student.done) {
        entry.doneCount += 1;
        entry.minutes += student.minutes;
        if (student.completedAt > entry.lastAt) entry.lastAt = student.completedAt;
      }
      entry.items.push({
        id: row.id,
        kind: row.kind,
        title: row.title,
        phase: row.phase,
        detail: row.detail,
        actionLabel: row.actionLabel,
        done: student.done,
        minutes: student.minutes,
        completedAt: student.completedAt
      });
      map.set(student.studentId, entry);
    });
  });
  return [...map.values()]
    .map((row) => ({ ...row, items: [...row.items].sort((a, b) => phaseRank[a.phase] - phaseRank[b.phase] || a.title.localeCompare(b.title)) }))
    .sort((a, b) => b.doneCount / (b.total || 1) - a.doneCount / (a.total || 1) || b.minutes - a.minutes);
}

type ResultsVariant = "teacher" | "academic" | "student";

export function ResultsWorkspace({
  state,
  sessions: sourceSessions,
  variant,
  schoolName
}: {
  state: PlatformState;
  sessions: ClassSession[];
  variant: ResultsVariant;
  schoolName?: string;
}) {
  const academic = variant === "academic";
  const student = variant === "student";
  const { t } = useTranslation();
  // 首页「最近课程结果」等入口可以带 ?sessionId= 直接切到对应课次。
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedSessionId, setSelectedSessionId] = useState<string>(() => searchParams.get("sessionId") ?? "");
  const [sessionQuery, setSessionQuery] = useState("");
  const [sessionTimeRange, setSessionTimeRange] = useState<"all" | "today" | "7d" | "30d">("all");
  const [view, setView] = useState<"class" | "students">("class");
  const [drilldown, setDrilldown] = useState<ClassContentRow | null>(null);
  const [studentDetail, setStudentDetail] = useState<StudentDetailRow | null>(null);

  // 课程结果只展示老师已经结束的课次，并按上课时间从近到远排列。
  const completedSessions = useMemo(
    () =>
      sourceSessions
        .filter((session) => sessionRuntimeStatus(session) === "ended")
        .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()),
    [sourceSessions]
  );

  useEffect(() => {
    if (completedSessions.length === 0) {
      if (selectedSessionId) setSelectedSessionId("");
      return;
    }
    if (selectedSessionId && completedSessions.some((session) => session.id === selectedSessionId)) return;
    setSelectedSessionId(completedSessions[0].id);
  }, [completedSessions, selectedSessionId]);

  // 带上来的 sessionId 用完就清掉，避免地址栏残留影响后续切换。
  useEffect(() => {
    if (!searchParams.get("sessionId")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("sessionId");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const visibleSessions = useMemo(() => {
    const now = Date.now();
    const keyword = sessionQuery.trim().toLowerCase();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const minStartAt =
      sessionTimeRange === "today"
        ? startOfToday.getTime()
        : sessionTimeRange === "7d"
          ? now - 7 * 24 * 60 * 60 * 1000
          : sessionTimeRange === "30d"
            ? now - 30 * 24 * 60 * 60 * 1000
            : Number.NEGATIVE_INFINITY;
    return completedSessions.filter((item) => {
      const startAt = new Date(item.startAt).getTime();
      const matchesTime = startAt >= minStartAt;
      const teacher = getUser(state, item.teacherId);
      const searchText = `${item.title} ${item.className} ${teacher?.name ?? ""} ${item.roomLabel} ${formatDateTime(item.startAt, state.ui.timeZone, state.ui.language)}`.toLowerCase();
      return matchesTime && (!keyword || searchText.includes(keyword));
    });
  }, [completedSessions, sessionQuery, sessionTimeRange, state.ui.language, state.ui.timeZone]);

  useEffect(() => {
    if (visibleSessions.length === 0) return;
    if (visibleSessions.some((item) => item.id === selectedSessionId)) return;
    setSelectedSessionId(visibleSessions[0].id);
  }, [selectedSessionId, visibleSessions]);

  const session = completedSessions.find((item) => item.id === selectedSessionId) ?? completedSessions[0];
  const analytics = useMemo(() => (session ? buildClassAnalytics(state, session) : null), [state, session]);
  const studentRows = useMemo(() => (analytics ? buildStudentRows(analytics) : []), [analytics]);
  const phaseLabel = (phase: Phase) =>
    phase === "preview" ? t("results.phasePreviewShort") : phase === "live" ? t("results.phaseLiveShort") : t("results.phaseReviewShort");
  const phaseGroupLabel = (phase: Phase) =>
    phase === "preview" ? t("results.phasePreview") : phase === "live" ? t("results.phaseLive") : t("results.phaseReview");
  const actionText = (label: string) => {
    if (label === "完成") return t("results.actionComplete");
    if (label === "播放") return t("results.actionPlay");
    if (label === "查看") return t("results.actionView");
    if (label === "下载") return t("results.actionDownload");
    return label;
  };
  const detailText = (kind: ClassContentRow["kind"], detail: string) =>
    kind === "interaction"
      ? t("results.questionCount", { count: Number(detail.match(/\d+/)?.[0] ?? 0) })
      : detail.replace("外链", t("results.externalLink"));
  const pageTitle = academic || student ? t("results.titlePerformance") : t("results.titleTeacher");
  const pageDescription = student
    ? t("results.descStudent")
    : academic
      ? t("results.descAcademic", { school: schoolName ?? t("results.schoolFallback") })
      : t("results.descTeacher");
  const pageActions = student
    ? <Badge tone="blue">{t("results.badgeStudent")}</Badge>
    : academic
      ? <Badge tone="mint">{t("results.badgeAcademic")}</Badge>
      : undefined;

  if (!session || !analytics) {
    return (
      <>
        <PageHeader eyebrow={academic || student ? "Class performance" : "Class analytics"} title={pageTitle} description={pageDescription} actions={pageActions} />
        <EmptyState
          title={student ? t("results.emptyStudentTitle") : academic ? t("results.emptyAcademicTitle") : t("results.emptyTeacherTitle")}
          description={student ? t("results.emptyStudentDesc") : academic ? t("results.emptyAcademicDesc") : t("results.emptyTeacherDesc")}
        />
      </>
    );
  }

  const participation = analytics.rosterSize ? Math.round((analytics.reachedStudents / analytics.rosterSize) * 100) : 0;
  const teacher = getUser(state, session.teacherId);
  const highlightStudentId = student ? currentUser(state).id : undefined;
  const displayName = (studentId: string, name: string) => (studentId === highlightStudentId ? `${name}${t("results.meSuffix")}` : name);
  const drilldownAction = drilldown ? actionText(drilldown.actionLabel) : "";

  return (
    <>
      <PageHeader
        eyebrow={academic || student ? "Class performance" : "Class analytics"}
        title={pageTitle}
        description={pageDescription}
        actions={pageActions}
      />

      <div className="analytics-layout">
        <aside className="analytics-session-nav">
          <div className="analytics-session-filters">
            <div className="search-box">
              <Search size={15} />
              <TextInput
                value={sessionQuery}
                onChange={(event) => setSessionQuery(event.target.value)}
                placeholder={academic ? t("results.searchAcademic") : student ? t("results.searchStudent") : t("results.searchTeacher")}
                aria-label={t("results.searchAria")}
              />
            </div>
            <Select
              value={sessionTimeRange}
              onChange={(event) => setSessionTimeRange(event.target.value as "all" | "today" | "7d" | "30d")}
              aria-label={t("results.timeFilterAria")}
            >
              <option value="all">{t("results.timeAll")}</option>
              <option value="today">{t("results.timeToday")}</option>
              <option value="7d">{t("results.time7d")}</option>
              <option value="30d">{t("results.time30d")}</option>
            </Select>
          </div>
          <div className="analytics-session-list">
            {visibleSessions.map((item) => {
              const itemAnalytics = buildClassAnalytics(state, item);
              const itemTeacher = getUser(state, item.teacherId);
              return (
                <button
                  key={item.id}
                  className={item.id === session.id ? "active" : ""}
                  onClick={() => setSelectedSessionId(item.id)}
                >
                  <span className="nav-session-date">
                    <span>{formatDateTime(item.startAt, state.ui.timeZone, state.ui.language)}</span>
                    <span className="nav-session-room">· {item.roomLabel}</span>
                  </span>
                  <strong>{item.title}</strong>
                  <small>
                    {academic && `${item.className}${itemTeacher ? ` · ${itemTeacher.name}` : ""} · `}
                    {student && `${item.className} · `}
                    {t("results.rosterCount", { count: itemAnalytics.rosterSize })}
                    {!itemAnalytics.totalActions && ` · ${t("results.noRecord")}`}
                  </small>
                </button>
              );
            })}
            {visibleSessions.length === 0 && <p className="analytics-session-empty">{t("results.noMatch")}</p>}
          </div>
        </aside>

        <div className="analytics-detail">
          <Card className="analytics-session-head">
            <div>
              <h2>{session.title}</h2>
              <div className="session-meta">
                <span><GraduationCap size={15} /> {session.className}</span>
                {academic && teacher && <span><UserRound size={15} /> {teacher.name}</span>}
                <span><CalendarClock size={15} /> {formatRange(session.startAt, session.endAt, state.ui.timeZone, state.ui.language)}</span>
                <span><MapPin size={15} /> {session.roomLabel}</span>
                <span><UsersRound size={15} /> {t("results.classSize", { count: analytics.rosterSize })}</span>
              </div>
            </div>
          </Card>

          <section className="stat-grid stat-grid-4">
            <StatCard
              label={t("results.reachedLabel")}
              value={`${analytics.reachedStudents}/${analytics.rosterSize}`}
              detail={t("results.participation", { rate: participation })}
              icon={<UsersRound size={20} />}
              tone="blue"
              progress={participation}
            />
            <PmNote block kind="口径" note="先计算每个互动或材料的完成率，再取全部内容平均值。">
              <StatCard
                label={t("results.averageRateLabel")}
                value={`${analytics.averageRate}%`}
                detail={t("results.averageRateDetail", { rows: analytics.rows.length, good: analytics.goodCount })}
                icon={<TrendingUp size={20} />}
                tone="orange"
                progress={analytics.averageRate}
              />
            </PmNote>
            <PmNote block kind="口径" note="平均完成用时只统计已完成该项内容的学生。">
              <StatCard
                label={t("results.averageTimeLabel")}
                value={analytics.totalActions ? t("results.minutes", { count: analytics.averageMinutes }) : "--"}
                detail={t("results.averageTimeDetail")}
                icon={<BarChart3 size={20} />}
                tone="purple"
              />
            </PmNote>
            <StatCard
              label={t("results.totalStudyLabel")}
              value={t("results.minutes", { count: analytics.totalMinutes })}
              detail={t("results.totalStudyDetail")}
              icon={<Clock3 size={20} />}
              tone="mint"
            />
          </section>

          <div className="section-heading-row">
            <div>
              <span className="eyebrow">Class completion</span>
              <h2>{view === "class" ? t("results.classCompletion") : t("results.studentCompletion")}</h2>
            </div>
            <PmNote kind="流程" note="按内容看全班适合定位薄弱环节；按学生看个人适合跟进个体完成情况。">
              <div className="analytics-view-switch">
              <div className="scope-choice">
                <button className={view === "class" ? "active" : ""} onClick={() => setView("class")}>{t("results.viewClass")}</button>
                <button className={view === "students" ? "active" : ""} onClick={() => setView("students")}>{t("results.viewStudents")}</button>
              </div>
              </div>
            </PmNote>
          </div>

          {view === "class" ? (
            <Card className="class-completion-card">
              <div className="class-completion-head">
                <div>
                  <strong>
                    {t("results.classSummary", {
                      students: analytics.rosterSize,
                      rows: analytics.rows.length,
                      interactions: analytics.interactionCount,
                      materials: analytics.materialCount
                    })}
                  </strong>
                  <small>
                    {t("results.classSummaryHint", { good: analytics.goodCount, weak: analytics.weakCount })}
                  </small>
                </div>
                <PmNote kind="口径" note="完成率达到 85% 为完成较好，达到 60% 为基本完成。">
                  <div className="class-legend">
                    <span><i className="legend-dot dot-good" />{t("results.legendGood")}</span>
                    <span><i className="legend-dot dot-ok" />{t("results.legendOk")}</span>
                    <span><i className="legend-dot dot-weak" />{t("results.legendWeak")}</span>
                  </div>
                </PmNote>
              </div>

              <PmNote block kind="流程" note="点击任意内容可下钻查看每位学生的完成状态和用时。">
                <div className="class-section-list">
                {(["preview", "live", "review"] as Phase[]).map((phase) => {
                  const group = analytics.rows.filter((row) => row.phase === phase);
                  if (group.length === 0) return null;
                  return (
                    <Fragment key={phase}>
                      <div className="class-phase-divider">
                        <span>{phaseGroupLabel(phase)}</span>
                        <i />
                        <small>{t("results.itemCount", { count: group.length })}</small>
                      </div>
                      {group.map((row) => {
                        const meta = statusMeta[row.status];
                        return (
                          <button className="class-section-row" key={`${row.kind}-${row.id}`} onClick={() => setDrilldown(row)}>
                            <span className={`phase-badge phase-${row.phase}`}>{phaseLabel(row.phase)}</span>
                            <span className="class-section-name">
                              <strong>{row.title}</strong>
                              <small>
                                <i className={`content-kind kind-${row.kind}`}>{row.kind === "interaction" ? t("results.kindInteraction") : t("results.kindMaterial")}</i>
                                {detailText(row.kind, row.detail)}
                              </small>
                            </span>
                            <span className="class-section-progress">
                              <ProgressBar value={row.rate} tone={row.status === "weak" ? "orange" : "mint"} />
                              <small>{t("results.rowProgress", { done: row.doneCount, total: row.total, action: actionText(row.actionLabel), rate: Math.round(row.rate) })}</small>
                            </span>
                            <span className="class-section-score">
                              <strong>{row.averageMinutes ? `${row.averageMinutes}′` : "--"}</strong>
                              <small>{t("results.averageTimeShort")}</small>
                            </span>
                            <Badge tone={meta.tone}>{t(meta.labelKey)}</Badge>
                            <ChevronRight size={16} className="class-section-arrow" />
                          </button>
                        );
                      })}
                    </Fragment>
                  );
                })}
                {analytics.rows.length === 0 && (
                  <EmptyState title={t("results.noContentTitle")} description={t("results.noContentDesc")} />
                )}
                </div>
              </PmNote>
            </Card>
          ) : (
            <Card className="class-completion-card">
                <PmNote block kind="口径" note="互动按有效提交去重，材料按查看、播放或下载去重。按完成比例排序，累计用时只计算已完成内容。">
                  <div className="class-completion-head">
                  <div>
                    <strong>{t("results.studentSummaryHead", { students: studentRows.length, rows: analytics.rows.length })}</strong>
                    <small>{t("results.studentSummaryHint")}</small>
                  </div>
                  </div>
                </PmNote>

              <PmNote block kind="流程" note="点击任意学生可查看其完成的每一项内容、用时和最近记录。">
                <div className="class-section-list">
                {studentRows.map((row) => {
                  const rate = row.total ? (row.doneCount / row.total) * 100 : 0;
                  const status = rate >= 85 ? "good" : rate >= 60 ? "ok" : "weak";
                  const meta = statusMeta[status];
                  return (
                    <button className="student-progress-row" key={row.studentId} onClick={() => setStudentDetail(row)}>
                      <Avatar label={row.avatar} tone={rate >= 85 ? "purple" : "orange"} />
                      <span className="class-section-name">
                        <strong>{displayName(row.studentId, row.name)} · {row.level}</strong>
                        <small>{t("results.className", { name: row.className })}</small>
                      </span>
                      <span className="class-section-progress">
                        <ProgressBar value={rate} tone={status === "weak" ? "orange" : "mint"} />
                        <small>{t("results.itemProgress", { done: row.doneCount, total: row.total, rate: Math.round(rate) })}</small>
                      </span>
                      <span className="class-section-score">
                        <strong>{row.minutes ? `${row.minutes}′` : "--"}</strong>
                        <small>{t("results.totalTime")}</small>
                      </span>
                      <Badge tone={meta.tone}>{t(meta.labelKey)}</Badge>
                      <ChevronRight size={16} className="class-section-arrow" />
                    </button>
                  );
                })}
                {studentRows.length === 0 && (
                  <EmptyState title={t("results.noStudentsTitle")} description={t("results.noStudentsDesc")} />
                )}
                </div>
              </PmNote>
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(drilldown)}
        title={drilldown ? t("results.drillTitle", { title: drilldown.title, action: drilldownAction }) : ""}
        onClose={() => setDrilldown(null)}
        width="820px"
        footer={
          <div className="modal-footer-split">
            <span>
              {drilldown
                ? t("results.drillFooter", {
                    action: drilldownAction,
                    done: drilldown.doneCount,
                    total: drilldown.total,
                    rate: Math.round(drilldown.rate),
                    minutes: drilldown.averageMinutes || "--"
                  })
                : ""}
            </span>
          </div>
        }
      >
        {drilldown && (
          <>
            <p className="muted-copy">
              {t("results.drillDescription", {
                kind: drilldown.kind === "interaction" ? t("results.kindInteraction") : t("results.kindMaterial"),
                detail: detailText(drilldown.kind, drilldown.detail),
                action: drilldownAction
              })}
            </p>

            <div className="class-drill-metrics">
              <div><strong>{drilldown.doneCount}/{drilldown.total}</strong><small>{t("results.metricReached", { action: drilldownAction })}</small></div>
              <div><strong>{Math.round(drilldown.rate)}%</strong><small>{t("results.metricReach")}</small></div>
              <div><strong>{drilldown.averageMinutes || "--"}</strong><small>{t("results.metricMinutes")}</small></div>
              <div><strong>{drilldown.students.filter((student) => !student.done).length}</strong><small>{t("results.metricMissing", { action: drilldownAction })}</small></div>
            </div>

            <div className="modal-section">
              <div className="roster-modal-section-head">
                <h4>{t("results.drillDetailTitle")}</h4>
              </div>
              <div className="class-drill-list">
                {[...drilldown.students]
                  .sort((a, b) => Number(b.done) - Number(a.done) || a.minutes - b.minutes)
                  .map((student) => (
                    <article className={`class-drill-row ${student.done ? "is-done" : "is-missing"}`} key={student.studentId}>
                      <Avatar label={student.avatar} tone={student.done ? "purple" : "neutral"} />
                      <div>
                        <strong>{displayName(student.studentId, student.name)} · {student.level}</strong>
                        <small>{t("results.className", { name: student.className })}</small>
                      </div>
                      <span className="class-drill-figures">
                        {student.done ? (
                          <>
                            <b>{t("results.drillMinutes", { minutes: student.minutes })}</b>
                            <small>{formatDateTime(student.completedAt, state.ui.timeZone, state.ui.language)} {drilldownAction}</small>
                          </>
                        ) : (
                          <>
                            <b>{t("results.itemMissing", { action: drilldownAction })}</b>
                            <small>{t("results.drillNoRecord")}</small>
                          </>
                        )}
                      </span>
                    </article>
                  ))}
                {drilldown.students.length === 0 && <p className="muted-copy">{t("results.drillNoStudents")}</p>}
              </div>
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={Boolean(studentDetail)}
        title={studentDetail ? t("results.studentDetailTitle", { name: displayName(studentDetail.studentId, studentDetail.name) }) : ""}
        onClose={() => setStudentDetail(null)}
        width="880px"
        footer={
          <div className="modal-footer-split">
            <span>
              {studentDetail
                ? t("results.studentDetailFooter", {
                    done: studentDetail.doneCount,
                    total: studentDetail.total,
                    minutes: studentDetail.minutes || 0,
                    last: studentDetail.lastAt
                      ? t("results.studentDetailLast", { time: formatDateTime(studentDetail.lastAt, state.ui.timeZone, state.ui.language) })
                      : ""
                  })
                : ""}
            </span>
          </div>
        }
      >
        {studentDetail && (
          <>
            <div className="class-drill-metrics">
              <div><strong>{studentDetail.doneCount}/{studentDetail.total}</strong><small>{t("results.metricDone")}</small></div>
              <div><strong>{Math.round((studentDetail.doneCount / (studentDetail.total || 1)) * 100)}%</strong><small>{t("results.metricRate")}</small></div>
              <div><strong>{studentDetail.minutes}</strong><small>{t("results.metricMinutesTotal")}</small></div>
              <div><strong>{studentDetail.total - studentDetail.doneCount}</strong><small>{t("results.metricIncomplete")}</small></div>
            </div>

            <div className="modal-section">
              <div className="roster-modal-section-head">
                <h4>
                  {t("results.studentHeading", {
                    name: displayName(studentDetail.studentId, studentDetail.name),
                    level: studentDetail.level,
                    className: studentDetail.className
                  })}
                </h4>
              </div>
              <div className="class-drill-list">
                {studentDetail.items.map((item) => (
                  <article className={`class-drill-row ${item.done ? "is-done" : "is-missing"}`} key={`${item.kind}-${item.id}`}>
                    <span className={`phase-badge phase-${item.phase}`}>{phaseLabel(item.phase)}</span>
                    <div>
                      <strong>{item.title}</strong>
                      <small>
                        <i className={`content-kind kind-${item.kind}`}>{item.kind === "interaction" ? t("results.kindInteraction") : t("results.kindMaterial")}</i>
                        {detailText(item.kind, item.detail)}
                      </small>
                    </div>
                    <span className="class-drill-figures">
                      {item.done ? (
                        <>
                          <b>{t("results.itemDone", { action: actionText(item.actionLabel), minutes: item.minutes })}</b>
                          <small>{formatDateTime(item.completedAt, state.ui.timeZone, state.ui.language)}</small>
                        </>
                      ) : (
                        <>
                          <b>{t("results.itemMissing", { action: actionText(item.actionLabel) })}</b>
                          <small>{t("results.drillNoRecord")}</small>
                        </>
                      )}
                    </span>
                  </article>
                ))}
              </div>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

export function TeacherResults() {
  const state = usePlatformStore((store) => store.state);
  const user = currentUser(state);
  const sessions = useMemo(() => getTeacherSessions(state, user.id), [state, user.id]);
  return <ResultsWorkspace state={state} sessions={sessions} variant="teacher" />;
}

export function AcademicResults() {
  const rawState = usePlatformStore((store) => store.state);
  const user = currentUser(rawState);
  const schoolId = getAcademicSchoolId(rawState, user);
  const state = useMemo(() => workspaceState(rawState, schoolId), [rawState, schoolId]);
  const sessions = useMemo(
    () => state.sessions.filter((session) => session.status === "published"),
    [state.sessions]
  );
  return (
    <ResultsWorkspace
      state={state}
      sessions={sessions}
      variant="academic"
      schoolName={state.schools[0]?.name}
    />
  );
}
