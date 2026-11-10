import type { GradeTrendPoint } from "../lib/gradeAnalytics";
import { dateInputInTimeZone } from "../lib/gradeAnalytics";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "./ui";

const series = [
  { key: "composite", labelKey: "gradeChart.composite", color: "#6552ff" },
  { key: "interaction", labelKey: "gradeChart.interaction", color: "#33b99c" },
  { key: "homework", labelKey: "gradeChart.homework", color: "#f39549" },
  { key: "exam", labelKey: "gradeChart.exam", color: "#54a8ef" }
] as const;

function linePoints(
  values: Array<number | null>,
  width: number,
  height: number,
  padding: number,
  domainMin: number,
  domainMax: number
) {
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  return values.map((value, index) => {
    if (value === null) return null;
    const x = values.length === 1 ? width / 2 : padding + (index / (values.length - 1)) * usableWidth;
    const y = padding + ((domainMax - value) / (domainMax - domainMin)) * usableHeight;
    return { x, y, value };
  });
}

function axisTicks(lowestScore: number) {
  const domainMin = Math.max(0, Math.min(80, Math.floor((lowestScore - 5) / 10) * 10));
  const step = domainMin >= 80 ? 5 : domainMin >= 60 ? 10 : 20;
  const ticks: number[] = [];
  for (let value = domainMin; value < 100; value += step) ticks.push(value);
  ticks.push(100);
  return ticks;
}

export function GradeTrendChart({
  points,
  timeZone,
  height = 230
}: {
  points: GradeTrendPoint[];
  timeZone: string;
  height?: number;
}) {
  const { t } = useTranslation();
  const gradientId = `grade-trend-fill-${useId().replace(/:/g, "")}`;

  if (!points.length) {
    return <EmptyState title={t("gradeChart.noTrendTitle")} description={t("gradeChart.noTrendDescription")} />;
  }

  const width = 720;
  const padding = 34;
  const values = {
    composite: points.map((point) => point.composite),
    interaction: points.map((point) => point.categories.interaction),
    homework: points.map((point) => point.categories.homework),
    exam: points.map((point) => point.categories.exam)
  };
  const availableScores = Object.values(values)
    .flat()
    .filter((value): value is number => value !== null);
  const ticks = axisTicks(availableScores.length ? Math.min(...availableScores) : 0);
  const domainMin = ticks[0];

  return (
    <div className="grade-trend">
      <div className="grade-trend-legend">
        {series.map((item) => (
          <span key={item.key}><i style={{ background: item.color }} />{t(item.labelKey)}</span>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t("gradeChart.trendAria")}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6552ff" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#6552ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((value) => {
          const y = padding + ((100 - value) / (100 - domainMin)) * (height - padding * 2);
          return (
            <g key={value}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} className="grade-trend-grid" />
              <text x={padding - 8} y={y + 4} textAnchor="end" className="grade-trend-axis">{value}</text>
            </g>
          );
        })}
        {series.map((item) => {
          const plotted = linePoints(values[item.key], width, height, padding, domainMin, 100);
          const visiblePoints = plotted.filter((point): point is NonNullable<typeof point> => Boolean(point));
          const path = visiblePoints
            .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
            .join(" ");
          const firstPoint = visiblePoints[0];
          const lastPoint = visiblePoints[visiblePoints.length - 1];
          const baseline = height - padding;
          const areaPath = item.key === "composite" && visiblePoints.length > 1
            ? `${path} L ${lastPoint.x} ${baseline} L ${firstPoint.x} ${baseline} Z`
            : null;
          return (
            <g key={item.key}>
              {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
              {path && <path d={path} fill="none" stroke={item.color} strokeWidth={item.key === "composite" ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" />}
              {visiblePoints.map((point, index) => (
                <circle key={`${item.key}-${index}`} cx={point.x} cy={point.y} r={item.key === "composite" ? 4.5 : 3} fill="#fff" stroke={item.color} strokeWidth="2">
                  <title>{`${t(item.labelKey)} ${point.value}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {points.map((point, index) => {
          if (points.length > 8 || index % Math.ceil(points.length / 6) !== 0) return null;
          const x = points.length === 1 ? width / 2 : padding + (index / (points.length - 1)) * (width - padding * 2);
          const label = point.key.includes("-")
            ? dateInputInTimeZone(new Date(point.startAt), timeZone).slice(5)
            : point.key;
          return <text key={point.key} x={x} y={height - 8} textAnchor="middle" className="grade-trend-axis">{label}</text>;
        })}
      </svg>
    </div>
  );
}
