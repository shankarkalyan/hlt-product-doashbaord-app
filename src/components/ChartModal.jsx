import { useEffect } from "react";

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

export default function ChartModal({ open, title, sub, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="cmodal-overlay" onClick={onClose}>
      <div
        className="cmodal"
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cmodal-head">
          <div>
            <div className="cmodal-eyebrow">Expanded view</div>
            <div className="cmodal-title">{title}</div>
            {sub && <div className="cmodal-sub">{sub}</div>}
          </div>
          <button
            type="button"
            className="drill-icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </header>
        <div className="cmodal-body">{children}</div>
      </div>
    </div>
  );
}
