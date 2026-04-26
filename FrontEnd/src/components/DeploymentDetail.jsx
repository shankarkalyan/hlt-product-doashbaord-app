import { useEffect, useState } from "react";
import { api } from "../api/client";

const STATUS_CLASS = {
  SUCCESS: "status status-success",
  ACKNOWLEDGED: "status status-ack",
  FAILED: "status status-failed",
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
    const m = 60_000;
    const h = 3_600_000;
    const d = 86_400_000;
    const future = diff < 0;
    const abs = Math.abs(diff);
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

const Icon = ({ children }) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const ICONS = {
  app: (
    <Icon>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </Icon>
  ),
  rocket: (
    <Icon>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </Icon>
  ),
  ticket: (
    <Icon>
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
      <path d="M13 5v2" />
      <path d="M13 17v2" />
      <path d="M13 11v2" />
    </Icon>
  ),
  id: (
    <Icon>
      <path d="M4 17v2a2 2 0 0 0 2 2h2" />
      <path d="M4 7V5a2 2 0 0 1 2-2h2" />
      <path d="M16 21h2a2 2 0 0 0 2-2v-2" />
      <path d="M16 3h2a2 2 0 0 1 2 2v2" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <circle cx="9" cy="9" r="1" />
      <circle cx="15" cy="15" r="1" />
    </Icon>
  ),
  clock: (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Icon>
  ),
  copy: (
    <Icon>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Icon>
  ),
  check: (
    <Icon>
      <polyline points="20 6 9 17 4 12" />
    </Icon>
  ),
};

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <button
      type="button"
      className={`copy-btn ${copied ? "copied" : ""}`}
      onClick={onCopy}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
      title={copied ? "Copied" : "Copy"}
    >
      {copied ? ICONS.check : ICONS.copy}
    </button>
  );
}

function Field({ label, value, mono = false, copy = false, breakAll = false }) {
  return (
    <div className="field-row">
      <div className="field-label">{label}</div>
      <div className={`field-value ${mono ? "mono" : ""} ${breakAll ? "break" : ""}`}>
        <span className="field-text">{value}</span>
        {copy && <CopyButton value={value} />}
      </div>
    </div>
  );
}

function InfoCard({ title, icon, tone, children }) {
  return (
    <section className={`info-card tone-${tone}`}>
      <header className="info-card-head">
        <span className="info-card-icon">{icon}</span>
        <h3>{title}</h3>
      </header>
      <div className="info-card-body">{children}</div>
    </section>
  );
}

export default function DeploymentDetail({ jetUuid }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api
      .deployment(jetUuid)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [jetUuid]);

  return (
    <div className="panel detail-panel">
      <div className="panel-header">
        <div>
          <h2>Deployment Detail</h2>
          <span className="hint">Full record metadata for this deployment.</span>
        </div>
      </div>
      {error && <div className="error">Error: {error}</div>}
      {!data && !error && <div className="loading">Loading…</div>}

      {data && (
        <div className="detail-layout">
          {/* HERO */}
          <section className="hero-card">
            <div className="hero-pills">
              <span className="tech-pill">{data.deploy_type}</span>
              <span
                className={
                  STATUS_CLASS[data.deploy_status] || "status status-default"
                }
              >
                {data.deploy_status}
              </span>
              <span className="env-pill">{data.environment}</span>
            </div>
            <h3 className="hero-title">{data.repo_name}</h3>
            <p className="hero-sub">
              {data.project_name} <span className="dot">·</span>{" "}
              {data.application_name}
            </p>
            <div className="hero-stats">
              <div className="hero-stat">
                <span className="hero-stat-icon">{ICONS.clock}</span>
                <div>
                  <div className="hero-stat-label">Deployed</div>
                  <div className="hero-stat-value">
                    {formatTime(data.deploy_time)}
                  </div>
                  <div className="hero-stat-sub">
                    {relativeTime(data.deploy_time)}
                  </div>
                </div>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-icon">{ICONS.ticket}</span>
                <div>
                  <div className="hero-stat-label">Change Ticket</div>
                  <div className="hero-stat-value mono">
                    {data.change_ctrl_ticket}
                  </div>
                  <div className="hero-stat-sub">{data.event_type}</div>
                </div>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-icon">{ICONS.app}</span>
                <div>
                  <div className="hero-stat-label">Application ID</div>
                  <div className="hero-stat-value mono">
                    {data.application_id}
                  </div>
                  <div className="hero-stat-sub">{data.product_name}</div>
                </div>
              </div>
            </div>
          </section>

          {/* CARDS */}
          <div className="info-grid">
            <InfoCard title="Application" icon={ICONS.app} tone="blue">
              <Field label="Application Name" value={data.application_name} />
              <Field
                label="Application ID"
                value={data.application_id}
                mono
              />
              <Field label="Project" value={data.project_name} />
              <Field label="Product" value={data.product_name} />
              <Field label="Product Line" value={data.product_line} />
            </InfoCard>

            <InfoCard title="Deployment" icon={ICONS.rocket} tone="green">
              <Field
                label="Deploy Type"
                value={<span className="tech-pill">{data.deploy_type}</span>}
              />
              <Field label="Environment" value={data.environment} mono />
              <Field label="Event Type" value={data.event_type} mono />
              <Field
                label="Status"
                value={
                  <span
                    className={
                      STATUS_CLASS[data.deploy_status] ||
                      "status status-default"
                    }
                  >
                    {data.deploy_status}
                  </span>
                }
              />
              <Field
                label="Deploy Time"
                value={formatTime(data.deploy_time)}
                mono
              />
            </InfoCard>

            <InfoCard
              title="Change Management"
              icon={ICONS.ticket}
              tone="amber"
            >
              <Field
                label="Change Ticket"
                value={data.change_ctrl_ticket}
                mono
                copy
              />
              <Field label="Repository" value={data.repo_name} mono copy />
            </InfoCard>

            <InfoCard title="Identifiers" icon={ICONS.id} tone="purple">
              <Field label="Jet UUID" value={data.jet_uuid} mono copy />
              <Field
                label="Jet ID"
                value={data.jet_id}
                mono
                breakAll
                copy
              />
              <Field
                label="Composite Key"
                value={data.key_appid_projkey_repo}
                mono
                breakAll
              />
            </InfoCard>
          </div>
        </div>
      )}
    </div>
  );
}
