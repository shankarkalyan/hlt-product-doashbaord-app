import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, Bubble, Doughnut, Line } from "react-chartjs-2";
import KPICards from "./KPICards";
import AnimatedNumber from "./AnimatedNumber";

const PRIORITY_COLORS = {
  P1: "#e74c3c",
  P2: "#e67e22",
  P3: "#f1c40f",
  P4: "#27ae60",
};
const PRIORITY_LIST = ["P1", "P2", "P3", "P4"];
const SLA_DAYS = { P1: 0.5, P2: 2, P3: 5, P4: 10 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AGE_BUCKETS = ["0-1 Days", "1-2 Days", "2-4 Days", "4-10 Days"];
const AGE_BUCKET_COLORS = ["#27ae60", "#f1c40f", "#e67e22", "#e74c3c"];

// Schema for the shared DrillPanel — operates on the raw incident JSON shape
export const INCIDENT_SCHEMA = {
  entity: "Incident",
  pluralEntity: "incidents",
  emptyText: "No incidents match this slice.",
  rowKey: (d) => d["Incident Number"],
  columns: [
    {
      id: "Incident Number",
      label: "INC #",
      render: (d) => (
        <span className="tbl-mono" style={{ fontSize: 11 }}>
          {d["Incident Number"]}
        </span>
      ),
    },
    {
      id: "Reporting Date",
      label: "Date",
      render: (d) => (
        <span className="tbl-mono" style={{ fontSize: 11 }}>
          {String(d["Reporting Date"] || "—").replace(/\\\//g, "/")}
        </span>
      ),
    },
    {
      id: "Priority",
      label: "Priority",
      render: (d) => (
        <span
          className="badge"
          style={{
            background: PRIORITY_COLORS[d.Priority] + "30",
            color: PRIORITY_COLORS[d.Priority],
            fontWeight: 700,
          }}
        >
          {d.Priority}
        </span>
      ),
    },
    {
      id: "Time to Resolve (Days)",
      label: "TTR",
      render: (d) => {
        const v = d["Time to Resolve (Days)"];
        const n = parseFloat(v);
        if (!isFinite(n)) return <span className="tbl-mono" style={{ fontSize: 11 }}>—</span>;
        const sla = SLA_DAYS[d.Priority];
        const cls = sla == null ? "" : n <= sla ? "sla-ok" : n <= sla * 1.5 ? "sla-warn" : "sla-breach";
        return (
          <span className={`tbl-mono ${cls}`} style={{ fontSize: 11, fontWeight: 700 }}>
            {n}d
          </span>
        );
      },
    },
    {
      id: "Category",
      label: "Category",
      render: (d) => (
        <span style={{ fontSize: 11 }}>{d.Category}</span>
      ),
    },
    {
      id: "SubCategory",
      label: "SubCategory",
      render: (d) => (
        <span className="log-subcat-pill" title={d.SubCategory}>
          {d.SubCategory}
        </span>
      ),
    },
    {
      id: "Resolved By",
      label: "Resolved By",
      render: (d) => (
        <span style={{ fontSize: 11 }}>{d["Resolved By"]}</span>
      ),
    },
  ],
  detail: {
    title: (d) => d["Incident Number"],
    subtitle: (d) =>
      `${d.App || "—"} · ${d["Reporting Date"] ? String(d["Reporting Date"]).replace(/\\\//g, "/") : "—"}`,
    pills: (d) => [
      <span
        key="p"
        className="badge"
        style={{
          background: PRIORITY_COLORS[d.Priority] + "30",
          color: PRIORITY_COLORS[d.Priority],
          fontWeight: 700,
        }}
      >
        {d.Priority}
      </span>,
      <span
        key="s"
        className="badge"
        style={{
          background: "rgba(148,163,184,0.18)",
          color: "var(--tm)",
        }}
      >
        {d.State}
      </span>,
      <span
        key="age"
        className="badge"
        style={{
          background: "rgba(52,152,219,0.18)",
          color: "#3498db",
        }}
      >
        {d["Resolved Age"]}
      </span>,
    ],
    fields: [
      ["Incident Number", "Incident #"],
      ["Priority", "Priority"],
      ["State", "State"],
      ["Reporting Date", "Reporting Date"],
      ["Reporting Month", "Reporting Month"],
      ["Reporting Year", "Reporting Year"],
      ["App", "Application"],
      ["App ID", "App ID"],
      ["Product", "Product"],
      ["Product Line", "Product Line"],
      ["Time to Resolve (Days)", "TTR (Days)"],
      ["Resolved Age", "Resolved Age"],
      ["Category", "Category"],
      ["SubCategory", "SubCategory"],
      ["Severity", "Severity"],
      ["Urgency", "Urgency"],
      ["Assignment Group", "Assignment Group"],
      ["Assigned To", "Assigned To"],
      ["Resolved By", "Resolved By"],
      ["Opened By", "Opened By"],
      ["Opened Time", "Opened"],
      ["Resolved Time", "Resolved"],
      ["Duration", "Duration"],
      ["Affected CIs", "Affected CIs"],
      ["Business Impact", "Business Impact"],
      ["Short Description", "Short Description"],
      ["Description", "Description"],
      ["Work Notes", "Work Notes"],
    ],
    formatField: (key, value) => {
      if (value == null || value === "" || value === "-") return "—";
      if (typeof value === "string") return value.replace(/\\\//g, "/");
      return String(value);
    },
    monoFields: new Set([
      "Incident Number",
      "Reporting Date",
      "Opened Time",
      "Resolved Time",
      "Description",
      "Work Notes",
      "Business Impact",
    ]),
  },
};

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

// Parse "MM/DD/YYYY" or "MM/DD/YYYY HH:MM" → Date
function parseDate(s) {
  if (!s || typeof s !== "string" || s === "-") return null;
  const cleaned = s.replace(/\\\//g, "/");
  const [datePart, timePart] = cleaned.split(" ");
  const [mm, dd, yyyy] = datePart.split("/").map(Number);
  if (!mm || !dd || !yyyy) return null;
  let hh = 0;
  let mi = 0;
  if (timePart) {
    const [h, m] = timePart.split(":").map(Number);
    hh = h || 0;
    mi = m || 0;
  }
  return new Date(yyyy, mm - 1, dd, hh, mi);
}

// Parse customer count out of "Approximately N customers impacted"
function parseImpact(text) {
  if (!text || typeof text !== "string") return null;
  const m = text.match(/Approximately\s+([\d,]+)\s+customers?\s+impacted/i);
  if (!m) return null;
  return parseInt(m[1].replace(/,/g, ""), 10);
}

function asNumber(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v !== "-" && v !== "") {
    const n = parseFloat(v);
    return isFinite(n) ? n : null;
  }
  return null;
}

export default function IncidentDashboard({
  incidents,
  isDark,
  setExpandedChart,
  openDrill,
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
    color: isDark ? "#ffffff" : "#0f172a",
    font: { weight: 700, size: 11, family: "'JetBrains Mono', monospace" },
    anchor: "center",
    align: "center",
    formatter: (v) => (v && v !== 0 ? v : ""),
    textStrokeColor: isDark ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.65)",
    textStrokeWidth: 2,
  };

  // Normalised incident records
  const items = useMemo(() => {
    return incidents.map((d) => {
      const reportedAt = parseDate(d["Reporting Date"]);
      const openedAt = parseDate(d["Opened Time"]);
      const resolvedAt = parseDate(d["Resolved Time"]);
      const ttr = asNumber(d["Time to Resolve (Days)"]);
      return {
        num: d["Incident Number"],
        priority: d["Priority"],
        state: d["State"],
        appId: d["App ID"],
        app: d["App"],
        productLine: d["Product Line"],
        product: d["Product"],
        ttr: ttr == null ? 0 : ttr,
        ttrRaw: ttr,
        ageBucket: d["Resolved Age"],
        category: d["Category"],
        subCategory: d["SubCategory"],
        severity: d["Severity"],
        urgency: d["Urgency"],
        impact: parseImpact(d["Business Impact"]),
        resolver: d["Resolved By"],
        assignee: d["Assigned To"],
        opener: d["Opened By"],
        group: d["Assignment Group"],
        month: d["Reporting Month"],
        year: d["Reporting Year"],
        shortDesc: d["Short Description"] || "",
        description: d["Description"] || "",
        reportedAt,
        openedAt,
        resolvedAt,
      };
    });
  }, [incidents]);

  const stats = useMemo(() => {
    const total = items.length;
    const byPriority = {};
    const byMonth = {};
    const monthByPrio = {};
    const monthSet = new Set();
    const byCategory = {};
    const bySub = {};
    const byAge = {};
    const byGroup = {};
    const byResolver = {};
    let impactedCount = 0;
    let totalImpact = 0;
    items.forEach((d) => {
      byPriority[d.priority] = (byPriority[d.priority] || 0) + 1;
      monthSet.add(d.month);
      byMonth[d.month] = (byMonth[d.month] || 0) + 1;
      const mk = `${d.month}|${d.priority}`;
      monthByPrio[mk] = (monthByPrio[mk] || 0) + 1;
      byCategory[d.category] = (byCategory[d.category] || 0) + 1;
      bySub[d.subCategory] = (bySub[d.subCategory] || 0) + 1;
      byAge[d.ageBucket] = (byAge[d.ageBucket] || 0) + 1;
      byGroup[d.group] = (byGroup[d.group] || 0) + 1;
      byResolver[d.resolver] = (byResolver[d.resolver] || 0) + 1;
      if (d.impact) {
        impactedCount += 1;
        totalImpact += d.impact;
      }
    });

    const months = MONTHS.filter((m) => monthSet.has(m));

    const priorityList = PRIORITY_LIST.filter((p) => (byPriority[p] || 0) > 0);

    const avgTtr = (filterFn) => {
      const slice = items.filter(filterFn);
      if (!slice.length) return 0;
      return slice.reduce((s, d) => s + d.ttr, 0) / slice.length;
    };
    const avgTtrAll = total ? items.reduce((s, d) => s + d.ttr, 0) / total : 0;

    const ttrByPrio = priorityList.map((p) => avgTtr((d) => d.priority === p));

    const subTtr = Object.keys(bySub).map((s) => {
      const slice = items.filter((d) => d.subCategory === s);
      return {
        sub: s,
        avg: slice.reduce((acc, d) => acc + d.ttr, 0) / slice.length,
        count: slice.length,
      };
    }).sort((a, b) => b.avg - a.avg);

    const resolverStats = Object.keys(byResolver).map((r) => {
      const slice = items.filter((d) => d.resolver === r);
      return {
        resolver: r,
        count: slice.length,
        avg: slice.reduce((acc, d) => acc + d.ttr, 0) / slice.length,
      };
    }).sort((a, b) => b.count - a.count);

    const groupStats = Object.keys(byGroup).map((g) => ({
      group: g,
      count: byGroup[g],
    })).sort((a, b) => b.count - a.count);

    // Customers impacted by month
    const custByMonth = months.map((m) =>
      items.filter((d) => d.month === m && d.impact).reduce((s, d) => s + d.impact, 0)
    );

    // Busiest month
    let busiestMonth = months[0] || "—";
    let busiestCount = 0;
    months.forEach((m) => {
      if ((byMonth[m] || 0) > busiestCount) {
        busiestCount = byMonth[m];
        busiestMonth = m;
      }
    });

    const thirdPartyCount = items.filter(
      (d) =>
        d.subCategory &&
        d.subCategory.toLowerCase().includes("third party")
    ).length;

    // chronological order (oldest → newest)
    const chronological = [...items].sort(
      (a, b) => (a.reportedAt?.getTime() || 0) - (b.reportedAt?.getTime() || 0)
    );

    // app(s)
    const apps = [...new Set(items.map((d) => d.app).filter(Boolean))];
    const appIds = [...new Set(items.map((d) => d.appId).filter(Boolean))];

    return {
      total,
      byPriority,
      priorityList,
      months,
      byMonth,
      monthByPrio,
      byCategory,
      bySub,
      byAge,
      byGroup,
      byResolver,
      avgTtr,
      avgTtrAll,
      ttrByPrio,
      subTtr,
      resolverStats,
      groupStats,
      custByMonth,
      impactedCount,
      totalImpact,
      busiestMonth,
      busiestCount,
      thirdPartyCount,
      chronological,
      apps,
      appIds,
    };
  }, [items]);

  // ---- Drill helpers (operate on raw incident JSON shape) ----
  const drill = (title, predicate) => openDrill && openDrill(title, predicate);
  const drillByPriority = (p) =>
    drill(`Priority · ${p}`, (d) => d.Priority === p);
  const drillByMonth = (m) =>
    drill(`Month · ${m}`, (d) => d["Reporting Month"] === m);
  const drillByMonthPriority = (m, p) =>
    drill(`${m} · ${p}`, (d) => d["Reporting Month"] === m && d.Priority === p);
  const drillByCategory = (c) =>
    drill(`Category · ${c}`, (d) => d.Category === c);
  const drillBySub = (s) =>
    drill(`SubCategory · ${s}`, (d) => d.SubCategory === s);
  const drillByAge = (a) =>
    drill(`Resolved age · ${a}`, (d) => d["Resolved Age"] === a);
  const drillByGroup = (g) =>
    drill(`Group · ${g}`, (d) => d["Assignment Group"] === g);
  const drillByResolver = (r) =>
    drill(`Resolved by · ${r}`, (d) => d["Resolved By"] === r);
  const drillByImpacted = () =>
    drill(
      "Customer-impacting incidents",
      (d) => parseImpact(d["Business Impact"]) != null
    );
  const drillSingle = (incidentNumber) =>
    drill(
      `Incident · ${incidentNumber}`,
      (d) => d["Incident Number"] === incidentNumber
    );
  const drillByMonthCustomers = (m) =>
    drill(
      `${m} · customer-impacting`,
      (d) =>
        d["Reporting Month"] === m && parseImpact(d["Business Impact"]) != null
    );

  // ---- KPI cards ----
  const kpiCards = [
    {
      label: "Total Incidents",
      value: stats.total,
      sub: `All ${items.filter((d) => d.state === "Closed").length} closed · ${stats.months.join(" · ")}`,
      tone: "blue",
    },
    {
      label: "P1 Critical",
      value: stats.byPriority.P1 || 0,
      sub: `Avg ${stats.avgTtr((d) => d.priority === "P1").toFixed(1)}d TTR`,
      tone: "red",
      trend: "dn",
    },
    {
      label: "P2 High",
      value: stats.byPriority.P2 || 0,
      sub: `Avg ${stats.avgTtr((d) => d.priority === "P2").toFixed(1)}d TTR`,
      tone: "orange",
    },
    {
      label: "P3 Medium",
      value: stats.byPriority.P3 || 0,
      sub: `Avg ${stats.avgTtr((d) => d.priority === "P3").toFixed(1)}d TTR`,
      tone: "purple",
    },
    {
      label: "Avg TTR (All)",
      value: `${stats.avgTtrAll.toFixed(1)}d`,
      sub: "Time-to-resolve overall",
      tone: "cyan",
    },
    {
      label: "Customers Hit",
      value: stats.totalImpact.toLocaleString(),
      sub: `Across ${stats.impactedCount} incidents`,
      tone: "red",
      trend: "dn",
    },
    {
      label: "3rd-Party Issues",
      value: stats.thirdPartyCount,
      sub: "Vendor dependency risk",
      tone: "orange",
      trend: "dn",
    },
    {
      label: "Busiest Month",
      value: stats.busiestMonth,
      sub: `${stats.busiestCount} incidents`,
      tone: "green",
    },
  ];

  // ---- 1. Priority Donut + Legend ----
  const donutData = {
    labels: stats.priorityList,
    datasets: [
      {
        data: stats.priorityList.map((p) => stats.byPriority[p] || 0),
        backgroundColor: stats.priorityList.map((p) => PRIORITY_COLORS[p] + "bb"),
        borderColor: stats.priorityList.map((p) => PRIORITY_COLORS[p]),
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
      if (els.length) drillByPriority(stats.priorityList[els[0].index]);
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (c) => `${c.label}: ${c.raw} incident${c.raw === 1 ? "" : "s"}`,
        },
      },
      datalabels: {
        ...labelInside,
        font: { weight: 800, size: 13, family: "'JetBrains Mono', monospace" },
        formatter: (v) => {
          const pct = (v / stats.total) * 100;
          if (pct < 5) return "";
          return String(v);
        },
      },
    },
  };
  const donutLegend = (
    <div className="legend">
      {stats.priorityList.map((p) => (
        <div
          key={p}
          className="leg-item leg-clickable"
          onClick={() => drillByPriority(p)}
        >
          <div className="leg-dot" style={{ background: PRIORITY_COLORS[p] }} />
          {p}{" "}
          <b style={{ color: PRIORITY_COLORS[p] }}>
            <AnimatedNumber value={stats.byPriority[p] || 0} />
          </b>
        </div>
      ))}
    </div>
  );

  // ---- 2. Monthly volume (line) ----
  const monthlyVolData = {
    labels: stats.months,
    datasets: [
      {
        label: "Incidents",
        data: stats.months.map((m) => stats.byMonth[m] || 0),
        fill: true,
        tension: 0.45,
        backgroundColor: "rgba(52, 152, 219, 0.18)",
        borderColor: "#3498db",
        borderWidth: 2.5,
        pointBackgroundColor: "#3498db",
        pointRadius: 5,
        pointHoverRadius: 8,
      },
    ],
  };
  const monthlyVolOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillByMonth(stats.months[els[0].index]);
    },
    plugins: {
      legend: { display: false },
      datalabels: {
        color: "#fff",
        backgroundColor: "#3498db",
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
        ticks: { color: tickColor, stepSize: 1 },
        beginAtZero: true,
      },
    },
  };

  // ---- 3. Monthly stacked by priority ----
  const monthlyStackedData = {
    labels: stats.months,
    datasets: stats.priorityList.map((p) => ({
      label: p,
      data: stats.months.map((m) => stats.monthByPrio[`${m}|${p}`] || 0),
      backgroundColor: PRIORITY_COLORS[p] + "99",
      borderColor: PRIORITY_COLORS[p],
      borderWidth: 1,
      borderRadius: 5,
    })),
  };
  const monthlyStackedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) {
        const el = els[0];
        const m = stats.months[el.index];
        const p = stats.priorityList[el.datasetIndex];
        drillByMonthPriority(m, p);
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
      x: { stacked: true, grid: { display: false }, ticks: { color: tickColor } },
      y: {
        stacked: true,
        grid: { color: gridColor },
        ticks: { color: tickColor, stepSize: 1 },
      },
    },
  };

  // ---- 4. TTR by Priority (bar + SLA target line) ----
  const ttrPrioData = {
    labels: stats.priorityList,
    datasets: [
      {
        label: "Avg TTR",
        data: stats.ttrByPrio.map((v) => parseFloat(v.toFixed(2))),
        backgroundColor: stats.priorityList.map((p, i) =>
          stats.ttrByPrio[i] <= SLA_DAYS[p] ? "#27ae6099" : "#e74c3c99"
        ),
        borderColor: stats.priorityList.map((p, i) =>
          stats.ttrByPrio[i] <= SLA_DAYS[p] ? "#27ae60" : "#e74c3c"
        ),
        borderWidth: 2,
        borderRadius: 8,
      },
      {
        label: "SLA Target",
        data: stats.priorityList.map((p) => SLA_DAYS[p]),
        type: "line",
        borderColor: "rgba(255,255,255,0.4)",
        borderWidth: 1.5,
        borderDash: [5, 3],
        pointRadius: 0,
        fill: false,
        datalabels: { display: false },
      },
    ],
  };
  const ttrPrioOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) {
        const el = els[0];
        if (el.datasetIndex === 0) drillByPriority(stats.priorityList[el.index]);
      }
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 10, font: { size: 10 }, color: tickColor, padding: 8 },
      },
      datalabels: {
        ...labelOnTop,
        formatter: (v, ctx) => (ctx.datasetIndex === 0 && v ? `${v.toFixed(1)}d` : ""),
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: tickColor } },
      y: {
        grid: { color: gridColor },
        ticks: { color: tickColor },
        beginAtZero: true,
        title: { display: true, text: "Days", color: tickColor, font: { size: 10 } },
      },
    },
  };

  // ---- 5. Resolved Age Bucket Doughnut ----
  const ageData = {
    labels: AGE_BUCKETS,
    datasets: [
      {
        data: AGE_BUCKETS.map((b) => stats.byAge[b] || 0),
        backgroundColor: AGE_BUCKET_COLORS.map((c) => c + "bb"),
        borderColor: AGE_BUCKET_COLORS,
        borderWidth: 2,
        hoverOffset: 8,
      },
    ],
  };
  const ageOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "55%",
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillByAge(AGE_BUCKETS[els[0].index]);
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 10, font: { size: 10 }, color: tickColor, padding: 6 },
      },
      datalabels: {
        ...labelInside,
        formatter: (v) => (v && v !== 0 ? v : ""),
      },
    },
  };

  // ---- 6. Category Bar ----
  const catLabels = Object.keys(stats.byCategory);
  const CATEGORY_COLORS = ["#3498db", "#e67e22", "#9b59b6", "#1abc9c", "#f1c40f", "#e74c3c"];
  const catData = {
    labels: catLabels,
    datasets: [
      {
        data: catLabels.map((c) => stats.byCategory[c]),
        backgroundColor: catLabels.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length] + "99"),
        borderColor: catLabels.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]),
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };
  const catOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillByCategory(catLabels[els[0].index]);
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
        ticks: { color: tickColor, stepSize: 2 },
        beginAtZero: true,
      },
    },
  };

  // ---- 7. SubCategory horizontal bar ----
  const subSorted = Object.entries(stats.bySub)
    .map(([sub, count]) => ({ sub, count }))
    .sort((a, b) => b.count - a.count);
  const subData = {
    labels: subSorted.map((x) => x.sub),
    datasets: [
      {
        data: subSorted.map((x) => x.count),
        backgroundColor: "#3498db66",
        borderColor: "#3498db",
        borderWidth: 2,
        borderRadius: 6,
      },
    ],
  };
  const subOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillBySub(subSorted[els[0].index].sub);
    },
    plugins: {
      legend: { display: false },
      datalabels: {
        ...labelInside,
        formatter: (v) => (v > 0 ? v : ""),
      },
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: tickColor, stepSize: 1 },
        beginAtZero: true,
      },
      y: {
        grid: { display: false },
        ticks: { color: tickColor, font: { family: "'JetBrains Mono'", size: 10 } },
      },
    },
  };

  // ---- 8. Customer Impact Bubble ----
  const impacted = items.filter((d) => d.impact);
  const bubbleByPrio = stats.priorityList
    .filter((p) => impacted.some((d) => d.priority === p))
    .map((p) => ({
      label: p,
      data: impacted
        .filter((d) => d.priority === p)
        .map((d) => ({
          x: items.indexOf(d) + 1,
          y: d.ttr,
          r: Math.min(Math.sqrt(d.impact) / 5 + 5, 30),
          inc: d,
        })),
      backgroundColor: PRIORITY_COLORS[p] + "88",
      borderColor: PRIORITY_COLORS[p],
      borderWidth: 2,
    }));
  const bubbleData = { datasets: bubbleByPrio };
  const bubbleOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) {
        const el = els[0];
        const ds = bubbleData.datasets[el.datasetIndex];
        const point = ds && ds.data[el.index];
        if (point && point.inc) drillSingle(point.inc.num);
      }
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 10, font: { size: 10 }, color: tickColor, padding: 8 },
      },
      tooltip: {
        callbacks: {
          label: (c) => {
            const d = c.raw.inc;
            if (!d) return "";
            return [
              `${d.priority} · ${d.ttr}d TTR`,
              `${d.impact.toLocaleString()} customers`,
              d.shortDesc.slice(0, 60) + (d.shortDesc.length > 60 ? "…" : ""),
            ];
          },
        },
      },
      datalabels: { display: false },
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: tickColor },
        title: { display: true, text: "Incident # (chronological)", color: tickColor, font: { size: 10 } },
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: tickColor },
        beginAtZero: true,
        title: { display: true, text: "TTR (Days)", color: tickColor, font: { size: 10 } },
      },
    },
  };

  // ---- 9. Customers by month bar ----
  const MONTH_COLORS = ["#e74c3c", "#e67e22", "#3498db", "#27ae60", "#9b59b6", "#1abc9c"];
  const custMonthData = {
    labels: stats.months,
    datasets: [
      {
        data: stats.custByMonth,
        backgroundColor: stats.months.map((_, i) => MONTH_COLORS[i % MONTH_COLORS.length] + "99"),
        borderColor: stats.months.map((_, i) => MONTH_COLORS[i % MONTH_COLORS.length]),
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };
  const custMonthOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillByMonthCustomers(stats.months[els[0].index]);
    },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => `${c.raw.toLocaleString()} customers` } },
      datalabels: {
        ...labelOnTop,
        formatter: (v) => (v ? v.toLocaleString() : ""),
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: tickColor } },
      y: { grid: { color: gridColor }, ticks: { color: tickColor }, beginAtZero: true },
    },
  };

  // ---- 10. Assignment group workload ----
  const groupShortLabel = (g) =>
    g.replace("CCB_HLT_SENC_HLA: ", "SENC: ").replace("CCB_HLT_HLA: ", "");
  const groupData = {
    labels: stats.groupStats.map((x) => groupShortLabel(x.group)),
    datasets: [
      {
        data: stats.groupStats.map((x) => x.count),
        backgroundColor: "#9b59b666",
        borderColor: "#9b59b6",
        borderWidth: 2,
        borderRadius: 7,
      },
    ],
  };
  const groupOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillByGroup(stats.groupStats[els[0].index].group);
    },
    plugins: {
      legend: { display: false },
      datalabels: { ...labelInside, formatter: (v) => (v > 0 ? v : "") },
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: tickColor, stepSize: 1 },
        beginAtZero: true,
      },
      y: {
        grid: { display: false },
        ticks: { color: tickColor, font: { family: "'JetBrains Mono'", size: 10 } },
      },
    },
  };

  // ---- 11. Resolver chart ----
  const resolverData = {
    labels: stats.resolverStats.map((x) => x.resolver.split(" ")[0]),
    datasets: [
      {
        data: stats.resolverStats.map((x) => x.count),
        backgroundColor: stats.resolverStats.map((x) =>
          x.avg <= 1 ? "#27ae6099" : x.avg <= 2 ? "#f1c40f99" : "#e74c3c99"
        ),
        borderColor: stats.resolverStats.map((x) =>
          x.avg <= 1 ? "#27ae60" : x.avg <= 2 ? "#f1c40f" : "#e74c3c"
        ),
        borderWidth: 2,
        borderRadius: 7,
      },
    ],
  };
  const resolverOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) drillByResolver(stats.resolverStats[els[0].index].resolver);
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (c) => {
            const r = stats.resolverStats[c.dataIndex];
            return `${r.resolver}: ${c.raw} resolved · Avg ${r.avg.toFixed(1)}d`;
          },
        },
      },
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

  // ---- 13. TTR Line chronological ----
  const ttrLineData = {
    labels: stats.chronological.map((d) => d.num.replace("INC5418", "…")),
    datasets: [
      {
        label: "TTR (Days)",
        data: stats.chronological.map((d) => d.ttr),
        fill: false,
        tension: 0.3,
        borderColor: "#3498db",
        borderWidth: 2,
        pointBackgroundColor: stats.chronological.map((d) => PRIORITY_COLORS[d.priority]),
        pointRadius: 5,
        pointHoverRadius: 8,
      },
      {
        label: "P2 SLA",
        data: stats.chronological.map(() => 2),
        borderColor: "rgba(230,126,34,0.4)",
        borderWidth: 1,
        borderDash: [5, 3],
        pointRadius: 0,
        fill: false,
        datalabels: { display: false },
      },
    ],
  };
  const ttrLineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: pointerOnHover,
    onClick: (_e, els) => {
      if (els.length) {
        const el = els[0];
        if (el.datasetIndex === 0) {
          const d = stats.chronological[el.index];
          if (d) drillSingle(d.num);
        }
      }
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 10, font: { size: 10 }, color: tickColor },
      },
      tooltip: {
        callbacks: {
          label: (c) => {
            if (c.datasetIndex === 0) {
              const d = stats.chronological[c.dataIndex];
              return `${d.priority} · ${d.ttr}d · ${d.shortDesc.slice(0, 60)}…`;
            }
            return "P2 SLA: 2 days";
          },
        },
      },
      datalabels: { display: false },
    },
    scales: {
      x: { display: false },
      y: {
        grid: { color: gridColor },
        ticks: { color: tickColor },
        beginAtZero: true,
        title: { display: true, text: "Days", color: tickColor, font: { size: 10 } },
      },
    },
  };

  // ---- Expand defs ----
  const expand = (key, title, sub, render, footer) =>
    setExpandedChart({ key, title, sub, render, footer });

  const expandPriority = () =>
    expand(
      "inc-priority",
      "Incidents by Priority",
      "Distribution of P1–P4 across all incidents",
      () => <Doughnut data={donutData} options={donutOptions} />,
      donutLegend
    );
  const expandMonthlyVol = () =>
    expand(
      "inc-monthlyVol",
      "Monthly Incident Volume",
      "Total incidents opened per month",
      () => <Line data={monthlyVolData} options={monthlyVolOptions} />
    );
  const expandMonthlyStacked = () =>
    expand(
      "inc-monthlyStacked",
      "Monthly Volume by Priority",
      "Stacked bar — P1/P2/P3/P4 per month",
      () => <Bar data={monthlyStackedData} options={monthlyStackedOptions} />
    );
  const expandTtrPrio = () =>
    expand(
      "inc-ttrPrio",
      "Avg Time-to-Resolve by Priority",
      "Bars colored by SLA · dashed line = SLA target",
      () => <Bar data={ttrPrioData} options={ttrPrioOptions} />
    );
  const expandAge = () =>
    expand(
      "inc-age",
      "Resolved Age Bucket Distribution",
      "0–1d · 1–2d · 2–4d · 4–10d",
      () => <Doughnut data={ageData} options={ageOptions} />
    );
  const expandCat = () =>
    expand(
      "inc-cat",
      "Incidents by Category",
      "Top-level category split",
      () => <Bar data={catData} options={catOptions} />
    );
  const expandSub = () =>
    expand(
      "inc-sub",
      "SubCategory Breakdown",
      "Most frequent root cause areas",
      () => <Bar data={subData} options={subOptions} />
    );
  const expandBubble = () =>
    expand(
      "inc-bubble",
      "Customers Impacted per Incident",
      "Bubble size = customers · color = priority · y = TTR days",
      () => <Bubble data={bubbleData} options={bubbleOptions} />
    );
  const expandCustMonth = () =>
    expand(
      "inc-custMonth",
      "Customers Impacted by Month",
      "Sum of affected customers per reporting month",
      () => <Bar data={custMonthData} options={custMonthOptions} />
    );
  const expandGroup = () =>
    expand(
      "inc-group",
      "Assignment Group Workload",
      "Which teams handled the most incidents",
      () => <Bar data={groupData} options={groupOptions} />
    );
  const expandResolver = () =>
    expand(
      "inc-resolver",
      "Resolver Performance",
      "Closed per engineer · color = avg TTR",
      () => <Bar data={resolverData} options={resolverOptions} />
    );
  const expandTtrLine = () =>
    expand(
      "inc-ttrLine",
      "TTR Distribution — Chronological",
      "Time-to-resolve in chronological order",
      () => <Line data={ttrLineData} options={ttrLineOptions} />
    );

  return (
    <>
      <Section>Executive KPIs</Section>
      <KPICards cards={kpiCards} />

      <Section>Volume &amp; Priority Analysis</Section>
      <div className="chart-grid g3">
        <ChartCard
          title="Incidents by Priority"
          sub="Distribution of P1–P4 across all incidents"
          onExpand={expandPriority}
          footer={donutLegend}
          height={210}
        >
          <Doughnut data={donutData} options={donutOptions} />
        </ChartCard>
        <ChartCard
          title="Monthly Incident Volume"
          sub="Total incidents per month"
          onExpand={expandMonthlyVol}
          height={210}
        >
          <Line data={monthlyVolData} options={monthlyVolOptions} />
        </ChartCard>
        <ChartCard
          title="Monthly Volume by Priority"
          sub="Stacked — see P1/P2 escalation months"
          onExpand={expandMonthlyStacked}
          height={210}
        >
          <Bar data={monthlyStackedData} options={monthlyStackedOptions} />
        </ChartCard>
      </div>

      <Section>Resolution Performance</Section>
      <div className="chart-grid g2">
        <ChartCard
          title="Avg Time-to-Resolve by Priority (Days)"
          sub="P1 ≤0.5d · P2 ≤2d · P3 ≤5d · dashed line = SLA"
          onExpand={expandTtrPrio}
          height={230}
        >
          <Bar data={ttrPrioData} options={ttrPrioOptions} />
        </ChartCard>
        <ChartCard
          title="Resolved Age Bucket Distribution"
          sub="Grouping of resolution times"
          onExpand={expandAge}
          height={230}
        >
          <Doughnut data={ageData} options={ageOptions} />
        </ChartCard>
      </div>

      <Section>Category Intelligence</Section>
      <div className="chart-grid g2">
        <ChartCard
          title="Incidents by Category"
          sub="Top-level category"
          onExpand={expandCat}
          height={230}
        >
          <Bar data={catData} options={catOptions} />
        </ChartCard>
        <ChartCard
          title="SubCategory Breakdown"
          sub="Most frequent root cause areas"
          onExpand={expandSub}
          height={230}
        >
          <Bar data={subData} options={subOptions} />
        </ChartCard>
      </div>

      <Section>Customer Impact &amp; SLA</Section>
      <div className="chart-grid g21">
        <ChartCard
          title="Customers Impacted per Incident — Timeline"
          sub="Bubble size = customers · color = priority · y = TTR days"
          onExpand={expandBubble}
          height={260}
        >
          <Bubble data={bubbleData} options={bubbleOptions} />
        </ChartCard>
        <ChartCard
          title="Total Customers Impacted by Month"
          sub="Sum of affected customers per reporting month"
          onExpand={expandCustMonth}
          height={260}
        >
          <Bar data={custMonthData} options={custMonthOptions} />
        </ChartCard>
      </div>

      <Section>Team &amp; Workload Analysis</Section>
      <div className="chart-grid g2">
        <ChartCard
          title="Assignment Group Workload"
          sub="Which teams handled the most incidents"
          onExpand={expandGroup}
          height={230}
        >
          <Bar data={groupData} options={groupOptions} />
        </ChartCard>
        <ChartCard
          title="Resolver Performance — Closed per Engineer"
          sub="Color = avg TTR (green=fast · red=slow)"
          onExpand={expandResolver}
          height={230}
        >
          <Bar data={resolverData} options={resolverOptions} />
        </ChartCard>
      </div>

      <Section>Resolution Time Deep-Dive</Section>
      <div className="chart-grid g12">
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <div className="chart-title">SubCategory Avg TTR (Days)</div>
              <div className="chart-sub">
                Which problem types take the longest to fix
              </div>
            </div>
            <button
              type="button"
              className="chart-expand"
              onClick={() =>
                expand(
                  "inc-subTtr",
                  "SubCategory Avg TTR",
                  "Sorted by avg time-to-resolve",
                  () => <SubTtrBars rows={stats.subTtr} onRowClick={drillBySub} tall />
                )
              }
              aria-label="Expand chart"
              title="Expand"
            >
              <ExpandIcon />
            </button>
          </div>
          <SubTtrBars rows={stats.subTtr} onRowClick={drillBySub} />
        </div>
        <ChartCard
          title="TTR Distribution — All Incidents (Chronological)"
          sub="Spot degradation trends · point color = priority"
          onExpand={expandTtrLine}
          height={220}
        >
          <Line data={ttrLineData} options={ttrLineOptions} />
        </ChartCard>
      </div>

      <Section>Full Incident Log</Section>
      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <div className="chart-title">All {stats.total} Incidents</div>
              <div className="chart-sub">
                Sortable · Excel-style column filters · color-coded by priority
              </div>
            </div>
            <button
              type="button"
              className="chart-expand"
              onClick={() =>
                expand(
                  "inc-fullLog",
                  `All ${stats.total} Incidents`,
                  "Sortable · Excel-style column filters · color-coded by priority",
                  () => <IncidentLog items={items} onRowClick={drillSingle} tall />
                )
              }
              aria-label="Expand chart"
              title="Expand"
            >
              <ExpandIcon />
            </button>
          </div>
          <IncidentLog items={items} onRowClick={drillSingle} />
        </div>
      </div>
    </>
  );
}

// ---- SubCategory progress bars ----
function SubTtrBars({ rows, tall = false, onRowClick }) {
  const max = Math.max(0.001, ...rows.map((r) => r.avg));
  return (
    <div className={`pbar-list${tall ? " is-tall" : ""}`}>
      {rows.map((r) => {
        const tone = r.avg >= 3 ? "bad" : r.avg >= 1.5 ? "warn" : "ok";
        return (
          <button
            key={r.sub}
            type="button"
            className={`pbar-row${onRowClick ? " pbar-clickable" : ""}`}
            onClick={() => onRowClick && onRowClick(r.sub)}
            title={`${r.sub} — ${r.count} incident(s)`}
          >
            <div className="pbar-lbl">{r.sub}</div>
            <div className="pbar-bg">
              <div
                className={`pbar-fill tone-${tone}`}
                style={{ width: `${Math.max(2, (r.avg / max) * 100)}%` }}
              />
            </div>
            <div className={`pbar-val tone-${tone}`}>
              {r.avg.toFixed(1)}d
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---- Incident log: sortable + Excel-style column filters ----
const LOG_COLS = [
  { key: "num", label: "INC #", filterable: false },
  { key: "reportedAt", label: "Date", filterable: false },
  { key: "priority", label: "Priority", filterable: true },
  { key: "ttr", label: "TTR (Days)", filterable: false },
  { key: "category", label: "Category", filterable: true },
  { key: "subCategory", label: "SubCategory", filterable: true },
  { key: "resolver", label: "Resolved By", filterable: true },
  { key: "impact", label: "Customers", filterable: false },
  { key: "shortDesc", label: "Description", filterable: false },
];

function fmtDate(d) {
  if (!d) return "—";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function IncidentLog({ items, tall = false, onRowClick }) {
  const [sort, setSort] = useState({ key: "reportedAt", dir: "asc" });
  const [filters, setFilters] = useState({});
  const [openFilter, setOpenFilter] = useState(null);

  const filtered = useMemo(() => {
    const entries = Object.entries(filters).filter(
      ([, set]) => set && set.size > 0
    );
    if (!entries.length) return items;
    return items.filter((d) =>
      entries.every(([k, set]) => {
        const v = d[k];
        return set.has(String(v == null ? "" : v));
      })
    );
  }, [items, filters]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let av = a[sort.key];
      let bv = b[sort.key];
      if (sort.key === "reportedAt") {
        av = av ? av.getTime() : 0;
        bv = bv ? bv.getTime() : 0;
      } else if (sort.key === "impact" || sort.key === "ttr") {
        av = av == null ? 0 : av;
        bv = bv == null ? 0 : bv;
      }
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sort]);

  const onHeaderSort = (k) =>
    setSort((s) =>
      s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "asc" }
    );

  const applyFilter = (key, set) =>
    setFilters((f) => {
      const next = { ...f };
      if (!set || set.size === 0) delete next[key];
      else next[key] = set;
      return next;
    });

  const activeFilterCount = Object.keys(filters).length;
  const clearAll = () => setFilters({});

  return (
    <div className={`log-wrap${tall ? " is-tall" : ""}`}>
      <div className="log-toolbar">
        <span className="log-count">
          Showing <b>{sorted.length}</b> of <b>{items.length}</b>
          {activeFilterCount > 0 && (
            <>
              {" "}· <span className="log-filter-tag">{activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}</span>
              <button type="button" className="log-clear-btn" onClick={clearAll}>
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
              {LOG_COLS.map((c) => (
                <IncColumnHeader
                  key={c.key}
                  col={c}
                  rows={items}
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
                <td colSpan={LOG_COLS.length} className="log-empty">
                  No incidents match the active filters.
                </td>
              </tr>
            )}
            {sorted.map((d) => {
              const slaCls = ttrSlaClass(d);
              return (
                <tr
                  key={d.num}
                  className={`log-row${onRowClick ? " log-row-clickable" : ""}`}
                  onClick={() => onRowClick && onRowClick(d.num)}
                >
                  <td className="log-time">{d.num}</td>
                  <td className="log-time">{fmtDate(d.reportedAt)}</td>
                  <td>
                    <span
                      className="log-status-pill"
                      style={{
                        background: PRIORITY_COLORS[d.priority] + "30",
                        color: PRIORITY_COLORS[d.priority],
                      }}
                    >
                      {d.priority}
                    </span>
                  </td>
                  <td className={`log-ttr ${slaCls}`}>
                    {d.ttrRaw == null ? "—" : `${d.ttr}d`}
                  </td>
                  <td className="log-cat">{d.category}</td>
                  <td>
                    <span className="log-subcat-pill" title={d.subCategory}>
                      {d.subCategory}
                    </span>
                  </td>
                  <td className="log-resolver">{d.resolver}</td>
                  <td className="log-impact">
                    {d.impact ? (
                      <b style={{ color: "#e74c3c" }}>{d.impact.toLocaleString()}</b>
                    ) : (
                      <span style={{ opacity: 0.5 }}>—</span>
                    )}
                  </td>
                  <td className="log-desc" title={d.shortDesc}>
                    {d.shortDesc}
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

function ttrSlaClass(d) {
  const sla = SLA_DAYS[d.priority];
  if (sla == null || d.ttrRaw == null) return "";
  if (d.ttr <= sla) return "sla-ok";
  if (d.ttr <= sla * 1.5) return "sla-warn";
  return "sla-breach";
}

function FilterIcon({ active }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function IncColumnHeader({ col, rows, sort, onSortClick, filters, onApply, isOpen, onToggle }) {
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
        {col.filterable && (
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
      {isOpen && col.filterable && (
        <IncFilterPopover
          col={col}
          rows={rows}
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

function IncFilterPopover({ col, rows, current, onApply, onClose }) {
  const ref = useRef(null);

  const uniqueValues = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => set.add(String(r[col.key] == null ? "" : r[col.key])));
    return [...set].sort();
  }, [rows, col.key]);

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
        <button type="button" onClick={selectAllFiltered} className="filter-quick-btn">Select all</button>
        <button type="button" onClick={clearAllFiltered} className="filter-quick-btn">Clear</button>
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
        <button type="button" className="filter-btn-secondary" onClick={clear}>Reset</button>
        <button type="button" className="filter-btn-primary" onClick={apply}>Apply</button>
      </div>
    </div>
  );
}
