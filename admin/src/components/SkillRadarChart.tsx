import type { SkillRadarDimension } from "../lib/gradeAnalytics";
import { useTranslation } from "react-i18next";

const width = 300;
const height = 246;
const centerX = width / 2;
const centerY = 116;
const radius = 72;
const gridLevels = [0.25, 0.5, 0.75, 1];

function pointAt(index: number, count: number, amount: number) {
  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
  return {
    x: centerX + Math.cos(angle) * radius * amount,
    y: centerY + Math.sin(angle) * radius * amount
  };
}

function polygonPoints(dimensions: SkillRadarDimension[], valueForDimension: (dimension: SkillRadarDimension) => number) {
  return dimensions
    .map((dimension, index) => {
      const point = pointAt(index, dimensions.length, valueForDimension(dimension));
      return `${point.x},${point.y}`;
    })
    .join(" ");
}

export function SkillRadarChart({ dimensions }: { dimensions: SkillRadarDimension[] }) {
  const { t } = useTranslation();

  if (!dimensions.length) return null;

  const plotted = dimensions.map((dimension, index) => {
    const value = dimension.score === null ? 0 : Math.max(0, Math.min(100, dimension.score));
    const point = pointAt(index, dimensions.length, value / 100);
    const labelPoint = pointAt(index, dimensions.length, 1.42);
    const anchor: "end" | "start" | "middle" = labelPoint.x < centerX - 8 ? "end" : labelPoint.x > centerX + 8 ? "start" : "middle";
    const labelY = labelPoint.y < centerY - 8 ? -3 : labelPoint.y > centerY + 8 ? 11 : 4;
    return { dimension, point, labelPoint, anchor, labelY };
  });

  return (
    <svg className="skill-radar-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t("gradeChart.radarAria")}>
      <g className="skill-radar-grid">
        {gridLevels.map((level) => (
          <polygon key={level} points={polygonPoints(dimensions, () => level)} />
        ))}
        {dimensions.map((dimension, index) => {
          const end = pointAt(index, dimensions.length, 1);
          return <line key={dimension.key} x1={centerX} y1={centerY} x2={end.x} y2={end.y} />;
        })}
      </g>

      <polygon className="skill-radar-area" points={polygonPoints(dimensions, (dimension) => (dimension.score ?? 0) / 100)} />
      {plotted.map(({ dimension, point }) => (
        <circle key={dimension.key} className="skill-radar-dot" cx={point.x} cy={point.y} r="3.2">
          <title>{`${t(`gradeChart.${dimension.key}`)} ${dimension.score ?? "--"}`}</title>
        </circle>
      ))}

      {plotted.map(({ dimension, labelPoint, anchor, labelY }) => (
        <text
          key={dimension.key}
          className="skill-radar-label"
          x={labelPoint.x}
          y={labelPoint.y + labelY}
          textAnchor={anchor}
        >
          <tspan x={labelPoint.x}>{t(`gradeChart.${dimension.key}`)}</tspan>
          <tspan className="skill-radar-value" x={labelPoint.x} dy="11">{dimension.score ?? "--"}</tspan>
        </text>
      ))}
    </svg>
  );
}
