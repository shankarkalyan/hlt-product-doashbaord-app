import { useEffect, useState } from "react";
import { api } from "../api/client";

const STATUS_CLASS = {
  SUCCESS: "status status-success",
  ACKNOWLEDGED: "status status-ack",
  FAILED: "status status-failed",
};

const STATUS_ROW_CLASS = {
  SUCCESS: "row-success",
  ACKNOWLEDGED: "row-ack",
  FAILED: "row-failed",
};

const TECH_COLORS = {
  TERRAFORM: "#3b82f6",
  ECS: "#10b981",
  LAMBDA: "#f97316",
  EKS: "#8b5cf6",
  GKP: "#ec4899",
  GAP: "#14b8a6",
  GLUE: "#f59e0b",
  VSI: "#6366f1",
  AWS: "#ef4444",
};

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

function relativeTime(ts) {
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const future = diff < 0;
    const abs = Math.abs(diff);
    const m = 60_000,
      h = 3_600_000,
      d = 86_400_000;
    let val, unit;
    if (abs < h) {
      val = Math.max(1, Math.round(abs / m));
      unit = "min";
    } else if (abs < d) {
      val = Math.round(abs / h);
      unit = "hr";
    } else if (abs < d * 30) {
      val = Math.round(abs / d);
      unit = "day";
    } else if (abs < d * 365) {
      val = Math.round(abs / (d * 30));
      unit = "mo";
    } else {
      val = Math.round(abs / (d * 365));
      unit = "yr";
    }
    return `${future ? "in " : ""}${val} ${unit}${val === 1 ? "" : "s"}${
      future ? "" : " ago"
    }`;
  } catch {
    return "";
  }
}

function ChevronRight() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <div className="empty-title">No deployments found</div>
      <div className="empty-sub">Try a different filter from the heat map.</div>
    </div>
  );
}

export default function DeploymentList({ filter, onSelect }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api
      .deployments({
        deployType: filter.deployType,
        applicationId: filter.applicationId,
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [filter.deployType, filter.applicationId]);

  const heading = [
    filter.deployType ? `${filter.deployType}` : null,
    filter.applicationName ? `${filter.applicationName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>Deployments — {heading || "all"}</h2>
          <span className="hint">
            Click a row to view full deployment metadata.
          </span>
        </div>
        {data && <span className="count-badge">{data.count} total</span>}
      </div>

      {error && <div className="error">Error: {error}</div>}
      {!data && !error && <div className="loading">Loading…</div>}

      {data && data.deployments.length === 0 && <EmptyState />}

      {data && data.deployments.length > 0 && (
        <div className="table-wrap">
          <table className="deployments-table">
            <thead>
              <tr>
                <th className="th-status" aria-label="Status indicator"></th>
                <th>Project / Application</th>
                <th>Repository</th>
                <th>Deploy Type</th>
                <th>Environment</th>
                <th>Status</th>
                <th>Deploy Time</th>
                <th>Change Ticket</th>
                <th aria-label="Open"></th>
              </tr>
            </thead>
            <tbody>
              {data.deployments.map((d) => {
                const statusUp = d.deploy_status.toUpperCase();
                const techColor = TECH_COLORS[d.deploy_type] || "#64748b";
                return (
                  <tr
                    key={d.jet_uuid}
                    className={`row ${STATUS_ROW_CLASS[statusUp] || ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(d.jet_uuid)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(d.jet_uuid);
                      }
                    }}
                  >
                    <td className="td-status" aria-hidden="true"></td>
                    <td>
                      <div className="cell-primary">{d.project_name}</div>
                      <div className="cell-secondary">{d.application_name}</div>
                    </td>
                    <td>
                      <span className="repo-cell mono">{d.repo_name}</span>
                    </td>
                    <td>
                      <span
                        className="tech-chip"
                        style={{ "--tech-color": techColor }}
                      >
                        <span className="tech-dot" aria-hidden="true" />
                        {d.deploy_type}
                      </span>
                    </td>
                    <td>
                      <span className="env-chip mono">{d.environment}</span>
                    </td>
                    <td>
                      <span
                        className={
                          STATUS_CLASS[statusUp] || "status status-default"
                        }
                      >
                        {d.deploy_status}
                      </span>
                    </td>
                    <td>
                      <div className="time-cell">
                        <div className="time-abs mono">
                          {formatTime(d.deploy_time)}
                        </div>
                        <div className="time-rel">
                          {relativeTime(d.deploy_time)}
                        </div>
                      </div>
                    </td>
                    <td className="mono ticket-cell">
                      {d.change_ctrl_ticket}
                    </td>
                    <td className="action-cell">
                      <ChevronRight />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
