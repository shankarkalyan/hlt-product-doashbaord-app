export default function Breadcrumbs({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={idx} className={isLast ? "current" : ""}>
              {item.onClick && !isLast ? (
                <button
                  type="button"
                  className="crumb-btn"
                  onClick={item.onClick}
                >
                  {item.label}
                </button>
              ) : (
                <span className="crumb-current">{item.label}</span>
              )}
              {!isLast && (
                <span className="crumb-sep" aria-hidden="true">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
