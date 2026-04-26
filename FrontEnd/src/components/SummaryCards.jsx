const Icon = ({ children }) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
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
  layers: (
    <Icon>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </Icon>
  ),
  repo: (
    <Icon>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
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
  app: (
    <Icon>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </Icon>
  ),
  check: (
    <Icon>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </Icon>
  ),
  alert: (
    <Icon>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </Icon>
  ),
};

export default function SummaryCards({ summary }) {
  if (!summary) return null;

  const cards = [
    {
      key: "types",
      label: "Deployment Types",
      value: summary.deployment_types,
      icon: ICONS.layers,
      tone: "blue",
    },
    {
      key: "repos",
      label: "Total Repositories",
      value: summary.total_repositories,
      icon: ICONS.repo,
      tone: "purple",
    },
    {
      key: "deploys",
      label: "Total Deployments",
      value: summary.total_deployments,
      icon: ICONS.rocket,
      sub: `${summary.applications} applications · ${summary.environments} env${summary.environments === 1 ? "" : "s"}`,
      tone: "indigo",
    },
    {
      key: "success",
      label: "Avg Success Rate",
      value: `${summary.success_rate}%`,
      icon: ICONS.check,
      sub: `${summary.successful}/${summary.total_deployments} successful`,
      tone: "green",
    },
    {
      key: "failed",
      label: "Failed",
      value: summary.failed,
      icon: ICONS.alert,
      sub:
        summary.acknowledged > 0
          ? `${summary.acknowledged} acknowledged`
          : null,
      tone: "red",
    },
  ];

  return (
    <div className="summary-cards">
      {cards.map((c) => (
        <div key={c.key} className={`summary-card tone-${c.tone}`}>
          <div className="summary-icon">{c.icon}</div>
          <div className="summary-body">
            <div className="summary-label">{c.label}</div>
            <div className="summary-value">{c.value}</div>
            {c.sub && <div className="summary-sub">{c.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
