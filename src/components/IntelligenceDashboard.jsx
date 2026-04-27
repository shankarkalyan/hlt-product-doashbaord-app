import { useMemo, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import KPICards from "./KPICards";
import AnimatedNumber from "./AnimatedNumber";

// Application color map (project_name -> color)
const AC = {
  HLINTRANET: "#117ACA",
  HLCE: "#10b981",
  HLSMC: "#f97316",
  HLSMCE: "#ef4444",
  HLACC: "#8b5cf6",
  HLCEIFS: "#38bdf8",
};

const APP_FALLBACK = ["#0ea5e9", "#84cc16", "#a855f7", "#f43f5e", "#06b6d4", "#22c55e"];
function colorForApp(p) {
  if (AC[p]) return AC[p];
  let h = 0;
  for (let i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) | 0;
  return APP_FALLBACK[Math.abs(h) % APP_FALLBACK.length];
}

const TYPE_COLORS = {
  TERRAFORM: "#117ACA",
  GAP: "#f97316",
  ECS: "#38bdf8",
  EKS: "#10b981",
  LAMBDA: "#8b5cf6",
  GKP: "#ec4899",
  VSI: "#eab308",
  GLUE: "#14b8a6",
  AWS: "#0a4b94",
};
const TYPE_FALLBACK = ["#0ea5e9", "#84cc16", "#a855f7", "#f43f5e", "#06b6d4", "#22c55e"];
function colorForType(t) {
  if (TYPE_COLORS[t]) return TYPE_COLORS[t];
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return TYPE_FALLBACK[Math.abs(h) % TYPE_FALLBACK.length];
}

const STATUS_COLORS = {
  SUCCESS: "#10b981",
  ACKNOWLEDGED: "#f97316",
  FAILED: "#ef4444",
};
const STATUS_LIST = ["SUCCESS", "ACKNOWLEDGED", "FAILED"];

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function Section({ children }) {
  return (
    <div className="section-wrap">
      <div className="section-lbl">{children}</div>
    </div>
  );
}

function ExpandIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function ChartCard({ title, sub, onExpand, children, footer, height = 230 }) {
  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <div className="chart-card-title">
          <div className="chart-title">{title}</div>
          <div className="chart-sub">{sub}</div>
        </div>
        {onExpand && (
          <button type="button" className="chart-expand" onClick={onExpand} aria-label="Expand chart" title="Expand">
            <ExpandIcon />
          </button>
        )}
      </div>
      <div className="chart-wrap" style={{ height }}>
        {children}
      </div>
      {footer}
    </div>
  );
}

const pointerOnHover = (e, els) => {
  const t = e?.native?.target;
  if (t) t.style.cursor = els.length ? "pointer" : "default";
};

export default function IntelligenceDashboard({
  deployments,
  isDark,
  openDrill,
  setExpandedChart,
}) {
  const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const tickColor = isDark ? "#94a3b8" : "#475569";
  const onSurfaceText = isDark ? "#e2e8f0" : "#0f172a";

  const labelOnTop = {
    color: onSurfaceText,
    font: { weight: 700, size: 11, family: "'JetBrains Mono', monospace" },
    anchor: "end",
    align: "top",
    offset: 4,
    formatter: (v) => (v && v !== 0 ? v : ""),
  };
  const labelInside = {
    color: "#ffffff",
    font: { weight: 700, size: 11, family: "'JetBrains Mono', monospace" },
    anchor: "center",
    align: "center",
    formatter: (v) => (v && v !== 0 ? v : ""),
    textStrokeColor: "rgba(0,0,0,0.45)",
    textStrokeWidth: 2,
  };

  const intel = useMemo(() => {
    // Group by application (project_name)
    const apps = {};
    const repos = {};
    deployments.forEach((d) => {
      const proj = d.project_name;
      if (!apps[proj]) {
        apps[proj] = {
          project: proj,
          appId: d.application_id,
          appName: d.application_name,
          repos: new Set(),
          deploys: [],
          deployTypes: new Set(),
        };
      }
      apps[proj].repos.add(d.repo_name);
      apps[proj].deploys.push(d);
      apps[proj].deployTypes.add(d.deploy_type);

      if (!repos[d.repo_name]) {
        repos[d.repo_name] = {
          repo: d.repo_name,
          deploys: [],
          apps: new Set(),
          deployTypes: new Set(),
          firstSeen: null,
          lastSeen: null,
        };
      }
      const r = repos[d.repo_name];
      r.deploys.push(d);
      r.apps.add(d.project_name);
      r.deployTypes.add(d.deploy_type);
      const dt = new Date(d.deploy_time);
      if (!r.firstSeen || dt < r.firstSeen) r.firstSeen = dt;
      if (!r.lastSeen || dt > r.lastSeen) r.lastSeen = dt;
    });

    const appList = Object.values(apps).sort((a, b) => a.project.localeCompare(b.project));
    const repoList = Object.values(repos);

    // Per-app metrics
    const reposPerApp = appList.map((a) => ({ project: a.project, count: a.repos.size }));
    const deploysPerApp = appList.map((a) => ({ project: a.project, count: a.deploys.length }));
    const successPerApp = appList.map((a) => {
      const total = a.deploys.length;
      const ok = a.deploys.filter((d) => d.deploy_status === "SUCCESS").length;
      return { project: a.project, rate: total ? Math.round((ok / total) * 100) : 0, total };
    });

    // Failure rate per repo (top 10 by rate, then by total)
    const failurePerRepo = repoList
      .map((r) => {
        const failed = r.deploys.filter((d) => d.deploy_status === "FAILED").length;
        const ack = r.deploys.filter((d) => d.deploy_status === "ACKNOWLEDGED").length;
        const total = r.deploys.length;
        return {
          repo: r.repo,
          failed,
          ack,
          total,
          rate: total ? Math.round((failed / total) * 100) : 0,
          troubled: total ? Math.round(((failed + ack) / total) * 100) : 0,
        };
      })
      .sort((a, b) => b.troubled - a.troubled || b.total - a.total)
      .slice(0, 10);

    // Repo stability leaderboard (success rate)
    const stability = repoList
      .map((r) => {
        const ok = r.deploys.filter((d) => d.deploy_status === "SUCCESS").length;
        const total = r.deploys.length;
        return {
          repo: r.repo,
          total,
          success: ok,
          rate: total ? Math.round((ok / total) * 100) : 0,
          apps: [...r.apps],
        };
      })
      .sort((a, b) => b.rate - a.rate || b.total - a.total);

    // Composite risk score: failure_rate × deploy_volume × repo_count × 10
    const riskScores = appList
      .map((a) => {
        const total = a.deploys.length;
        const failed = a.deploys.filter((d) => d.deploy_status === "FAILED").length;
        const ack = a.deploys.filter((d) => d.deploy_status === "ACKNOWLEDGED").length;
        const failureRate = total ? failed / total : 0;
        const score = Math.round(failureRate * total * a.repos.size * 10);
        return {
          project: a.project,
          appName: a.appName,
          appId: a.appId,
          repos: a.repos.size,
          total,
          failed,
          ack,
          failureRate,
          score,
        };
      })
      .sort((a, b) => b.score - a.score || b.failed - a.failed);

    // Shared repos: repos used by >1 app
    const sharedRepos = repoList
      .filter((r) => r.apps.size > 1)
      .map((r) => ({
        repo: r.repo,
        apps: [...r.apps].sort(),
        deploys: r.deploys.length,
        failed: r.deploys.filter((d) => d.deploy_status === "FAILED").length,
        ack: r.deploys.filter((d) => d.deploy_status === "ACKNOWLEDGED").length,
      }))
      .sort((a, b) => b.apps.length - a.apps.length || b.deploys - a.deploys);

    // Repo lifecycle (first→last deploy gap, in days)
    const lifecycle = repoList
      .map((r) => {
        const start = r.firstSeen.getTime();
        const end = r.lastSeen.getTime();
        return { repo: r.repo, start, end, span: Math.max(0, end - start), deploys: r.deploys.length };
      })
      .sort((a, b) => a.start - b.start);

    // Deploy types per repo (top 8 by deploys)
    const topRepos = [...repoList]
      .sort((a, b) => b.deploys.length - a.deploys.length)
      .slice(0, 8);
    const allTypes = [...new Set(deployments.map((d) => d.deploy_type))].sort();

    // Cadence: per-month per-app
    const monthSet = new Set();
    deployments.forEach((d) => {
      const dt = new Date(d.deploy_time);
      monthSet.add(`${dt.getFullYear()}-${dt.getMonth()}`);
    });
    const monthsArr = [...monthSet]
      .map((s) => {
        const [y, m] = s.split("-").map(Number);
        return { y, m };
      })
      .sort((a, b) => (a.y - b.y) * 100 + (a.m - b.m));

    // Hotspot: App × Repo failure/ack count grid (rows = apps, cols = repos)
    const hotspotCols = topRepos.map((r) => r.repo);
    const hotspot = appList.map((a) => ({
      project: a.project,
      cells: hotspotCols.map((repo) => {
        const slice = a.deploys.filter((d) => d.repo_name === repo);
        const failed = slice.filter((d) => d.deploy_status === "FAILED").length;
        const ack = slice.filter((d) => d.deploy_status === "ACKNOWLEDGED").length;
        return { repo, total: slice.length, failed, ack, troubled: failed + ack };
      }),
    }));

    // KPI computations
    const total = deployments.length;
    const overallSuccess = total
      ? ((deployments.filter((d) => d.deploy_status === "SUCCESS").length / total) * 100).toFixed(1)
      : "0.0";
    const overallFailure = total
      ? ((deployments.filter((d) => d.deploy_status === "FAILED").length / total) * 100).toFixed(1)
      : "0.0";
    const mostActive = [...repoList].sort((a, b) => b.deploys.length - a.deploys.length)[0];

    return {
      apps,
      appList,
      repos,
      repoList,
      reposPerApp,
      deploysPerApp,
      successPerApp,
      failurePerRepo,
      stability,
      riskScores,
      sharedRepos,
      lifecycle,
      topRepos,
      allTypes,
      monthsArr,
      hotspotCols,
      hotspot,
      total,
      totalRepos: repoList.length,
      totalApps: appList.length,
      avgReposPerApp: appList.length ? (repoList.length / appList.length).toFixed(1) : "0",
      overallSuccess,
      overallFailure,
      mostActive,
      highestRisk: riskScores[0],
    };
  }, [deployments]);

  // ---- KPI cards ----
  const kpiCards = [
    {
      label: "Total Applications",
      value: intel.totalApps,
      sub: "Distinct projects observed",
      tone: "blue",
    },
    {
      label: "Total Repositories",
      value: intel.totalRepos,
      sub: `Across ${intel.totalApps} applications`,
      tone: "cyan",
    },
    {
      label: "Avg Repos / App",
      value: intel.avgReposPerApp,
      sub: "Repos per application",
      tone: "purple",
    },
    {
      label: "Shared Repositories",
      value: intel.sharedRepos.length,
      sub: "Used by 2+ applications",
      tone: "orange",
    },
    {
      label: "Overall Success",
      value: `${intel.overallSuccess}%`,
      sub: `${deployments.filter((d) => d.deploy_status === "SUCCESS").length} successful`,
      tone: "green",
      trend: "up",
    },
    {
      label: "Overall Failure",
      value: `${intel.overallFailure}%`,
      sub: `${deployments.filter((d) => d.deploy_status === "FAILED").length} failed`,
      tone: "red",
      trend: "dn",
    },
    {
      label: "Highest Risk App",
      value: intel.highestRisk ? intel.highestRisk.project : "—",
      sub: intel.highestRisk
        ? `${intel.highestRisk.failed} failed · score ${intel.highestRisk.score}`
        : "No data",
      tone: "red",
    },
    {
      label: "Most Active Repo",
      value: intel.mostActive ? intel.mostActive.deploys.length : 0,
      sub: intel.mostActive ? intel.mostActive.repo : "No data",
      tone: "blue",
    },
  ];

  // ---- Drill helpers ----
  const drillByApp = (project) =>
    openDrill(`Application · ${project}`, (d) => d.project_name === project);
  const drillByRepo = (repo) =>
    openDrill(`Repository · ${repo}`, (d) => d.repo_name === repo);
  const drillByAppRepo = (project, repo) =>
    openDrill(
      `${project} · ${repo}`,
      (d) => d.project_name === project && d.repo_name === repo
    );
  const drillByMonth = (y, m, project) =>
    openDrill(
      `${MONTHS[m]} ${y}${project ? ` · ${project}` : ""}`,
      (d) => {
        const dt = new Date(d.deploy_time);
        return (
          dt.getFullYear() === y &&
          dt.getMonth() === m &&
          (!project || d.project_name === project)
        );
      }
    );
  const drillByRepoType = (repo, type) =>
    openDrill(
      `${repo} · ${type}`,
      (d) => d.repo_name === repo && d.deploy_type === type
    );

  // ---- 1. Repo Count per App (vertical bar) ----
  const repoCountData = {
    labels: intel.reposPerApp.map((r) => r.project),
    datasets: [
      {
        data: intel.reposPerApp.map((r) => r.count),
        backgroundColor: intel.reposPerApp.map((r) => colorForApp(r.project) + "cc"),
        borderColor: intel.reposPerApp.map((r) => colorForApp(r.project)),
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };
  const repoCountOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillByApp(intel.reposPerApp[els[0].index].project);
    },
    plugins: {
      legend: { display: false },
      datalabels: { ...labelOnTop },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: tickColor, font: { family: "'JetBrains Mono'", size: 10 } },
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: tickColor, stepSize: 1 },
        beginAtZero: true,
      },
    },
  };

  // ---- 2. Deploy Frequency per App ----
  const deployFreqData = {
    labels: intel.deploysPerApp.map((r) => r.project),
    datasets: [
      {
        data: intel.deploysPerApp.map((r) => r.count),
        backgroundColor: intel.deploysPerApp.map((r) => colorForApp(r.project) + "cc"),
        borderColor: intel.deploysPerApp.map((r) => colorForApp(r.project)),
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };
  const deployFreqOptions = {
    ...repoCountOptions,
    onClick: (_e, els) => {
      if (els.length) drillByApp(intel.deploysPerApp[els[0].index].project);
    },
  };

  // ---- 3. Success Rate per App ----
  const successData = {
    labels: intel.successPerApp.map((r) => r.project),
    datasets: [
      {
        data: intel.successPerApp.map((r) => r.rate),
        backgroundColor: intel.successPerApp.map((r) =>
          r.rate >= 80 ? "#10b98199" : r.rate >= 50 ? "#f9731699" : "#ef444499"
        ),
        borderColor: intel.successPerApp.map((r) =>
          r.rate >= 80 ? "#10b981" : r.rate >= 50 ? "#f97316" : "#ef4444"
        ),
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };
  const successOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillByApp(intel.successPerApp[els[0].index].project);
    },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => `${c.raw}% success` } },
      datalabels: { ...labelOnTop, formatter: (v) => `${v}%` },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: tickColor, font: { family: "'JetBrains Mono'", size: 10 } },
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: tickColor },
        min: 0,
        max: 110,
      },
    },
  };

  // ---- 4. Failure Rate per Repo (top 10) — horizontal bar ----
  const failRepoLabels = intel.failurePerRepo.map((r) => truncate(r.repo, 28));
  const failRepoData = {
    labels: failRepoLabels,
    datasets: [
      {
        label: "Failed",
        data: intel.failurePerRepo.map((r) => r.failed),
        backgroundColor: "#ef444499",
        borderColor: "#ef4444",
        borderWidth: 2,
        borderRadius: 6,
        stack: "trouble",
      },
      {
        label: "Acknowledged",
        data: intel.failurePerRepo.map((r) => r.ack),
        backgroundColor: "#f9731699",
        borderColor: "#f97316",
        borderWidth: 2,
        borderRadius: 6,
        stack: "trouble",
      },
    ],
  };
  const failRepoOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillByRepo(intel.failurePerRepo[els[0].index].repo);
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 10, font: { size: 10 }, color: tickColor, padding: 8 },
      },
      datalabels: { ...labelInside, formatter: (v) => (v > 0 ? v : "") },
    },
    scales: {
      x: {
        stacked: true,
        grid: { color: gridColor },
        ticks: { color: tickColor, stepSize: 1 },
        beginAtZero: true,
      },
      y: {
        stacked: true,
        grid: { display: false },
        ticks: { color: tickColor, font: { family: "'JetBrains Mono'", size: 10 } },
      },
    },
  };

  // ---- 5. Cadence — stacked area per app per month ----
  const cadenceLabels = intel.monthsArr.map(({ y, m }) => `${MONTHS[m]} ${y}`);
  const cadenceData = {
    labels: cadenceLabels,
    datasets: intel.appList.map((a) => ({
      label: a.project,
      data: intel.monthsArr.map(({ y, m }) =>
        a.deploys.filter((d) => {
          const dt = new Date(d.deploy_time);
          return dt.getFullYear() === y && dt.getMonth() === m;
        }).length
      ),
      backgroundColor: colorForApp(a.project) + "55",
      borderColor: colorForApp(a.project),
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointBackgroundColor: colorForApp(a.project),
      pointRadius: 3,
      pointHoverRadius: 6,
    })),
  };
  const cadenceOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) {
        const el = els[0];
        const project = cadenceData.datasets[el.datasetIndex].label;
        const { y, m } = intel.monthsArr[el.index];
        drillByMonth(y, m, project);
      }
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 10, font: { size: 10 }, color: tickColor, padding: 8 },
      },
      datalabels: { display: false },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: tickColor } },
      y: {
        stacked: true,
        grid: { color: gridColor },
        ticks: { color: tickColor, stepSize: 1 },
        beginAtZero: true,
      },
    },
  };

  // ---- 6. Repo Lifecycle — float bar (per-repo first→last) ----
  // Use stacked bars: dataset 0 = invisible offset (start), dataset 1 = span (visible)
  const baseTime = intel.lifecycle.length ? intel.lifecycle[0].start : 0;
  const dayMs = 86400000;
  const lifecycleRepos = intel.lifecycle.map((r) => truncate(r.repo, 28));
  const lifecycleData = {
    labels: lifecycleRepos,
    datasets: [
      {
        label: "_offset",
        data: intel.lifecycle.map((r) => Math.round((r.start - baseTime) / dayMs)),
        backgroundColor: "rgba(0,0,0,0)",
        borderColor: "rgba(0,0,0,0)",
        borderWidth: 0,
        stack: "lifecycle",
        datalabels: { display: false },
      },
      {
        label: "Lifecycle (days)",
        data: intel.lifecycle.map((r) => Math.max(1, Math.round(r.span / dayMs))),
        backgroundColor: intel.lifecycle.map((r) => {
          const proj = r.repo && intel.repos[r.repo].apps.values().next().value;
          return colorForApp(proj || "") + "cc";
        }),
        borderColor: intel.lifecycle.map((r) => {
          const proj = r.repo && intel.repos[r.repo].apps.values().next().value;
          return colorForApp(proj || "");
        }),
        borderWidth: 2,
        borderRadius: 4,
        stack: "lifecycle",
      },
    ],
  };
  const lifecycleOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillByRepo(intel.lifecycle[els[0].index].repo);
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (c) => {
            if (c.datasetIndex === 0) return null;
            const item = intel.lifecycle[c.dataIndex];
            const start = new Date(item.start);
            const end = new Date(item.end);
            const span = Math.round(item.span / dayMs);
            return `${start.toLocaleDateString()} → ${end.toLocaleDateString()} · ${span} days · ${item.deploys} deploys`;
          },
        },
      },
      datalabels: {
        display: (ctx) => ctx.datasetIndex === 1,
        color: "#fff",
        font: { weight: 700, size: 10, family: "'JetBrains Mono', monospace" },
        anchor: "center",
        align: "center",
        formatter: (v, ctx) => `${intel.lifecycle[ctx.dataIndex].deploys}d`,
        textStrokeColor: "rgba(0,0,0,0.5)",
        textStrokeWidth: 2,
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { color: gridColor },
        ticks: { color: tickColor },
        beginAtZero: true,
        title: { display: true, text: "Days from earliest first-deploy", color: tickColor },
      },
      y: {
        stacked: true,
        grid: { display: false },
        ticks: { color: tickColor, font: { family: "'JetBrains Mono'", size: 10 } },
      },
    },
  };

  // ---- 7. Deploy Type per Repo (top 8) — horizontal stacked bar ----
  const typePerRepoLabels = intel.topRepos.map((r) => truncate(r.repo, 26));
  const typePerRepoData = {
    labels: typePerRepoLabels,
    datasets: intel.allTypes.map((t) => ({
      label: t,
      data: intel.topRepos.map(
        (r) => r.deploys.filter((d) => d.deploy_type === t).length
      ),
      backgroundColor: colorForType(t) + "99",
      borderColor: colorForType(t),
      borderWidth: 1,
      borderRadius: 4,
    })),
  };
  const typePerRepoOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) {
        const el = els[0];
        const repo = intel.topRepos[el.index].repo;
        const type = typePerRepoData.datasets[el.datasetIndex].label;
        drillByRepoType(repo, type);
      }
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 10, font: { size: 10 }, color: tickColor, padding: 8 },
      },
      datalabels: { ...labelInside, formatter: (v) => (v > 0 ? v : "") },
    },
    scales: {
      x: {
        stacked: true,
        grid: { color: gridColor },
        ticks: { color: tickColor, stepSize: 1 },
        beginAtZero: true,
      },
      y: {
        stacked: true,
        grid: { display: false },
        ticks: { color: tickColor, font: { family: "'JetBrains Mono'", size: 10 } },
      },
    },
  };

  // ---- Chart definitions for expand modal ----
  const expandRepoCount = () =>
    setExpandedChart({
      key: "intel-repoCount",
      title: "Repository Count per Application",
      sub: "Number of unique repos per app — click a bar",
      render: () => <Bar data={repoCountData} options={repoCountOptions} />,
    });
  const expandDeployFreq = () =>
    setExpandedChart({
      key: "intel-deployFreq",
      title: "Deployment Frequency per Application",
      sub: "Total deployments per app — click a bar",
      render: () => <Bar data={deployFreqData} options={deployFreqOptions} />,
    });
  const expandSuccess = () =>
    setExpandedChart({
      key: "intel-success",
      title: "Success Rate per Application",
      sub: "% successful deploys per app",
      render: () => <Bar data={successData} options={successOptions} />,
    });
  const expandFailRepo = () =>
    setExpandedChart({
      key: "intel-failRepo",
      title: "Top 10 Troubled Repositories",
      sub: "Failed + Acknowledged stacked — click a row",
      render: () => <Bar data={failRepoData} options={failRepoOptions} />,
    });
  const expandCadence = () =>
    setExpandedChart({
      key: "intel-cadence",
      title: "Deployment Cadence — Stacked by Application",
      sub: "Per-month volume per application",
      render: () => <Line data={cadenceData} options={cadenceOptions} />,
    });
  const expandLifecycle = () =>
    setExpandedChart({
      key: "intel-lifecycle",
      title: "Repository Lifecycle",
      sub: "First→last deploy span per repo",
      render: () => <Bar data={lifecycleData} options={lifecycleOptions} />,
    });
  const expandTypePerRepo = () =>
    setExpandedChart({
      key: "intel-typePerRepo",
      title: "Deploy Type per Repository (Top 8)",
      sub: "Stacked by deploy type — click a segment",
      render: () => <Bar data={typePerRepoData} options={typePerRepoOptions} />,
    });

  return (
    <>
      <Section>Portfolio Overview</Section>
      <KPICards cards={kpiCards} />

      <Section>Application Portfolio Analysis</Section>
      <div className="chart-grid g2">
        <ChartCard
          title="Repository Count per Application"
          sub="Unique repos per app · click a bar"
          onExpand={expandRepoCount}
        >
          <Bar data={repoCountData} options={repoCountOptions} />
        </ChartCard>
        <ChartCard
          title="Deployment Frequency per Application"
          sub="Total deploys per app · click a bar"
          onExpand={expandDeployFreq}
        >
          <Bar data={deployFreqData} options={deployFreqOptions} />
        </ChartCard>
      </div>

      <Section>Health &amp; Reliability</Section>
      <div className="chart-grid g2">
        <ChartCard
          title="Success Rate per Application"
          sub="% successful deploys (green=80%+) · click a bar"
          onExpand={expandSuccess}
        >
          <Bar data={successData} options={successOptions} />
        </ChartCard>
        <ChartCard
          title="Top 10 Troubled Repositories"
          sub="Failed + Acknowledged stacked · click a row"
          onExpand={expandFailRepo}
          height={260}
        >
          <Bar data={failRepoData} options={failRepoOptions} />
        </ChartCard>
      </div>

      <Section>Risk Scoring</Section>
      <div className="chart-grid g2">
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <div className="chart-title">Repository Stability Leaderboard</div>
              <div className="chart-sub">
                Sorted by success rate · click a row to drill in
              </div>
            </div>
          </div>
          <StabilityBars rows={intel.stability} onRowClick={drillByRepo} />
        </div>
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <div className="chart-title">Application Composite Risk Score</div>
              <div className="chart-sub">
                failure_rate × volume × repos × 10 · click an app
              </div>
            </div>
          </div>
          <RiskScorePills rows={intel.riskScores} onRowClick={drillByApp} />
        </div>
      </div>

      <Section>Failure Hotspot Heatmap — App × Repo</Section>
      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <div className="chart-title">Failure / Ack Hotspot Heatmap</div>
              <div className="chart-sub">
                Darker cell = more troubled deploys · click any cell
              </div>
            </div>
          </div>
          <HotspotHeatmap
            apps={intel.hotspot}
            repos={intel.hotspotCols}
            onCellClick={(project, repo) => drillByAppRepo(project, repo)}
          />
        </div>
      </div>

      <Section>Cadence &amp; Coupling Risk</Section>
      <div className="chart-grid g2">
        <ChartCard
          title="Deployment Cadence — Stacked by App"
          sub="Per-month volume per application · click a point"
          onExpand={expandCadence}
          height={260}
        >
          <Line data={cadenceData} options={cadenceOptions} />
        </ChartCard>
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <div className="chart-title">Shared Repository Risk Register</div>
              <div className="chart-sub">
                Repos used by 2+ applications · click a row to drill in
              </div>
            </div>
          </div>
          <SharedRepoTable rows={intel.sharedRepos} onRowClick={drillByRepo} />
        </div>
      </div>

      <Section>Repository Lifecycle &amp; Technology Spread</Section>
      <div className="chart-grid g2">
        <ChartCard
          title="Repository Lifecycle"
          sub="First→last deploy span per repo · click a bar"
          onExpand={expandLifecycle}
          height={Math.max(260, intel.lifecycle.length * 16)}
        >
          <Bar data={lifecycleData} options={lifecycleOptions} />
        </ChartCard>
        <ChartCard
          title="Deploy Type per Repo (Top 8)"
          sub="Stacked by deploy type · click a segment"
          onExpand={expandTypePerRepo}
          height={260}
        >
          <Bar data={typePerRepoData} options={typePerRepoOptions} />
        </ChartCard>
      </div>

      <Section>Full Deployment Log</Section>
      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <div className="chart-title">All Deployments</div>
              <div className="chart-sub">
                Sortable · click any row to inspect the full record
              </div>
            </div>
          </div>
          <FullLogTable
            deployments={deployments}
            onRowClick={(d) =>
              openDrill(d.repo_name, (row) => row.jet_uuid === d.jet_uuid)
            }
          />
        </div>
      </div>
    </>
  );
}

function truncate(s, max) {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// ---- Repository Stability Leaderboard ----
function StabilityBars({ rows, onRowClick }) {
  return (
    <div className="stab-list">
      {rows.map((r) => {
        const tone = r.rate >= 80 ? "ok" : r.rate >= 50 ? "warn" : "bad";
        return (
          <button
            key={r.repo}
            type="button"
            className="stab-row"
            onClick={() => onRowClick(r.repo)}
          >
            <div className="stab-meta">
              <span className="stab-name" title={r.repo}>{r.repo}</span>
              <span className="stab-stats">
                <AnimatedNumber value={r.success} />/
                <AnimatedNumber value={r.total} />
                {" · "}
                <b>{r.rate}%</b>
              </span>
            </div>
            <div className={`stab-track tone-${tone}`}>
              <div className="stab-fill" style={{ width: `${r.rate}%` }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---- Application Composite Risk Score ----
function RiskScorePills({ rows, onRowClick }) {
  const max = Math.max(1, ...rows.map((r) => r.score));
  return (
    <div className="risk-list">
      {rows.map((r) => {
        const tone = r.score === 0 ? "ok" : r.score < max * 0.4 ? "warn" : "bad";
        const pct = Math.max(8, Math.round((r.score / max) * 100));
        return (
          <button
            key={r.project}
            type="button"
            className={`risk-pill tone-${tone}`}
            onClick={() => onRowClick(r.project)}
            title={r.appName}
          >
            <span className="risk-app">{r.project}</span>
            <span className="risk-bar">
              <span className="risk-bar-fill" style={{ width: `${pct}%` }} />
            </span>
            <span className="risk-stats">
              <span className="risk-score">
                <AnimatedNumber value={r.score} />
              </span>
              <span className="risk-detail">
                {r.failed}F · {r.ack}A · {r.total} deploys · {r.repos} repos
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---- Failure Hotspot Heatmap ----
function HotspotHeatmap({ apps, repos, onCellClick }) {
  // intensity from 0..1 across all cells
  let max = 0;
  apps.forEach((a) => a.cells.forEach((c) => { if (c.troubled > max) max = c.troubled; }));
  const safe = max || 1;
  return (
    <div className="hot-wrap">
      <table className="hot-table">
        <thead>
          <tr>
            <th />
            {repos.map((r) => (
              <th key={r} title={r}>
                <span className="hot-col-label">{truncate(r, 14)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {apps.map((row) => (
            <tr key={row.project}>
              <th className="hot-row-label">
                <span className="hot-app-dot" style={{ background: colorForApp(row.project) }} />
                {row.project}
              </th>
              {row.cells.map((c) => {
                const intensity = c.troubled / safe;
                const hasFail = c.failed > 0;
                const hue = hasFail ? "239,68,68" : c.ack > 0 ? "249,115,22" : c.total > 0 ? "16,185,129" : "148,163,184";
                const alpha = c.total === 0 ? 0.05 : 0.15 + intensity * 0.6;
                return (
                  <td
                    key={c.repo}
                    className={`hot-cell${c.total ? " has-data" : ""}`}
                    style={{
                      background: `rgba(${hue},${alpha})`,
                      borderColor: c.total ? `rgba(${hue},0.65)` : "transparent",
                    }}
                    onClick={() => c.total && onCellClick(row.project, c.repo)}
                    title={`${row.project} · ${c.repo}: ${c.total} deploys (${c.failed} failed, ${c.ack} ack)`}
                  >
                    {c.total > 0 && (
                      <span className="hot-cell-val">
                        {c.troubled > 0 ? `${c.troubled}/${c.total}` : c.total}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Shared Repository Risk Register ----
function SharedRepoTable({ rows, onRowClick }) {
  if (!rows.length) {
    return (
      <div className="shared-empty">
        No shared repositories — every repo belongs to a single application.
      </div>
    );
  }
  return (
    <div className="shared-wrap">
      <table className="shared-table">
        <thead>
          <tr>
            <th>Repository</th>
            <th>Apps using</th>
            <th>Deploys</th>
            <th>Trouble</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.repo}
              className="shared-row"
              onClick={() => onRowClick(r.repo)}
            >
              <td className="shared-repo" title={r.repo}>{r.repo}</td>
              <td>
                <div className="shared-apps">
                  {r.apps.map((a) => (
                    <span key={a} className="shared-app-pill" style={{ background: colorForApp(a) + "33", borderColor: colorForApp(a), color: colorForApp(a) }}>
                      {a}
                    </span>
                  ))}
                </div>
              </td>
              <td><b>{r.deploys}</b></td>
              <td>
                <span className="shared-trouble">
                  {r.failed > 0 && <span className="trouble-pill bad">{r.failed}F</span>}
                  {r.ack > 0 && <span className="trouble-pill warn">{r.ack}A</span>}
                  {r.failed === 0 && r.ack === 0 && <span className="trouble-pill ok">clean</span>}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Full sortable deployment log ----
const LOG_COLUMNS = [
  { key: "deploy_time", label: "Deploy Time", numeric: true },
  { key: "project_name", label: "App" },
  { key: "repo_name", label: "Repository" },
  { key: "deploy_type", label: "Type" },
  { key: "deploy_status", label: "Status" },
  { key: "change_ctrl_ticket", label: "Change Ticket" },
];

function FullLogTable({ deployments, onRowClick }) {
  const [sort, setSort] = useState({ key: "deploy_time", dir: "desc" });

  const sorted = useMemo(() => {
    const copy = [...deployments];
    copy.sort((a, b) => {
      let av = a[sort.key];
      let bv = b[sort.key];
      if (sort.key === "deploy_time") {
        av = new Date(av).getTime();
        bv = new Date(bv).getTime();
      }
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [deployments, sort]);

  const onHeaderClick = (k) =>
    setSort((s) =>
      s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "asc" }
    );

  return (
    <div className="log-wrap">
      <table className="log-table">
        <thead>
          <tr>
            {LOG_COLUMNS.map((c) => (
              <th
                key={c.key}
                className={`log-th${sort.key === c.key ? " sorted" : ""}`}
                onClick={() => onHeaderClick(c.key)}
              >
                <span>{c.label}</span>
                <span className="log-arrow">
                  {sort.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((d) => (
            <tr
              key={d.jet_uuid}
              className="log-row"
              onClick={() => onRowClick(d)}
            >
              <td className="log-time">{formatTs(d.deploy_time)}</td>
              <td>
                <span className="log-app-pill" style={{ color: colorForApp(d.project_name), borderColor: colorForApp(d.project_name) + "55", background: colorForApp(d.project_name) + "20" }}>
                  {d.project_name}
                </span>
              </td>
              <td className="log-repo" title={d.repo_name}>{d.repo_name}</td>
              <td>
                <span className="log-type-pill" style={{ color: colorForType(d.deploy_type), borderColor: colorForType(d.deploy_type) + "55", background: colorForType(d.deploy_type) + "20" }}>
                  {d.deploy_type}
                </span>
              </td>
              <td>
                <span className={`log-status-pill log-status-${d.deploy_status.toLowerCase()}`}>
                  {d.deploy_status}
                </span>
              </td>
              <td className="log-ticket">{d.change_ctrl_ticket}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatTs(ts) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
