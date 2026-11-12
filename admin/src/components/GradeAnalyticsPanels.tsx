import { useEffect, useId, useRef, useState } from "react";
import { BarChart3, Info, Radar, TrendingUp } from "lucide-react";
import type { GradeCategory } from "../domain/types";
import type {
  GradeCategorySummary,
  GradeRecord,
  GradeTrendPoint,
  SkillDimensionKey,
  SkillRadarDimension
} from "../lib/gradeAnalytics";
import { interactionSkillWeights, skillDimensionLabels } from "../lib/gradeAnalytics";
import { INTERACTION_TYPE_LABELS, INTERACTION_TYPES } from "../lib/interactionTypes";
import { GradeRecordList } from "./GradeRecordList";
import { GradeTrendChart } from "./GradeTrendChart";
import { SkillRadarChart } from "./SkillRadarChart";
import { Badge, Card, ProgressBar, Tabs } from "./ui";

const compositionMeta: Array<{ category: GradeCategory; label: string; tone: "mint" | "orange" | "blue" }> = [
  { category: "interaction", label: "互动练习", tone: "mint" },
  { category: "homework", label: "作业", tone: "orange" },
  { category: "exam", label: "考试", tone: "blue" }
];

function scoreValue(value: number | null) {
  return value === null ? "--" : value;
}

function SkillRadarInfo() {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  function openTooltip() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  }

  /** 鼠标离开后延迟收起，保证斜向移入浮标时不会闪退。 */
  function scheduleClose() {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setOpen(false);
    }, 200);
  }

  return (
    <span className="skill-radar-icons">
      <Radar size={21} />
      <span
        className={`skill-radar-info ${open ? "is-open" : ""}`}
        onMouseEnter={openTooltip}
        onMouseLeave={scheduleClose}
        onFocus={openTooltip}
        onBlur={scheduleClose}
      >
        <button
          type="button"
          className="skill-radar-info-trigger"
          aria-label="查看题型与能力维度对照"
          aria-describedby={tooltipId}
        >
          <Info size={13} />
        </button>
        <span className="skill-radar-tooltip" id={tooltipId} role="tooltip">
          <span className="skill-radar-tooltip-box">
            <strong>题型与能力维度对照</strong>
            <span className="skill-radar-tooltip-note">
              互动练习按题型把该次得分计入对应能力维度，维度越靠前权重越高。
            </span>
            <span className="skill-radar-tooltip-list">
              {INTERACTION_TYPES.map((type) => {
                const weights = interactionSkillWeights[type];
                const dimensions = (Object.keys(weights) as SkillDimensionKey[])
                  .sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0));
                return (
                  <span className="skill-radar-tooltip-row" key={type}>
                    <span className="skill-radar-tooltip-type">{INTERACTION_TYPE_LABELS[type]}</span>
                    <span className="skill-radar-tooltip-dims">
                      {dimensions.length
                        ? dimensions.map((key, index) => (
                            <em key={key} className={index === 0 ? "is-primary" : ""}>{skillDimensionLabels[key]}</em>
                          ))
                        : <em className="is-none">不计入能力雷达</em>}
                    </span>
                  </span>
                );
              })}
            </span>
          </span>
        </span>
      </span>
    </span>
  );
}

export function GradeAnalysisCards({
  trend,
  skillRadar,
  categories,
  timeZone,
  pendingCount,
  pendingLabel,
  radarDescription = "综合所选时间范围内的线上答题、互动与考核得分，估算六项能力表现。",
  showTrend = true,
  showComposition = true,
  className = ""
}: {
  trend: GradeTrendPoint[];
  skillRadar: SkillRadarDimension[];
  categories: Record<GradeCategory, GradeCategorySummary>;
  timeZone: string;
  /** 只有需要提醒待办时才传 pendingLabel；两个字段都不传就不显示这条徽标。 */
  pendingCount?: number;
  pendingLabel?: string;
  radarDescription?: string;
  /** 单课次视角下没有趋势与成绩构成，按需隐藏。 */
  showTrend?: boolean;
  showComposition?: boolean;
  className?: string;
}) {
  const strongestSkill = [...skillRadar]
    .filter((item) => item.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null;

  return (
    <div className={`student-grade-layout grade-analysis-cards ${className}`}>
      {showTrend && (
        <Card className="student-grade-trend-card">
          <div className="card-heading">
            <div><span className="eyebrow">Score trend</span><h2>成绩趋势</h2></div>
            <TrendingUp size={21} />
          </div>
          <GradeTrendChart points={trend} timeZone={timeZone} />
        </Card>
      )}

      <Card className="student-grade-radar-card">
        <div className="card-heading">
          <div><span className="eyebrow">Ability radar</span><h2>能力雷达</h2></div>
          <SkillRadarInfo />
        </div>
        <p>{radarDescription}</p>
        <SkillRadarChart dimensions={skillRadar} />
        <div className="skill-radar-foot">
          <span>优势维度</span>
          <strong>{strongestSkill ? `${strongestSkill.label} ${strongestSkill.score}` : "样本不足"}</strong>
        </div>
      </Card>

      {showComposition && (
        <Card className="student-grade-composition">
          <div className="card-heading">
            <div><span className="eyebrow">Composition</span><h2>成绩构成</h2></div>
            <BarChart3 size={21} />
          </div>
          <p>综合成绩只使用当前范围内有有效成绩的类别，缺失类别会自动重新分配权重。</p>
          <div className="grade-composition-list">
            {compositionMeta.map((item) => {
              const category = categories[item.category];
              return (
                <div key={item.category}>
                  <div><span>{item.label}</span><strong>{scoreValue(category.average)}</strong><small>权重 {category.weight}%</small></div>
                  <ProgressBar value={category.average ?? 0} tone={item.tone} />
                </div>
              );
            })}
          </div>
          {pendingLabel && (
            <div className="grade-personal-note">
              <Badge tone={pendingCount ? "orange" : "mint"}>{pendingCount ?? 0} {pendingLabel}</Badge>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export function GradeDetailsCard({
  records,
  timeZone,
  language,
  statusMode = "student",
  singleLine = true,
  className = "",
  defaultCategory = "interaction"
}: {
  records: GradeRecord[];
  timeZone: string;
  language: string;
  statusMode?: "student" | "teacher";
  singleLine?: boolean;
  className?: string;
  defaultCategory?: GradeCategory;
}) {
  const [category, setCategory] = useState<GradeCategory>(defaultCategory);
  const filteredRecords = records.filter((record) => record.category === category);

  return (
    <Card className={`student-grade-records grade-details-card ${className}`}>
      <div className="card-heading grade-details-heading">
        <div><span className="eyebrow">Grade details</span><h2>成绩明细</h2></div>
        <div className="grade-details-heading-actions">
          <Tabs
            compact
            value={category}
            onChange={setCategory}
            items={compositionMeta.map((item) => ({
              value: item.category,
              label: item.label,
              count: records.filter((record) => record.category === item.category).length
            }))}
          />
          <span className="grade-details-note">分数均经过归一化计算</span>
        </div>
      </div>
      <GradeRecordList
        records={filteredRecords}
        timeZone={timeZone}
        language={language}
        statusMode={statusMode}
        singleLine={singleLine}
      />
    </Card>
  );
}
