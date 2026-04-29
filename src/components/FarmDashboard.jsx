import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, Bubble, Doughnut } from "react-chartjs-2";
import KPICards from "./KPICards";
import AnimatedNumber from "./AnimatedNumber";

const STATUS_ORDER = [
  "Overdue",
  "Due in 0-30 Days",
  "Due in 31-60 Days",
  "Due in 61-90 Days",
];
const STATUS_COLORS = {
  Overdue: "#c0392b",
  "Due in 0-30 Days": "#e67e22",
  "Due in 31-60 Days": "#d4ac0d",
  "Due in 61-90 Days": "#27ae60",
};
const SEVERITY_LIST = ["S1", "S2", "S3", "S4"];
const SEVERITY_COLORS = {
  S1: "#e74c3c",
  S2: "#e67e22",
  S3: "#d4ac0d",
  S4: "#27ae60",
};
const CRITICALITY_LIST = ["W1", "W2", "W3"];
const CRITICALITY_COLORS = {
  W1: "#e74c3c",
  W2: "#e67e22",
  W3: "#27ae60",
};
const DOMAIN_PALETTE = [
  "#e74c3c",
  "#e67e22",
  "#3498db",
  "#1abc9c",
  "#9b59b6",
  "#f1c40f",
  "#ec407a",
];
const RESPONSE_PALETTE = ["#3498db", "#e67e22", "#9b59b6", "#1abc9c", "#ef4444"];
const OWNER_PALETTE = [
  "#e74c3c",
  "#3498db",
  "#9b59b6",
  "#1abc9c",
  "#e67e22",
  "#f1c40f",
  "#ec407a",
  "#26a69a",
  "#8d6e63",
  "#78909c",
  "#66bb6a",
];
const IMPACT_PALETTE = ["#9b59b6", "#e74c3c", "#3498db", "#1abc9c", "#e67e22"];

function ownerName(d) {
  return String(d["Responsible Party"] || "").split(" (")[0] || "—";
}
function cpCode(d) {
  return String(d["Control Procedure"] || "").split(":")[0] || "—";
}
function snc(d) {
  const m = String(d["Response Description"] || "").match(/INC\d+/);
  return m ? m[0] : "";
}
function extCount(d) {
  const v = d["Extension Counter"];
  if (v == null || v === "") return 0;
  const n = parseInt(v, 10);
  return isFinite(n) ? n : 0;
}
function isReopened(d) {
  const v = d["Reopened Date"];
  return !!(v && v !== "No Date" && v !== "");
}
function numFld(d, key) {
  const n = parseInt(d[key], 10);
  return isFinite(n) ? n : 0;
}

function statusBadge(s) {
  return (
    <span
      className="badge"
      style={{
        background: (STATUS_COLORS[s] || "#94a3b8") + "26",
        color: STATUS_COLORS[s] || "var(--ts)",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {s}
    </span>
  );
}
function sevBadge(s) {
  const c = SEVERITY_COLORS[s] || "#94a3b8";
  return (
    <span className="badge" style={{ background: c + "26", color: c, fontWeight: 700 }}>
      {s}
    </span>
  );
}
function critBadge(c) {
  const col = CRITICALITY_COLORS[c] || "#94a3b8";
  return (
    <span className="badge" style={{ background: col + "26", color: col, fontWeight: 700 }}>
      {c}
    </span>
  );
}
function respBadge(r) {
  const col =
    r === "Fix"
      ? "#3498db"
      : r === "Risk Accept"
      ? "#e67e22"
      : "#9b59b6";
  return (
    <span className="badge" style={{ background: col + "26", color: col, fontWeight: 700 }}>
      {r}
    </span>
  );
}

// ---- Schema for the shared DrillPanel ----
export const FARM_SCHEMA = {
  entity: "Finding",
  pluralEntity: "findings",
  emptyText: "No findings match this slice.",
  rowKey: (d) => d["Source ID"],
  columns: [
    {
      id: "Source ID",
      label: "Source ID",
      render: (d) => (
        <span className="tbl-mono" style={{ fontSize: 11 }}>
          {d["Source ID"]}
        </span>
      ),
    },
    {
      id: "Application Name",
      label: "Application",
      render: (d) => (
        <>
          <div className="drill-cell-primary">{d["Application Name"]}</div>
          <div className="drill-cell-secondary">{d["Application ID"]}</div>
        </>
      ),
    },
    {
      id: "Control Domain",
      label: "Domain",
      render: (d) => <span style={{ fontSize: 11 }}>{d["Control Domain"]}</span>,
    },
    {
      id: "Current Target Date Age Status",
      label: "Status",
      render: (d) => statusBadge(d["Current Target Date Age Status"]),
    },
    {
      id: "Severity",
      label: "Sev",
      render: (d) => sevBadge(d["Severity"]),
    },
    {
      id: "Criticality",
      label: "Crit",
      render: (d) => critBadge(d["Criticality"]),
    },
    {
      id: "Days Until Current Target Date",
      label: "Days Left",
      filterValue: (d) => d["Days Until Current Target Date"],
      render: (d) => {
        const n = numFld(d, "Days Until Current Target Date");
        const c = n < 0 ? "#e74c3c" : n <= 30 ? "#e67e22" : n <= 60 ? "#d4ac0d" : "#27ae60";
        return (
          <span className="tbl-mono" style={{ fontSize: 11, color: c, fontWeight: 700 }}>
            {n > 0 ? "+" : ""}
            {n}
          </span>
        );
      },
    },
    {
      id: "Responsible Party",
      label: "Owner",
      render: (d) => <span style={{ fontSize: 11 }}>{ownerName(d)}</span>,
    },
  ],
  detail: {
    title: (d) => `Finding · ${d["Source ID"]}`,
    subtitle: (d) =>
      `${d["Application Name"]} · ${d["Control Domain"]} · ${d["Current Target Date Age Status"]}`,
    pills: (d) => [
      <span key="sv">{sevBadge(d["Severity"])}</span>,
      <span key="cr">{critBadge(d["Criticality"])}</span>,
      <span key="rs">{respBadge(d["Response Decision"])}</span>,
    ],
    fields: [
      ["Source ID", "Source ID"],
      ["Application ID", "Application ID"],
      ["Application Name", "Application Name"],
      ["Control Domain", "Control Domain"],
      ["Current Target Date Age Status", "Deadline Status"],
      ["Current Target Date", "Current Target Date"],
      ["Target Date", "Target Date"],
      ["Days Until Current Target Date", "Days Until Target"],
      ["Days Since Created Date", "Days Since Created"],
      ["Created Date", "Created Date"],
      ["Reopened Date", "Reopened Date"],
      ["Extension Counter", "Extension Counter"],
      ["Severity", "Severity"],
      ["Criticality", "Criticality"],
      ["Response Decision", "Response Decision"],
      ["Response Description", "Response Description"],
      ["Control Procedure", "Control Procedure"],
      ["Control Procedure Sub Type", "CP Sub Type"],
      ["Origin", "Origin"],
      ["Sub Type", "Sub Type"],
      ["Impacting List", "Impacting List"],
      ["Responsible Party", "Responsible Party"],
      ["AO", "Application Owner"],
      ["CTO", "CTO"],
      ["Description", "Description"],
    ],
    formatField: (_k, v) => {
      if (v == null || v === "" || v === "-") return "—";
      return String(v);
    },
    monoFields: new Set([
      "Source ID",
      "Application ID",
      "Description",
      "Response Description",
      "Created Date",
      "Current Target Date",
      "Target Date",
      "Reopened Date",
    ]),
  },
};

// ---- Chart Card helpers ----
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

// Chart.js plugins for the bubble & days-until-target zero lines
const verticalZeroLine = {
  id: "vZeroLine",
  afterDraw(c) {
    const x = c.scales.x;
    if (!x) return;
    c.ctx.save();
    c.ctx.strokeStyle = "rgba(192,57,43,.55)";
    c.ctx.lineWidth = 1.5;
    c.ctx.setLineDash([5, 4]);
    const px = x.getPixelForValue(0);
    c.ctx.beginPath();
    c.ctx.moveTo(px, c.chartArea.top);
    c.ctx.lineTo(px, c.chartArea.bottom);
    c.ctx.stroke();
    c.ctx.setLineDash([]);
    c.ctx.restore();
  },
};
const horizontalZeroLine = {
  id: "hZeroLine",
  afterDraw(c) {
    const y = c.scales.y;
    if (!y) return;
    c.ctx.save();
    c.ctx.strokeStyle = "rgba(192,57,43,.55)";
    c.ctx.lineWidth = 1.5;
    c.ctx.setLineDash([6, 4]);
    const py = y.getPixelForValue(0);
    c.ctx.beginPath();
    c.ctx.moveTo(c.chartArea.left, py);
    c.ctx.lineTo(c.chartArea.right, py);
    c.ctx.stroke();
    c.ctx.setLineDash([]);
    c.ctx.restore();
  },
};

export default function FarmDashboard({ findings, isDark, openDrill, setExpandedChart }) {
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

  const stats = useMemo(() => {
    const total = findings.length;
    const cnt = (key, val) =>
      findings.filter((d) => d[key] === val).length;

    const byStatus = STATUS_ORDER.map((s) => cnt("Current Target Date Age Status", s));
    const bySeverity = SEVERITY_LIST.map((s) => cnt("Severity", s));
    const byCriticality = CRITICALITY_LIST.map((c) => cnt("Criticality", c));

    // Group + sort
    const groupCount = (key) => {
      const m = {};
      findings.forEach((d) => {
        const v = d[key];
        m[v] = (m[v] || 0) + 1;
      });
      return Object.entries(m).sort((a, b) => b[1] - a[1]);
    };
    const domainGroups = groupCount("Control Domain");
    const respGroups = groupCount("Response Decision");
    const originGroups = groupCount("Origin");
    const impactGroups = groupCount("Impacting List").filter((x) => x[0] && x[0] !== "-");

    // App rollup
    const appMap = {};
    findings.forEach((d) => {
      const a = d["Application Name"];
      if (!appMap[a])
        appMap[a] = { name: a, id: d["Application ID"], cnt: 0, ov: 0 };
      appMap[a].cnt++;
      if (d["Current Target Date Age Status"] === "Overdue") appMap[a].ov++;
    });
    const appRows = Object.values(appMap).sort((a, b) => b.cnt - a.cnt);

    // App × Domain heatmap
    const domNames = domainGroups.map((x) => x[0]);
    const heatmapRows = appRows.map((a) => ({
      app: a.name,
      cells: domNames.map((dom) => {
        const slice = findings.filter(
          (d) => d["Application Name"] === a.name && d["Control Domain"] === dom
        );
        const ov = slice.filter(
          (d) => d["Current Target Date Age Status"] === "Overdue"
        ).length;
        return { domain: dom, count: slice.length, overdue: ov };
      }),
    }));

    // Owner rollup
    const owMap = {};
    findings.forEach((d) => {
      const n = ownerName(d);
      if (!owMap[n])
        owMap[n] = {
          name: n,
          full: d["Responsible Party"],
          cnt: 0,
          ov: 0,
          s1: 0,
          ra: 0,
        };
      owMap[n].cnt++;
      if (d["Current Target Date Age Status"] === "Overdue") owMap[n].ov++;
      if (d["Severity"] === "S1") owMap[n].s1++;
      if (d["Response Decision"] === "Risk Accept") owMap[n].ra++;
    });
    const ownerRows = Object.values(owMap).sort((a, b) => b.cnt - a.cnt);

    // Control procedure recurrence
    const cpMap = {};
    findings.forEach((d) => {
      const cp = cpCode(d);
      if (!cpMap[cp]) cpMap[cp] = { cp, cnt: 0, apps: new Set() };
      cpMap[cp].cnt++;
      cpMap[cp].apps.add(d["Application ID"]);
    });
    const cpRows = Object.values(cpMap)
      .map((x) => ({ cp: x.cp, cnt: x.cnt, apps: x.apps.size }))
      .sort((a, b) => b.cnt - a.cnt);

    // Composite risk score for top 8
    const sevWeight = { S1: 4, S2: 3, S3: 2, S4: 1 };
    const critWeight = { W1: 4, W2: 2, W3: 1 };
    const statusWeight = {
      Overdue: 10,
      "Due in 0-30 Days": 5,
      "Due in 31-60 Days": 2,
      "Due in 61-90 Days": 1,
    };
    const scored = findings
      .map((d) => {
        const score =
          (sevWeight[d["Severity"]] || 1) *
            (critWeight[d["Criticality"]] || 1) *
            (statusWeight[d["Current Target Date Age Status"]] || 1) *
            (d["Impacting List"] && d["Impacting List"] !== "-" ? 2 : 1) +
          extCount(d) * 3;
        return { d, score };
      })
      .sort((a, b) => b.score - a.score);
    const top8 = scored.slice(0, 8);

    // Days-until-target sorted
    const sortedByDays = [...findings].sort(
      (a, b) =>
        numFld(a, "Days Until Current Target Date") -
        numFld(b, "Days Until Current Target Date")
    );

    // Aggregate KPIs
    const overdue = byStatus[0];
    const due030 = byStatus[1];
    const due3160 = byStatus[2];
    const due6190 = byStatus[3];
    const s1 = bySeverity[0];
    const w1 = byCriticality[0];
    const ra = cnt("Response Decision", "Risk Accept");
    const withExt = findings.filter((d) => extCount(d) > 0).length;
    const reopened = findings.filter((d) => isReopened(d)).length;
    const ages = findings.map((d) => numFld(d, "Days Since Created Date"));
    const avgAge = ages.length
      ? Math.round(ages.reduce((s, n) => s + n, 0) / ages.length)
      : 0;
    const maxAge = ages.length ? Math.max(...ages) : 0;

    return {
      total,
      apps: appRows.length,
      byStatus,
      bySeverity,
      byCriticality,
      domainGroups,
      respGroups,
      originGroups,
      impactGroups,
      appRows,
      heatmapRows,
      domNames,
      ownerRows,
      cpRows,
      top8,
      sortedByDays,
      overdue,
      due030,
      due3160,
      due6190,
      s1,
      w1,
      ra,
      withExt,
      reopened,
      avgAge,
      maxAge,
    };
  }, [findings]);

  // ---- Drill helpers ----
  const drill = (title, predicate) => openDrill && openDrill(title, predicate);
  const drillByStatus = (s) =>
    drill(`Status · ${s}`, (d) => d["Current Target Date Age Status"] === s);
  const drillBySeverity = (s) =>
    drill(`Severity · ${s}`, (d) => d["Severity"] === s);
  const drillByCriticality = (c) =>
    drill(`Criticality · ${c}`, (d) => d["Criticality"] === c);
  const drillByDomain = (dom) =>
    drill(`Domain · ${dom}`, (d) => d["Control Domain"] === dom);
  const drillByResponse = (r) =>
    drill(`Response · ${r}`, (d) => d["Response Decision"] === r);
  const drillByApp = (a) =>
    drill(`Application · ${a}`, (d) => d["Application Name"] === a);
  const drillByAppDomain = (a, dom) =>
    drill(
      `${a} · ${dom}`,
      (d) => d["Application Name"] === a && d["Control Domain"] === dom
    );
  const drillByOrigin = (o) =>
    drill(`Origin · ${o}`, (d) => d["Origin"] === o);
  const drillByImpact = (i) =>
    drill(`Impacting · ${i}`, (d) => d["Impacting List"] === i);
  const drillByOwner = (n) =>
    drill(`Owner · ${n}`, (d) => ownerName(d) === n);
  const drillByCp = (cp) =>
    drill(`Control Procedure · ${cp}`, (d) => cpCode(d) === cp);
  const drillSingle = (sourceId) =>
    drill(`Finding · ${sourceId}`, (d) => d["Source ID"] === sourceId);

  // ---- KPI cards ----
  const kpiCards = [
    {
      label: "Overdue",
      value: stats.overdue,
      sub: "Past target date",
      tone: "red",
      trend: "dn",
    },
    {
      label: "Due 0–30 Days",
      value: stats.due030,
      sub: "Imminent deadline",
      tone: "orange",
      trend: "dn",
    },
    {
      label: "Due 31–60 Days",
      value: stats.due3160,
      sub: "Short window",
      tone: "orange",
    },
    {
      label: "Due 61–90 Days",
      value: stats.due6190,
      sub: "Planned horizon",
      tone: "green",
    },
    {
      label: "S1 Severity",
      value: stats.s1,
      sub: "Highest severity",
      tone: "red",
      trend: "dn",
    },
    {
      label: "W1 Criticality",
      value: stats.w1,
      sub: "Most critical weight",
      tone: "red",
    },
    {
      label: "Risk Accepts",
      value: stats.ra,
      sub: "Not being fixed",
      tone: "purple",
    },
    {
      label: "Avg Age (Days)",
      value: stats.avgAge,
      sub: `Max: ${stats.maxAge}d (oldest)`,
      tone: "cyan",
    },
    {
      label: "With Extensions",
      value: stats.withExt,
      sub: "Target date extended",
      tone: "orange",
    },
    {
      label: "Reopened",
      value: stats.reopened,
      sub: "Previously resolved",
      tone: "red",
    },
  ];

  // ---- Status Donut ----
  const statusDonutData = {
    labels: STATUS_ORDER,
    datasets: [
      {
        data: stats.byStatus,
        backgroundColor: STATUS_ORDER.map((s) => STATUS_COLORS[s] + "cc"),
        borderColor: STATUS_ORDER.map((s) => STATUS_COLORS[s]),
        borderWidth: 2,
        hoverOffset: 8,
      },
    ],
  };
  const statusDonutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillByStatus(STATUS_ORDER[els[0].index]);
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 10, font: { size: 10 }, color: tickColor, padding: 8 },
      },
      datalabels: {
        ...labelInside,
        formatter: (v) => (v && v !== 0 ? v : ""),
      },
    },
  };

  // ---- Severity bar ----
  const sevData = {
    labels: SEVERITY_LIST,
    datasets: [
      {
        data: stats.bySeverity,
        backgroundColor: SEVERITY_LIST.map((s) => SEVERITY_COLORS[s] + "cc"),
        borderColor: SEVERITY_LIST.map((s) => SEVERITY_COLORS[s]),
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };
  const sevOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillBySeverity(SEVERITY_LIST[els[0].index]);
    },
    plugins: {
      legend: { display: false },
      datalabels: { ...labelOnTop },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: tickColor, font: { family: "'JetBrains Mono'", size: 12 } } },
      y: { grid: { color: gridColor }, ticks: { color: tickColor, stepSize: 1 }, beginAtZero: true },
    },
  };

  // ---- Criticality donut ----
  const critData = {
    labels: ["W1 — Critical", "W2 — High", "W3 — Medium"],
    datasets: [
      {
        data: stats.byCriticality,
        backgroundColor: CRITICALITY_LIST.map((c) => CRITICALITY_COLORS[c] + "cc"),
        borderColor: CRITICALITY_LIST.map((c) => CRITICALITY_COLORS[c]),
        borderWidth: 2,
        hoverOffset: 8,
      },
    ],
  };
  const critOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "55%",
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillByCriticality(CRITICALITY_LIST[els[0].index]);
    },
    plugins: {
      legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 }, color: tickColor, padding: 8 } },
      datalabels: { ...labelInside },
    },
  };

  // ---- Domain horizontal bar ----
  const domData = {
    labels: stats.domainGroups.map((x) => x[0]),
    datasets: [
      {
        data: stats.domainGroups.map((x) => x[1]),
        backgroundColor: stats.domainGroups.map((_, i) => DOMAIN_PALETTE[i % DOMAIN_PALETTE.length] + "99"),
        borderColor: stats.domainGroups.map((_, i) => DOMAIN_PALETTE[i % DOMAIN_PALETTE.length]),
        borderWidth: 2,
        borderRadius: 7,
      },
    ],
  };
  const domOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillByDomain(stats.domainGroups[els[0].index][0]);
    },
    plugins: {
      legend: { display: false },
      datalabels: { ...labelInside, formatter: (v) => (v > 0 ? v : "") },
    },
    scales: {
      x: { grid: { color: gridColor }, ticks: { color: tickColor, stepSize: 1 }, beginAtZero: true },
      y: { grid: { display: false }, ticks: { color: tickColor, font: { size: 10 } } },
    },
  };

  // ---- Response Decision donut ----
  const respData = {
    labels: stats.respGroups.map((x) => x[0]),
    datasets: [
      {
        data: stats.respGroups.map((x) => x[1]),
        backgroundColor: stats.respGroups.map((_, i) => RESPONSE_PALETTE[i % RESPONSE_PALETTE.length] + "cc"),
        borderColor: stats.respGroups.map((_, i) => RESPONSE_PALETTE[i % RESPONSE_PALETTE.length]),
        borderWidth: 2,
        hoverOffset: 8,
      },
    ],
  };
  const respOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "58%",
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillByResponse(stats.respGroups[els[0].index][0]);
    },
    plugins: {
      legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 }, color: tickColor, padding: 8 } },
      datalabels: { ...labelInside },
    },
  };

  // ---- Origin horizontal bar ----
  const originData = {
    labels: stats.originGroups.map((x) => x[0].replace(/_/g, " ")),
    datasets: [
      {
        data: stats.originGroups.map((x) => x[1]),
        backgroundColor: "#3498db88",
        borderColor: "#3498db",
        borderWidth: 2,
        borderRadius: 7,
      },
    ],
  };
  const originOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillByOrigin(stats.originGroups[els[0].index][0]);
    },
    plugins: {
      legend: { display: false },
      datalabels: { ...labelInside, formatter: (v) => (v > 0 ? v : "") },
    },
    scales: {
      x: { grid: { color: gridColor }, ticks: { color: tickColor, stepSize: 1 }, beginAtZero: true },
      y: { grid: { display: false }, ticks: { color: tickColor, font: { size: 10 } } },
    },
  };

  // ---- Impacting List bar ----
  const impactData = {
    labels: stats.impactGroups.map((x) => x[0]),
    datasets: [
      {
        data: stats.impactGroups.map((x) => x[1]),
        backgroundColor: stats.impactGroups.map((_, i) => IMPACT_PALETTE[i % IMPACT_PALETTE.length] + "99"),
        borderColor: stats.impactGroups.map((_, i) => IMPACT_PALETTE[i % IMPACT_PALETTE.length]),
        borderWidth: 2,
        borderRadius: 7,
      },
    ],
  };
  const impactOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillByImpact(stats.impactGroups[els[0].index][0]);
    },
    plugins: {
      legend: { display: false },
      datalabels: { ...labelOnTop },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: tickColor, font: { family: "'JetBrains Mono'", size: 11 } } },
      y: { grid: { color: gridColor }, ticks: { color: tickColor, stepSize: 1 }, beginAtZero: true },
    },
  };

  // ---- Age vs Days-Until-Target Bubble ----
  const bubbleData = {
    datasets: SEVERITY_LIST.filter((s) => findings.some((d) => d["Severity"] === s)).map((s) => ({
      label: s,
      data: findings
        .filter((d) => d["Severity"] === s)
        .map((d) => ({
          x: numFld(d, "Days Until Current Target Date"),
          y: numFld(d, "Days Since Created Date"),
          r: { W1: 11, W2: 7, W3: 5 }[d["Criticality"]] || 6,
          inc: d,
        })),
      backgroundColor: SEVERITY_COLORS[s] + "77",
      borderColor: SEVERITY_COLORS[s],
      borderWidth: 2,
    })),
  };
  const bubbleOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) {
        const el = els[0];
        const ds = bubbleData.datasets[el.datasetIndex];
        const point = ds && ds.data[el.index];
        if (point && point.inc) drillSingle(point.inc["Source ID"]);
      }
    },
    plugins: {
      legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 }, color: tickColor, padding: 8 } },
      datalabels: { display: false },
      tooltip: {
        callbacks: {
          label: (c) => {
            const d = c.raw.inc;
            return [
              d["Application Name"],
              `Days Until Target: ${c.raw.x} · Age: ${c.raw.y}d`,
              `${d["Severity"]} ${d["Criticality"]} · ${d["Current Target Date Age Status"]}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: tickColor },
        title: { display: true, text: "Days Until Target Date (negative = Overdue)", color: tickColor, font: { size: 10 } },
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: tickColor },
        title: { display: true, text: "Days Since Created Date (Age)", color: tickColor, font: { size: 10 } },
        beginAtZero: true,
      },
    },
  };

  // ---- CP Recurrence Bar (count + distinct apps) ----
  const cpData = {
    labels: stats.cpRows.map((x) => x.cp),
    datasets: [
      {
        label: "Finding Count",
        data: stats.cpRows.map((x) => x.cnt),
        backgroundColor: "#e74c3c88",
        borderColor: "#e74c3c",
        borderWidth: 2,
        borderRadius: 6,
      },
      {
        label: "Distinct Apps",
        data: stats.cpRows.map((x) => x.apps),
        backgroundColor: "#3498db66",
        borderColor: "#3498db",
        borderWidth: 2,
        borderRadius: 6,
      },
    ],
  };
  const cpOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillByCp(stats.cpRows[els[0].index].cp);
    },
    plugins: {
      legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 }, color: tickColor, padding: 8 } },
      datalabels: { ...labelOnTop, formatter: (v) => (v > 0 ? v : "") },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: tickColor, font: { family: "'JetBrains Mono'", size: 9 } } },
      y: { grid: { color: gridColor }, ticks: { color: tickColor, stepSize: 1 }, beginAtZero: true },
    },
  };

  // ---- Days-Until-Target Bar (every finding) ----
  const daysData = {
    labels: stats.sortedByDays.map((d) => d["Source ID"].slice(-6)),
    datasets: [
      {
        data: stats.sortedByDays.map((d) => numFld(d, "Days Until Current Target Date")),
        backgroundColor: stats.sortedByDays.map((d) => {
          const v = numFld(d, "Days Until Current Target Date");
          return v < 0 ? "#e74c3c99" : v <= 30 ? "#e67e2299" : v <= 60 ? "#d4ac0d99" : "#27ae6099";
        }),
        borderColor: stats.sortedByDays.map((d) => {
          const v = numFld(d, "Days Until Current Target Date");
          return v < 0 ? "#e74c3c" : v <= 30 ? "#e67e22" : v <= 60 ? "#d4ac0d" : "#27ae60";
        }),
        borderWidth: 1.5,
        borderRadius: 5,
      },
    ],
  };
  const daysOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillSingle(stats.sortedByDays[els[0].index]["Source ID"]);
    },
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
      tooltip: {
        callbacks: {
          label: (c) => {
            const d = stats.sortedByDays[c.dataIndex];
            return `${d["Application Name"]}: ${c.raw > 0 ? "+" : ""}${c.raw} days`;
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 8 }, maxRotation: 55 } },
      y: { grid: { color: gridColor }, ticks: { color: tickColor } },
    },
  };

  // ---- Expand registry ----
  const expand = (key, title, sub, render, footer) =>
    setExpandedChart({ key, title, sub, render, footer });
  const expandStatusDonut = () =>
    expand("farm-status", "Deadline Status", "Distribution of all findings by deadline urgency",
      () => <Doughnut data={statusDonutData} options={statusDonutOptions} />);
  const expandSev = () =>
    expand("farm-sev", "Severity Distribution", "S1 (highest) → S4 (lowest)",
      () => <Bar data={sevData} options={sevOptions} />);
  const expandCrit = () =>
    expand("farm-crit", "Criticality Distribution", "W1 critical · W2 high · W3 medium",
      () => <Doughnut data={critData} options={critOptions} />);
  const expandDom = () =>
    expand("farm-dom", "Control Domain Breakdown", "Findings grouped by Control Domain",
      () => <Bar data={domData} options={domOptions} />);
  const expandResp = () =>
    expand("farm-resp", "Response Decision", "How each finding is being handled",
      () => <Doughnut data={respData} options={respOptions} />);
  const expandOrigin = () =>
    expand("farm-origin", "Finding Origin", "Which scanner generated each finding",
      () => <Bar data={originData} options={originOptions} />);
  const expandImpact = () =>
    expand("farm-impact", "Impacting List Coverage", "Regulated data / processes exposed",
      () => <Bar data={impactData} options={impactOptions} />);
  const expandBubble = () =>
    expand("farm-bubble", "Age vs Days Until Target", "Bubble size = criticality weight",
      () => <Bubble data={bubbleData} options={bubbleOptions} />);
  const expandCp = () =>
    expand("farm-cp", "Control Procedure Recurrence", "Finding count + distinct apps per CP",
      () => <Bar data={cpData} options={cpOptions} />);
  const expandDays = () =>
    expand("farm-days", "Days Until Target — All Findings", "Negative = already Overdue (red dashed = today)",
      () => <Bar data={daysData} options={daysOptions} />);

  return (
    <>
      <Section>Executive Summary</Section>
      <KPICards cards={kpiCards} />

      <Section>Findings Status Spectrum</Section>
      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <div className="chart-title">Findings Status Ribbon</div>
              <div className="chart-sub">
                Proportional view across deadline urgency bands · click a band to drill in
              </div>
            </div>
          </div>
          <StatusRibbon
            counts={stats.byStatus}
            onClick={(s) => drillByStatus(s)}
            total={stats.total}
          />
        </div>
      </div>

      <Section>Severity · Criticality · Control Domains</Section>
      <div className="chart-grid g3">
        <ChartCard
          title="Deadline Status"
          sub="Current Target Date Age Status · click a slice"
          onExpand={expandStatusDonut}
          height={210}
        >
          <Doughnut data={statusDonutData} options={statusDonutOptions} />
        </ChartCard>
        <ChartCard
          title="Severity Distribution"
          sub="S1 (high) → S4 · click a bar"
          onExpand={expandSev}
          height={210}
        >
          <Bar data={sevData} options={sevOptions} />
        </ChartCard>
        <ChartCard
          title="Criticality Distribution"
          sub="W1 / W2 / W3 · click a slice"
          onExpand={expandCrit}
          height={210}
        >
          <Doughnut data={critData} options={critOptions} />
        </ChartCard>
      </div>

      <div className="chart-grid g21">
        <ChartCard
          title="Control Domain Breakdown"
          sub="Click a bar to drill into that domain"
          onExpand={expandDom}
          height={250}
        >
          <Bar data={domData} options={domOptions} />
        </ChartCard>
        <ChartCard
          title="Response Decision"
          sub="Fix · Risk Accept · etc."
          onExpand={expandResp}
          height={250}
        >
          <Doughnut data={respData} options={respOptions} />
        </ChartCard>
      </div>

      <Section>Application Intelligence</Section>
      <div className="chart-grid g12">
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <div className="chart-title">Findings per Application</div>
              <div className="chart-sub">
                Red = has Overdue · click a row to drill in
              </div>
            </div>
            <button
              type="button"
              className="chart-expand"
              onClick={() =>
                expand(
                  "farm-app-meter",
                  "Findings per Application",
                  "Sorted by count · red = has Overdue",
                  () => <AppMeter rows={stats.appRows} onRowClick={drillByApp} tall />
                )
              }
              aria-label="Expand"
              title="Expand"
            >
              <ExpandIcon />
            </button>
          </div>
          <AppMeter rows={stats.appRows} onRowClick={drillByApp} />
        </div>
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <div className="chart-title">App × Control Domain Heatmap</div>
              <div className="chart-sub">
                Red cells = has Overdue · click any cell to drill in
              </div>
            </div>
            <button
              type="button"
              className="chart-expand"
              onClick={() =>
                expand(
                  "farm-heatmap",
                  "App × Control Domain Heatmap",
                  "Intersection counts · red = has Overdue",
                  () => (
                    <FarmHeatmap
                      rows={stats.heatmapRows}
                      domains={stats.domNames}
                      isDark={isDark}
                      onCellClick={(app, cell) =>
                        cell.count > 0 && drillByAppDomain(app, cell.domain)
                      }
                    />
                  )
                )
              }
              aria-label="Expand"
              title="Expand"
            >
              <ExpandIcon />
            </button>
          </div>
          <FarmHeatmap
            rows={stats.heatmapRows}
            domains={stats.domNames}
            isDark={isDark}
            onCellClick={(app, cell) =>
              cell.count > 0 && drillByAppDomain(app, cell.domain)
            }
          />
        </div>
      </div>

      <Section>Source &amp; Impact Analysis</Section>
      <div className="chart-grid g2">
        <ChartCard
          title="Finding Origin"
          sub="Which scanner is generating findings · click a bar"
          onExpand={expandOrigin}
          height={240}
        >
          <Bar data={originData} options={originOptions} />
        </ChartCard>
        <ChartCard
          title="Impacting List Coverage"
          sub="Regulated data / processes exposed · click a bar"
          onExpand={expandImpact}
          height={240}
        >
          <Bar data={impactData} options={impactOptions} />
        </ChartCard>
      </div>

      <Section>Owner Workload</Section>
      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <div className="chart-title">Responsible Party Load</div>
              <div className="chart-sub">
                Each owner's count, overdue, S1, and risk-accept exposure · click a card
              </div>
            </div>
            <button
              type="button"
              className="chart-expand"
              onClick={() =>
                expand(
                  "farm-owners",
                  "Responsible Party Load",
                  "Click an owner to drill in",
                  () => <OwnerCards rows={stats.ownerRows} onCardClick={drillByOwner} tall />
                )
              }
              aria-label="Expand"
              title="Expand"
            >
              <ExpandIcon />
            </button>
          </div>
          <OwnerCards rows={stats.ownerRows} onCardClick={drillByOwner} />
        </div>
      </div>

      <div className="chart-grid g2">
        <ChartCard
          title="Age vs Days Until Target"
          sub="Days Since Created (y) × Days Until Target (x) · bubble = criticality · click to drill"
          onExpand={expandBubble}
          height={260}
        >
          <Bubble data={bubbleData} options={bubbleOptions} plugins={[verticalZeroLine]} />
        </ChartCard>
        <ChartCard
          title="Control Procedure Recurrence"
          sub="Same CP across multiple apps = systemic gap · click a bar"
          onExpand={expandCp}
          height={260}
        >
          <Bar data={cpData} options={cpOptions} />
        </ChartCard>
      </div>

      <Section>Remediation Priority &amp; Timeline</Section>
      <div className="chart-grid g2">
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <div className="chart-title">Top 8 Priority Actions</div>
              <div className="chart-sub">
                Risk = Severity × Criticality × deadline band × impact + ext × 3
              </div>
            </div>
            <button
              type="button"
              className="chart-expand"
              onClick={() =>
                expand(
                  "farm-top",
                  "Top Priority Actions",
                  "Click any item to drill in",
                  () => <TopPriorityList rows={stats.top8} onItemClick={drillSingle} tall />
                )
              }
              aria-label="Expand"
              title="Expand"
            >
              <ExpandIcon />
            </button>
          </div>
          <TopPriorityList rows={stats.top8} onItemClick={drillSingle} />
        </div>
        <ChartCard
          title="Days Until Target — All Findings"
          sub="Negative = already Overdue · red dashed = today · click a bar"
          onExpand={expandDays}
          height={290}
        >
          <Bar data={daysData} options={daysOptions} plugins={[horizontalZeroLine]} />
        </ChartCard>
      </div>

      <Section>Complete Findings Register</Section>
      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <div className="chart-title">All Findings — Sortable + Filterable</div>
              <div className="chart-sub">
                Excel-style column filters · click any row to inspect the full record
              </div>
            </div>
            <button
              type="button"
              className="chart-expand"
              onClick={() =>
                expand(
                  "farm-register",
                  "All Findings — Register",
                  "Sortable + filterable · click a row to inspect",
                  () => <FarmRegister rows={findings} onRowClick={drillSingle} />
                )
              }
              aria-label="Expand"
              title="Expand"
            >
              <ExpandIcon />
            </button>
          </div>
          <FarmRegister rows={findings} onRowClick={drillSingle} />
        </div>
      </div>
    </>
  );
}

// ---- Status ribbon ----
function StatusRibbon({ counts, onClick, total }) {
  return (
    <>
      <div className="farm-ribbon">
        {STATUS_ORDER.map((s, i) => {
          const n = counts[i];
          if (!n) return null;
          const pct = total ? Math.round((n / total) * 100) : 0;
          return (
            <button
              key={s}
              type="button"
              className="farm-rib-seg"
              style={{ flex: n, background: STATUS_COLORS[s] }}
              onClick={() => onClick(s)}
              title={`${s}: ${n} (${pct}%)`}
            >
              {pct > 9 ? n : ""}
            </button>
          );
        })}
      </div>
      <div className="farm-ribbon-legend">
        {STATUS_ORDER.map((s, i) => (
          <span key={s} className="farm-ribbon-leg-item">
            <span className="leg-dot" style={{ background: STATUS_COLORS[s] }} />
            {s}:{" "}
            <b style={{ color: STATUS_COLORS[s] }}>
              <AnimatedNumber value={counts[i]} />
            </b>
          </span>
        ))}
      </div>
    </>
  );
}

// ---- Per-application meter ----
function AppMeter({ rows, onRowClick, tall = false }) {
  const max = rows.length ? rows[0].cnt : 1;
  return (
    <div className={`farm-meter${tall ? " is-tall" : ""}`}>
      {rows.map((a) => {
        const col = a.ov > 0 ? "#e74c3c" : a.cnt >= 3 ? "#e67e22" : "#3498db";
        return (
          <button
            key={a.name}
            type="button"
            className="farm-meter-row"
            onClick={() => onRowClick && onRowClick(a.name)}
            title={a.name}
          >
            <span className="farm-meter-label">{a.name}</span>
            <span className="farm-meter-bg">
              <span
                className="farm-meter-fill"
                style={{ width: `${Math.round((a.cnt / max) * 100)}%`, background: col }}
              />
            </span>
            <span className="farm-meter-val" style={{ color: col }}>
              {a.ov > 0 ? `${a.cnt}/${a.ov}↑` : a.cnt}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---- App × Domain heatmap ----
function FarmHeatmap({ rows, domains, isDark, onCellClick }) {
  let max = 0;
  rows.forEach((r) =>
    r.cells.forEach((c) => {
      if (c.count > max) max = c.count;
    })
  );
  const safeMax = max || 1;

  const shortenDom = (d) => d.split(" ").slice(0, 2).join(" ");
  const shortenApp = (a) =>
    a
      .replace("Home Lending ", "HL ")
      .replace("ChaseMyHome ", "CMH ")
      .replace("Mortgage ", "Mtg ")
      .replace(" Service", "")
      .replace(" Platform", "");

  return (
    <div className="farm-hm">
      <div className="farm-hm-head">
        <div className="farm-hm-rspacer" />
        {domains.map((d) => (
          <div key={d} className="farm-hm-clbl" title={d}>
            {shortenDom(d)}
          </div>
        ))}
      </div>
      {rows.map((r) => (
        <div key={r.app} className="farm-hm-row">
          <div className="farm-hm-rlbl" title={r.app}>
            {shortenApp(r.app)}
          </div>
          {r.cells.map((c) => {
            const baseCol = c.overdue > 0 ? "#e74c3c" : c.count > 0 ? "#3498db" : null;
            const alpha = c.count === 0 ? 0.04 : 0.12 + (c.count / safeMax) * 0.7;
            const bg = baseCol
              ? `${baseCol}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`
              : isDark
              ? "rgba(255,255,255,0.04)"
              : "rgba(0,0,0,0.04)";
            const fg = baseCol || "var(--ts)";
            return (
              <button
                key={c.domain}
                type="button"
                className={`farm-hm-cell${c.count > 0 ? " has-data" : ""}`}
                style={{ background: bg, color: fg }}
                onClick={() => onCellClick && onCellClick(r.app, c)}
                title={`${r.app} × ${c.domain}: ${c.count} finding${c.count !== 1 ? "s" : ""}${
                  c.overdue ? ` (${c.overdue} overdue)` : ""
                }`}
              >
                {c.count > 0 ? c.count : "—"}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---- Owner cards ----
function OwnerCards({ rows, onCardClick, tall = false }) {
  return (
    <div className={`farm-owner-grid${tall ? " is-tall" : ""}`}>
      {rows.map((o, i) => {
        const c = OWNER_PALETTE[i % OWNER_PALETTE.length];
        return (
          <button
            key={o.name}
            type="button"
            className="farm-owner-card"
            style={{ borderLeft: `3px solid ${c}` }}
            onClick={() => onCardClick && onCardClick(o.name)}
            title={o.full || o.name}
          >
            <div className="farm-owner-name">{o.name}</div>
            <div className="farm-owner-stats">
              <span className="farm-owner-stat" style={{ background: c + "26", color: c }}>
                {o.cnt} finding{o.cnt !== 1 ? "s" : ""}
              </span>
              {o.ov > 0 && (
                <span className="farm-owner-stat tone-red">{o.ov} OVD</span>
              )}
              {o.s1 > 0 && (
                <span className="farm-owner-stat tone-red">S1×{o.s1}</span>
              )}
              {o.ra > 0 && (
                <span className="farm-owner-stat tone-orange">Risk Accept</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---- Top Priority List ----
function TopPriorityList({ rows, onItemClick, tall = false }) {
  const dotPalette = ["#e74c3c", "#e74c3c", "#e74c3c", "#e67e22", "#e67e22", "#d4ac0d", "#d4ac0d", "#27ae60"];
  return (
    <div className={`farm-tl${tall ? " is-tall" : ""}`}>
      {rows.map(({ d, score }, i) => (
        <button
          key={d["Source ID"]}
          type="button"
          className="farm-tl-item"
          onClick={() => onItemClick && onItemClick(d["Source ID"])}
        >
          <span
            className="farm-tl-dot"
            style={{ background: dotPalette[i] || "#94a3b8" }}
          >
            {d["Severity"]}
          </span>
          <span className="farm-tl-body">
            <span className="farm-tl-title">{d["Application Name"]}</span>
            <span className="farm-tl-sub">
              {d["Control Domain"]} · {cpCode(d)} ·{" "}
              <b style={{ color: STATUS_COLORS[d["Current Target Date Age Status"]] }}>
                {d["Current Target Date Age Status"]}
              </b>
              {d["Impacting List"] && d["Impacting List"] !== "-" && (
                <>
                  {" "}· <b style={{ color: "#9b59b6" }}>Impacts: {d["Impacting List"]}</b>
                </>
              )}
              {extCount(d) > 0 && (
                <>
                  {" "}· <b style={{ color: "#e67e22" }}>Ext×{extCount(d)}</b>
                </>
              )}
              {" "}· <span className="farm-tl-score">Score {score}</span>
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

// ---- Findings register table ----
const REGISTER_COLS = [
  { key: "Source ID", label: "Source ID" },
  { key: "Application Name", label: "Application" },
  { key: "Control Domain", label: "Domain" },
  { key: "Current Target Date Age Status", label: "Status" },
  { key: "Severity", label: "Sev" },
  { key: "Criticality", label: "Crit" },
  { key: "_days", label: "Days Left" },
  { key: "Days Since Created Date", label: "Age" },
  { key: "Response Decision", label: "Response" },
  { key: "_owner", label: "Owner" },
  { key: "Impacting List", label: "Impacting" },
  { key: "_cp", label: "CP" },
  { key: "Origin", label: "Origin" },
  { key: "_ext", label: "Ext" },
  { key: "_reopened", label: "Reopened" },
  { key: "_inc", label: "ServiceNow INC" },
];
function FarmRegister({ rows, onRowClick }) {
  const [sort, setSort] = useState({ key: "_days", dir: "asc" });
  const [filters, setFilters] = useState({});
  const [openFilter, setOpenFilter] = useState(null);

  const filterValue = (col, d) => {
    if (col === "_days") return numFld(d, "Days Until Current Target Date");
    if (col === "_owner") return ownerName(d);
    if (col === "_cp") return cpCode(d);
    if (col === "_ext") return extCount(d);
    if (col === "_reopened") return isReopened(d) ? "Yes" : "No";
    if (col === "_inc") return snc(d) || "—";
    return d[col] == null ? "" : d[col];
  };

  const filtered = useMemo(() => {
    const entries = Object.entries(filters).filter(([, set]) => set && set.size > 0);
    if (!entries.length) return rows;
    return rows.filter((d) =>
      entries.every(([col, set]) => set.has(String(filterValue(col, d))))
    );
  }, [rows, filters]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = filterValue(sort.key, a);
      const bv = filterValue(sort.key, b);
      const na = typeof av === "number" ? av : null;
      const nb = typeof bv === "number" ? bv : null;
      if (na != null && nb != null) {
        return sort.dir === "asc" ? na - nb : nb - na;
      }
      const sa = String(av).toLowerCase();
      const sb = String(bv).toLowerCase();
      if (sa < sb) return sort.dir === "asc" ? -1 : 1;
      if (sa > sb) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sort]);

  const onHeaderSort = (k) =>
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "asc" }));

  const applyFilter = (key, set) =>
    setFilters((f) => {
      const next = { ...f };
      if (!set || set.size === 0) delete next[key];
      else next[key] = set;
      return next;
    });

  const activeFilterCount = Object.keys(filters).length;
  const filterableCols = new Set([
    "Application Name",
    "Control Domain",
    "Current Target Date Age Status",
    "Severity",
    "Criticality",
    "Response Decision",
    "_owner",
    "Impacting List",
    "_cp",
    "Origin",
    "_reopened",
  ]);

  return (
    <div className="log-wrap">
      <div className="log-toolbar">
        <span className="log-count">
          Showing <b>{sorted.length}</b> of <b>{rows.length}</b>
          {activeFilterCount > 0 && (
            <>
              {" "}·{" "}
              <span className="log-filter-tag">
                {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                className="log-clear-btn"
                onClick={() => setFilters({})}
              >
                Clear all
              </button>
            </>
          )}
        </span>
      </div>
      <div className="log-scroll">
        <table className="log-table">
          <thead>
            <tr>
              {REGISTER_COLS.map((c) => (
                <FarmColHeader
                  key={c.key}
                  col={c}
                  rows={rows}
                  filterValueFn={filterValue}
                  filterable={filterableCols.has(c.key)}
                  sort={sort}
                  onSortClick={() => onHeaderSort(c.key)}
                  filters={filters}
                  onApply={(set) => applyFilter(c.key, set)}
                  isOpen={openFilter === c.key}
                  onToggle={() =>
                    setOpenFilter((cur) => (cur === c.key ? null : c.key))
                  }
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={REGISTER_COLS.length} className="log-empty">
                  No findings match the active filters.
                </td>
              </tr>
            )}
            {sorted.map((d) => {
              const days = numFld(d, "Days Until Current Target Date");
              const dc = days < 0 ? "#e74c3c" : days <= 30 ? "#e67e22" : "#27ae60";
              const inc = snc(d);
              return (
                <tr
                  key={d["Source ID"]}
                  className="log-row log-row-clickable"
                  onClick={() => onRowClick && onRowClick(d["Source ID"])}
                >
                  <td className="log-time">{d["Source ID"]}</td>
                  <td className="log-repo" title={d["Application Name"]}>
                    {d["Application Name"]}
                  </td>
                  <td className="log-cat" title={d["Control Domain"]}>
                    {d["Control Domain"]}
                  </td>
                  <td>{statusBadge(d["Current Target Date Age Status"])}</td>
                  <td>{sevBadge(d["Severity"])}</td>
                  <td>{critBadge(d["Criticality"])}</td>
                  <td className="tbl-mono" style={{ color: dc, fontWeight: 700, fontSize: 11 }}>
                    {days > 0 ? "+" : ""}
                    {days}
                  </td>
                  <td className="tbl-mono" style={{ color: "var(--tm)", fontSize: 11 }}>
                    {d["Days Since Created Date"]}
                  </td>
                  <td>{respBadge(d["Response Decision"])}</td>
                  <td className="log-resolver" title={d["Responsible Party"]}>
                    {ownerName(d)}
                  </td>
                  <td>
                    {d["Impacting List"] && d["Impacting List"] !== "-" ? (
                      <span
                        className="badge"
                        style={{ background: "rgba(155,89,182,.16)", color: "#9b59b6" }}
                      >
                        {d["Impacting List"]}
                      </span>
                    ) : (
                      <span style={{ color: "var(--ts)" }}>—</span>
                    )}
                  </td>
                  <td className="tbl-mono" style={{ fontSize: 10, color: "var(--ts)" }} title={d["Control Procedure"]}>
                    {cpCode(d)}
                  </td>
                  <td className="tbl-mono" style={{ fontSize: 10, color: "var(--ts)" }}>
                    {String(d["Origin"] || "").replace(/_/g, " ")}
                  </td>
                  <td
                    className="tbl-mono"
                    style={{
                      textAlign: "center",
                      color: extCount(d) > 0 ? "#e67e22" : "var(--ts)",
                      fontSize: 11,
                    }}
                  >
                    {extCount(d) || "—"}
                  </td>
                  <td
                    className="tbl-mono"
                    style={{ fontSize: 10, color: isReopened(d) ? "#e74c3c" : "var(--ts)" }}
                  >
                    {isReopened(d) ? "Yes" : "No"}
                  </td>
                  <td className="tbl-mono" style={{ fontSize: 10, color: inc ? "#3498db" : "var(--ts)" }}>
                    {inc || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterIcon({ active }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function FarmColHeader({
  col,
  rows,
  filterValueFn,
  filterable,
  sort,
  onSortClick,
  filters,
  onApply,
  isOpen,
  onToggle,
}) {
  const sorted = sort.key === col.key;
  const filterActive = !!filters[col.key] && filters[col.key].size > 0;
  return (
    <th className={`log-th${sorted ? " sorted" : ""}`}>
      <div className="log-th-row">
        <button type="button" className="log-th-sort" onClick={onSortClick}>
          <span>{col.label}</span>
          <span className="log-arrow">
            {sorted ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
          </span>
        </button>
        {filterable && (
          <button
            type="button"
            className={`log-filter-trigger${filterActive ? " active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            aria-label={`Filter ${col.label}`}
            title={`Filter ${col.label}`}
          >
            <FilterIcon active={filterActive} />
          </button>
        )}
      </div>
      {isOpen && filterable && (
        <FarmFilterPopover
          col={col}
          rows={rows}
          filterValueFn={filterValueFn}
          current={filters[col.key]}
          onApply={(set) => {
            onApply(set);
            onToggle();
          }}
          onClose={onToggle}
        />
      )}
    </th>
  );
}

function FarmFilterPopover({ col, rows, filterValueFn, current, onApply, onClose }) {
  const ref = useRef(null);
  const uniqueValues = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => set.add(String(filterValueFn(col.key, r))));
    return [...set].sort();
  }, [rows, col.key, filterValueFn]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(() => {
    if (current && current.size > 0) return new Set(current);
    return new Set(uniqueValues);
  });
  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [onClose]);
  const filteredValues = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return uniqueValues;
    return uniqueValues.filter((v) => v.toLowerCase().includes(q));
  }, [uniqueValues, search]);
  const toggle = (v) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  const selectAllFiltered = () =>
    setSelected((s) => {
      const next = new Set(s);
      filteredValues.forEach((v) => next.add(v));
      return next;
    });
  const clearAllFiltered = () =>
    setSelected((s) => {
      const next = new Set(s);
      filteredValues.forEach((v) => next.delete(v));
      return next;
    });
  const apply = () => {
    if (selected.size === uniqueValues.length) onApply(null);
    else onApply(selected);
  };
  const clear = () => onApply(null);
  return (
    <div className="filter-popover" ref={ref} onClick={(e) => e.stopPropagation()}>
      <input
        type="search"
        className="filter-search"
        placeholder={`Search ${col.label}…`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      <div className="filter-quicks">
        <button type="button" onClick={selectAllFiltered} className="filter-quick-btn">
          Select all
        </button>
        <button type="button" onClick={clearAllFiltered} className="filter-quick-btn">
          Clear
        </button>
      </div>
      <div className="filter-options">
        {filteredValues.length === 0 && <div className="filter-empty">No matches</div>}
        {filteredValues.map((v) => (
          <label key={v} className="filter-opt">
            <input type="checkbox" checked={selected.has(v)} onChange={() => toggle(v)} />
            <span title={v}>{v}</span>
          </label>
        ))}
      </div>
      <div className="filter-actions">
        <button type="button" className="filter-btn-secondary" onClick={clear}>
          Reset
        </button>
        <button type="button" className="filter-btn-primary" onClick={apply}>
          Apply
        </button>
      </div>
    </div>
  );
}
