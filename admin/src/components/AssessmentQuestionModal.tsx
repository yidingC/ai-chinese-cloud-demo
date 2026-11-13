import { BarChart3 } from "lucide-react";
import type { GradeAssessment } from "../domain/types";
import { formatDateTime } from "../lib/format";
import { scoreTone } from "../lib/gradeAnalytics";
import { usePlatformStore } from "../store/usePlatformStore";
import { Badge, EmptyState, Modal, ProgressBar } from "./ui";

const questionBlueprints = [
  { title: "听音选择", skill: "听力理解" },
  { title: "词语匹配", skill: "词汇语义" },
  { title: "句子填空", skill: "语法句式" },
  { title: "对话理解", skill: "阅读语境" },
  { title: "综合表达", skill: "语言运用" }
];

function textHash(value: string) {
  return [...value].reduce((sum, character) => sum + character.charCodeAt(0), 0);
}

function questionAccuracies(assessment: GradeAssessment, average: number | null, answeredCount: number) {
  if (average === null) return questionBlueprints.map((question) => ({ ...question, accuracy: null, correctCount: 0 }));
  const seed = textHash(assessment.id);
  return questionBlueprints.map((question, index) => {
    const offset = ((seed + index * 13) % 21) - 10;
    const accuracy = Math.max(0, Math.min(100, Math.round(average + offset)));
    return {
      ...question,
      accuracy,
      correctCount: Math.round(answeredCount * accuracy / 100)
    };
  });
}

export function AssessmentQuestionModal({ assessmentId, onClose }: { assessmentId: string; onClose: () => void }) {
  const state = usePlatformStore((store) => store.state);
  const assessment = state.assessments.find((item) => item.id === assessmentId);
  if (!assessment) return null;

  const classGroup = state.classes.find((item) => item.id === assessment.classId);
  const scores = state.assessmentScores.filter((item) => item.assessmentId === assessment.id);
  const counted = scores.filter((item) => item.status === "graded" || item.status === "absent");
  const average = counted.length
    ? Math.round(counted.reduce((sum, item) => sum + (item.normalizedScore ?? 0), 0) / counted.length * 10) / 10
    : null;
  const answeredCount = scores.filter((item) => item.status === "graded").length;
  const questions = questionAccuracies(assessment, average, answeredCount);

  return (
    <Modal open title="题目正确率" onClose={onClose} width="760px">
      <div className="assessment-question-modal">
        <div className="assessment-question-summary">
          <span className={`grade-category-icon category-${assessment.category}`}><BarChart3 size={19} /></span>
          <div>
            <div className="grade-assessment-title">
              <h3>{assessment.title}</h3>
              <Badge tone={assessment.category === "homework" ? "orange" : "blue"}>{assessment.category === "homework" ? "作业" : "考试"}</Badge>
            </div>
            <p>{classGroup?.name ?? "班级已归档"} · {formatDateTime(assessment.assessedAt, state.ui.timeZone, state.ui.language)} · 满分 {assessment.maxScore}</p>
          </div>
          <div className="assessment-question-average"><strong>{average ?? "--"}</strong><small>本次均分</small></div>
        </div>

        {questions.length ? (
          <div className="question-accuracy-list">
            {questions.map((question, index) => (
              <div className="question-accuracy-row" key={question.title}>
                <span className="question-index">{index + 1}</span>
                <div className="question-accuracy-copy"><strong>{question.title}</strong><small>{question.skill}</small></div>
                <div className="question-accuracy-progress">
                  <ProgressBar value={question.accuracy ?? 0} tone={scoreTone(question.accuracy)} />
                  <small>{answeredCount ? `答对 ${question.correctCount}/${answeredCount}` : "暂无作答"}</small>
                </div>
                <strong>{question.accuracy === null ? "--" : `${question.accuracy}%`}</strong>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="暂无题目统计" description="学生完成作答后，这里会显示每道题的正确率。" />
        )}

        <p className="question-data-note">当前为演示口径，根据班级得分模拟单题正确率；接入真实单题作答结果后将自动替换。</p>
      </div>
    </Modal>
  );
}
