# JSON Viewer — CLAUDE.md

## Project
Static app (Vite + React + TypeScript) to visualize JSON as an interactive node graph, diff files, and analyze Excel/CSV database schemas.

## Stack
- **Vite + React + TypeScript**
- **@xyflow/react** — interactive graph
- **@dagrejs/dagre** — automatic left-to-right layout
- **html-to-image** — PNG/SVG export
- **diff** — line-by-line file comparison
- **xlsx (SheetJS)** — Excel/CSV parsing

## Tabs
- **Viewer** — paste JSON, visualize as nodes/edges, export to image, bidirectional sync with editor
- **Compare** — two editors side by side, real-time diff, language detection (JSON/JS/TS)
- **Schema** — upload Excel/CSV files, visualize DB table relationships, compare with JSON

## Environment variables
Copy `.env.example` to `.env.local` and fill in values before running locally.

```
VITE_APP_PASSWORD=   # access password shown on the lock screen
```

## Dev
```bash
npm install
cp .env.example .env.local   # then edit .env.local
npm run dev
```

## Build & deploy
```bash
npm run build   # outputs to dist/
```
