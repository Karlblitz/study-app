import { useMemo } from "react";

const chartWidth = 360;
const chartHeight = 260;
const plot = { left: 44, right: 20, top: 18, bottom: 42 };

/** Responsive SVG chart for the learner's most recent quiz scores. */
export function ScoreTrendChart({ attempts = [] }) {
  const scores = useMemo(() => [...attempts]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-8)
    .map((attempt, index) => ({
      ...attempt,
      scorePercent: attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0,
      label: `Attempt ${Math.max(1, attempts.length - Math.min(8, attempts.length) + index + 1)}`,
    })), [attempts]);

  const points = scores.map((item, index) => {
    const usableWidth = chartWidth - plot.left - plot.right;
    const usableHeight = chartHeight - plot.top - plot.bottom;
    const x = scores.length === 1 ? plot.left + usableWidth / 2 : plot.left + (index / (scores.length - 1)) * usableWidth;
    const y = plot.top + ((100 - item.scorePercent) / 100) * usableHeight;
    return { ...item, x, y };
  });

  if (!scores.length) {
    return <section className="panel score-chart-panel" aria-labelledby="score-chart-title">
      <div className="score-chart-heading"><div><p className="eyebrow">QUIZ PERFORMANCE</p><h2 id="score-chart-title">Recent quiz scores</h2></div></div>
      <p className="score-chart-empty">Complete a quiz to see your score trend here.</p>
    </section>;
  }

  const line = points.map(({ x, y }) => `${x},${y}`).join(" ");
  const usableHeight = chartHeight - plot.top - plot.bottom;
  return <section className="panel score-chart-panel" aria-labelledby="score-chart-title">
    <div className="score-chart-heading"><div><p className="eyebrow">QUIZ PERFORMANCE</p><h2 id="score-chart-title">Recent quiz scores</h2></div><span>Latest {scores.length} attempt{scores.length === 1 ? "" : "s"}</span></div>
    <div className="score-chart-scroll">
      <svg className="score-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={`Quiz score trend over ${scores.length} attempts, from ${scores[0].scorePercent}% to ${scores.at(-1).scorePercent}%`}>
        {[0, 25, 50, 75, 100].map((value) => {
          const y = plot.top + ((100 - value) / 100) * usableHeight;
          return <g className="score-chart-grid" key={value}><line x1={plot.left} x2={chartWidth - plot.right} y1={y} y2={y} /><text x={plot.left - 9} y={y + 4} textAnchor="end">{value}%</text></g>;
        })}
        {points.length > 1 && <polyline className="score-chart-line" points={line} />}
        {points.map((point, index) => <g className="score-chart-point" key={`${point.id || point.date}-${index}`}>
          <title>{`${point.label}: ${point.scorePercent}%${point.title ? ` - ${point.title}` : ""}`}</title>
          <circle cx={point.x} cy={point.y} r="5" />
          <text x={point.x} y={chartHeight - 12} textAnchor="middle">{index + 1}</text>
        </g>)}
      </svg>
    </div>
    <div className="score-chart-caption"><span>Oldest attempt</span><span>Most recent</span></div>
  </section>;
}
