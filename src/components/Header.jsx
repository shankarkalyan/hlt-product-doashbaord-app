export default function Header({ theme, onToggle, subtitle, onBrandClick }) {
  const isDark = theme === "dark";
  const Brand = (
    <>
      <div className="ph-logo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect
            x="3"
            y="3"
            width="7"
            height="7"
            rx="1.5"
            fill="white"
            opacity=".9"
          />
          <rect
            x="14"
            y="3"
            width="7"
            height="7"
            rx="1.5"
            fill="white"
            opacity=".6"
          />
          <rect
            x="3"
            y="14"
            width="7"
            height="7"
            rx="1.5"
            fill="white"
            opacity=".6"
          />
          <rect
            x="14"
            y="14"
            width="7"
            height="7"
            rx="1.5"
            fill="white"
            opacity=".9"
          />
        </svg>
      </div>
      <span className="ph-title">HLT Operations Portal</span>
    </>
  );

  return (
    <div className="page-header">
      <div className="ph-left">
        {onBrandClick ? (
          <button
            type="button"
            className="ph-brand ph-brand-button"
            onClick={onBrandClick}
            aria-label="Go to home"
          >
            {Brand}
          </button>
        ) : (
          <div className="ph-brand">{Brand}</div>
        )}
        {subtitle && <div className="ph-sub">{subtitle}</div>}
      </div>
      <div className="ph-right">
        <button
          type="button"
          className="ph-btn ph-btn-ghost"
          onClick={onToggle}
          aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
        >
          {isDark ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="12"
                r="4"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          <span>{isDark ? "Light" : "Dark"}</span>
        </button>
      </div>
    </div>
  );
}
