import { useEffect, useMemo, useRef, useState } from "react";

const chartHeight = 300;
const plot = { left: 48, right: 24, top: 22, bottom: 38 };

/** Responsive SVG chart for the learner's most recent quiz scores. */
export function ScoreTrendChart({ attempts = [] }) {
  const chartContainer = useRef(null);
  const [chartWidth, setChartWidth] = useState(720);

  useEffect(() => {
    const element = chartContainer.current;
    if (!element) return undefined;
    const updateWidth = () => setChartWidth(Math.max(320, Math.round(element.getBoundingClientRect().width)));
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scores = useMemo(() => [...attempts]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-8)
    .map((attempt, index) => ({
      ...attempt,
      scorePercent: attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0,
      label: `Attempt ${Math.max(1, attempts.length - Math.min(8, attempts.length) + index + 1)}`,
    })), [attempts]);

  const bars = scores.map((item, index) => {
    const usableWidth = chartWidth - plot.left - plot.right;
    const usableHeight = chartHeight - plot.top - plot.bottom;
    const slotWidth = usableWidth / scores.length;
    const barWidth = Math.min(52, slotWidth * 0.58);
    const x = plot.left + (index * slotWidth) + (slotWidth - barWidth) / 2;
    const height = Math.max((item.scorePercent / 100) * usableHeight, 2);
    const y = plot.top + usableHeight - height;
    return { ...item, x, y, width: barWidth, height };
  });

  if (!scores.length) {
    return <section className="panel score-chart-panel" aria-labelledby="score-chart-title">
      <div className="score-chart-heading"><div><p className="eyebrow">QUIZ PERFORMANCE</p><h2 id="score-chart-title">Recent quiz scores</h2></div></div>
      <p className="score-chart-empty">Complete a quiz to see your score trend here.</p>
    </section>;
  }

  const usableHeight = chartHeight - plot.top - plot.bottom;
  return <section className="panel score-chart-panel" aria-labelledby="score-chart-title">
    <div className="score-chart-heading"><div><p className="eyebrow">QUIZ PERFORMANCE</p><h2 id="score-chart-title">Recent quiz scores</h2></div><span>Latest {scores.length} attempt{scores.length === 1 ? "" : "s"}</span></div>
    <div className="score-chart-scroll" ref={chartContainer}>
      <svg className="score-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" role="img" aria-label={`Quiz score trend over ${scores.length} attempts, from ${scores[0].scorePercent}% to ${scores.at(-1).scorePercent}%`}>
        {[0, 25, 50, 75, 100].map((value) => {
          const y = plot.top + ((100 - value) / 100) * usableHeight;
          return <g className="score-chart-grid" key={value}><line x1={plot.left} x2={chartWidth - plot.right} y1={y} y2={y} /><text x={plot.left - 9} y={y + 4} textAnchor="end">{value}%</text></g>;
        })}
        {bars.map((bar, index) => <g className="score-chart-bar-group" key={`${bar.id || bar.date}-${index}`}>
          <title>{`${bar.label}: ${bar.scorePercent}%${bar.title ? ` - ${bar.title}` : ""}`}</title>
          <rect className="score-chart-bar" x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx="4" />
        </g>)}
      </svg>
    </div>
    <div className="score-chart-legend" style={{ "--legend-count": scores.length }} aria-label="Quiz scores by attempt">
      {scores.map((score, index) => <div className="score-chart-legend-item" key={`${score.id || score.date}-${index}`} title={score.title || score.label}>
        <span className="score-chart-legend-label"><span className="score-chart-legend-marker" aria-hidden="true" /><span className="score-chart-legend-title">{score.title || score.label}</span></span>
        <strong>{score.scorePercent}%</strong>
      </div>)}
    </div>
  </section>;
}
