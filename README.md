# HLTCMH — Chase My Home Deployment Dashboard

Production deployment dashboard for the **Chase My Home** product.
Single-page Chart.js dashboard with KPI cards, eight charts, a risk
heat map, drill-down to filtered deployment tables (with Excel-style
column filters and pagination), and per-record detail views.

- **Frontend:** React 18 + Vite + Chart.js (no `lucide-react`)
- **Backend:** None — pure React. Deployment data is imported as JSON
  at build time from `src/data/cmh-deployment-data.json`. All
  aggregation runs in the browser; everything refreshes when you swap
  the JSON.

## Drill-down flow

1. **Home** — landing tile for `HLTCMH`
2. **HLTCMH** — landing tile for `Deployment Metrics Dashboard`
3. **Production Deployment Dashboard** — KPI cards + 8 charts + risk
   heat map + recent deployments table
4. **Filtered drill panel** — click any chart element / heat-map cell /
   legend chip / table row → slide-in panel with paginated, column-filtered
   deployment list
5. **Deployment detail** — click a row to see the full record metadata

## Run (development)

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. No API server, no extra terminals.

## Run on a machine that doesn't have Node / Vite

Vite is only used at build time. The built output in `dist/` is plain
HTML/CSS/JS and runs on any browser without Node or Vite.

Build once on a machine with Node 18+:

```bash
npm install
npm run build
```

This produces `dist/` with **relative** asset paths (`base: "./"` in
`vite.config.js`), so it's fully portable. To run it elsewhere:

1. Copy the entire `dist/` folder to the target machine.
2. Either double-click `dist/index.html` (most browsers run it from `file://`),
   **or** serve it with any HTTP server, e.g.:
   ```bash
   cd dist
   python3 -m http.server 8080
   ```
   Then open <http://localhost:8080>.

Nothing on the target machine needs Node, npm, or Vite installed.

## Updating the data

Edit `src/data/cmh-deployment-data.json` — an array of deployment
records (same shape: `application_id`, `project_name`, `repo_name`,
`deploy_type`, `deploy_status`, `deploy_time`, `change_ctrl_ticket`,
`environment`, `product_line`, `product_name`, `jet_id`, `jet_uuid`, …).

Everything in the dashboard recomputes from this file:

- KPI cards (counts, success / failure rates)
- Header subtitle (`product_line · product_name · environments ·
  date range · N records · M applications`)
- Donut, status bar, success-rate, stacked bar, radar, timeline,
  monthly grouped, bubble chart
- Risk heat map (deploy type × status)
- Recent deployments + drill-down filters
- Date range adapts across years
- New `deploy_type` values automatically get a stable color from the
  fallback palette — no code change required

Vite hot-reloads when the JSON changes during `npm run dev`.

## Project layout

```
.
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx            # React entry
│   ├── App.jsx             # All views, charts, drill state
│   ├── styles.css
│   ├── data/
│   │   └── cmh-deployment-data.json
│   └── components/
│       ├── Header.jsx
│       ├── KPICards.jsx
│       ├── RiskHeatmap.jsx
│       ├── RecentTable.jsx
│       ├── DrillPanel.jsx
│       ├── ChartModal.jsx
│       ├── LandingTile.jsx
│       ├── Breadcrumbs.jsx
│       └── AnimatedNumber.jsx
└── dist/                   # production build (committed for no-Node deploys)
```
