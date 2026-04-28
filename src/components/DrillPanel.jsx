import { useEffect, useMemo, useRef, useState } from "react";

const STATUS_BADGE = {
  SUCCESS: "b-success",
  FAILED: "b-fail",
  ACKNOWLEDGED: "b-ack",
};

const PAGE_SIZE = 15;

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

// Default schema = deployments. New callers can pass a custom schema via the
// drill state to render different entity types (e.g., incidents).
const DEPLOYMENT_SCHEMA = {
  entity: "Deployment",
  pluralEntity: "deployments",
  emptyText: "No deployments match this slice.",
  rowKey: (d) => d.jet_uuid || `${d.application_id}-${d.deploy_time}`,
  columns: [
    {
      id: "project_name",
      label: "Project",
      filterValue: (d) => d.project_name,
      render: (d) => (
        <>
          <div className="drill-cell-primary">{d.project_name}</div>
          <div className="drill-cell-secondary">{d.application_name}</div>
        </>
      ),
    },
    {
      id: "repo_name",
      label: "Repository",
      filterValue: (d) => d.repo_name,
      render: (d) => (
        <span className="tbl-mono" style={{ fontSize: 11 }}>
          {d.repo_name}
        </span>
      ),
    },
    {
      id: "deploy_type",
      label: "Type",
      filterValue: (d) => d.deploy_type,
      render: (d) => <span className="badge b-type">{d.deploy_type}</span>,
    },
    {
      id: "deploy_status",
      label: "Status",
      filterValue: (d) => d.deploy_status,
      render: (d) => (
        <span className={`badge ${STATUS_BADGE[d.deploy_status] || "b-ack"}`}>
          {d.deploy_status}
        </span>
      ),
    },
    {
      id: "deploy_time",
      label: "Date",
      filterValue: (d) => d.deploy_time,
      render: (d) => (
        <>
          <div className="tbl-mono" style={{ fontSize: 11 }}>
            {formatTime(d.deploy_time)}
          </div>
          <div style={{ fontSize: 10, color: "var(--ts)", marginTop: 2 }}>
            {relativeTime(d.deploy_time)}
          </div>
        </>
      ),
    },
  ],
  detail: {
    title: (d) => d.repo_name,
    subtitle: (d) => `${d.project_name} · ${d.application_name}`,
    pills: (d) => [
      <span key="t" className="badge b-type">{d.deploy_type}</span>,
      <span
        key="s"
        className={`badge ${STATUS_BADGE[d.deploy_status] || "b-ack"}`}
      >
        {d.deploy_status}
      </span>,
      <span
        key="e"
        className="badge"
        style={{ background: "rgba(148,163,184,0.14)", color: "var(--tm)" }}
      >
        {d.environment}
      </span>,
    ],
    fields: [
      ["product_line", "Product Line"],
      ["product_name", "Product"],
      ["application_id", "Application ID"],
      ["application_name", "Application"],
      ["project_name", "Project"],
      ["repo_name", "Repository"],
      ["environment", "Environment"],
      ["event_type", "Event Type"],
      ["deploy_type", "Deploy Type"],
      ["deploy_status", "Deploy Status"],
      ["deploy_time", "Deploy Time"],
      ["change_ctrl_ticket", "Change Ticket"],
      ["jet_uuid", "Jet UUID"],
      ["jet_id", "Jet ID"],
      ["key_appid_projkey_repo", "Composite Key"],
    ],
    formatField: (key, value) =>
      key === "deploy_time" ? formatTime(value) : String(value ?? "—"),
    monoFields: new Set(["jet_id"]),
  },
};

function CloseIcon() {
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
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function FilterIcon({ active }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path
        d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"
        stroke={active ? "#117ACA" : "currentColor"}
        fill={active ? "#117ACA" : "none"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function DrillPanel({
  open,
  title,
  rows,
  selected,
  onSelect,
  onBackToList,
  onClose,
  schema,
}) {
  const sch = schema || DEPLOYMENT_SCHEMA;
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const inDetail = !!selected;

  return (
    <div className="drill-overlay" onClick={onClose}>
      <aside
        className="drill-panel"
        role="dialog"
        aria-label="Drill-down details"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="drill-head">
          <div className="drill-head-text">
            <div className="drill-eyebrow">
              {inDetail
                ? `${sch.entity} record`
                : `Drill-down · ${rows.length} record${
                    rows.length === 1 ? "" : "s"
                  }`}
            </div>
            <div className="drill-title">
              {inDetail ? sch.detail.title(selected) : title}
            </div>
          </div>
          <div className="drill-head-actions">
            {inDetail && (
              <button
                type="button"
                className="drill-btn"
                onClick={onBackToList}
                aria-label="Back to list"
              >
                <BackIcon />
                <span>Back</span>
              </button>
            )}
            <button
              type="button"
              className="drill-icon-btn"
              onClick={onClose}
              aria-label="Close drill-down"
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="drill-body">
          {inDetail ? (
            <DetailView record={selected} schema={sch} />
          ) : (
            <FilteredPagedList rows={rows} onSelect={onSelect} schema={sch} />
          )}
        </div>
      </aside>
    </div>
  );
}

// ----------------- List with filters + pagination -----------------

function FilteredPagedList({ rows, onSelect, schema }) {
  const columns = schema.columns;
  // filters: column id -> Set<string> of allowed display values (raw values, stringified)
  const [filters, setFilters] = useState({});
  const [openFilter, setOpenFilter] = useState(null);
  const [page, setPage] = useState(1);

  const filterByCol = (col) =>
    col.filterValue ? col.filterValue : (d) => d[col.id];

  const filteredRows = useMemo(() => {
    const entries = Object.entries(filters).filter(
      ([, set]) => set && set.size > 0
    );
    if (entries.length === 0) return rows;
    return rows.filter((r) =>
      entries.every(([colId, set]) => {
        const col = columns.find((c) => c.id === colId);
        const v = col ? filterByCol(col)(r) : r[colId];
        return set.has(String(v == null ? "" : v));
      })
    );
  }, [rows, filters, columns]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  // reset to page 1 if filters shrink the result so we're past the last page
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const setFilter = (col, set) => {
    setFilters((f) => {
      const next = { ...f };
      if (!set || set.size === 0) delete next[col];
      else next[col] = set;
      return next;
    });
    setPage(1);
  };

  const clearAllFilters = () => {
    setFilters({});
    setPage(1);
  };

  const activeFilterCount = Object.keys(filters).length;

  if (rows.length === 0) {
    return <div className="drill-empty">{schema.emptyText}</div>;
  }

  return (
    <div>
      {activeFilterCount > 0 && (
        <div className="filter-summary">
          <span>
            <strong>{filteredRows.length}</strong> of {rows.length} after{" "}
            {activeFilterCount} filter
            {activeFilterCount === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            className="filter-clear-all"
            onClick={clearAllFilters}
          >
            Clear all
          </button>
        </div>
      )}

      <table className="tbl drill-list-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <ColumnHeader
                key={col.id}
                col={col}
                rows={rows}
                filters={filters}
                onApply={(set) => setFilter(col.id, set)}
                isOpen={openFilter === col.id}
                onToggle={() =>
                  setOpenFilter(openFilter === col.id ? null : col.id)
                }
              />
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pageRows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + 1}
                style={{ textAlign: "center", padding: 32 }}
              >
                No rows match the active filters.
              </td>
            </tr>
          )}
          {pageRows.map((d) => (
            <tr
              key={schema.rowKey(d)}
              className="drill-row"
              onClick={() => onSelect(d)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(d);
                }
              }}
            >
              {columns.map((col) => (
                <td key={col.id}>{col.render(d)}</td>
              ))}
              <td className="drill-row-arrow">›</td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          totalRows={filteredRows.length}
          onChange={setPage}
        />
      )}
    </div>
  );
}

// ----------------- Column header with filter popover -----------------

function ColumnHeader({ col, rows, filters, onApply, isOpen, onToggle }) {
  const active = !!filters[col.id] && filters[col.id].size > 0;
  return (
    <th className="filter-th">
      <div className="th-row">
        <span>{col.label}</span>
        <button
          type="button"
          className={`filter-trigger ${active ? "active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-label={`Filter ${col.label}`}
          title={`Filter ${col.label}`}
        >
          <FilterIcon active={active} />
        </button>
      </div>
      {isOpen && (
        <FilterPopover
          col={col}
          rows={rows}
          current={filters[col.id]}
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

function FilterPopover({ col, rows, current, onApply, onClose }) {
  const ref = useRef(null);

  // unique stringified values for this column (use filterValue getter if provided)
  const uniqueValues = useMemo(() => {
    const set = new Set();
    const getValue = col.filterValue ? col.filterValue : (r) => r[col.id];
    rows.forEach((r) => {
      const v = getValue(r);
      set.add(String(v == null ? "" : v));
    });
    return [...set].sort();
  }, [rows, col]);

  const [search, setSearch] = useState("");
  // local working selection: Set<string>; null means "all selected"
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
    if (selected.size === uniqueValues.length) {
      onApply(null);
    } else {
      onApply(selected);
    }
  };

  const clear = () => onApply(null);

  return (
    <div
      className="filter-popover"
      ref={ref}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="search"
        className="filter-search"
        placeholder={`Search ${col.label}…`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      <div className="filter-quicks">
        <button
          type="button"
          onClick={selectAllFiltered}
          className="filter-quick-btn"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={clearAllFiltered}
          className="filter-quick-btn"
        >
          Clear
        </button>
      </div>
      <div className="filter-options">
        {filteredValues.length === 0 && (
          <div className="filter-empty">No matches</div>
        )}
        {filteredValues.map((v) => (
          <label key={v} className="filter-opt">
            <input
              type="checkbox"
              checked={selected.has(v)}
              onChange={() => toggle(v)}
            />
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

// ----------------- Pagination -----------------

function Pagination({ page, totalPages, totalRows, onChange }) {
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, totalRows);

  const pageNumbers = [];
  const window = 1;
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= page - window && i <= page + window)
    ) {
      pageNumbers.push(i);
    } else if (
      pageNumbers[pageNumbers.length - 1] !== "…" &&
      i < page - window
    ) {
      pageNumbers.push("…");
    } else if (
      pageNumbers[pageNumbers.length - 1] !== "…" &&
      i > page + window
    ) {
      pageNumbers.push("…");
    }
  }

  return (
    <div className="pager">
      <div className="pager-info">
        Showing <strong>{start}</strong>–<strong>{end}</strong> of{" "}
        <strong>{totalRows}</strong>
      </div>
      <div className="pager-controls">
        <button
          type="button"
          className="pager-btn"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
        >
          Prev
        </button>
        {pageNumbers.map((n, i) =>
          n === "…" ? (
            <span key={`gap-${i}`} className="pager-gap">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              className={`pager-btn ${n === page ? "active" : ""}`}
              onClick={() => onChange(n)}
            >
              {n}
            </button>
          )
        )}
        <button
          type="button"
          className="pager-btn"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ----------------- Detail view -----------------

function DetailView({ record, schema }) {
  const detail = schema.detail;
  const monoFields = detail.monoFields || new Set();
  const fmt = detail.formatField || ((_k, v) => String(v ?? "—"));
  const pills = detail.pills ? detail.pills(record) : [];
  const subtitle = detail.subtitle ? detail.subtitle(record) : null;
  return (
    <div className="drill-detail">
      <div className="drill-detail-banner">
        {pills.length > 0 && <div className="drill-detail-pills">{pills}</div>}
        <div className="drill-detail-title tbl-mono">
          {detail.title(record)}
        </div>
        {subtitle && <div className="drill-detail-sub">{subtitle}</div>}
      </div>

      <dl className="drill-detail-grid">
        {detail.fields.map(([key, label]) => (
          <div key={key} className="drill-detail-row">
            <dt>{label}</dt>
            <dd className={`tbl-mono${monoFields.has(key) ? " break" : ""}`}>
              {fmt(key, record[key])}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
