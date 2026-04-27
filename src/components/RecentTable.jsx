const STATUS_BADGE = {
  SUCCESS: "b-success",
  FAILED: "b-fail",
  ACKNOWLEDGED: "b-ack",
};

export default function RecentTable({ deployments, limit = 8, onSelect }) {
  const recent = [...deployments]
    .sort((a, b) => new Date(b.deploy_time) - new Date(a.deploy_time))
    .slice(0, limit);

  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>App</th>
          <th>Type</th>
          <th>Status</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        {recent.map((d) => (
          <tr
            key={d.jet_uuid || `${d.application_id}-${d.deploy_time}`}
            className={onSelect ? "tbl-clickable" : ""}
            onClick={() => onSelect && onSelect(d)}
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : undefined}
            onKeyDown={(e) => {
              if (!onSelect) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(d);
              }
            }}
          >
            <td
              className="tbl-mono"
              style={{ fontSize: 11, color: "var(--tp)" }}
            >
              {d.project_name}
            </td>
            <td>
              <span className="badge b-type">{d.deploy_type}</span>
            </td>
            <td>
              <span
                className={`badge ${STATUS_BADGE[d.deploy_status] || "b-ack"}`}
              >
                {d.deploy_status}
              </span>
            </td>
            <td className="tbl-mono" style={{ fontSize: 10 }}>
              {String(d.deploy_time).slice(0, 10)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
