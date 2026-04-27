import { useEffect, useMemo, useState } from "react";
import { Doughnut, Bar, Radar, Line, Bubble } from "react-chartjs-2";
import { Chart as ChartJS, registerables } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import deployments from "./data/cmh-deployment-data.json";
import Header from "./components/Header";
import KPICards from "./components/KPICards";
import RiskHeatmap from "./components/RiskHeatmap";
import RecentTable from "./components/RecentTable";
import DrillPanel from "./components/DrillPanel";
import ChartModal from "./components/ChartModal";
import AnimatedNumber from "./components/AnimatedNumber";
import LandingTile from "./components/LandingTile";
import Breadcrumbs from "./components/Breadcrumbs";

ChartJS.register(...registerables, ChartDataLabels);

// Pronounced entrance animation that replays on every fresh chart mount
// (initial card render *and* every time the expand modal opens).
// We only override duration/easing — leaving Chart.js' built-in
// `animations.*` config (including the internal `numbers` properties list)
// untouched so per-property animation continues to work correctly.
ChartJS.defaults.animation.duration = 1200;
ChartJS.defaults.animation.easing = "easeOutQuart";

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

// Stable colors for deploy_types that aren't in TYPE_COLORS — picked
// deterministically from a fallback palette so new data automatically gets
// a consistent color without code changes.
const FALLBACK_COLORS = [
  "#0ea5e9",
  "#84cc16",
  "#a855f7",
  "#f43f5e",
  "#06b6d4",
  "#22c55e",
  "#fb7185",
  "#fde047",
];
function colorForType(t) {
  if (TYPE_COLORS[t]) return TYPE_COLORS[t];
  let hash = 0;
  for (let i = 0; i < t.length; i++) {
    hash = (hash * 31 + t.charCodeAt(i)) | 0;
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

const STATUS_COLORS = {
  SUCCESS: "#10b981",
  ACKNOWLEDGED: "#f97316",
  FAILED: "#ef4444",
};

const STATUS_LIST = ["SUCCESS", "ACKNOWLEDGED", "FAILED"];

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function Section({ children }) {
  return (
    <div className="section-wrap">
      <div className="section-lbl">{children}</div>
    </div>
  );
}

const HOUSE_ICON = (
  <svg
    viewBox="0 0 24 24"
    width="28"
    height="28"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const LAYERS_ICON = (
  <svg
    viewBox="0 0 24 24"
    width="28"
    height="28"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

function ExpandIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function ChartCard({
  title,
  sub,
  onExpand,
  children,
  footer,
  height = 210,
}) {
  return (
    <div className="chart-card">
      <div className="chart-card-head">
        <div className="chart-card-title">
          <div className="chart-title">{title}</div>
          <div className="chart-sub">{sub}</div>
        </div>
        {onExpand && (
          <button
            type="button"
            className="chart-expand"
            onClick={onExpand}
            aria-label="Expand chart"
            title="Expand"
          >
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
  const tgt = e?.native?.target;
  if (tgt) tgt.style.cursor = els.length ? "pointer" : "default";
};

export default function App() {
  const [theme, setTheme] = useState("dark");
  const [drill, setDrill] = useState(null);
  // expandedChart: id (string) of currently expanded chart
  const [expandedChart, setExpandedChart] = useState(null);
  // view: 'home' | 'product' | 'dashboard'
  const [view, setView] = useState("home");

  const goHome = () => setView("home");
  const goProduct = () => setView("product");
  const goDashboard = () => setView("dashboard");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Single source of truth for body scroll-lock. Any modal open → lock,
  // both closed → release. Avoids the prev-value-capture leak you get
  // when each component independently saves/restores body.style.overflow.
  useEffect(() => {
    const anyOpen = !!drill || !!expandedChart;
    if (anyOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drill, expandedChart]);

  const isDark = theme === "dark";

  const stats = useMemo(() => {
    const total = deployments.length;
    const byStatus = {};
    const byType = {};
    const appLabels = {};
    const monthSet = new Set();
    const productLineSet = new Set();
    const productNameSet = new Set();
    const envSet = new Set();
    let minTs = null;
    let maxTs = null;

    deployments.forEach((d) => {
      byStatus[d.deploy_status] = (byStatus[d.deploy_status] || 0) + 1;
      byType[d.deploy_type] = (byType[d.deploy_type] || 0) + 1;
      appLabels[d.application_id] = d.project_name;
      if (d.product_line) productLineSet.add(d.product_line);
      if (d.product_name) productNameSet.add(d.product_name);
      if (d.environment) envSet.add(d.environment.toUpperCase());
      const dt = new Date(d.deploy_time);
      monthSet.add(`${dt.getFullYear()}-${dt.getMonth()}`);
      if (!minTs || dt < minTs) minTs = dt;
      if (!maxTs || dt > maxTs) maxTs = dt;
    });

    const uniqueApps = [...new Set(deployments.map((d) => d.application_id))]
      .sort()
      .map(Number);
    const uniqueTypes = [
      ...new Set(deployments.map((d) => d.deploy_type)),
    ].sort();
    const uniqueStatuses = [
      ...new Set(deployments.map((d) => d.deploy_status)),
    ];

    const successRate = total
      ? (((byStatus.SUCCESS || 0) / total) * 100).toFixed(1)
      : "0.0";
    const failureRate = total
      ? (((byStatus.FAILED || 0) / total) * 100).toFixed(1)
      : "0.0";

    const months = [...monthSet]
      .map((s) => {
        const [y, m] = s.split("-").map(Number);
        return { y, m };
      })
      .sort((a, b) => (a.y - b.y) * 100 + (a.m - b.m));

    let dateRange = "";
    if (minTs && maxTs) {
      const sameYear = minTs.getFullYear() === maxTs.getFullYear();
      dateRange = sameYear
        ? `${MONTH_NAMES[minTs.getMonth()]}–${
            MONTH_NAMES[maxTs.getMonth()]
          } ${maxTs.getFullYear()}`
        : `${MONTH_NAMES[minTs.getMonth()]} ${minTs.getFullYear()}–${
            MONTH_NAMES[maxTs.getMonth()]
          } ${maxTs.getFullYear()}`;
    }

    const productLine = [...productLineSet].join(" / ");
    const productName = [...productNameSet].join(" / ");
    const environments = [...envSet].sort().join(" · ");

    return {
      total,
      byStatus,
      byType,
      appLabels,
      uniqueApps,
      uniqueTypes,
      uniqueStatuses,
      successRate,
      failureRate,
      months,
      dateRange,
      productLine,
      productName,
      environments,
    };
  }, []);

  const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const tickColor = isDark ? "#94a3b8" : "#475569";
  const onSurfaceText = isDark ? "#e2e8f0" : "#0f172a";

  // common datalabel presets
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

  // ---- Drill helpers ----
  const openDrill = (title, predicate) => {
    const rows = deployments.filter(predicate);
    setDrill({ title, rows });
  };
  const drillByType = (type) =>
    openDrill(`Deploy type · ${type}`, (d) => d.deploy_type === type);
  const drillByStatus = (status) =>
    openDrill(`Status · ${status}`, (d) => d.deploy_status === status);
  const drillByApp = (appId) =>
    openDrill(
      `Application · ${stats.appLabels[appId]} (${appId})`,
      (d) => d.application_id === appId
    );
  const drillByAppType = (appId, type) =>
    openDrill(
      `${stats.appLabels[appId]} · ${type}`,
      (d) => d.application_id === appId && d.deploy_type === type
    );
  const drillByMonth = (y, m, status) =>
    openDrill(
      `${MONTH_NAMES[m]} ${y}${status ? ` · ${status}` : ""}`,
      (d) => {
        const dt = new Date(d.deploy_time);
        return (
          dt.getFullYear() === y &&
          dt.getMonth() === m &&
          (!status || d.deploy_status === status)
        );
      }
    );
  const drillByTypeStatus = (type, status) =>
    openDrill(
      `${type} · ${status}`,
      (d) => d.deploy_type === type && d.deploy_status === status
    );

  // ---- KPI cards ----
  const kpiCards = [
    {
      label: "Total Deployments",
      value: stats.total,
      sub: `Across ${stats.uniqueApps.length} applications`,
      tone: "blue",
    },
    {
      label: "Success Rate",
      value: `${stats.successRate}%`,
      sub: `${stats.byStatus.SUCCESS || 0} successful`,
      tone: "green",
      trend: "up",
    },
    {
      label: "Failure Rate",
      value: `${stats.failureRate}%`,
      sub: `${stats.byStatus.FAILED || 0} failed`,
      tone: "red",
      trend: "dn",
    },
    {
      label: "Acknowledged",
      value: stats.byStatus.ACKNOWLEDGED || 0,
      sub: "Awaiting confirmation",
      tone: "orange",
      trend: "neu",
    },
    {
      label: "Deploy Types",
      value: stats.uniqueTypes.length,
      sub: stats.uniqueTypes.slice(0, 3).join(" · "),
      tone: "purple",
    },
    {
      label: "Applications",
      value: stats.uniqueApps.length,
      sub: `${stats.productName || "—"}${
        stats.environments ? ` · ${stats.environments}` : ""
      }`,
      tone: "cyan",
    },
  ];

  // ---- 1. Donut: deploy type distribution (numbers IN body) ----
  const dtypes = Object.keys(stats.byType).sort(
    (a, b) => stats.byType[b] - stats.byType[a]
  );
  const donutData = {
    labels: dtypes,
    datasets: [
      {
        data: dtypes.map((t) => stats.byType[t]),
        backgroundColor: dtypes.map((t) => colorForType(t) + "cc"),
        borderColor: dtypes.map((t) => colorForType(t)),
        borderWidth: 2,
        hoverOffset: 8,
      },
    ],
  };
  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillByType(dtypes[els[0].index]);
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (c) =>
            `${c.label}: ${c.raw} (${((c.raw / stats.total) * 100).toFixed(0)}%)`,
        },
      },
      datalabels: {
        ...labelInside,
        font: { weight: 800, size: 13, family: "'JetBrains Mono', monospace" },
        formatter: (v) => {
          const pct = (v / stats.total) * 100;
          if (pct < 4) return "";
          return String(v);
        },
      },
    },
  };

  // ---- 2. Status horizontal bar (numbers ON top = end of bar) ----
  const statusBarData = {
    labels: STATUS_LIST,
    datasets: [
      {
        data: STATUS_LIST.map((s) => stats.byStatus[s] || 0),
        backgroundColor: STATUS_LIST.map((s) => STATUS_COLORS[s] + "99"),
        borderColor: STATUS_LIST.map((s) => STATUS_COLORS[s]),
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };
  const statusBarOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillByStatus(STATUS_LIST[els[0].index]);
    },
    plugins: {
      legend: { display: false },
      datalabels: {
        ...labelOnTop,
        anchor: "end",
        align: "right",
        offset: 6,
      },
    },
    layout: { padding: { right: 30 } },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: tickColor, stepSize: 1 },
        beginAtZero: true,
      },
      y: {
        grid: { display: false },
        ticks: {
          color: tickColor,
          font: { family: "'JetBrains Mono'", size: 11 },
        },
      },
    },
  };

  // ---- 3. Success rate per app (numbers ON top of bar) ----
  const successRates = stats.uniqueApps.map((aid) => {
    const slice = deployments.filter((d) => d.application_id === aid);
    return Math.round(
      (slice.filter((d) => d.deploy_status === "SUCCESS").length /
        slice.length) *
        100
    );
  });
  const successRateData = {
    labels: stats.uniqueApps.map((a) => stats.appLabels[a]),
    datasets: [
      {
        data: successRates,
        backgroundColor: successRates.map((r) =>
          r >= 80 ? "#10b98199" : r >= 50 ? "#f9731699" : "#ef444499"
        ),
        borderColor: successRates.map((r) =>
          r >= 80 ? "#10b981" : r >= 50 ? "#f97316" : "#ef4444"
        ),
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };
  const successRateOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillByApp(stats.uniqueApps[els[0].index]);
    },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => `${c.raw}% success` } },
      datalabels: {
        ...labelOnTop,
        formatter: (v) => `${v}%`,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: tickColor,
          font: { family: "'JetBrains Mono'", size: 10 },
        },
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: tickColor },
        min: 0,
        max: 110,
      },
    },
  };

  // ---- 4. Stacked bar (count IN segments) ----
  const stackedData = {
    labels: stats.uniqueApps.map((a) => stats.appLabels[a]),
    datasets: stats.uniqueTypes.map((t) => ({
      label: t,
      data: stats.uniqueApps.map(
        (aid) =>
          deployments.filter(
            (d) => d.application_id === aid && d.deploy_type === t
          ).length
      ),
      backgroundColor: colorForType(t) + "99",
      borderColor: colorForType(t),
      borderWidth: 1,
      borderRadius: 4,
    })),
  };
  const stackedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) {
        const el = els[0];
        const appId = stats.uniqueApps[el.index];
        const type = stackedData.datasets[el.datasetIndex].label;
        drillByAppType(appId, type);
      }
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          boxWidth: 10,
          font: { size: 10 },
          color: tickColor,
          padding: 8,
        },
      },
      datalabels: {
        ...labelInside,
        formatter: (v) => (v > 0 ? v : ""),
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: {
          color: tickColor,
          font: { family: "'JetBrains Mono'", size: 10 },
        },
      },
      y: {
        stacked: true,
        grid: { color: gridColor },
        ticks: { color: tickColor, stepSize: 1 },
      },
    },
  };

  // ---- 5. Radar (count IN body at each point) ----
  const radarData = {
    labels: stats.uniqueTypes,
    datasets: [
      {
        label: "Count",
        data: stats.uniqueTypes.map((t) => stats.byType[t] || 0),
        backgroundColor: "#117ACA22",
        borderColor: "#117ACA",
        borderWidth: 2,
        pointBackgroundColor: "#117ACA",
        pointRadius: 4,
      },
    ],
  };
  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillByType(stats.uniqueTypes[els[0].index]);
    },
    plugins: {
      legend: { display: false },
      datalabels: {
        color: "#117ACA",
        backgroundColor: isDark ? "rgba(7,18,36,0.85)" : "rgba(255,255,255,0.85)",
        borderRadius: 4,
        padding: { top: 2, bottom: 2, left: 5, right: 5 },
        font: { weight: 700, size: 10, family: "'JetBrains Mono', monospace" },
        anchor: "end",
        align: "end",
        offset: 4,
        formatter: (v) => (v && v !== 0 ? v : ""),
      },
    },
    scales: {
      r: {
        grid: { color: gridColor },
        ticks: { color: tickColor, backdropColor: "transparent", stepSize: 1 },
        pointLabels: {
          color: tickColor,
          font: { size: 10, family: "'JetBrains Mono'" },
        },
        angleLines: { color: gridColor },
      },
    },
  };

  // ---- 6. Timeline line (count IN body at each point) ----
  const timelineMonths = stats.months;
  const timelineLabels = timelineMonths.map(
    ({ y, m }) => `${MONTH_NAMES[m]} ${y}`
  );
  const timelineCounts = timelineMonths.map(
    ({ y, m }) =>
      deployments.filter((d) => {
        const dt = new Date(d.deploy_time);
        return dt.getFullYear() === y && dt.getMonth() === m;
      }).length
  );
  const timelineData = {
    labels: timelineLabels,
    datasets: [
      {
        label: "Deployments",
        data: timelineCounts,
        fill: true,
        tension: 0.45,
        backgroundColor: "#117ACA22",
        borderColor: "#117ACA",
        borderWidth: 2.5,
        pointBackgroundColor: "#117ACA",
        pointRadius: 5,
        pointHoverRadius: 8,
      },
    ],
  };
  const timelineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) {
        const { y, m } = timelineMonths[els[0].index];
        drillByMonth(y, m);
      }
    },
    plugins: {
      legend: { display: false },
      datalabels: {
        color: "#fff",
        backgroundColor: "#117ACA",
        borderRadius: 6,
        padding: { top: 2, bottom: 2, left: 6, right: 6 },
        font: { weight: 700, size: 10, family: "'JetBrains Mono', monospace" },
        anchor: "end",
        align: "top",
        offset: 6,
        formatter: (v) => (v && v !== 0 ? v : ""),
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: tickColor } },
      y: {
        grid: { color: gridColor },
        ticks: { color: tickColor, stepSize: 2 },
        beginAtZero: true,
      },
    },
  };

  // ---- 7. Monthly grouped (numbers ON top of each bar) ----
  const monthlyShort = timelineMonths.map(({ m }) => MONTH_NAMES[m]);
  const monthlyData = {
    labels: monthlyShort,
    datasets: STATUS_LIST.map((s) => ({
      label: s,
      data: timelineMonths.map(
        ({ y, m }) =>
          deployments.filter((d) => {
            const dt = new Date(d.deploy_time);
            return (
              dt.getFullYear() === y &&
              dt.getMonth() === m &&
              d.deploy_status === s
            );
          }).length
      ),
      backgroundColor: STATUS_COLORS[s] + "99",
      borderColor: STATUS_COLORS[s],
      borderWidth: 2,
      borderRadius: 6,
    })),
  };
  const monthlyOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) {
        const el = els[0];
        const { y, m } = timelineMonths[el.index];
        const status = STATUS_LIST[el.datasetIndex];
        drillByMonth(y, m, status);
      }
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          boxWidth: 10,
          font: { size: 10 },
          color: tickColor,
          padding: 8,
        },
      },
      datalabels: {
        ...labelOnTop,
        font: { weight: 700, size: 10, family: "'JetBrains Mono', monospace" },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: tickColor } },
      y: {
        grid: { color: gridColor },
        ticks: { color: tickColor, stepSize: 1 },
        beginAtZero: true,
      },
    },
  };

  // ---- 8. Bubble (count IN body of bubble) ----
  const bubbleTypes = Object.keys(stats.byType);
  const bubbleData = {
    datasets: bubbleTypes.map((t, i) => {
      const cnt = stats.byType[t];
      const ok = deployments.filter(
        (d) => d.deploy_type === t && d.deploy_status === "SUCCESS"
      ).length;
      return {
        label: t,
        data: [
          {
            x: i + 1,
            y: Math.round((ok / cnt) * 100),
            r: Math.max(10, cnt * 5),
            cnt,
          },
        ],
        backgroundColor: colorForType(t) + "88",
        borderColor: colorForType(t),
        borderWidth: 2,
      };
    }),
  };
  const bubbleOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillByType(bubbleTypes[els[0].datasetIndex]);
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (c) =>
            `${c.dataset.label}: ${c.raw.y}% success · ${c.raw.cnt} deploys`,
        },
      },
      datalabels: {
        color: "#fff",
        font: { weight: 800, size: 13, family: "'JetBrains Mono', monospace" },
        anchor: "center",
        align: "center",
        textStrokeColor: "rgba(0,0,0,0.5)",
        textStrokeWidth: 2,
        formatter: (v) => v.cnt,
      },
    },
    scales: {
      x: { display: false, min: 0, max: bubbleTypes.length + 1 },
      y: {
        grid: { color: gridColor },
        ticks: { color: tickColor },
        min: 0,
        max: 115,
        title: { display: true, text: "Success %", color: tickColor },
      },
    },
  };

  // Shared legends used in both the card footer and the expand modal
  const donutLegend = (
    <div className="legend">
      {dtypes.map((t) => (
        <div
          key={t}
          className="leg-item leg-clickable"
          onClick={() => drillByType(t)}
        >
          <div
            className="leg-dot"
            style={{ background: colorForType(t) }}
          />
          {t}{" "}
          <b style={{ color: "var(--tp)" }}>
            <AnimatedNumber value={stats.byType[t]} />
          </b>
        </div>
      ))}
    </div>
  );

  const bubbleLegend = (
    <div className="legend">
      {bubbleTypes.map((t) => (
        <div
          key={t}
          className="leg-item leg-clickable"
          onClick={() => drillByType(t)}
        >
          <div
            className="leg-dot"
            style={{ background: colorForType(t) }}
          />
          {t}{" "}
          <b style={{ color: "var(--tp)" }}>
            <AnimatedNumber value={stats.byType[t]} />
          </b>
        </div>
      ))}
    </div>
  );

  // Track all charts for the expand modal
  const CHART_DEFS = {
    donut: {
      title: "Deploy Type Distribution",
      sub: "Share of each infrastructure type",
      render: () => <Doughnut data={donutData} options={donutOptions} />,
      footer: donutLegend,
    },
    statusBar: {
      title: "Deploy Status Breakdown",
      sub: "SUCCESS · ACKNOWLEDGED · FAILED",
      render: () => <Bar data={statusBarData} options={statusBarOptions} />,
    },
    successRate: {
      title: "Success Rate by Application",
      sub: "% successful deploys per app (green=80%+)",
      render: () => <Bar data={successRateData} options={successRateOptions} />,
    },
    stacked: {
      title: "Deploy Types per Application — Stacked",
      sub: "Absolute deployment count by type per application",
      render: () => <Bar data={stackedData} options={stackedOptions} />,
    },
    radar: {
      title: "Deploy Type Radar Coverage",
      sub: "Usage frequency across all applications",
      render: () => <Radar data={radarData} options={radarOptions} />,
    },
    timeline: {
      title: "Deployment Velocity — Monthly",
      sub: "Number of deployments per month",
      render: () => <Line data={timelineData} options={timelineOptions} />,
    },
    monthly: {
      title: "Monthly Deployments by Status",
      sub: "Grouped bar — SUCCESS vs ACKNOWLEDGED vs FAILED per month",
      render: () => <Bar data={monthlyData} options={monthlyOptions} />,
    },
    bubble: {
      title: "Success Rate vs Volume — Bubble",
      sub: "Bubble size = volume · Y-axis = success %",
      render: () => <Bubble data={bubbleData} options={bubbleOptions} />,
      footer: bubbleLegend,
    },
  };

  const onSelectRow = (record) =>
    setDrill((d) => (d ? { ...d, selected: record } : d));
  const backToList = () =>
    setDrill((d) => (d ? { ...d, selected: undefined } : d));
  const closeDrill = () => setDrill(null);

  const headerSubtitle = (() => {
    if (view === "home")
      return "Operations Portal · Choose a product to explore";
    if (view === "product")
      return `${stats.productName || "Product"} dashboards`;
    return [
      stats.productLine,
      stats.productName,
      stats.environments,
      stats.dateRange,
      `${stats.total} records`,
      `${stats.uniqueApps.length} applications`,
    ]
      .filter(Boolean)
      .join(" · ");
  })();

  const breadcrumbs = (() => {
    const crumbs = [{ label: "Home", onClick: goHome }];
    if (view !== "home") crumbs.push({ label: "HLTCMH", onClick: goProduct });
    if (view === "dashboard")
      crumbs.push({ label: "Deployment Metrics Dashboard" });
    return crumbs;
  })();

  return (
    <>
      <Header
        theme={theme}
        onToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        subtitle={headerSubtitle}
        onBrandClick={goHome}
      />

      <div className="section-wrap">
        <Breadcrumbs items={breadcrumbs} />
      </div>

      {view === "home" && (
        <section className="landing-page">
          <div className="landing-intro">
            <span className="landing-eyebrow">HLT Operations Portal</span>
            <h2 className="landing-heading">Welcome</h2>
            <p className="landing-lead">
              Choose a product to explore its operational dashboards and
              production telemetry.
            </p>
          </div>
          <div className="landing-grid">
            <LandingTile
              icon={HOUSE_ICON}
              eyebrow="Product"
              title="HLTCMH"
              subtitle={stats.productName || "Chase My Home"}
              description={`Production deployment intelligence and operational telemetry for the ${
                stats.productName || "Chase My Home"
              } application suite.`}
              meta={[
                {
                  value: stats.uniqueApps.length,
                  label: "Applications",
                },
                {
                  value: stats.total,
                  label: "Deployments",
                },
                {
                  value: `${stats.successRate}%`,
                  label: "Success Rate",
                },
              ]}
              cta="Open product"
              onClick={goProduct}
            />
          </div>
        </section>
      )}

      {view === "product" && (
        <section className="landing-page">
          <div className="landing-intro">
            <span className="landing-eyebrow">
              HLTCMH{stats.productName ? ` · ${stats.productName}` : ""}
            </span>
            <h2 className="landing-heading">Dashboards</h2>
            <p className="landing-lead">
              Operational views available for this product. Drill in to
              explore.
            </p>
          </div>
          <div className="landing-grid">
            <LandingTile
              icon={LAYERS_ICON}
              eyebrow="Dashboard"
              title="Deployment Metrics Dashboard"
              subtitle="Heat map · status breakdown · drill-downs"
              description="Production deployment counts grouped by technology, with success-rate breakdowns and drill-through to individual deployment records."
              meta={[
                {
                  value: stats.uniqueTypes.length,
                  label: "Types",
                },
                {
                  value: stats.total,
                  label: "Deployments",
                },
                {
                  value: stats.uniqueApps.length,
                  label: "Applications",
                },
              ]}
              cta="Open dashboard"
              onClick={goDashboard}
            />
          </div>
        </section>
      )}

      {view === "dashboard" && (
        <DashboardView />
      )}

      <DrillPanel
        open={!!drill}
        title={drill?.title || ""}
        rows={drill?.rows || []}
        selected={drill?.selected || null}
        onSelect={onSelectRow}
        onBackToList={backToList}
        onClose={closeDrill}
      />

      <ChartModal
        open={!!expandedChart}
        title={expandedChart ? CHART_DEFS[expandedChart].title : ""}
        sub={expandedChart ? CHART_DEFS[expandedChart].sub : ""}
        onClose={() => setExpandedChart(null)}
      >
        {expandedChart && (
          <>
            <div
              className="cmodal-chart"
              key={`expanded-${expandedChart}`}
            >
              {CHART_DEFS[expandedChart].render()}
            </div>
            {CHART_DEFS[expandedChart].footer && (
              <div
                className="cmodal-footer"
                key={`expanded-footer-${expandedChart}`}
              >
                {CHART_DEFS[expandedChart].footer}
              </div>
            )}
          </>
        )}
      </ChartModal>
    </>
  );

  function DashboardView() {
    return (
      <>
      <Section>Key Performance Indicators</Section>
      <KPICards cards={kpiCards} />

      <Section>Distribution &amp; Status Analysis</Section>
      <div className="chart-grid g3">
        <ChartCard
          title={CHART_DEFS.donut.title}
          sub="Share of each infrastructure type · click a slice to drill in"
          onExpand={() => setExpandedChart("donut")}
          footer={donutLegend}
        >
          <Doughnut data={donutData} options={donutOptions} />
        </ChartCard>
        <ChartCard
          title={CHART_DEFS.statusBar.title}
          sub="SUCCESS · ACKNOWLEDGED · FAILED · click a bar"
          onExpand={() => setExpandedChart("statusBar")}
        >
          <Bar data={statusBarData} options={statusBarOptions} />
        </ChartCard>
        <ChartCard
          title={CHART_DEFS.successRate.title}
          sub="% successful per app · click a bar"
          onExpand={() => setExpandedChart("successRate")}
        >
          <Bar data={successRateData} options={successRateOptions} />
        </ChartCard>
      </div>

      <Section>Application &amp; Type Deep-Dive</Section>
      <div className="chart-grid g21">
        <ChartCard
          title={CHART_DEFS.stacked.title}
          sub="Click a stacked segment to see deployments for that app + type"
          onExpand={() => setExpandedChart("stacked")}
          height={250}
        >
          <Bar data={stackedData} options={stackedOptions} />
        </ChartCard>
        <ChartCard
          title={CHART_DEFS.radar.title}
          sub="Usage frequency · click a point"
          onExpand={() => setExpandedChart("radar")}
          height={250}
        >
          <Radar data={radarData} options={radarOptions} />
        </ChartCard>
      </div>

      <Section>Risk Heatmap — Deploy Type × Status</Section>
      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <div className="chart-title">
                Failure Heatmap — Deploy Type vs Deploy Status
              </div>
              <div className="chart-sub">
                Darker cell = higher count · click any cell to drill in
              </div>
            </div>
          </div>
          <RiskHeatmap
            deployments={deployments}
            isDark={isDark}
            onCellClick={(t, s) => drillByTypeStatus(t, s)}
          />
        </div>
      </div>

      <Section>Timeline &amp; Deployment Log</Section>
      <div className="chart-grid g12">
        <ChartCard
          title={CHART_DEFS.timeline.title}
          sub="Click a point to see deployments in that month"
          onExpand={() => setExpandedChart("timeline")}
        >
          <Line data={timelineData} options={timelineOptions} />
        </ChartCard>
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <div className="chart-title">Most Recent Deployments</div>
              <div className="chart-sub">
                Last 8 events · click a row for full record
              </div>
            </div>
          </div>
          <RecentTable
            deployments={deployments}
            limit={8}
            onSelect={(d) =>
              setDrill({ title: d.repo_name, rows: [d], selected: d })
            }
          />
        </div>
      </div>

      <Section>Change Control &amp; Monthly Breakdown</Section>
      <div className="chart-grid g2">
        <ChartCard
          title={CHART_DEFS.monthly.title}
          sub="Grouped bar — SUCCESS vs ACK vs FAILED per month"
          onExpand={() => setExpandedChart("monthly")}
        >
          <Bar data={monthlyData} options={monthlyOptions} />
        </ChartCard>
        <ChartCard
          title={CHART_DEFS.bubble.title}
          sub="Bubble size = volume · click a bubble"
          onExpand={() => setExpandedChart("bubble")}
          footer={bubbleLegend}
        >
          <Bubble data={bubbleData} options={bubbleOptions} />
        </ChartCard>
      </div>

      </>
    );
  }
}
