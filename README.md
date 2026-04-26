# HLTCMH — Chase My Home Deployment Dashboard

Production deployment dashboard for the **Chase My Home** product.
Visualises deployment-type distribution as an interactive D3 heat map with
drill-down to deployments and per-deployment detail.

- **Frontend:** React 18 + Vite + D3.js (no `lucide-react`)
- **Backend:** None — this is a pure React app. The deployment data is
  imported as JSON at build time and lives at
  `FrontEnd/src/data/cmh-deployment-data.json`.

## Drill-down flow

1. **Home** — landing tile for `HLTCMH`
2. **HLTCMH** — landing tile for `Deployment Type Distribution`
3. **Production Deployment Dashboard** — summary cards + heat map (one tile
   per `deploy_type`)
4. **Deployment list** — every deployment for the chosen technology
5. **Deployment detail** — full record metadata for one deployment

## Run

```bash
cd FrontEnd
npm install
npm run dev
```

Open <http://localhost:5173>. That's it — no API server to start.

For a production build:

```bash
npm run build
npm run preview
```

## Updating the data

Edit `FrontEnd/src/data/cmh-deployment-data.json` (same shape as before — an
array of deployment objects). Vite hot-reloads on change.

## Notes

- All aggregation (technology distribution, summary stats, per-tech success
  rates, repo counts) happens in the browser inside `FrontEnd/src/api/client.js`.
- The component code uses a Promise-based API facade so it remains identical
  to the previous client-server version.
- Theme preference (light/dark) is persisted to `localStorage`.
