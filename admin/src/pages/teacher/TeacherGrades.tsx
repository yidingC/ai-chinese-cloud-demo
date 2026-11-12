import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BarChart3, FileCheck2, GraduationCap, ListChecks, Search, TrendingUp } from "lucide-react";
import { AssessmentQuestionModal } from "../../components/AssessmentQuestionModal";
import { GradeAnalysisCards, GradeDetailsCard } from "../../components/GradeAnalyticsPanels";
import { GradePeriodPicker } from "../../components/GradePeriodPicker";
import { OperatorSchoolSelect, SchoolScopeLabel, useOperatorSchoolScope } from "../../components/OperatorSchoolScope";
import { Avatar, Badge, Button, Card, EmptyState, Modal, PageHeader, ProgressBar, Select, StatCard, TextInput } from "../../components/ui";
import type { AssessmentCategory, ClassGroup, GradeCategory, PlatformState } from "../../domain/types";
import { getAcademicSchoolId, workspaceState } from "../../lib/academicScope";
import { currentUser } from "../../lib/domain";
import { formatDateTime } from "../../lib/format";
import {
  buildGradeAnalytics,
  defaultGradeRange,
  gradeRangeBounds,
  scoreTone,
  type GradeRecord,
  type StudentGradeSummary
} from "../../lib/gradeAnalytics";
import { usePlatformStore } from "../../store/usePlatformStore";

const categoryLabels: Record<GradeCategory, string> = {
  interaction: "互动练习",
  homework: "作业",
  exam: "考试"
};

const phaseLabels: Record<NonNullable<GradeRecord["phase"]>, string> = {
  preview: "课前",
  live: "课中",
  review: "课后"
};

function scoreValue(value: number | null) {
  return value === null ? "--" : value;
}

type GradesVariant = "teacher" | "academic" | "operator";

export function GradesWorkspace({
  state,
  classes,
  variant,
  schoolName,
  teacherId,
  schoolId,
  schoolControl
}: {
  state: PlatformState;
  classes: ClassGroup[];
  variant: GradesVariant;
  schoolName?: string;
  teacherId?: string;
  schoolId?: string;
  schoolControl?: ReactNode;
}) {
  const academic = variant === "academic";
  const oversight = variant === "academic" || variant === "operator";
  const [range, setRange] = useState(() => defaultGradeRange(state.ui.timeZone));
  const [tab, setTab] = useState<"students" | GradeCategory>("students");
  const [dimension, setDimension] = useState<"student" | "content">("student");
  const [classId, setClassId] = useState("");
  const [query, setQuery] = useState("");
  const [detailStudentId, setDetailStudentId] = useState("");
  const [detailGradeCategory, setDetailGradeCategory] = useState<GradeCategory>("interaction");
  const [questionAssessmentId, setQuestionAssessmentId] = useState("");

  useEffect(() => {
    setRange((current) => ({ ...current, timeZone: state.ui.timeZone }));
  }, [state.ui.timeZone]);

  const selectedClass = classes.find((item) => item.id === classId) ?? null;
  const summaryTitle = selectedClass
    ? `${selectedClass.name}学生成绩明细`
    : oversight
      ? `${schoolName ?? "本校"}学生成绩明细`
      : "学生成绩明细";
  const allScopeLabel = oversight ? "本校" : "全部";
  const analytics = useMemo(
    () => buildGradeAnalytics(state, range, { teacherId, schoolId, classId: classId || undefined }),
    [classId, range, schoolId, state, teacherId]
  );
  const filteredStudents = analytics.students.filter((student) => {
    const keyword = query.trim().toLowerCase();
    return !keyword || `${student.name} ${student.level} ${student.classLabel}`.toLowerCase().includes(keyword);
  });
  const statistics = [
    {
      label: "综合均分",
      value: scoreValue(analytics.compositeAverage),
      detail: `${analytics.students.length} 位学生`,
      icon: <BarChart3 size={20} />,
      tone: "purple" as const
    },
    {
      label: "互动均分",
      value: scoreValue(analytics.categoryAverages.interaction.average),
      detail: `${analytics.categoryAverages.interaction.count} 项最佳成绩`,
      icon: <TrendingUp size={20} />,
      tone: "mint" as const
    },
    {
      label: "作业均分",
      value: scoreValue(analytics.categoryAverages.homework.average),
      detail: `${analytics.categoryAverages.homework.count} 项`,
      icon: <FileCheck2 size={20} />,
      tone: "orange" as const
    },
    {
      label: "考试均分",
      value: scoreValue(analytics.categoryAverages.exam.average),
      detail: `${analytics.categoryAverages.exam.count} 项`,
      icon: <GraduationCap size={20} />,
      tone: "blue" as const
    }
  ];
  const detailStudent = analytics.students.find((item) => item.studentId === detailStudentId) ?? null;
  const bounds = gradeRangeBounds(range);
  const assessments = state.assessments
    .filter((item) => item.status === "published")
    .filter((item) => !teacherId || item.teacherId === teacherId)
    .filter((item) => !schoolId || item.schoolId === schoolId)
    .filter((item) => !classId || item.classId === classId)
    .filter((item) => new Date(item.assessedAt).getTime() >= new Date(bounds.startAt).getTime() && new Date(item.assessedAt).getTime() <= new Date(bounds.endAt).getTime())
    .sort((a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime());
  const interactionRecords = analytics.records.filter((record) => record.category === "interaction");
  const interactionGroups = useMemo(() => {
    const groups = new Map<string, {
      id: string;
      title: string;
      classId?: string;
      lessonTitle?: string;
      phase?: GradeRecord["phase"];
      records: GradeRecord[];
      latestAt: string;
    }>();
    interactionRecords.forEach((record) => {
      const key = `${record.classId ?? "unassigned"}:${record.sourceId}`;
      const group = groups.get(key) ?? {
        id: key,
        title: record.title,
        classId: record.classId,
        lessonTitle: record.lessonTitle,
        phase: record.phase,
        records: [],
        latestAt: record.occurredAt
      };
      group.records.push(record);
      if (new Date(record.occurredAt).getTime() > new Date(group.latestAt).getTime()) group.latestAt = record.occurredAt;
      groups.set(key, group);
    });
    return [...groups.values()].sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
  }, [interactionRecords]);
  const interactionStudentRows = filteredStudents.map((student) => {
    const records = student.records.filter((record) => record.category === "interaction");
    const scores = records
      .map((record) => record.normalizedScore)
      .filter((score): score is number => score !== null);
    return {
      student,
      records,
      average: scores.length
        ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length * 10) / 10
        : null,
      wrongItemTotal: records.reduce((sum, record) => sum + (record.wrongItemCount ?? 0), 0),
      averageSeconds: records.length
        ? Math.round(records.reduce((sum, record) => sum + (record.timeSpentSeconds ?? 0), 0) / records.length)
        : 0,
      latestAt: records[0]?.occurredAt ?? ""
    };
  }).filter((row) => row.records.length > 0);
  const buildAssessmentStudentRows = (category: AssessmentCategory) => filteredStudents.map((student) => {
    const records = student.records.filter((record) => record.category === category);
    return {
      student,
      records,
      average: student.categories[category].average,
      gradedCount: records.filter((record) => record.status === "graded").length,
      absentCount: records.filter((record) => record.status === "absent").length,
      latestAt: records[0]?.occurredAt ?? ""
    };
  }).filter((row) => row.records.length > 0);
  const homeworkStudentRows = buildAssessmentStudentRows("homework");
  const examStudentRows = buildAssessmentStudentRows("exam");
  const assessmentTab = tab === "homework" || tab === "exam" ? tab : null;
  const assessmentStudentRows = assessmentTab === "homework"
    ? homeworkStudentRows
    : assessmentTab === "exam"
      ? examStudentRows
      : [];
  const assessmentLabel = assessmentTab ? categoryLabels[assessmentTab] : "";
  const absenceLabel = assessmentTab === "homework" ? "缺交" : "缺考";
  const homeworkAssessments = assessments.filter((item) => item.category === "homework");
  const examAssessments = assessments.filter((item) => item.category === "exam");
  const visibleAssessments = assessmentTab ? assessments.filter((item) => item.category === assessmentTab) : [];
  const interactionTabCount = dimension === "student" ? interactionStudentRows.length : interactionGroups.length;
  const homeworkTabCount = dimension === "student" ? homeworkStudentRows.length : homeworkAssessments.length;
  const examTabCount = dimension === "student" ? examStudentRows.length : examAssessments.length;

  function openStudentDetail(studentId: string, category: GradeCategory) {
    setDetailGradeCategory(category);
    setDetailStudentId(studentId);
  }

  const schoolScope = schoolControl ?? (oversight && schoolName ? <SchoolScopeLabel name={schoolName} /> : null);

  return (
    <>
      <PageHeader
        eyebrow={oversight ? "School gradebook" : "Student gradebook"}
        title="学生成绩"
        description={variant === "academic"
          ? `${schoolName ?? "本校"}全部班级的互动、作业与考试成绩；学校教务可查看，并按班级、时间或学生筛选。`
          : variant === "operator"
            ? `${schoolName ?? "当前学校"}全部班级的互动、作业与考试成绩；运营可切换学校，并按班级、时间或学生筛选。`
            : "按时间范围汇总本人所教学生的互动、作业与考试成绩。"}
      />

      <Card className={`content-filter-bar results-filter-bar grade-filter-bar ${range.preset === "custom" ? "has-custom-period" : ""}`.trim()}>
        {schoolScope}
        <Select value={classId} onChange={(event) => setClassId(event.target.value)} aria-label="按班级筛选">
          <option value="">全部班级</option>
          {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
        <GradePeriodPicker value={range} onChange={setRange} compact={oversight} />
        <div className="search-box">
          <Search size={16} />
          <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索学生、等级或班级" aria-label="搜索学生、等级或班级" />
        </div>
      </Card>

      <section className="stat-grid stat-grid-4">
        {statistics.map((item) => <StatCard key={item.label} {...item} />)}
      </section>

      <GradeAnalysisCards
        trend={analytics.trend}
        skillRadar={analytics.skillRadar}
        categories={analytics.categoryAverages}
        timeZone={state.ui.timeZone}
        radarDescription="综合当前筛选范围内学生的线上答题、互动与考核得分，等权估算六项能力表现。"
        className="teacher-class-analysis"
      />

      <div className="section-heading-row grade-summary-tabs">
        <div className="tabs" role="tablist">
          <button className={tab === "students" ? "active" : ""} onClick={() => setTab("students")} role="tab">学生汇总</button>
          <button className={tab === "interaction" ? "active" : ""} onClick={() => setTab("interaction")} role="tab">
            互动练习 <span>{interactionTabCount}</span>
          </button>
          <button className={tab === "homework" ? "active" : ""} onClick={() => setTab("homework")} role="tab">
            作业 <span>{homeworkTabCount}</span>
          </button>
          <button className={tab === "exam" ? "active" : ""} onClick={() => setTab("exam")} role="tab">
            考试 <span>{examTabCount}</span>
          </button>
        </div>
        {tab !== "students" && (
          <div className="grade-dimension-switch" role="group" aria-label="统计维度">
            <button className={dimension === "student" ? "active" : ""} aria-pressed={dimension === "student"} onClick={() => setDimension("student")}>学生维度</button>
            <button className={dimension === "content" ? "active" : ""} aria-pressed={dimension === "content"} onClick={() => setDimension("content")}>内容维度</button>
          </div>
        )}
      </div>

      {tab === "students" && (
        <Card className="grade-table-card">
          <div className="grade-table-heading">
            <div><h2>{summaryTitle}</h2><p>点击学生查看个人成绩趋势、能力雷达与成绩明细。</p></div>
            <Badge tone="purple">{filteredStudents.length} 位学生</Badge>
          </div>
          <div className="data-table grade-student-table">
            <div className="data-table-head">
              <span>学生</span><span>班级</span><span>综合</span><span>互动</span><span>作业</span><span>考试</span><span>状态</span>
            </div>
            {filteredStudents.map((student) => (
              <button className="data-table-row" key={student.studentId} onClick={() => openStudentDetail(student.studentId, "interaction")}>
                <span className="grade-student-cell"><Avatar label={student.avatar} size="sm" /><span><strong>{student.name}</strong><small>{student.level}</small></span></span>
                <span>{student.classLabel}</span>
                <span><strong className={`grade-score score-${scoreTone(student.composite)}`}>{scoreValue(student.composite)}</strong></span>
                <span>{scoreValue(student.categories.interaction.average)}</span>
                <span>{scoreValue(student.categories.homework.average)}</span>
                <span>{scoreValue(student.categories.exam.average)}</span>
                <span>
                  {/* 状态只看异常：有待录但无缺考的学生仍视为正常，避免把“还没录分”当成学生的问题。 */}
                  {student.absentCount > 0
                    ? <Badge tone="danger">{student.absentCount} 项缺考</Badge>
                    : <Badge tone="mint">正常</Badge>}
                </span>
              </button>
            ))}
          </div>
          {filteredStudents.length === 0 && <EmptyState title="这段时间没有学生成绩" description={oversight ? "调整时间或班级后重试；成绩由任课教师录入后自动汇总。" : "调整时间或班级后重试，也可以发布一项正式考核。"} />}
        </Card>
      )}

      {tab === "interaction" && dimension === "student" && (
        <Card className="grade-table-card interaction-grade-table-card">
          <div className="grade-table-heading">
            <div>
              <h2>{selectedClass ? `${selectedClass.name}互动练习表现` : `${allScopeLabel}学生互动练习表现`}</h2>
              <p>每名学生一行；同一互动取时间范围内最好成绩，用时按已完成的互动计算。</p>
            </div>
            <Badge tone="purple">{interactionStudentRows.length} 位学生</Badge>
          </div>
          <div className="data-table interaction-student-table">
            <div className="data-table-head">
              <span>学生</span><span>班级</span><span>互动均分</span><span>完成互动</span><span>错题总数</span><span>平均用时</span><span>最近互动</span>
            </div>
            {interactionStudentRows.map((row) => (
              <button className="data-table-row" key={row.student.studentId} onClick={() => openStudentDetail(row.student.studentId, "interaction")}>
                <span className="grade-student-cell"><Avatar label={row.student.avatar} size="sm" /><span><strong>{row.student.name}</strong><small>{row.student.level}</small></span></span>
                <span>{row.student.classLabel}</span>
                <span><strong className={`grade-score score-${scoreTone(row.average)}`}>{scoreValue(row.average)}</strong></span>
                <span>{row.records.length} 项</span>
                <span>{row.wrongItemTotal} 题</span>
                <span>{row.averageSeconds} 秒</span>
                <span>{formatDateTime(row.latestAt, state.ui.timeZone, state.ui.language)}</span>
              </button>
            ))}
          </div>
          {interactionStudentRows.length === 0 && <EmptyState title="当前范围没有互动成绩" description="学生完成计入成绩的互动后，会在这里按学生汇总。" />}
        </Card>
      )}

      {tab === "interaction" && dimension === "content" && (
        <div className="grade-assessment-list">
          {interactionGroups.map((group) => {
            const scores = group.records
              .map((record) => record.normalizedScore)
              .filter((score): score is number => score !== null);
            const average = scores.length
              ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length * 10) / 10
              : null;
            const averageSeconds = group.records.length
              ? Math.round(group.records.reduce((sum, record) => sum + (record.timeSpentSeconds ?? 0), 0) / group.records.length)
              : 0;
            const wrongItemTotal = group.records.reduce((sum, record) => sum + (record.wrongItemCount ?? 0), 0);
            const classGroup = state.classes.find((item) => item.id === group.classId);
            return (
              <Card className="grade-assessment-card" key={group.id}>
                <div className="grade-assessment-head">
                  <span className="grade-category-icon category-interaction">互</span>
                  <div>
                    <div className="grade-assessment-title">
                      <h2>{group.title}</h2>
                      <Badge tone="mint">互动练习</Badge>
                      {group.phase && <Badge tone={group.phase === "preview" ? "blue" : group.phase === "live" ? "purple" : "mint"}>{phaseLabels[group.phase]}</Badge>}
                    </div>
                    <p>{classGroup?.name ?? "未关联班级"} · {group.lessonTitle ?? "未关联课节"} · {formatDateTime(group.latestAt, state.ui.timeZone, state.ui.language)}</p>
                  </div>
                  <Badge tone="purple">{group.records.length} 人完成</Badge>
                </div>
                <div className="grade-assessment-metrics">
                  <div><strong>{average ?? "--"}</strong><small>班级均分</small></div>
                  <div><strong>{group.records.length}</strong><small>完成人数</small></div>
                  <div><strong>{wrongItemTotal}</strong><small>错题总数</small></div>
                  <div><strong>{averageSeconds} 秒</strong><small>平均用时</small></div>
                </div>
                <div className="grade-assessment-progress"><ProgressBar value={average ?? 0} tone="mint" /><small>按范围内最佳一次成绩统计</small></div>
              </Card>
            );
          })}
          {interactionGroups.length === 0 && <EmptyState title="当前范围没有互动成绩" description="学生完成计入成绩的互动后，会在这里按互动汇总。" />}
        </div>
      )}

      {assessmentTab && dimension === "student" && (
        <Card className="grade-table-card assessment-grade-table-card">
          <div className="grade-table-heading">
            <div>
              <h2>{selectedClass ? `${selectedClass.name}${assessmentLabel}表现` : `${allScopeLabel}学生${assessmentLabel}表现`}</h2>
              <p>每名学生一行；{absenceLabel}按 0 分。</p>
            </div>
            <Badge tone="purple">{assessmentStudentRows.length} 位学生</Badge>
          </div>
          <div className="data-table assessment-student-table">
            <div className="data-table-head">
              <span>学生</span><span>班级</span><span>均分</span><span>已录入</span><span>{absenceLabel}</span><span>最近考核</span>
            </div>
            {assessmentStudentRows.map((row) => (
              <button className="data-table-row" key={row.student.studentId} onClick={() => openStudentDetail(row.student.studentId, assessmentTab === "homework" ? "homework" : "exam")}>
                <span className="grade-student-cell"><Avatar label={row.student.avatar} size="sm" /><span><strong>{row.student.name}</strong><small>{row.student.level}</small></span></span>
                <span>{row.student.classLabel}</span>
                <span><strong className={`grade-score score-${scoreTone(row.average)}`}>{scoreValue(row.average)}</strong></span>
                <span>{row.gradedCount} 项</span>
                <span>{row.absentCount} 项</span>
                <span>{formatDateTime(row.latestAt, state.ui.timeZone, state.ui.language)}</span>
              </button>
            ))}
          </div>
          {assessmentStudentRows.length === 0 && <EmptyState title={`当前范围没有${assessmentLabel}成绩`} description="教学管理发布考核成绩后会自动出现在这里。" />}
        </Card>
      )}

      {assessmentTab && dimension === "content" && (
        <div className="grade-assessment-list">
          {visibleAssessments.map((assessment) => {
            const classGroup = state.classes.find((item) => item.id === assessment.classId);
            const scores = state.assessmentScores.filter((item) => item.assessmentId === assessment.id);
            const counted = scores.filter((item) => item.status === "graded" || item.status === "absent");
            const average = counted.length
              ? Math.round(counted.reduce((sum, item) => sum + (item.normalizedScore ?? 0), 0) / counted.length * 10) / 10
              : null;
            const absent = scores.filter((item) => item.status === "absent").length;
            const completion = scores.length ? (counted.length / scores.length) * 100 : 0;
            return (
              <Card className="grade-assessment-card" key={assessment.id}>
                <div className="grade-assessment-head">
                  <span className={`grade-category-icon category-${assessment.category}`}>{assessment.category === "homework" ? "作" : "考"}</span>
                  <div>
                    <div className="grade-assessment-title"><h2>{assessment.title}</h2><Badge tone={assessment.category === "homework" ? "orange" : "blue"}>{categoryLabels[assessment.category]}</Badge></div>
                    <p>{classGroup?.name ?? "班级已归档"} · {formatDateTime(assessment.assessedAt, state.ui.timeZone, state.ui.language)} · 满分 {assessment.maxScore}</p>
                  </div>
                  <Button variant="secondary" onClick={() => setQuestionAssessmentId(assessment.id)}><ListChecks size={16} /> 按题目查看</Button>
                </div>
                <div className="grade-assessment-metrics is-three">
                  <div><strong>{average ?? "--"}</strong><small>班级均分</small></div>
                  <div><strong>{absent}</strong><small>{absenceLabel}</small></div>
                  <div><strong>{scores.length}</strong><small>名单人数</small></div>
                </div>
                <div className="grade-assessment-progress"><ProgressBar value={completion} tone={completion === 100 ? "mint" : "orange"} /><small>已处理 {counted.length}/{scores.length}</small></div>
              </Card>
            );
          })}
          {visibleAssessments.length === 0 && <EmptyState title={`当前范围没有${assessmentLabel}`} description="教学管理发布考核成绩后会自动出现在这里。" />}
        </div>
      )}

      <Modal
        open={Boolean(detailStudent)}
        title={detailStudent ? `${detailStudent.name} · 成绩详情` : ""}
        onClose={() => setDetailStudentId("")}
        width="1120px"
      >
        {detailStudent && <StudentGradeDetail student={detailStudent} timeZone={state.ui.timeZone} language={state.ui.language} defaultCategory={detailGradeCategory} />}
      </Modal>

      <AssessmentQuestionModal assessmentId={questionAssessmentId} onClose={() => setQuestionAssessmentId("")} />
    </>
  );
}

export function TeacherGrades() {
  const state = usePlatformStore((store) => store.state);
  const user = currentUser(state);
  const classes = useMemo(
    () => state.classes.filter((item) => item.teacherId === user.id),
    [state.classes, user.id]
  );
  return (
    <GradesWorkspace
      state={state}
      classes={classes}
      variant="teacher"
      teacherId={user.id}
    />
  );
}

export function AcademicGrades() {
  const rawState = usePlatformStore((store) => store.state);
  const user = currentUser(rawState);
  const schoolId = getAcademicSchoolId(rawState, user);
  const state = useMemo(() => workspaceState(rawState, schoolId), [rawState, schoolId]);
  const classes = useMemo(
    () => state.classes.filter((item) => item.status === "active"),
    [state.classes]
  );

  if (!schoolId) {
    return (
      <>
        <PageHeader
          eyebrow="School gradebook"
          title="学生成绩"
          description="学校教务只能查看所属学校的学生成绩。"
        />
        <EmptyState title="当前账号未关联学校" description="请联系教学管理配置学校成员关系后再查看成绩。" />
      </>
    );
  }

  return (
    <GradesWorkspace
      state={state}
      classes={classes}
      variant="academic"
      schoolId={schoolId}
      schoolName={state.schools[0]?.name}
    />
  );
}

export function OperatorGrades() {
  const rawState = usePlatformStore((store) => store.state);
  const { schools, selectedSchoolId, selectedSchool, selectSchool } = useOperatorSchoolScope(rawState);
  const state = useMemo(() => workspaceState(rawState, selectedSchoolId), [rawState, selectedSchoolId]);
  const classes = useMemo(
    () => state.classes.filter((item) => item.status === "active"),
    [state.classes]
  );

  if (!selectedSchoolId) {
    return (
      <>
        <PageHeader
          eyebrow="School gradebook"
          title="学生成绩"
          description="运营端暂无可查看的学校。"
        />
        <EmptyState title="暂无可用学校" description="请先在学校与教职工中创建或启用学校。" />
      </>
    );
  }

  return (
    <GradesWorkspace
      key={selectedSchoolId}
      state={state}
      classes={classes}
      variant="operator"
      schoolId={selectedSchoolId}
      schoolName={selectedSchool?.name}
      schoolControl={
        <OperatorSchoolSelect
          className="results-scope-select"
          schools={schools}
          schoolId={selectedSchoolId}
          onChange={selectSchool}
        />
      }
    />
  );
}

function StudentGradeDetail({ student, timeZone, language, defaultCategory }: { student: StudentGradeSummary; timeZone: string; language: string; defaultCategory: GradeCategory }) {
  return (
    <div className="grade-detail-layout">
      <div className="grade-detail-summary">
        <div className="grade-detail-score"><span>综合成绩</span><strong>{scoreValue(student.composite)}</strong></div>
        {(["interaction", "homework", "exam"] as GradeCategory[]).map((category) => (
          <div key={category}><span>{categoryLabels[category]}</span><strong>{scoreValue(student.categories[category].average)}</strong><small>{student.categories[category].count} 项 · 权重 {student.categories[category].weight}%</small></div>
        ))}
      </div>
      <GradeAnalysisCards
        trend={student.trend}
        skillRadar={student.skillRadar}
        categories={student.categories}
        timeZone={timeZone}
        className="grade-analysis-in-modal"
      />
      <GradeDetailsCard
        records={student.records}
        timeZone={timeZone}
        language={language}
        statusMode="teacher"
        defaultCategory={defaultCategory}
        className="grade-details-in-modal"
      />
    </div>
  );
}
