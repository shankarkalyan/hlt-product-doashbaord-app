import AnimatedNumber from "./AnimatedNumber";

const TONE_COLORS = {
  blue: "#117ACA",
  green: "#10b981",
  red: "#ef4444",
  orange: "#f97316",
  purple: "#8b5cf6",
  cyan: "#38bdf8",
};

const TREND_LABEL = {
  up: "↑ Good",
  dn: "↓ Risk",
  neu: "—",
};

export default function KPICards({ cards }) {
  return (
    <div className="kpi-grid">
      {cards.map((k, i) => (
        <div
          key={k.label}
          className={`kpi-card ${k.tone}`}
          style={{ animationDelay: `${i * 0.07}s` }}
        >
          {k.trend && (
            <div className={`kpi-trend trend-${k.trend}`}>
              {TREND_LABEL[k.trend]}
            </div>
          )}
          <div className="kpi-label">{k.label}</div>
          <div
            className="kpi-val"
            style={{ color: TONE_COLORS[k.tone] }}
          >
            <AnimatedNumber value={k.value} />
          </div>
          <div className="kpi-sub">{k.sub}</div>
        </div>
      ))}
    </div>
  );
}
