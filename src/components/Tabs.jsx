export default function Tabs({ items, active, onChange }) {
  return (
    <div className="tabs-wrap">
      <div className="tabs-bar" role="tablist">
        {items.map((it) => {
          const isActive = it.id === active;
          return (
            <button
              key={it.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`tab-btn${isActive ? " is-active" : ""}`}
              onClick={() => onChange(it.id)}
            >
              {it.icon && <span className="tab-icon">{it.icon}</span>}
              <span className="tab-label">{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
