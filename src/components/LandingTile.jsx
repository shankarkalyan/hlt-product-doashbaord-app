import AnimatedNumber from "./AnimatedNumber";

function ArrowRight() {
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
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export default function LandingTile({
  icon,
  eyebrow,
  title,
  subtitle,
  description,
  meta,
  cta = "Open",
  onClick,
}) {
  return (
    <button
      type="button"
      className="landing-tile"
      onClick={onClick}
      aria-label={`Open ${title}`}
    >
      <div className="landing-tile-top">
        <div className="landing-tile-icon">{icon}</div>
        {eyebrow && <span className="landing-tile-eyebrow">{eyebrow}</span>}
      </div>
      <div className="landing-tile-body">
        <h3 className="landing-tile-title">{title}</h3>
        {subtitle && <div className="landing-tile-subtitle">{subtitle}</div>}
        {description && <p className="landing-tile-desc">{description}</p>}
      </div>
      {meta && meta.length > 0 && (
        <div className="landing-tile-meta">
          {meta.map((m, i) => (
            <div key={i} className="landing-meta-item">
              <div className="landing-meta-value">
                <AnimatedNumber value={m.value} />
              </div>
              <div className="landing-meta-label">{m.label}</div>
            </div>
          ))}
        </div>
      )}
      <div className="landing-tile-cta">
        <span>{cta}</span>
        <ArrowRight />
      </div>
    </button>
  );
}
