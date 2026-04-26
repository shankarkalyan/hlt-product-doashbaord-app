import { useEffect, useState } from "react";
import { api } from "./api/client";
import TechnologyHeatmap from "./components/TechnologyHeatmap";
import DeploymentList from "./components/DeploymentList";
import DeploymentDetail from "./components/DeploymentDetail";
import ThemeToggle from "./components/ThemeToggle";
import Breadcrumbs from "./components/Breadcrumbs";
import SummaryCards from "./components/SummaryCards";
import LandingTile from "./components/LandingTile";

const THEME_KEY = "hlt-cmh-theme";

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "light";
}

const Icon = ({ children, size = 28 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const HOUSE_ICON = (
  <Icon>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </Icon>
);

const LAYERS_ICON = (
  <Icon>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </Icon>
);

export default function App() {
  const [view, setView] = useState({ name: "home" });
  const [techData, setTechData] = useState(null);
  const [techError, setTechError] = useState(null);
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    api
      .technologies()
      .then(setTechData)
      .catch((e) => setTechError(e.message));
  }, []);

  const goHome = () => setView({ name: "home" });
  const goProduct = () => setView({ name: "product" });
  const goDashboard = () => setView({ name: "dashboard" });

  const headerSubtitle = (() => {
    switch (view.name) {
      case "home":
        return "Operations Portal";
      case "product":
        return "HLTCMH Dashboards";
      case "dashboard":
        return "Production Deployment Dashboard";
      case "list":
        return view.deployType
          ? `${view.deployType} Deployments`
          : "Deployments";
      case "detail":
        return "Deployment Detail";
      default:
        return "Production Deployment Dashboard";
    }
  })();

  const breadcrumbs = (() => {
    const crumbs = [{ label: "Home", onClick: goHome }];
    if (view.name !== "home") {
      crumbs.push({ label: "HLTCMH", onClick: goProduct });
    }
    if (
      view.name === "dashboard" ||
      view.name === "list" ||
      view.name === "detail"
    ) {
      crumbs.push({
        label: "Deployment Type Distribution",
        onClick: goDashboard,
      });
    }
    if (view.name === "list") {
      crumbs.push({ label: view.deployType || "All deployments" });
    } else if (view.name === "detail") {
      const prev = view.prev;
      crumbs.push({
        label: prev?.deployType || "Deployments",
        onClick: () => prev && setView(prev),
      });
      crumbs.push({ label: "Detail" });
    }
    return crumbs;
  })();

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <button
            type="button"
            className="brand-button"
            onClick={goHome}
            aria-label="Go to home"
          >
            <div className="brand-mark" aria-hidden="true">
              <span>CMH</span>
            </div>
            <div>
              <h1>HLTCMH — Chase My Home</h1>
              <p className="subtitle">{headerSubtitle}</p>
            </div>
          </button>
        </div>
        <div className="header-actions">
          <ThemeToggle
            theme={theme}
            onToggle={() =>
              setTheme((t) => (t === "dark" ? "light" : "dark"))
            }
          />
        </div>
      </header>

      <main className="app-main">
        <Breadcrumbs items={breadcrumbs} />

        {view.name === "home" && (
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
                subtitle="Chase My Home"
                description="Production deployment intelligence and operational telemetry for the Chase My Home application suite."
                meta={
                  techData
                    ? [
                        {
                          value: techData.summary.applications,
                          label: "Applications",
                        },
                        {
                          value: techData.summary.total_deployments,
                          label: "Deployments",
                        },
                        {
                          value: `${techData.summary.success_rate}%`,
                          label: "Success Rate",
                        },
                      ]
                    : []
                }
                cta="Open product"
                onClick={goProduct}
              />
            </div>
          </section>
        )}

        {view.name === "product" && (
          <section className="landing-page">
            <div className="landing-intro">
              <span className="landing-eyebrow">HLTCMH · Chase My Home</span>
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
                title="Deployment Type Distribution"
                subtitle="Heat map · status breakdown · drill-downs"
                description="Production deployment counts grouped by technology, with success-rate breakdowns and drill-through to individual deployment records."
                meta={
                  techData
                    ? [
                        {
                          value: techData.summary.deployment_types,
                          label: "Types",
                        },
                        {
                          value: techData.summary.total_repositories,
                          label: "Repositories",
                        },
                        {
                          value: techData.summary.total_deployments,
                          label: "Deployments",
                        },
                      ]
                    : []
                }
                cta="Open dashboard"
                onClick={goDashboard}
              />
            </div>
          </section>
        )}

        {view.name === "dashboard" && (
          <>
            {techData && <SummaryCards summary={techData.summary} />}
            <div className="panel panel-heatmap">
              <div className="panel-header">
                <div>
                  <h2>Production Deployment Dashboard</h2>
                  <span className="hint">
                    Click a tile to drill into deployments for that deployment
                    type.
                  </span>
                </div>
              </div>
              {techError && <div className="error">Error: {techError}</div>}
              {!techData && !techError && (
                <div className="loading">Loading…</div>
              )}
              {techData && (
                <TechnologyHeatmap
                  data={techData}
                  onTechClick={(deployType) =>
                    setView({ name: "list", deployType })
                  }
                />
              )}
            </div>
          </>
        )}

        {view.name === "list" && (
          <DeploymentList
            filter={view}
            onSelect={(jetUuid) =>
              setView({ ...view, name: "detail", jetUuid, prev: view })
            }
          />
        )}

        {view.name === "detail" && (
          <DeploymentDetail jetUuid={view.jetUuid} />
        )}
      </main>
    </div>
  );
}
