# Alayra Nexus — Dashboard (`web/`)

The operator console, rebuilt for Phase 7 (see [`../nexus-ui-plan.md`](../nexus-ui-plan.md)).
A **Vite + Preact + TypeScript** app that compiles to static assets — the gateway serves them
as-is, so the single self-hostable container is unchanged. No SSR, no CDN (fonts and charts are
bundled, so it works air-gapped).

```bash
cd web
npm install
npm run dev        # local dev server (http://localhost:5173)
npm run build      # static build → web/dist
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest + @testing-library/preact
```

CI runs lint / typecheck / test / build on every push (`.github/workflows/ci.yml`, `ui` job).

## Layout

| Path | What |
|---|---|
| `src/styles/tokens.css` | Design tokens — the slate-glass palette in dark **and** light. |
| `src/theme.ts` | Theme read/write/toggle (persisted, `prefers-color-scheme` aware). |
| `src/ui/` | The component kit (Button, Card, StatCard, Badge, Tabs, LineChart, …). |
| `src/shell/` | App frame: sidebar, top bar, theme toggle, notifications bell. |
| `src/nav.ts` | The 12-section information architecture. |
| `src/pages/` | Section pages (Overview live scaffold; the rest fill in per phase). |
| `src/api.ts` | Typed admin API client (bearer-token, mirrors the gateway contract). |

The current live dashboard (`../frontend/`) keeps serving until this app reaches parity, at which
point the gateway's static root is switched over.
