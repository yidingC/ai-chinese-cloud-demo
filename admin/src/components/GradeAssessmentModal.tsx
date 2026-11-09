import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, Save, UsersRound } from "lucide-react";
import type { AssessmentCategory, AssessmentScoreStatus } from "../domain/types";
import { currentUser } from "../lib/domain";
import { dateInputInTimeZone, gradeRangeBounds } from "../lib/gradeAnalytics";
import { platform } from "../lib/platform";
import { usePlatformStore } from "../store/usePlatformStore";
import { Badge, Button, EmptyState, Field, Modal, Select, TextInput } from "./ui";

export function AssessmentCreateModal({
  open,
  defaultClassId = "",
  allowedClassIds,
  onClose,
  onCreated
}: {
  open: boolean;
  defaultClassId?: string;
  allowedClassIds?: string[];
  onClose: () => void;
  onCreated?: (assessmentId: string, category: AssessmentCategory) => void;
}) {
  const { state, run } = usePlatformStore();
  const actor = currentUser(state);
  const availableClasses = useMemo(() => state.classes
    .filter((item) => item.status === "active")
    .filter((item) => !allowedClassIds || allowedClassIds.includes(item.id)), [allowedClassIds, state.classes]);
  const [classId, setClassId] = useState(defaultClassId);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<AssessmentCategory>("homework");
  const [maxScore, setMaxScore] = useState("100");
  const [assessedAt, setAssessedAt] = useState(dateInputInTimeZone(new Date(), state.ui.timeZone));

  useEffect(() => {
    if (!open) return;
    const preferred = defaultClassId && availableClasses.some((item) => item.id === defaultClassId)
      ? defaultClassId
      : availableClasses[0]?.id ?? "";
    setClassId(preferred);
    setTitle("");
    setCategory("homework");
    setMaxScore("100");
    setAssessedAt(dateInputInTimeZone(new Date(), state.ui.timeZone));
    // 打开弹窗时初始化；班次列表变化不应覆盖用户正在填写的内容。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultClassId, open, state.ui.timeZone]);

  const selectedClass = state.classes.find((item) => item.id === classId);
  const memberCount = state.classEnrollments.filter((item) => item.classId === classId && item.status === "active").length;

  function save() {
    if (!classId || !title.trim()) return;
    const result = run(
      () => platform.createAssessment({
        classId,
        title,
        category,
        maxScore: Number(maxScore),
        assessedAt: gradeRangeBounds({ start: assessedAt, end: assessedAt, timeZone: state.ui.timeZone }).startAt,
        actorId: actor.id
      }),
      "考核已发布并生成成绩名单"
    );
    if (!result.ok || !result.data) return;
    onCreated?.(result.data.id, result.data.category);
    onClose();
  }

  return (
    <Modal
      open={open}
      title="新建正式考核"
      onClose={onClose}
      width="650px"
      footer={
        <div className="modal-footer-split">
          <small>发布时按当前有效班级成员快照名单，后续转班成员不追溯。</small>
          <div>
            <Button variant="ghost" onClick={onClose}>取消</Button>
            <Button disabled={!classId || !title.trim() || memberCount === 0} onClick={save}>
              <CalendarPlus size={16} /> 发布考核
            </Button>
          </div>
        </div>
      }
    >
      {availableClasses.length === 0 ? (
        <EmptyState title="暂无可发布考核的班级" description="请先在“班级与学生”中创建班级并加入成员。" />
      ) : (
        <div className="editor-grid grade-assessment-form">
          <Field label="关联班级" className="field-span-2">
            <Select value={classId} onChange={(event) => setClassId(event.target.value)}>
              {availableClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </Field>
          <div className="grade-class-roster-hint field-span-2">
            <UsersRound size={16} />
            <span>{selectedClass?.name} · {memberCount} 位有效成员</span>
            <Badge tone={memberCount ? "mint" : "danger"}>{memberCount ? "名单可用" : "暂无成员"}</Badge>
          </div>
          <Field label="考核名称" className="field-span-2">
            <TextInput value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：第 2 单元测验" />
          </Field>
          <Field label="成绩类别">
            <Select value={category} onChange={(event) => setCategory(event.target.value as AssessmentCategory)}>
              <option value="homework">作业（30%）</option>
              <option value="exam">考试（30%）</option>
            </Select>
          </Field>
          <Field label="考核日期">
            <TextInput type="date" value={assessedAt} onChange={(event) => setAssessedAt(event.target.value)} />
          </Field>
          <Field label="满分" hint="学生原始分会在统计时统一换算为百分制。">
            <TextInput type="number" min="1" step="0.1" value={maxScore} onChange={(event) => setMaxScore(event.target.value)} />
          </Field>
        </div>
      )}
    </Modal>
  );
}

interface ScoreDraft {
  status: AssessmentScoreStatus;
  score: string;
}

export function AssessmentScoresModal({
  assessmentId,
  focusStudentId = "",
  onClose
}: {
  assessmentId: string;
  focusStudentId?: string;
  onClose: () => void;
}) {
  const { state, run } = usePlatformStore();
  const actor = currentUser(state);
  const assessment = state.assessments.find((item) => item.id === assessmentId);
  const [drafts, setDrafts] = useState<Record<string, ScoreDraft>>({});

  useEffect(() => {
    if (!assessment) return;
    setDrafts(Object.fromEntries(assessment.rosterStudentIds.map((studentId) => {
      const score = state.assessmentScores.find((item) => item.assessmentId === assessment.id && item.studentId === studentId);
      return [studentId, {
        status: score?.status ?? "pending",
        score: score?.score === null || score?.score === undefined ? "" : String(score.score)
      }];
    })));
    // 仅在打开另一份考核时重建表单，当前编辑内容不随 store 更新被覆盖。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment?.id]);

  if (!assessment) return null;
  const classGroup = state.classes.find((item) => item.id === assessment.classId);
  const visibleStudentIds = focusStudentId
    ? assessment.rosterStudentIds.filter((studentId) => studentId === focusStudentId)
    : assessment.rosterStudentIds;

  function save() {
    const entries = visibleStudentIds.map((studentId) => ({
      studentId,
      status: drafts[studentId]?.status ?? "pending",
      score: drafts[studentId]?.score === "" ? null : Number(drafts[studentId]?.score)
    }));
    const result = run(
      () => platform.saveAssessmentScores({ assessmentId, entries, actorId: actor.id }),
      "成绩已保存"
    );
    if (result.ok) onClose();
  }

  return (
    <Modal
      open
      title={`${assessment.title} · 录入成绩`}
      onClose={onClose}
      width="820px"
      footer={
        <div className="modal-footer-split">
          <small>{classGroup?.name} · 满分 {assessment.maxScore} · 待录不参与统计，缺考按 0 分。</small>
          <div><Button variant="ghost" onClick={onClose}>取消</Button><Button onClick={save}><Save size={16} /> 保存成绩</Button></div>
        </div>
      }
    >
      <div className="grade-score-editor">
        <div className="grade-score-editor-head">
          <span>学生</span><span>状态</span><span>原始分</span><span>百分制</span>
        </div>
        {visibleStudentIds.map((studentId) => {
          const user = state.users.find((item) => item.id === studentId);
          const draft = drafts[studentId] ?? { status: "pending", score: "" };
          const numericScore = draft.score === "" ? null : Number(draft.score);
          const normalized = draft.status === "graded" && numericScore !== null && Number.isFinite(numericScore)
            ? Math.round((numericScore / assessment.maxScore) * 1000) / 10
            : draft.status === "absent" ? 0 : null;
          return (
            <div className="grade-score-editor-row" key={studentId}>
              <span><strong>{user?.name ?? "学生"}</strong><small>{user?.avatar ?? "学"}</small></span>
              <Select
                value={draft.status}
                onChange={(event) => setDrafts((current) => ({
                  ...current,
                  [studentId]: { ...draft, status: event.target.value as AssessmentScoreStatus }
                }))}
              >
                <option value="pending">待录</option>
                <option value="graded">已评分</option>
                <option value="absent">缺考</option>
                <option value="excused">免考</option>
              </Select>
              <TextInput
                type="number"
                min="0"
                max={assessment.maxScore}
                step="0.1"
                disabled={draft.status !== "graded"}
                value={draft.status === "graded" ? draft.score : draft.status === "absent" ? "0" : ""}
                onChange={(event) => setDrafts((current) => ({
                  ...current,
                  [studentId]: { ...draft, score: event.target.value }
                }))}
                placeholder={`0–${assessment.maxScore}`}
              />
              <strong className={`grade-normalized-score ${normalized !== null && normalized < 60 ? "is-low" : ""}`}>
                {normalized === null ? "--" : normalized}
              </strong>
            </div>
          );
        })}
        {visibleStudentIds.length === 0 && <EmptyState title="该学生不在本次考核名单中" description="考核名单在发布时已经快照，不能追溯加入。" />}
      </div>
    </Modal>
  );
}
