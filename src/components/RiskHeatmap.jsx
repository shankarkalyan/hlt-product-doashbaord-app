const STATUSES = ["SUCCESS", "ACKNOWLEDGED", "FAILED"];

const STATUS_HEX = {
  SUCCESS: "#10b981",
  ACKNOWLEDGED: "#f97316",
  FAILED: "#ef4444",
};

function hexAlpha(alpha01) {
  return Math.round(alpha01 * 255)
    .toString(16)
    .padStart(2, "0");
}

export default function RiskHeatmap({ deployments, isDark, onCellClick }) {
  const types = [...new Set(deployments.map((d) => d.deploy_type))].sort();

  const matrix = {};
  types.forEach((t) => {
    matrix[t] = { SUCCESS: 0, ACKNOWLEDGED: 0, FAILED: 0 };
  });
  deployments.forEach((d) => {
    if (matrix[d.deploy_type]) matrix[d.deploy_type][d.deploy_status]++;
  });

  let maxV = 0;
  types.forEach((t) =>
    STATUSES.forEach((s) => {
      if (matrix[t][s] > maxV) maxV = matrix[t][s];
    })
  );

  const bgFor = (v, s) => {
    if (v === 0) return isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)";
    const alpha = 0.15 + (v / maxV) * 0.75;
    return STATUS_HEX[s] + hexAlpha(alpha);
  };

  return (
    <div className="heatmap">
      <div className="hm-col-labels">
        {STATUSES.map((s) => (
          <div key={s} className="hm-col-label">
            {s}
          </div>
        ))}
      </div>
      {types.map((t) => (
        <div key={t} className="hm-row">
          <div className="hm-label">{t}</div>
          {STATUSES.map((s) => {
            const v = matrix[t][s];
            const color = STATUS_HEX[s];
            return (
              <div
                key={s}
                className="hm-cell"
                style={{
                  background: bgFor(v, s),
                  color: v > 0 ? color : "var(--ts)",
                }}
                title={`${t} · ${s}: ${v}`}
                onClick={() => onCellClick && onCellClick(t, s)}
              >
                {v || "—"}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
