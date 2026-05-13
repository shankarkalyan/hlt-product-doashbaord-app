import { Fragment, useMemo, useState } from "react";
import KPICards from "./KPICards";
import AnimatedNumber from "./AnimatedNumber";
import Tabs from "./Tabs";

const MONTH_LABELS = [
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
const MONTH_LOOKUP = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

// Dark red (overdue) → blue (> 90 days) gradient.
const REL_COLORS = {
  overdue: "#8b0000",
  d030: "#e74c3c",
  d3160: "#e67e22",
  d6190: "#27ae60",
  far: "#3498db",
};
const REL_LABELS = {
  overdue: "Overdue",
  d030: "Due 0-30 days",
  d3160: "Due 31-60 days",
  d6190: "Due 61-90 days",
  far: "Due > 90 days",
};

function parseTargetDate(s) {
  if (!s || s === "No Date") return null;
  const parts = String(s).split("-");
  if (parts.length !== 3) return null;
  const month = MONTH_LOOKUP[parts[1]];
  const year = Number(parts[2]);
  if (month == null || !isFinite(year)) return null;
  return { year, month, key: `${year}-${month}` };
}

function relativeBucket(year, month, today) {
  const todayIdx = today.getFullYear() * 12 + today.getMonth();
  const idx = year * 12 + month - todayIdx;
  if (idx < 0) return "overdue";
  if (idx === 0) return "d030";
  if (idx === 1) return "d3160";
  if (idx === 2) return "d6190";
  return "far";
}

function alphaHex(a) {
  return Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, "0");
}

// Deterministic palette index for unknown values, so colors stay stable across
// re-renders for the same input string.
function _hashIdx(s, mod) {
  let h = 0;
  const str = String(s || "");
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

// Severity color. Curated tones for the standard S1-S4 ladder; anything else
// gets a stable palette pick. Does not depend on the dataset, so it can also
// be used by helper components outside the React component.
const _SEV_PALETTE = [
  "#3498db",
  "#9b59b6",
  "#1abc9c",
  "#ec407a",
  "#117aca",
  "#f1c40f",
];
function colorForSev(s) {
  if (!s) return "#94a3b8";
  const m = /^S(\d+)$/i.exec(s);
  if (m) {
    const n = Number(m[1]);
    // S1 highest severity → red; later numbers cool down.
    const ladder = ["#e74c3c", "#e67e22", "#d4ac0d", "#27ae60"];
    if (n >= 1 && n <= ladder.length) return ladder[n - 1];
  }
  return _SEV_PALETTE[_hashIdx(s, _SEV_PALETTE.length)];
}

// Bucket color. Parses "Overdue" and "Due in X-Y Days" patterns to map
// deadline proximity to warmth (overdue = dark red, < 30 = orange, < 60 =
// amber, < 90 = green, ≥ 90 = blue). Unknown labels get a stable palette.
const _BUCKET_PALETTE = [
  "#3498db",
  "#9b59b6",
  "#1abc9c",
  "#ec407a",
  "#117aca",
];
function colorForBucket(b) {
  if (!b) return "#94a3b8";
  if (/overdue/i.test(b)) return "#c0392b";
  const m = /(\d+)\s*-\s*(\d+)/.exec(b);
  if (m) {
    const lo = Number(m[1]);
    if (lo < 30) return "#e67e22";
    if (lo < 60) return "#d4ac0d";
    if (lo < 90) return "#27ae60";
    return "#3498db";
  }
  const m2 = /(\d+)\s*Days?/i.exec(b);
  if (m2) {
    const n = Number(m2[1]);
    if (n < 30) return "#e67e22";
    if (n < 60) return "#d4ac0d";
    if (n < 90) return "#27ae60";
    return "#3498db";
  }
  return _BUCKET_PALETTE[_hashIdx(b, _BUCKET_PALETTE.length)];
}

// Sort keys: lower number = closer to (or past) deadline / more severe.
function bucketSortKey(b) {
  if (!b) return 1e9;
  if (/overdue/i.test(b)) return -1;
  const m = /(\d+)\s*-\s*(\d+)/.exec(b);
  if (m) return Number(m[1]);
  const m2 = /(\d+)\s*Days?/i.exec(b);
  if (m2) return Number(m2[1]);
  return 1e8;
}
function severitySortKey(s) {
  const m = /^S(\d+)$/i.exec(s || "");
  if (m) return Number(m[1]);
  return 1e8;
}

// True for any non-overdue bucket whose upper bound is < 90 days. Lets the
// "Due in < 90 days" combinator work on whatever bucket strings the data has,
// not just the four known labels.
function bucketIsLt90(b) {
  if (!b) return false;
  if (/overdue/i.test(b)) return false;
  const m = /(\d+)\s*-\s*(\d+)/.exec(b);
  if (m) return Number(m[2]) < 90;
  const m2 = /(\d+)\s*Days?/i.exec(b);
  if (m2) return Number(m2[1]) < 90;
  return false;
}

function isOverdueFinding(f) {
  return /overdue/i.test(f["Current Target Date Age Status"] || "");
}

function matchesBucket(d, bucketId) {
  if (bucketId === "all") return true;
  const b = d["Current Target Date Age Status"];
  if (bucketId === "lt90") return bucketIsLt90(b);
  return b === bucketId;
}

// ---- Sample extension requests so the admin view has content on load ----
// Pure illustrative demo content. Source rows are picked from whichever
// findings happen to be overdue / near-deadline in the loaded dataset, so it
// stays meaningful when the data is swapped out.
function seedExtensionRequests(findings) {
  const seed = [];
  const reasons = [
    "ServiceNow change ticket awaiting CAB approval; dependency on infra freeze window.",
    "Vendor patch released later than planned; integration test cycle extended by two weeks.",
    "Remediation requires coordinated rollout across regions; need additional change window.",
    "Open PR blocked on security review; awaiting findings sign-off from InfoSec.",
    "Service account rotation requires owning team availability — scheduling conflict.",
  ];
  const overdueFindings = findings.filter(isOverdueFinding);
  const nearDeadline = findings.filter((f) => {
    const b = f["Current Target Date Age Status"] || "";
    if (/overdue/i.test(b)) return false;
    const m = /(\d+)\s*-\s*(\d+)/.exec(b);
    return m && Number(m[2]) <= 30;
  });
  const sampleSet = [
    ...overdueFindings.slice(0, 3),
    ...nearDeadline.slice(0, 2),
  ];
  const today = new Date();
  const toIso = (d) => {
    const z = new Date(d);
    z.setHours(0, 0, 0, 0);
    return z.toISOString().slice(0, 10);
  };
  sampleSet.forEach((f, idx) => {
    const requestedAt = new Date(today);
    requestedAt.setDate(today.getDate() - (idx * 2 + 1));
    seed.push({
      id: `EXT-${f["Source ID"]}`,
      sourceId: f["Source ID"],
      findingId: f["Source ID"],
      ao: f["AO"],
      application: f["Application Name"],
      severity: f["Severity"],
      currentTargetDate: f["Current Target Date"],
      requestedDays: 14 + idx * 7,
      reason: reasons[idx % reasons.length],
      status: "pending",
      adminComment: "",
      requestedAt: toIso(requestedAt),
    });
  });
  return seed;
}

// ---- Lightweight modal helper ----
function Modal({ open, title, onClose, children, width = 540 }) {
  if (!open) return null;
  return (
    <div className="aow-modal-overlay" onClick={onClose}>
      <div
        className="aow-modal"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aow-modal-head">
          <div className="aow-modal-title">{title}</div>
          <button
            type="button"
            className="aow-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="aow-modal-body">{children}</div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    pending: { bg: "rgba(230,126,34,0.18)", c: "#e67e22", label: "Pending" },
    approved: { bg: "rgba(39,174,96,0.18)", c: "#27ae60", label: "Approved" },
    rejected: { bg: "rgba(231,76,60,0.18)", c: "#e74c3c", label: "Rejected" },
  };
  const m = map[status] || map.pending;
  return (
    <span
      className="aow-pill"
      style={{ background: m.bg, color: m.c, fontWeight: 800 }}
    >
      {m.label}
    </span>
  );
}

function SeverityBadge({ s }) {
  const c = colorForSev(s);
  return (
    <span
      className="aow-pill"
      style={{ background: c + "26", color: c, fontWeight: 700 }}
    >
      {s || "—"}
    </span>
  );
}

export default function AOWorkflowDashboard({
  findings,
  isDark,
  openFarmDrill,
  openFarmDrillRow,
}) {
  const [tab, setTab] = useState("heatmap");
  const [bucketFilter, setBucketFilter] = useState("all");
  // ---- Auth state ----
  // Guests see Heatmap + Allocate. Admin login unlocks Admin Approvals.
  // AO login unlocks the AO Workbench tab for that specific owner.
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [isAo, setIsAo] = useState(false);
  const [aoLoggedIn, setAoLoggedIn] = useState(""); // e.g. "Sarah Chen (S123456)"
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginRole, setLoginRole] = useState("admin"); // 'admin' | 'ao'
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginAo, setLoginAo] = useState("");
  const [loginError, setLoginError] = useState("");
  // ---- Workbench-only state ----
  // JIRA tickets created by AOs against FARM breaks.
  const [jiras, setJiras] = useState({}); // sourceId -> { jiraId, createdAt }
  const [jiraCounter, setJiraCounter] = useState(80001);
  // Closed FARM breaks (AO marks done). Tickets stay in the queue until closed.
  const [closedTickets, setClosedTickets] = useState({}); // sourceId -> true
  const [workbenchFilter, setWorkbenchFilter] = useState("open"); // 'open' | 'closed' | 'all'
  // Local allocation overrides: sourceId → AO display name (e.g. "Sarah Chen (S123456)")
  const [allocations, setAllocations] = useState({});
  const [extensionRequests, setExtensionRequests] = useState(() =>
    seedExtensionRequests(findings)
  );
  const [requestModal, setRequestModal] = useState(null); // { finding }
  const [requestReason, setRequestReason] = useState("");
  const [requestDays, setRequestDays] = useState(14);
  const [adminCommentDraft, setAdminCommentDraft] = useState({}); // requestId → text
  const [toast, setToast] = useState(null);
  // Allocate tab state
  const [allocSearch, setAllocSearch] = useState("");
  const [allocOnlyUnallocated, setAllocOnlyUnallocated] = useState(false);
  const [allocSelected, setAllocSelected] = useState(null); // sourceId
  const [adminFilter, setAdminFilter] = useState("pending");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  // Demo-only credentials. In a real app this would hand off to SSO /
  // corporate auth and the role would come from the token.
  const DEMO_ADMIN = { user: "admin", pass: "admin123" };
  const DEMO_AO_PASS = "ao123";

  const openLogin = (role = "admin") => {
    setLoginRole(role);
    setLoginUser("");
    setLoginPass("");
    setLoginAo("");
    setLoginError("");
    setLoginOpen(true);
  };
  const closeLogin = () => {
    setLoginOpen(false);
    setLoginError("");
  };
  const submitLogin = () => {
    if (loginRole === "admin") {
      if (
        loginUser.trim().toLowerCase() === DEMO_ADMIN.user &&
        loginPass === DEMO_ADMIN.pass
      ) {
        setIsAdmin(true);
        setAdminName(loginUser.trim());
        setIsAo(false);
        setAoLoggedIn("");
        setLoginOpen(false);
        setLoginUser("");
        setLoginPass("");
        setLoginError("");
        showToast("Signed in as admin");
      } else {
        setLoginError("Invalid credentials.");
      }
      return;
    }
    // AO login
    if (!loginAo) {
      setLoginError("Pick your name from the list.");
      return;
    }
    if (loginPass !== DEMO_AO_PASS) {
      setLoginError("Invalid credentials.");
      return;
    }
    setIsAo(true);
    setAoLoggedIn(loginAo);
    setIsAdmin(false);
    setAdminName("");
    setLoginOpen(false);
    setLoginAo("");
    setLoginPass("");
    setLoginError("");
    setTab("workbench");
    showToast(`Signed in as ${loginAo.split(" (")[0]}`);
  };
  const signOut = () => {
    setIsAdmin(false);
    setAdminName("");
    setIsAo(false);
    setAoLoggedIn("");
    if (tab === "admin" || tab === "workbench") setTab("heatmap");
    showToast("Signed out");
  };

  // ---- Workbench helpers ----
  const aoShortName = (aoLoggedIn || "").split(" (")[0] || "AO";
  const today10 = () => new Date().toISOString().slice(0, 10);
  const createJira = (sid) => {
    if (jiras[sid]) {
      showToast(`${jiras[sid].jiraId} already exists for ${sid}`);
      return jiras[sid];
    }
    const jiraId = `JIRA-${jiraCounter}`;
    setJiraCounter((c) => c + 1);
    const entry = { jiraId, createdAt: today10() };
    setJiras((prev) => ({ ...prev, [sid]: entry }));
    showToast(`Created ${jiraId} for ${sid}`);
    return entry;
  };
  const closeTicket = (sid) => {
    setClosedTickets((prev) => ({ ...prev, [sid]: true }));
    showToast(`Closed ${sid}`);
  };
  const reopenTicket = (sid) => {
    setClosedTickets((prev) => {
      const next = { ...prev };
      delete next[sid];
      return next;
    });
    showToast(`Reopened ${sid}`);
  };
  const findingBySid = (sid) =>
    findings.find((f) => f["Source ID"] === sid) || null;
  const drillFinding = (f) => {
    if (openFarmDrillRow && f) openFarmDrillRow(f);
  };
  const drillBySid = (sid) => {
    const f = findingBySid(sid);
    if (f) drillFinding(f);
  };

  // Roster of AOs (derive from data so the workflow uses real names).
  const aoRoster = useMemo(() => {
    const set = new Set();
    findings.forEach((f) => {
      const ao = String(f["AO"] || "").trim();
      if (ao && ao !== "Unspecified") set.add(ao);
    });
    return [...set].sort();
  }, [findings]);

  // ---- Data-derived catalogs (severities, deadline buckets) ----
  // Everything downstream — filter dropdowns, KPI labels, ribbon segments —
  // pulls from these so the dashboard adapts to whatever values the dataset
  // actually contains.
  const sevCatalog = useMemo(() => {
    const set = new Set();
    findings.forEach((f) => {
      const s = f["Severity"];
      if (s) set.add(s);
    });
    return [...set].sort(
      (a, b) => severitySortKey(a) - severitySortKey(b) || a.localeCompare(b)
    );
  }, [findings]);

  const bucketCatalog = useMemo(() => {
    const set = new Set();
    findings.forEach((f) => {
      const b = f["Current Target Date Age Status"];
      if (b) set.add(b);
    });
    return [...set].sort(
      (a, b) => bucketSortKey(a) - bucketSortKey(b) || a.localeCompare(b)
    );
  }, [findings]);

  // Top (most severe) severity in the dataset — used wherever the prior
  // hardcoded "S1" reference appeared (KPI label, workload chip, etc.).
  const topSeverity = sevCatalog[0] || null;

  // Bucket filter options for the heatmap dropdown.
  const bucketOptions = useMemo(() => {
    const opts = [{ id: "all", label: "All findings" }];
    bucketCatalog.forEach((b) => opts.push({ id: b, label: b }));
    if (bucketCatalog.some(bucketIsLt90)) {
      opts.push({ id: "lt90", label: "Due in < 90 days" });
    }
    return opts;
  }, [bucketCatalog]);

  const bucketSubtitle = (id) =>
    bucketOptions.find((b) => b.id === id)?.label || "All findings";

  // Effective AO for a finding = local override if present, else original.
  const effectiveAO = (f) => allocations[f["Source ID"]] || f["AO"];

  // ---- Apply the bucket filter ----
  const filteredFindings = useMemo(
    () => findings.filter((f) => matchesBucket(f, bucketFilter)),
    [findings, bucketFilter]
  );

  // ---- Application × month matrix ----
  // Columns come from the full dataset so the layout is stable across filters.
  const heatmap = useMemo(() => {
    const today = new Date();
    const monthSet = new Map();
    findings.forEach((f) => {
      const d = parseTargetDate(f["Current Target Date"]);
      if (d) monthSet.set(d.key, { year: d.year, month: d.month });
    });
    const months = [...monthSet.values()].sort(
      (a, b) => (a.year - b.year) * 12 + (a.month - b.month)
    );
    const years = [];
    months.forEach((m) => {
      let g = years[years.length - 1];
      if (!g || g.year !== m.year) {
        g = { year: m.year, months: [] };
        years.push(g);
      }
      g.months.push(m);
    });

    const appMap = new Map();
    filteredFindings.forEach((f) => {
      const app = f["Application Name"] || "Unspecified";
      const d = parseTargetDate(f["Current Target Date"]);
      if (!d) return;
      if (!appMap.has(app)) {
        appMap.set(app, {
          app,
          appId: f["Application ID"],
          cells: {},
          total: 0,
        });
      }
      const r = appMap.get(app);
      r.cells[d.key] = (r.cells[d.key] || 0) + 1;
      r.total++;
    });
    const rows = [...appMap.values()].sort((a, b) => b.total - a.total);

    // Per-bucket max for intensity scaling — gives each column-bucket its own
    // scale so a single sparse "far" column doesn't wash out the overdue column.
    const maxPerBucket = { overdue: 0, d030: 0, d3160: 0, d6190: 0, far: 0 };
    rows.forEach((r) => {
      months.forEach((m) => {
        const v = r.cells[`${m.year}-${m.month}`] || 0;
        if (!v) return;
        const b = relativeBucket(m.year, m.month, today);
        if (v > maxPerBucket[b]) maxPerBucket[b] = v;
      });
    });

    return { rows, months, years, maxPerBucket, today };
  }, [findings, filteredFindings]);

  // ---- KPI cards for the heatmap tab ----
  const heatmapKpis = useMemo(() => {
    const overdue = filteredFindings.filter(isOverdueFinding).length;
    const topSevCount = topSeverity
      ? filteredFindings.filter((f) => f["Severity"] === topSeverity).length
      : 0;
    const apps = new Set(filteredFindings.map((f) => f["Application Name"]))
      .size;
    return [
      {
        label: "Findings in view",
        value: filteredFindings.length,
        sub: bucketSubtitle(bucketFilter),
        tone: "blue",
      },
      {
        label: "Applications",
        value: apps,
        sub: "Distinct application owners",
        tone: "cyan",
      },
      {
        label: "Overdue",
        value: overdue,
        sub: "Breach status",
        tone: "red",
      },
      {
        label: `${topSeverity || "Top"} severity`,
        value: topSevCount,
        sub: "Highest severity in view",
        tone: "orange",
      },
    ];
  }, [filteredFindings, bucketFilter, topSeverity]);

  // ---- Heatmap cell click → drill into FARM panel ----
  const openAppMonthDrill = (appName, year, month) => {
    if (!openFarmDrill) return;
    openFarmDrill(
      `${appName} · ${MONTH_LABELS[month]} ${year}`,
      (f) => {
        if (f["Application Name"] !== appName) return false;
        if (!matchesBucket(f, bucketFilter)) return false;
        const d = parseTargetDate(f["Current Target Date"]);
        return !!d && d.year === year && d.month === month;
      }
    );
  };

  // ---- Allocation: filter the working set ----
  const allocList = useMemo(() => {
    const q = allocSearch.trim().toLowerCase();
    return findings.filter((f) => {
      if (allocOnlyUnallocated && allocations[f["Source ID"]]) return false;
      if (!q) return true;
      const hay = [
        f["Source ID"],
        f["Application Name"],
        f["Control Domain"],
        f["AO"],
        f["Current Target Date Age Status"],
        f["Severity"],
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [findings, allocSearch, allocOnlyUnallocated, allocations]);

  // ---- AO workload (uses effective AO) ----
  const aoWorkload = useMemo(() => {
    const map = new Map();
    aoRoster.forEach((ao) =>
      map.set(ao, { ao, total: 0, overdue: 0, topSev: 0, reassigned: 0 })
    );
    findings.forEach((f) => {
      const ao = effectiveAO(f);
      if (!map.has(ao))
        map.set(ao, { ao, total: 0, overdue: 0, topSev: 0, reassigned: 0 });
      const r = map.get(ao);
      r.total++;
      if (isOverdueFinding(f)) r.overdue++;
      if (topSeverity && f["Severity"] === topSeverity) r.topSev++;
      if (allocations[f["Source ID"]]) r.reassigned++;
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [aoRoster, findings, allocations, topSeverity]);

  // ---- Allocation actions ----
  const allocateTo = (sourceId, ao) => {
    setAllocations((prev) => ({ ...prev, [sourceId]: ao }));
    const f = findings.find((x) => x["Source ID"] === sourceId);
    showToast(`Allocated ${sourceId} → ${ao.split(" (")[0]}`);
    if (f) setAllocSelected(null);
  };

  const clearAllocation = (sourceId) => {
    setAllocations((prev) => {
      const next = { ...prev };
      delete next[sourceId];
      return next;
    });
    showToast(`Reverted ${sourceId} to default AO`);
  };

  // ---- Extension request actions ----
  const submitExtensionRequest = () => {
    if (!requestModal) return;
    const f = requestModal.finding;
    const reason = requestReason.trim();
    if (!reason) {
      showToast("Reason is required");
      return;
    }
    const newReq = {
      id: `EXT-${f["Source ID"]}-${Date.now()}`,
      sourceId: f["Source ID"],
      findingId: f["Source ID"],
      ao: effectiveAO(f),
      application: f["Application Name"],
      severity: f["Severity"],
      currentTargetDate: f["Current Target Date"],
      requestedDays: Number(requestDays) || 14,
      reason,
      status: "pending",
      adminComment: "",
      jiraId: jiras[f["Source ID"]]?.jiraId || null,
      requestedAt: new Date().toISOString().slice(0, 10),
    };
    setExtensionRequests((prev) => [newReq, ...prev]);
    setRequestModal(null);
    setRequestReason("");
    setRequestDays(14);
    showToast(
      isAdmin
        ? `Extension requested for ${f["Source ID"]}`
        : `Extension submitted — awaiting admin review`
    );
    if (isAdmin) {
      setTab("admin");
      setAdminFilter("pending");
    }
  };

  const decideRequest = (id, decision) => {
    const comment = adminCommentDraft[id] || "";
    setExtensionRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: decision,
              adminComment: comment,
              decidedAt: new Date().toISOString().slice(0, 10),
            }
          : r
      )
    );
    setAdminCommentDraft((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    showToast(
      decision === "approved" ? "Extension approved" : "Extension rejected"
    );
  };

  const pendingCount = extensionRequests.filter(
    (r) => r.status === "pending"
  ).length;
  const approvedCount = extensionRequests.filter(
    (r) => r.status === "approved"
  ).length;
  const rejectedCount = extensionRequests.filter(
    (r) => r.status === "rejected"
  ).length;

  const adminVisible = useMemo(() => {
    if (adminFilter === "all") return extensionRequests;
    return extensionRequests.filter((r) => r.status === adminFilter);
  }, [extensionRequests, adminFilter]);

  // ===========================================================
  // RENDER
  // ===========================================================
  return (
    <>
      <div className="section-wrap">
        <div className="aow-auth-bar">
          {isAdmin && (
            <>
              <span className="aow-auth-badge">
                <span className="aow-auth-dot is-admin" />
                Signed in as <b>{adminName}</b> · admin
              </span>
              <button
                type="button"
                className="aow-btn aow-btn-secondary"
                onClick={signOut}
              >
                Sign out
              </button>
            </>
          )}
          {isAo && (
            <>
              <span className="aow-auth-badge">
                <span className="aow-auth-dot is-ao" />
                Signed in as <b>{aoShortName}</b> · Application Owner
              </span>
              <button
                type="button"
                className="aow-btn aow-btn-secondary"
                onClick={signOut}
              >
                Sign out
              </button>
            </>
          )}
          {!isAdmin && !isAo && (
            <>
              <span className="aow-auth-badge">
                <span className="aow-auth-dot" />
                Viewing as <b>guest</b> · sign in to access your workbench or
                approvals
              </span>
              <div className="aow-auth-actions">
                <button
                  type="button"
                  className="aow-btn aow-btn-secondary"
                  onClick={() => openLogin("ao")}
                >
                  Sign in as AO
                </button>
                <button
                  type="button"
                  className="aow-btn aow-btn-approve"
                  onClick={() => openLogin("admin")}
                >
                  Sign in as admin
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="section-wrap">
        <Tabs
          items={(() => {
            const items = [
              { id: "heatmap", label: "Application Heatmap" },
              { id: "allocate", label: "Allocate Tickets" },
            ];
            if (isAo) {
              items.push({
                id: "workbench",
                label: `AO Workbench · ${aoShortName}`,
              });
            }
            if (isAdmin) {
              items.push({
                id: "admin",
                label: `Admin Approvals${
                  pendingCount > 0 ? ` · ${pendingCount}` : ""
                }`,
              });
            }
            return items;
          })()}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "heatmap" && (
        <>
          <div className="section-wrap">
            <div className="section-lbl">Findings Overview</div>
          </div>
          <KPICards cards={heatmapKpis} />

          <div className="section-wrap">
            <div className="section-lbl">
              Application Heatmap — click a tile for findings
            </div>
          </div>
          <div className="chart-grid">
            <div className="chart-card">
              <div className="chart-card-head">
                <div className="chart-card-title">
                  <div className="chart-title">
                    Findings by Application — {bucketSubtitle(bucketFilter)}
                  </div>
                  <div className="chart-sub">
                    Darker tile = more findings · click for FARM break details
                  </div>
                </div>
                <div className="aow-filter">
                  <label className="aow-filter-lbl">View</label>
                  <select
                    className="aow-select"
                    value={bucketFilter}
                    onChange={(e) => setBucketFilter(e.target.value)}
                  >
                    {bucketOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {heatmap.rows.length === 0 ? (
                <div className="aow-empty">
                  No findings match this view. Pick a different bucket.
                </div>
              ) : (
                <>
                  <div className="aow-matrix-scroll">
                    <div
                      className="aow-matrix-grid"
                      style={{ "--col-count": heatmap.months.length }}
                    >
                      {/* Year header row */}
                      <div className="aow-matrix-corner aow-matrix-corner-year" />
                      {heatmap.years.map((g) => (
                        <div
                          key={`y-${g.year}`}
                          className="aow-matrix-year-cell"
                          style={{ gridColumn: `span ${g.months.length}` }}
                        >
                          {g.year}
                        </div>
                      ))}

                      {/* Month header row */}
                      <div className="aow-matrix-corner aow-matrix-corner-month">
                        Application
                      </div>
                      {heatmap.months.map((m) => {
                        const b = relativeBucket(
                          m.year,
                          m.month,
                          heatmap.today
                        );
                        return (
                          <div
                            key={`m-${m.year}-${m.month}`}
                            className="aow-matrix-month-cell"
                            style={{ color: REL_COLORS[b] }}
                            title={REL_LABELS[b]}
                          >
                            {MONTH_LABELS[m.month]}
                          </div>
                        );
                      })}

                      {/* Data rows */}
                      {heatmap.rows.map((r) => (
                        <Fragment key={r.app}>
                          <div className="aow-matrix-rowlbl" title={r.app}>
                            <div className="aow-matrix-rowlbl-name">
                              {r.app}
                            </div>
                            <div className="aow-matrix-rowlbl-sub">
                              <AnimatedNumber value={r.total} /> · ID {r.appId}
                            </div>
                          </div>
                          {heatmap.months.map((m) => {
                            const v = r.cells[`${m.year}-${m.month}`] || 0;
                            const b = relativeBucket(
                              m.year,
                              m.month,
                              heatmap.today
                            );
                            const max = heatmap.maxPerBucket[b] || 1;
                            const base = REL_COLORS[b];
                            let style;
                            if (v === 0) {
                              style = {
                                background: isDark
                                  ? "rgba(255,255,255,0.025)"
                                  : "rgba(15,23,42,0.04)",
                                color: "var(--ts)",
                              };
                            } else {
                              const alpha = 0.3 + (v / max) * 0.65;
                              style = {
                                background: base + alphaHex(alpha),
                                color: alpha > 0.55 ? "#ffffff" : base,
                                borderColor: base,
                                textShadow:
                                  alpha > 0.55
                                    ? "0 0 3px rgba(0,0,0,0.55)"
                                    : "none",
                              };
                            }
                            const title =
                              v > 0
                                ? `${r.app} · ${MONTH_LABELS[m.month]} ${m.year} · ${v} finding${v === 1 ? "" : "s"} (${REL_LABELS[b]})`
                                : `${r.app} · ${MONTH_LABELS[m.month]} ${m.year} · no findings`;
                            return (
                              <button
                                key={`${r.app}-${m.year}-${m.month}`}
                                type="button"
                                className={`aow-matrix-cell${
                                  v > 0 ? " is-active" : ""
                                }`}
                                style={style}
                                disabled={v === 0}
                                onClick={() =>
                                  v > 0 &&
                                  openAppMonthDrill(r.app, m.year, m.month)
                                }
                                title={title}
                              >
                                {v > 0 ? v : ""}
                              </button>
                            );
                          })}
                        </Fragment>
                      ))}
                    </div>
                  </div>
                  <div className="aow-matrix-legend">
                    <span className="aow-matrix-legend-title">
                      Cell color · target-date proximity
                    </span>
                    {["overdue", "d030", "d3160", "d6190", "far"].map((b) => (
                      <span key={b} className="aow-matrix-legend-item">
                        <span
                          className="aow-matrix-legend-dot"
                          style={{ background: REL_COLORS[b] }}
                        />
                        {REL_LABELS[b]}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {tab === "allocate" && (
        <>
          <div className="section-wrap">
            <div className="section-lbl">
              Ticket Allocation — assign FARM breaks to an AO
            </div>
          </div>
          <div className="aow-alloc-wrap">
            <div className="chart-card aow-alloc-list-card">
              <div className="chart-card-head">
                <div className="chart-card-title">
                  <div className="chart-title">FARM break queue</div>
                  <div className="chart-sub">
                    {allocList.length} ticket
                    {allocList.length === 1 ? "" : "s"} · click a row to pick an
                    AO
                  </div>
                </div>
                <div className="aow-alloc-toolbar">
                  <input
                    className="aow-search"
                    placeholder="Search ID, app, AO…"
                    value={allocSearch}
                    onChange={(e) => setAllocSearch(e.target.value)}
                  />
                  <label className="aow-check">
                    <input
                      type="checkbox"
                      checked={allocOnlyUnallocated}
                      onChange={(e) =>
                        setAllocOnlyUnallocated(e.target.checked)
                      }
                    />
                    Unallocated only
                  </label>
                </div>
              </div>
              <div className="aow-alloc-scroll">
                {allocList.length === 0 ? (
                  <div className="aow-empty">No tickets match this filter.</div>
                ) : (
                  <table className="aow-table">
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Application</th>
                        <th>Bucket</th>
                        <th>Sev</th>
                        <th>Current AO</th>
                        <th>Reassign</th>
                        <th>Extend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocList.slice(0, 80).map((f) => {
                        const sid = f["Source ID"];
                        const isOverridden = !!allocations[sid];
                        const ao = effectiveAO(f);
                        return (
                          <tr
                            key={sid}
                            className={`aow-row-drill${
                              allocSelected === sid ? " is-selected" : ""
                            }`}
                            onClick={() => {
                              setAllocSelected(sid);
                              drillFinding(f);
                            }}
                            title="Click to view finding details"
                          >
                            <td className="aow-mono">{sid}</td>
                            <td>
                              <div className="aow-cell-strong">
                                {f["Application Name"]}
                              </div>
                              <div className="aow-cell-sub">
                                {f["Control Domain"]}
                              </div>
                            </td>
                            <td>
                              {(() => {
                                const bc = colorForBucket(
                                  f["Current Target Date Age Status"]
                                );
                                return (
                                  <span
                                    className="aow-pill"
                                    style={{
                                      background: bc + "22",
                                      color: bc,
                                    }}
                                  >
                                    {f["Current Target Date Age Status"] ||
                                      "—"}
                                  </span>
                                );
                              })()}
                            </td>
                            <td>
                              <SeverityBadge s={f["Severity"]} />
                            </td>
                            <td>
                              <div className="aow-cell-strong">
                                {ao.split(" (")[0]}
                                {isOverridden && (
                                  <span className="aow-reassign-flag">
                                    reassigned
                                  </span>
                                )}
                              </div>
                              <div className="aow-cell-sub">
                                {f["Application ID"]}
                              </div>
                            </td>
                            <td>
                              <select
                                className="aow-select aow-select-sm"
                                value={ao}
                                onChange={(e) =>
                                  allocateTo(sid, e.target.value)
                                }
                                onClick={(e) => e.stopPropagation()}
                              >
                                {!aoRoster.includes(ao) && (
                                  <option value={ao}>{ao}</option>
                                )}
                                {aoRoster.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt.split(" (")[0]}
                                  </option>
                                ))}
                              </select>
                              {isOverridden && (
                                <button
                                  type="button"
                                  className="aow-link"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    clearAllocation(sid);
                                  }}
                                >
                                  revert
                                </button>
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="aow-btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRequestModal({ finding: f });
                                  setRequestReason("");
                                  setRequestDays(14);
                                }}
                              >
                                Request
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {allocList.length > 80 && (
                  <div className="aow-table-footer">
                    Showing first 80 of {allocList.length} — refine the search
                    to narrow.
                  </div>
                )}
              </div>
            </div>

            <div className="chart-card aow-workload-card">
              <div className="chart-card-head">
                <div className="chart-card-title">
                  <div className="chart-title">AO Workload</div>
                  <div className="chart-sub">
                    Live totals reflect allocation changes
                  </div>
                </div>
              </div>
              <div className="aow-workload-scroll">
                {aoWorkload.map((w) => {
                  const max = aoWorkload[0]?.total || 1;
                  const pct = (w.total / max) * 100;
                  return (
                    <div key={w.ao} className="aow-workload-row">
                      <div className="aow-workload-head">
                        <div className="aow-workload-name">
                          {w.ao.split(" (")[0]}
                        </div>
                        <div className="aow-workload-total">
                          <AnimatedNumber value={w.total} />
                        </div>
                      </div>
                      <div className="aow-workload-bar">
                        <div
                          className="aow-workload-fill"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="aow-workload-meta">
                        {w.overdue > 0 && (
                          <span style={{ color: "#e74c3c" }}>
                            ● Overdue {w.overdue}
                          </span>
                        )}
                        {topSeverity && w.topSev > 0 && (
                          <span style={{ color: colorForSev(topSeverity) }}>
                            ● {topSeverity} {w.topSev}
                          </span>
                        )}
                        {w.reassigned > 0 && (
                          <span style={{ color: "#3498db" }}>
                            ● Reassigned {w.reassigned}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "workbench" && isAo && (() => {
        const myTickets = findings.filter(
          (f) => effectiveAO(f) === aoLoggedIn
        );
        const myOpen = myTickets.filter((f) => !closedTickets[f["Source ID"]]);
        const myClosed = myTickets.filter(
          (f) => !!closedTickets[f["Source ID"]]
        );
        const visible =
          workbenchFilter === "open"
            ? myOpen
            : workbenchFilter === "closed"
            ? myClosed
            : myTickets;
        const myReqs = extensionRequests.filter((r) => r.ao === aoLoggedIn);
        const myPending = myReqs.filter((r) => r.status === "pending").length;
        const myApproved = myReqs.filter((r) => r.status === "approved").length;
        const myOverdue = myOpen.filter(isOverdueFinding).length;
        const myTopSev = topSeverity
          ? myOpen.filter((f) => f["Severity"] === topSeverity).length
          : 0;
        const latestReqFor = (sid) =>
          extensionRequests.find((r) => r.sourceId === sid);
        return (
          <>
            <div className="section-wrap">
              <div className="section-lbl">
                {aoShortName}'s workbench · FARM breaks pertaining to you
              </div>
            </div>
            <KPICards
              cards={[
                {
                  label: "Open in queue",
                  value: myOpen.length,
                  sub: "Stays until you mark closed",
                  tone: "blue",
                },
                {
                  label: "Overdue",
                  value: myOverdue,
                  sub: "Past target date",
                  tone: "red",
                },
                {
                  label: `${topSeverity || "Top"} severity`,
                  value: myTopSev,
                  sub: "Highest severity",
                  tone: "orange",
                },
                {
                  label: "Pending extensions",
                  value: myPending,
                  sub: "Awaiting admin decision",
                  tone: "orange",
                },
                {
                  label: "Approved",
                  value: myApproved,
                  sub: "Extensions granted",
                  tone: "green",
                },
              ]}
            />

            <div className="section-wrap">
              <div className="section-lbl">Your tickets</div>
            </div>
            <div className="chart-grid">
              <div className="chart-card">
                <div className="chart-card-head">
                  <div className="chart-card-title">
                    <div className="chart-title">
                      FARM breaks assigned to {aoShortName}
                    </div>
                    <div className="chart-sub">
                      Create a JIRA, request an extension, or mark closed.
                      Tickets remain in your queue until closed.
                    </div>
                  </div>
                  <div className="aow-filter">
                    <label className="aow-filter-lbl">View</label>
                    <select
                      className="aow-select"
                      value={workbenchFilter}
                      onChange={(e) => setWorkbenchFilter(e.target.value)}
                    >
                      <option value="open">Open ({myOpen.length})</option>
                      <option value="closed">
                        Closed ({myClosed.length})
                      </option>
                      <option value="all">All ({myTickets.length})</option>
                    </select>
                  </div>
                </div>
                {visible.length === 0 ? (
                  <div className="aow-empty">
                    {workbenchFilter === "open"
                      ? "No open tickets in your queue."
                      : workbenchFilter === "closed"
                      ? "Nothing closed yet."
                      : "No tickets assigned to you."}
                  </div>
                ) : (
                  <div className="aow-alloc-scroll">
                    <table className="aow-table">
                      <thead>
                        <tr>
                          <th>Source</th>
                          <th>Application</th>
                          <th>Bucket</th>
                          <th>Sev</th>
                          <th>Days</th>
                          <th>Target</th>
                          <th>JIRA</th>
                          <th>Extension</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((f) => {
                          const sid = f["Source ID"];
                          const jira = jiras[sid];
                          const closed = !!closedTickets[sid];
                          const latest = latestReqFor(sid);
                          const days =
                            parseInt(
                              f["Days Until Current Target Date"],
                              10
                            ) || 0;
                          const dayColor =
                            days < 0
                              ? "#e74c3c"
                              : days <= 30
                              ? "#e67e22"
                              : days <= 60
                              ? "#d4ac0d"
                              : "#27ae60";
                          const hasPending =
                            latest && latest.status === "pending";
                          return (
                            <tr
                              key={sid}
                              className={`aow-row-drill${
                                closed ? " aow-row-closed" : ""
                              }`}
                              onClick={() => drillFinding(f)}
                              title="Click to view finding details"
                            >
                              <td className="aow-mono">{sid}</td>
                              <td>
                                <div className="aow-cell-strong">
                                  {f["Application Name"]}
                                </div>
                                <div className="aow-cell-sub">
                                  {f["Application ID"]}
                                </div>
                              </td>
                              <td>
                                {(() => {
                                  const bc = colorForBucket(
                                    f["Current Target Date Age Status"]
                                  );
                                  return (
                                    <span
                                      className="aow-pill"
                                      style={{
                                        background: bc + "22",
                                        color: bc,
                                      }}
                                    >
                                      {f["Current Target Date Age Status"] ||
                                        "—"}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td>
                                <SeverityBadge s={f["Severity"]} />
                              </td>
                              <td
                                className="aow-mono"
                                style={{
                                  color: dayColor,
                                  fontWeight: 700,
                                }}
                              >
                                {days > 0 ? "+" : ""}
                                {days}
                              </td>
                              <td className="aow-mono aow-cell-sub">
                                {f["Current Target Date"]}
                              </td>
                              <td>
                                {jira ? (
                                  <span className="aow-jira-pill">
                                    {jira.jiraId}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    className="aow-btn-sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      createJira(sid);
                                    }}
                                    disabled={closed}
                                  >
                                    Create JIRA
                                  </button>
                                )}
                              </td>
                              <td>
                                {latest ? (
                                  <div>
                                    <StatusPill status={latest.status} />
                                    <div
                                      className="aow-cell-sub"
                                      style={{ marginTop: 2 }}
                                    >
                                      +{latest.requestedDays}d ·{" "}
                                      {latest.decidedAt || latest.requestedAt}
                                      {latest.jiraId
                                        ? ` · ${latest.jiraId}`
                                        : ""}
                                    </div>
                                    {latest.status !== "pending" &&
                                      latest.adminComment && (
                                        <div
                                          className="aow-cell-sub"
                                          style={{
                                            marginTop: 2,
                                            fontStyle: "italic",
                                          }}
                                          title={latest.adminComment}
                                        >
                                          “{latest.adminComment.slice(0, 60)}
                                          {latest.adminComment.length > 60
                                            ? "…"
                                            : ""}
                                          ”
                                        </div>
                                      )}
                                  </div>
                                ) : (
                                  <span className="aow-cell-sub">—</span>
                                )}
                              </td>
                              <td>
                                <div className="aow-action-stack">
                                  <button
                                    type="button"
                                    className="aow-btn-sm"
                                    disabled={closed || hasPending}
                                    title={
                                      hasPending
                                        ? "An extension request is already pending admin review"
                                        : jira
                                        ? "Request an extension on this JIRA"
                                        : "Request an extension"
                                    }
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRequestModal({ finding: f });
                                      setRequestReason("");
                                      setRequestDays(14);
                                    }}
                                  >
                                    {jira
                                      ? "Request via JIRA"
                                      : "Request Extension"}
                                  </button>
                                  {!closed ? (
                                    <button
                                      type="button"
                                      className="aow-btn-sm aow-btn-close-sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        closeTicket(sid);
                                      }}
                                    >
                                      Mark Closed
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="aow-btn-sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        reopenTicket(sid);
                                      }}
                                    >
                                      Reopen
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {tab === "admin" && isAdmin && (
        <>
          <div className="section-wrap">
            <div className="section-lbl">
              Admin — FARM break extension approvals
            </div>
          </div>
          <KPICards
            cards={[
              {
                label: "Pending",
                value: pendingCount,
                sub: "Awaiting decision",
                tone: "orange",
              },
              {
                label: "Approved",
                value: approvedCount,
                sub: "Total approved",
                tone: "green",
              },
              {
                label: "Rejected",
                value: rejectedCount,
                sub: "Total rejected",
                tone: "red",
              },
              {
                label: "Total requests",
                value: extensionRequests.length,
                sub: "All time",
                tone: "blue",
              },
            ]}
          />

          {(() => {
            const total = extensionRequests.length;
            const closedReqCount = extensionRequests.filter(
              (r) => !!closedTickets[r.sourceId]
            ).length;
            const stages = [
              {
                id: "submitted",
                label: "Submitted",
                sub: "All requests received",
                count: total,
                color: "#3498db",
                onClick: () => setAdminFilter("all"),
              },
              {
                id: "review",
                label: "Under Review",
                sub: "Awaiting admin",
                count: pendingCount,
                color: "#e67e22",
                onClick: () => setAdminFilter("pending"),
              },
              {
                id: "approved",
                label: "Approved",
                sub: "Extension granted",
                count: approvedCount,
                color: "#27ae60",
                onClick: () => setAdminFilter("approved"),
              },
              {
                id: "rejected",
                label: "Rejected",
                sub: "Extension denied",
                count: rejectedCount,
                color: "#e74c3c",
                onClick: () => setAdminFilter("rejected"),
              },
              {
                id: "closed",
                label: "Closed",
                sub: "Ticket marked done",
                count: closedReqCount,
                color: "#7f8c8d",
                onClick: () => setAdminFilter("all"),
              },
            ];
            const stageMax = stages.reduce(
              (m, s) => (s.count > m ? s.count : m),
              0
            );
            // Segregations on pending only (the actionable queue)
            const pendingReqs = extensionRequests.filter(
              (r) => r.status === "pending"
            );
            const findingForReq = (r) =>
              findings.find((f) => f["Source ID"] === r.sourceId);

            const sevSegs = sevCatalog
              .map((s) => ({
                label: s,
                count: pendingReqs.filter((r) => r.severity === s).length,
                color: colorForSev(s),
              }))
              .filter((x) => x.count > 0);

            const bucketSegs = bucketCatalog
              .map((b) => ({
                label: b,
                count: pendingReqs.filter((r) => {
                  const f = findingForReq(r);
                  return f && f["Current Target Date Age Status"] === b;
                }).length,
                color: colorForBucket(b),
              }))
              .filter((x) => x.count > 0);

            const today = new Date();
            const ageOf = (r) => {
              const d = new Date(r.requestedAt);
              if (isNaN(d)) return 0;
              return Math.max(
                0,
                Math.round((today - d) / (1000 * 60 * 60 * 24))
              );
            };
            const ageBuckets = [
              { label: "<1d", min: 0, max: 1, color: "#27ae60" },
              { label: "1-3d", min: 1, max: 3, color: "#d4ac0d" },
              { label: "3-7d", min: 3, max: 7, color: "#e67e22" },
              { label: "7d+", min: 7, max: Infinity, color: "#e74c3c" },
            ];
            const ageSegs = ageBuckets
              .map((b) => ({
                label: b.label,
                count: pendingReqs.filter((r) => {
                  const a = ageOf(r);
                  return a >= b.min && a < b.max;
                }).length,
                color: b.color,
              }))
              .filter((x) => x.count > 0);

            const jiraLinked = pendingReqs.filter((r) => !!r.jiraId).length;
            const adHoc = pendingReqs.length - jiraLinked;
            const linkSegs = [
              {
                label: "JIRA-linked",
                count: jiraLinked,
                color: "#3498db",
              },
              {
                label: "Ad-hoc",
                count: adHoc,
                color: "#9b59b6",
              },
            ].filter((x) => x.count > 0);

            const Ribbon = ({ title, segs, total }) => {
              if (!total) {
                return (
                  <div className="aow-ribbon-block">
                    <div className="aow-ribbon-title">{title}</div>
                    <div className="aow-ribbon-empty">
                      No pending requests in this segmentation.
                    </div>
                  </div>
                );
              }
              return (
                <div className="aow-ribbon-block">
                  <div className="aow-ribbon-title">{title}</div>
                  <div className="aow-ribbon">
                    {segs.map((s) => {
                      const pct = (s.count / total) * 100;
                      return (
                        <div
                          key={s.label}
                          className="aow-ribbon-seg"
                          style={{
                            width: `${pct}%`,
                            background: s.color,
                          }}
                          title={`${s.label} · ${s.count} (${pct.toFixed(0)}%)`}
                        >
                          {pct >= 10 ? `${s.label} ${s.count}` : s.count}
                        </div>
                      );
                    })}
                  </div>
                  <div className="aow-ribbon-legend">
                    {segs.map((s) => (
                      <span key={s.label} className="aow-ribbon-leg-item">
                        <span
                          className="leg-dot"
                          style={{ background: s.color }}
                        />
                        {s.label} <b>{s.count}</b>
                      </span>
                    ))}
                  </div>
                </div>
              );
            };

            return (
              <>
                <div className="section-wrap">
                  <div className="section-lbl">
                    Queue Pipeline & Segregation
                  </div>
                </div>
                <div className="chart-grid">
                  <div className="chart-card">
                    <div className="chart-card-head">
                      <div className="chart-card-title">
                        <div className="chart-title">
                          Extension request lifecycle
                        </div>
                        <div className="chart-sub">
                          Stage breakdown · click a stage to filter the queue
                          below
                        </div>
                      </div>
                    </div>

                    <div className="aow-pipeline">
                      {stages.map((s, i) => {
                        const pct = stageMax
                          ? (s.count / stageMax) * 100
                          : 0;
                        return (
                          <Fragment key={s.id}>
                            <button
                              type="button"
                              className="aow-pipe-stage"
                              style={{ borderColor: s.color }}
                              onClick={s.onClick}
                              title={`${s.label} · ${s.count}`}
                            >
                              <div
                                className="aow-pipe-dot"
                                style={{ background: s.color }}
                              />
                              <div className="aow-pipe-count">{s.count}</div>
                              <div className="aow-pipe-label">{s.label}</div>
                              <div className="aow-pipe-sub">{s.sub}</div>
                              <div className="aow-pipe-bar">
                                <div
                                  className="aow-pipe-bar-fill"
                                  style={{
                                    width: `${pct}%`,
                                    background: s.color,
                                  }}
                                />
                              </div>
                            </button>
                            {i < stages.length - 1 && (
                              <div
                                className="aow-pipe-arrow"
                                aria-hidden="true"
                              >
                                ›
                              </div>
                            )}
                          </Fragment>
                        );
                      })}
                    </div>

                    <div className="aow-ribbon-wrap">
                      <Ribbon
                        title="Pending · by severity"
                        segs={sevSegs}
                        total={pendingReqs.length}
                      />
                      <Ribbon
                        title="Pending · by deadline bucket"
                        segs={bucketSegs}
                        total={pendingReqs.length}
                      />
                      <Ribbon
                        title="Pending · by request age"
                        segs={ageSegs}
                        total={pendingReqs.length}
                      />
                      <Ribbon
                        title="Pending · JIRA linkage"
                        segs={linkSegs}
                        total={pendingReqs.length}
                      />
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

          <div className="chart-grid">
            <div className="chart-card">
              <div className="chart-card-head">
                <div className="chart-card-title">
                  <div className="chart-title">Extension requests</div>
                  <div className="chart-sub">
                    Review reason and decide — approve or reject with a comment
                  </div>
                </div>
                <div className="aow-filter">
                  <label className="aow-filter-lbl">Show</label>
                  <select
                    className="aow-select"
                    value={adminFilter}
                    onChange={(e) => setAdminFilter(e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="all">All</option>
                  </select>
                </div>
              </div>
              <div className="aow-admin-list">
                {adminVisible.length === 0 ? (
                  <div className="aow-empty">No requests in this view.</div>
                ) : (
                  adminVisible.map((r) => (
                    <div
                      key={r.id}
                      className="aow-req-card aow-req-card-drill"
                      onClick={() => drillBySid(r.sourceId)}
                      title="Click anywhere to view finding details"
                    >
                      <div className="aow-req-head">
                        <div>
                          <div className="aow-req-title">
                            {r.sourceId} · {r.application}
                            <span className="aow-req-drill-hint">
                              View details →
                            </span>
                          </div>
                          <div className="aow-req-sub">
                            Requested by {r.ao.split(" (")[0]} on{" "}
                            {r.requestedAt}
                          </div>
                        </div>
                        <div className="aow-req-status">
                          <SeverityBadge s={r.severity} />
                          <StatusPill status={r.status} />
                        </div>
                      </div>
                      <div className="aow-req-grid">
                        <div className="aow-req-field">
                          <div className="aow-req-label">
                            Current target date
                          </div>
                          <div className="aow-req-value">
                            {r.currentTargetDate}
                          </div>
                        </div>
                        <div className="aow-req-field">
                          <div className="aow-req-label">Requested extension</div>
                          <div className="aow-req-value">
                            +{r.requestedDays} days
                          </div>
                        </div>
                        {r.jiraId && (
                          <div className="aow-req-field">
                            <div className="aow-req-label">Linked JIRA</div>
                            <div className="aow-req-value">
                              <span className="aow-jira-pill">{r.jiraId}</span>
                            </div>
                          </div>
                        )}
                        <div className="aow-req-field aow-req-field-wide">
                          <div className="aow-req-label">Reason from AO</div>
                          <div className="aow-req-reason">{r.reason}</div>
                        </div>
                      </div>
                      {r.status === "pending" ? (
                        <div
                          className="aow-req-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <textarea
                            className="aow-textarea"
                            placeholder="Admin comment (optional)…"
                            value={adminCommentDraft[r.id] || ""}
                            onChange={(e) =>
                              setAdminCommentDraft((prev) => ({
                                ...prev,
                                [r.id]: e.target.value,
                              }))
                            }
                          />
                          <div className="aow-req-btn-row">
                            <button
                              type="button"
                              className="aow-btn aow-btn-reject"
                              onClick={(e) => {
                                e.stopPropagation();
                                decideRequest(r.id, "rejected");
                              }}
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              className="aow-btn aow-btn-approve"
                              onClick={(e) => {
                                e.stopPropagation();
                                decideRequest(r.id, "approved");
                              }}
                            >
                              Approve
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="aow-req-decision">
                          <div className="aow-req-label">
                            Decision · {r.decidedAt || "—"}
                          </div>
                          <div className="aow-req-reason">
                            {r.adminComment || "(no comment)"}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <Modal
        open={!!requestModal}
        title={
          requestModal
            ? `Request extension — ${requestModal.finding["Source ID"]}`
            : ""
        }
        onClose={() => setRequestModal(null)}
      >
        {requestModal && (
          <div className="aow-req-form">
            <div className="aow-req-form-row">
              <span className="aow-req-label">Application</span>
              <span>{requestModal.finding["Application Name"]}</span>
            </div>
            <div className="aow-req-form-row">
              <span className="aow-req-label">Current target date</span>
              <span>{requestModal.finding["Current Target Date"]}</span>
            </div>
            <div className="aow-req-form-row">
              <span className="aow-req-label">Requesting AO</span>
              <span>{effectiveAO(requestModal.finding).split(" (")[0]}</span>
            </div>
            <label className="aow-req-form-label">
              Extension (days)
              <input
                type="number"
                min={1}
                max={120}
                value={requestDays}
                onChange={(e) => setRequestDays(e.target.value)}
                className="aow-input"
              />
            </label>
            <label className="aow-req-form-label">
              Reason for extension
              <textarea
                className="aow-textarea"
                rows={4}
                placeholder="Describe why the FARM break cannot be remediated by the target date…"
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
              />
            </label>
            <div className="aow-req-btn-row">
              <button
                type="button"
                className="aow-btn aow-btn-secondary"
                onClick={() => setRequestModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="aow-btn aow-btn-approve"
                onClick={submitExtensionRequest}
              >
                Submit request
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={loginOpen}
        title="Sign in"
        onClose={closeLogin}
        width={460}
      >
        <div className="aow-login-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={loginRole === "ao"}
            className={`aow-login-tab${
              loginRole === "ao" ? " is-active" : ""
            }`}
            onClick={() => {
              setLoginRole("ao");
              setLoginError("");
            }}
          >
            Application Owner
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={loginRole === "admin"}
            className={`aow-login-tab${
              loginRole === "admin" ? " is-active" : ""
            }`}
            onClick={() => {
              setLoginRole("admin");
              setLoginError("");
            }}
          >
            Admin
          </button>
        </div>
        <form
          className="aow-login-form"
          onSubmit={(e) => {
            e.preventDefault();
            submitLogin();
          }}
        >
          {loginRole === "admin" ? (
            <>
              <label className="aow-req-form-label">
                Username
                <input
                  className="aow-input"
                  type="text"
                  autoFocus
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  autoComplete="username"
                />
              </label>
              <label className="aow-req-form-label">
                Password
                <input
                  className="aow-input"
                  type="password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <div className="aow-login-hint">
                Demo credentials · admin / admin123
              </div>
            </>
          ) : (
            <>
              <label className="aow-req-form-label">
                Application Owner
                <select
                  className="aow-select"
                  autoFocus
                  value={loginAo}
                  onChange={(e) => setLoginAo(e.target.value)}
                >
                  <option value="">— select your name —</option>
                  {aoRoster.map((ao) => (
                    <option key={ao} value={ao}>
                      {ao}
                    </option>
                  ))}
                </select>
              </label>
              <label className="aow-req-form-label">
                Password
                <input
                  className="aow-input"
                  type="password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <div className="aow-login-hint">
                Demo credentials · pick your name · password ao123
              </div>
            </>
          )}
          {loginError && <div className="aow-login-error">{loginError}</div>}
          <div className="aow-req-btn-row">
            <button
              type="button"
              className="aow-btn aow-btn-secondary"
              onClick={closeLogin}
            >
              Cancel
            </button>
            <button type="submit" className="aow-btn aow-btn-approve">
              Sign in
            </button>
          </div>
        </form>
      </Modal>

      {toast && <div className="aow-toast">{toast}</div>}
    </>
  );
}
