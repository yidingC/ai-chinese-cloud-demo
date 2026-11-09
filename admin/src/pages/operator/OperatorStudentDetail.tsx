import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarPlus, ClipboardPlus, Globe2, Pencil, Phone, Save, Star, TrendingUp, UsersRound } from "lucide-react";
import { platform } from "../../lib/platform";
import { usePlatformStore } from "../../store/usePlatformStore";
import { currentUser, getLesson, getSession, getStudent, getUser, studentAppAccount, studentMetrics } from "../../lib/domain";
import { getAcademicSchoolId, workspaceState } from "../../lib/academicScope";
import { formatDateTime, relativeTime, timeZoneLabel } from "../../lib/format";
import type { Booking, ClassSession, PlatformUser, StudentProfile } from "../../domain/types";
import { Avatar, Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Select, StatCard, Tabs, TextInput } from "../../components/ui";
import { AssessmentCreateModal, AssessmentScoresModal } from "../../components/GradeAssessmentModal";

function operatorCourseStatus(session: ClassSession, booking?: Booking) {
  if (session.status === "cancelled" || booking?.status === "cancelled") {
    return { label: "已取消", tone: "neutral" as const };
  }
  if (booking?.status === "pending_review") {
    return { label: "待审核", tone: "orange" as const };
  }
  const now = Date.now();
  const start = new Date(session.startAt).getTime();
  const end = new Date(session.endAt).getTime();
  if (start <= now && end >= now) return { label: "进行中", tone: "mint" as const };
  if (end < now) return { label: "已结束", tone: "neutral" as const };
  return { label: "待上课", tone: "purple" as const };
}

export function OperatorStudentDetail({
  academic = false,
  basePath = "/operator"
}: {
  academic?: boolean;
  basePath?: string;
} = {}) {
  const { studentId = "" } = useParams();
  const navigate = useNavigate();
  const { state: rawState, run } = usePlatformStore();
  const operator = currentUser(rawState);
  const schoolId = academic ? getAcademicSchoolId(rawState, operator) : "";
  const state = academic ? workspaceState(rawState, schoolId) : rawState;
  const user = getUser(state, studentId);
  const profile = getStudent(state, studentId);
  const metrics = studentMetrics(state, studentId);
  const appAccount = studentAppAccount(user);
  const [tab, setTab] = useState<"bookings" | "results" | "profile">("bookings");
  const [createAssessmentOpen, setCreateAssessmentOpen] = useState(false);
  const [scoreAssessmentId, setScoreAssessmentId] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => ({
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    timeZone: user?.timeZone ?? "Asia/Jakarta",
    level: profile?.level ?? "",
    program: profile?.program ?? "",
    learningGoal: profile?.learningGoal ?? "",
    notes: profile?.notes ?? ""
  }));
  const studentClasses = state.classEnrollments
    .filter((item) => item.studentId === studentId && item.status === "active")
    .map((item) => state.classes.find((classItem) => classItem.id === item.classId))
    .filter((item) => item?.status === "active" && !["待分班", "待分配班级"].includes(item.name));
  const studentClassIds = studentClasses.map((classItem) => classItem!.id);
  const studentBookingBySession = new Map(
    state.bookings.filter((booking) => booking.studentId === studentId).map((booking) => [booking.sessionId, booking])
  );
  const operatorSessionIds = new Set([
    ...state.sessions
      .filter((session) => studentClassIds.includes(session.classId) && session.status !== "draft")
      .map((session) => session.id),
    ...studentBookingBySession.keys()
  ]);
  const operatorCourseRows = [...operatorSessionIds]
    .flatMap((sessionId) => {
      const session = getSession(state, sessionId);
      return session ? [{ session, booking: studentBookingBySession.get(sessionId) }] : [];
    })
    .sort((a, b) => {
      const now = Date.now();
      const aUpcoming = new Date(a.session.endAt).getTime() >= now;
      const bUpcoming = new Date(b.session.endAt).getTime() >= now;
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      const aStart = new Date(a.session.startAt).getTime();
      const bStart = new Date(b.session.startAt).getTime();
      return aUpcoming ? aStart - bStart : bStart - aStart;
    });
  const operatorUpcomingCourses = operatorCourseRows.filter(({ session, booking }) =>
    operatorCourseStatus(session, booking).label !== "已取消"
    && new Date(session.endAt).getTime() >= Date.now()
  );
  const studentClassSummary = studentClasses.map((classItem) => classItem!.name).join("、") || "待分班";
  const studentAssessments = academic
    ? state.assessments
      .filter((item) => item.status === "published" && item.rosterStudentIds.includes(studentId))
      .sort((a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime())
    : [];

  if (!user || !profile) return <EmptyState title="学生不存在" action={<Button onClick={() => navigate(`${basePath}/students`)}>返回学生列表</Button>} />;

  function save() {
    const result = run(
      () =>
        platform.updateStudent({
          studentId,
          patch: (academic
            ? { level: form.level, program: form.program, timeZone: form.timeZone, learningGoal: form.learningGoal, notes: form.notes }
            : {
              name: form.name,
              phone: form.phone,
              timeZone: form.timeZone,
              level: form.level,
              program: form.program
            }) as Partial<PlatformUser & StudentProfile>,
          actorId: operator.id,
          reason: academic ? "学校教务更新本校学生档案" : "教学管理更新学生档案"
        }),
      "学生档案已更新"
    );
    if (result.ok) setEditing(false);
  }

  function openEdit() {
    if (!user || !profile) return;
    setForm({
      name: user.name,
      phone: user.phone ?? "",
      timeZone: user.timeZone,
      level: profile.level,
      program: profile.program,
      learningGoal: profile.learningGoal,
      notes: profile.notes
    });
    setEditing(true);
  }

  return (
    <>
      <Button className="detail-back-button" variant="ghost" onClick={() => navigate(`${basePath}/students?tab=students`)}>
        <ArrowLeft size={18} /> 返回学生列表
      </Button>
      <PageHeader
        eyebrow="Student profile"
        title={user.name}
        description={academic
          ? `${profile.level} · ${profile.program} · ${user.timeZone}`
          : `${profile.level} · ${profile.program}`}
        actions={
          <Button onClick={openEdit}><Pencil size={16} /> 编辑档案</Button>
        }
      />

      {academic ? (
        <section className="student-profile-hero">
          <Avatar label={user.avatar} size="lg" tone="purple" />
          <div>
            <p className="profile-summary-line">{profile.learningGoal}</p>
            <div className="profile-tags">{profile.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          </div>
          <div className="profile-joined">
            <small>加入时间</small>
            <strong>{formatDateTime(profile.joinedAt, state.ui.timeZone, state.ui.language)}</strong>
            <span>{relativeTime(profile.joinedAt, state.ui.language)}</span>
          </div>
        </section>
      ) : profile.tags.length > 0 && (
        <div className="profile-tags operator-profile-tags">
          {profile.tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      )}

      {academic ? (
        <section className="stat-grid stat-grid-4">
          <StatCard label="待上课程" value={metrics.upcoming.length} detail="已预约的未来课堂" icon={<CalendarPlus size={20} />} tone="purple" />
          <StatCard label="互动完成" value={metrics.completedSetIds.size} detail={`${metrics.attempts.length} 次作答`} icon={<TrendingUp size={20} />} tone="mint" />
          <StatCard label="平均得分" value={metrics.averageScore ? Math.round(metrics.averageScore) : "--"} detail="所有互动记录" icon={<Star size={20} />} tone="orange" />
          <StatCard label="练习时长" value={`${metrics.totalStudyMinutes} 分`} detail="互动累计用时" icon={<CalendarPlus size={20} />} tone="blue" />
        </section>
      ) : (
        <section className="stat-grid stat-grid-4">
          <StatCard className="profile-fact-card" label="电话号码" value={user.phone || "未填写"} icon={<Phone size={20} />} tone="blue" />
          <StatCard className="profile-fact-card" label="时区" value={timeZoneLabel(user.timeZone)} icon={<Globe2 size={20} />} tone="purple" />
          <StatCard className="profile-fact-card profile-class-card" label="所在班级" value={`${studentClasses.length} 个班`} detail={studentClassSummary} icon={<UsersRound size={20} />} tone="orange" />
          <StatCard label="待上课程" value={operatorUpcomingCourses.length} icon={<CalendarPlus size={20} />} tone="mint" />
        </section>
      )}

      {academic ? (
        <div className="section-heading-row">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: "bookings", label: "预约记录", count: metrics.bookings.length },
              { value: "results", label: "成绩与结果", count: metrics.attempts.length + studentAssessments.length },
              { value: "profile", label: "档案信息" }
            ]}
          />
        </div>
      ) : (
        <div className="section-heading-row operator-course-heading">
          <h2>课程记录</h2>
          <span>{operatorCourseRows.length} 节</span>
        </div>
      )}

      {tab === "bookings" && (
        <Card className="student-booking-table-card">
          {academic ? (
            <div className="data-table">
              <div className="data-table-head"><span>课程</span><span>时间</span><span>来源</span><span>状态</span></div>
              {metrics.bookings.map((booking) => {
                const session = getSession(state, booking.sessionId);
                const lesson = session ? getLesson(state, session.lessonId) : undefined;
                return (
                  <div className="data-table-row" key={booking.id}>
                    <span><strong>{lesson?.title}</strong><small>{session?.title}</small></span>
                    <span>{session ? formatDateTime(session.startAt, state.ui.timeZone, state.ui.language) : "-"}</span>
                    <span><Badge tone={booking.source === "operator" || booking.source === "academic" ? "orange" : "mint"}>{booking.source === "academic" ? "学校教务代约" : booking.source === "operator" ? "教学管理代约" : "学生预约"}</Badge></span>
                    <span><Badge tone="mint">已预约</Badge></span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="data-table operator-course-table">
              <div className="data-table-head"><span>课程</span><span>时间</span><span>班级 / 教师</span><span>状态</span></div>
              {operatorCourseRows.map(({ session, booking }) => {
                const lesson = getLesson(state, session.lessonId);
                const classItem = state.classes.find((item) => item.id === session.classId);
                const teacher = getUser(state, session.teacherId);
                const status = operatorCourseStatus(session, booking);
                return (
                  <div className="data-table-row" key={session.id}>
                    <span><strong>{lesson?.title ?? session.title}</strong><small>{session.title}</small></span>
                    <span>{formatDateTime(session.startAt, state.ui.timeZone, state.ui.language)}</span>
                    <span><strong>{classItem?.name ?? session.className}</strong><small>{teacher?.name ?? "未分配教师"}</small></span>
                    <span><Badge tone={status.tone}>{status.label}</Badge></span>
                  </div>
                );
              })}
              {operatorCourseRows.length === 0 && <p className="muted-copy operator-course-empty">暂无课程记录</p>}
            </div>
          )}
        </Card>
      )}

      {academic && tab === "results" && (
        <div className="operator-grade-results">
          <Card className="operator-formal-grades">
            <div className="grade-table-heading">
              <div><h2>正式成绩</h2><p>{academic ? "学校教务可以补录或修正本校学生考核成绩，所有改动写入本校操作日志。" : "教学管理可以补录或修正学生已有的考核成绩，所有改动写入操作日志。"}</p></div>
              <Button variant="secondary" disabled={!studentClassIds.length} onClick={() => setCreateAssessmentOpen(true)}>
                <ClipboardPlus size={16} /> 新建考核
              </Button>
            </div>
            <div className="grade-record-list">
              {studentAssessments.map((assessment) => {
                const score = state.assessmentScores.find((item) => item.assessmentId === assessment.id && item.studentId === studentId);
                const classGroup = state.classes.find((item) => item.id === assessment.classId);
                return (
                  <article className="grade-record-row" key={assessment.id}>
                    <span className={`grade-record-icon category-${assessment.category}`}>{assessment.category === "homework" ? "作" : "考"}</span>
                    <div className="grade-record-main">
                      <div><strong>{assessment.title}</strong><Badge tone={assessment.category === "homework" ? "orange" : "blue"}>{assessment.category === "homework" ? "作业" : "考试"}</Badge></div>
                      <small>{classGroup?.name} · {formatDateTime(assessment.assessedAt, state.ui.timeZone, state.ui.language)} · 满分 {assessment.maxScore}</small>
                    </div>
                    <div className="grade-record-score">
                      <strong>{score?.normalizedScore ?? "--"}</strong>
                      <small>{score?.status === "graded" ? "已录入" : score?.status === "absent" ? "缺考" : score?.status === "excused" ? "免考" : "待录"}</small>
                      <Button size="sm" variant="ghost" onClick={() => setScoreAssessmentId(assessment.id)}>补录 / 修改</Button>
                    </div>
                  </article>
                );
              })}
              {studentAssessments.length === 0 && <p className="muted-copy">这位学生暂时没有正式考核记录。</p>}
            </div>
          </Card>
          <Card className="attempt-list-card">
            <div className="grade-table-heading"><div><h2>互动答题记录</h2><p>现有自动评分记录继续保留，并会参与成绩统计。</p></div></div>
            <div className="attempt-list">
              {metrics.attempts.map((attempt) => {
                const set = state.interactionSets.find((item) => item.id === attempt.setId);
                return (
                  <Card className="attempt-row" key={attempt.id}>
                    <span className={`attempt-score ${attempt.score >= 80 ? "good" : "medium"}`}>{attempt.score}</span>
                    <div><strong>{set?.title}</strong><p>{formatDateTime(attempt.completedAt, state.ui.timeZone, state.ui.language)} · {attempt.timeSpentSeconds} 秒</p></div>
                    <Badge tone={attempt.wrongItemIds.length ? "orange" : "mint"}>{attempt.wrongItemIds.length} 个错题</Badge>
                  </Card>
                );
              })}
              {metrics.attempts.length === 0 && <p className="muted-copy">暂时没有互动答题记录。</p>}
            </div>
          </Card>
        </div>
      )}

      {academic && tab === "profile" && (
        <Card className="profile-edit-card">
          <div className="profile-detail-grid">
            <div><small>联系方式</small><strong>{user.phone || "未填写"}</strong></div>
            <div><small>App 绑定</small><strong>{appAccount ? `已绑定 · ${appAccount}` : "未绑定"}</strong></div>
            <div><small>时区</small><strong>{user.timeZone}</strong></div>
            <div><small>等级</small><strong>{profile.level}</strong></div>
            <div><small>课程项目</small><strong>{profile.program}</strong></div>
            <div><small>加入时间</small><strong>{formatDateTime(profile.joinedAt, state.ui.timeZone, state.ui.language)}</strong></div>
            <div className="span-2"><small>所在班级</small><strong>{studentClassSummary}</strong></div>
            <div className="span-2"><small>学习目标</small><strong>{profile.learningGoal}</strong></div>
            {academic && <div className="span-2"><small>学校教务备注</small><strong>{profile.notes}</strong></div>}
          </div>
        </Card>
      )}

      <Modal
        open={editing}
        title="编辑学生档案"
        onClose={() => setEditing(false)}
        width="720px"
        footer={
          <div className="modal-footer-split modal-footer-end">
            <div>
              <Button variant="ghost" onClick={() => setEditing(false)}>取消</Button>
              <Button disabled={!form.name.trim()} onClick={save}><Save size={16} /> 保存档案</Button>
            </div>
          </div>
        }
      >
        <div className="editor-grid">
          <Field label="姓名"><TextInput value={form.name} disabled={academic} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} /></Field>
          <Field label="联系方式"><TextInput value={form.phone} disabled={academic} onChange={(event) => setForm((value) => ({ ...value, phone: event.target.value }))} /></Field>
          <Field label="等级"><TextInput value={form.level} onChange={(event) => setForm((value) => ({ ...value, level: event.target.value }))} /></Field>
          <Field label="时区">
            <Select value={form.timeZone} onChange={(event) => setForm((value) => ({ ...value, timeZone: event.target.value }))}>
              <option value="Asia/Jakarta">GMT+7 雅加达</option>
              <option value="Asia/Shanghai">GMT+8 上海</option>
              <option value="Asia/Singapore">GMT+8 新加坡</option>
            </Select>
          </Field>
          <Field label="课程项目" className="field-span-2"><TextInput value={form.program} onChange={(event) => setForm((value) => ({ ...value, program: event.target.value }))} /></Field>
          {academic && <Field label="学习目标" className="field-span-2"><textarea className="input textarea" value={form.learningGoal} onChange={(event) => setForm((value) => ({ ...value, learningGoal: event.target.value }))} /></Field>}
          {academic && <Field label="学校教务备注" className="field-span-2"><textarea className="input textarea" value={form.notes} onChange={(event) => setForm((value) => ({ ...value, notes: event.target.value }))} /></Field>}
        </div>
      </Modal>

      {academic && (
        <AssessmentCreateModal
          open={createAssessmentOpen}
          defaultClassId={studentClassIds[0] ?? ""}
          allowedClassIds={studentClassIds}
          onClose={() => setCreateAssessmentOpen(false)}
          onCreated={setScoreAssessmentId}
        />
      )}
      {academic && scoreAssessmentId && (
        <AssessmentScoresModal assessmentId={scoreAssessmentId} focusStudentId={studentId} onClose={() => setScoreAssessmentId("")} />
      )}
    </>
  );
}
