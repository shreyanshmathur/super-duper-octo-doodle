# AI Solar Revenue Intelligence Platform

A fully client-side React dashboard for solar plant operators. Upload any CSV or Excel file and the app auto-detects column meanings, runs formula checks, flags edge cases, and surfaces revenue insights — no backend required.

---

## Features

| Tab | What it does |
|-----|-------------|
| **Upload & Mapping** | Drag-drop CSV / XLSX / XLS / ZIP. Fuzzy column inference with confidence scores. Manual override. Multi-file and multi-sheet support. |
| **Executive Overview** | KPI cards — total generation, gross/net revenue, penalty, forecast MAPE, data quality score. |
| **Forecasting Performance** | AI vs legacy vs scheduled forecast accuracy. MAPE / MAE / RMSE per day. Recharts time-series. |
| **Revenue & Settlement** | Gross revenue, deviation penalty, net revenue over time. Settlement status breakdown. |
| **Deviation & Penalty** | Per-block deviation MWh and penalty cost. Worst-deviation days ranked. |
| **Consumer Allocation** | Allocated MWh and revenue by consumer type (DISCOM, Open Access, Captive, Exchange). |
| **Asset Health** | Inverter availability trends, fault codes, underperformer flags. |
| **Edge Case Monitor** | Detects negative generation, impossible values, frozen meters, sudden drops, forecast spikes. |
| **Data Quality** | Per-field issue log with severity, affected row count, and suggested fix. |
| **AI Recommendations** | Rule-based recommendations ranked by priority — weather risk, equipment faults, commercial exposure, data quality. |
| **Formula Audit** | Row-by-row formula verification: Deviation = Actual − Scheduled, Gross Revenue = Actual × Tariff × 1000, etc. |
| **Model Assumptions** | Editable plant capacity, block duration, penalty rate, currency, and tolerance settings. |

### AI Copilot

A floating **🤖** button (bottom-right) opens a streaming chat panel powered by the [Groq API](https://console.groq.com). The copilot has full context of the loaded data — KPIs, daily breakdown, asset health, consumer allocation — and can answer questions like:

- *"Which inverter is performing worst?"*
- *"What caused the highest penalty day?"*
- *"How can I reduce deviation penalties?"*

Responses stream in real time. Conversations can be exported as Markdown.

---

## Tech Stack

- **React 19** + **TypeScript**
- **Tailwind CSS v4** (via `@tailwindcss/vite`)
- **Recharts** — all charts with `ResponsiveContainer`
- **Zustand** — global state
- **PapaParse** — CSV parsing
- **SheetJS (xlsx)** — Excel parsing
- **JSZip** — ZIP extraction
- **Groq API** (`llama-3.3-70b-versatile`) — AI copilot via SSE streaming
- **Vitest** + **React Testing Library** — 178 tests

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 9+

### Install & run

```bash
cd solar-app
npm install
npm run dev
```

App runs at `http://localhost:5173`.

### Build

```bash
npm run build
```

Output goes to `solar-app/dist/`.

### Tests

```bash
npm test          # run once
npm run coverage  # with V8 coverage report
```

All 178 tests use internal synthetic datasets — no real files needed.

---

## Uploading Data

The app accepts any CSV, Excel (.xlsx / .xls), or ZIP file. Column names are inferred automatically using bigram similarity and synonym dictionaries across **47 canonical fields** (timestamp, actual MWh, scheduled MWh, tariff, fault codes, etc.).

### Supported dataset types

| Type | Auto-detected when |
|------|--------------------|
| Generation / Interval | Timestamp + actual energy columns present |
| Consumer Allocation | Consumer name + allocated energy |
| Asset Health | Inverter ID + availability / fault code |
| Weather | Irradiance / cloud cover / GHI columns |
| Event / Anomaly | Event type + severity columns |

You can upload multiple files at once — each is classified independently and merged into the dashboard.

### Try without your own data

Click **"Try Sample Data"** on the upload page. This loads a deterministic 7-day synthetic solar plant dataset:

- **672 generation rows** — solar curve with cloud events (Day 3–4 overcast), INV-06 fault on Day 3, realistic forecast/schedule errors
- **56 asset health rows** — 8 inverters; INV-03 degrading (F03-Grid), INV-06 trip (F07-DC-Low), INV-07 slow degradation
- **384 consumer allocation rows** — 4 consumers across Day 0 (DISCOM 50%, Open Access 25%, Captive 15%, Exchange 10%)

---

## AI Copilot Setup

1. Get a free API key from [console.groq.com](https://console.groq.com).
2. Open the **🤖** panel (bottom-right corner).
3. Click **⚙️** and paste your key — it is saved in browser `localStorage` only, never sent anywhere except the Groq API.

**For Netlify deployments:** set `VITE_GROQ_API_KEY` as an environment variable in the Netlify dashboard. The panel will pick it up automatically.

---

## Deploying to Netlify

The repo includes a `netlify.toml` at the root:

```toml
[build]
  base    = "solar-app"
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from   = "/*"
  to     = "/index.html"
  status = 200
```

Connect the GitHub repo to Netlify and it deploys automatically. Set `VITE_GROQ_API_KEY` under **Site settings → Environment variables** to pre-configure the copilot API key.

---

## Formula Reference

| Formula | Expression |
|---------|-----------|
| Deviation MWh | `Actual MWh − Scheduled MWh` |
| Gross Revenue (₹) | `Actual MWh × 1000 × Tariff (₹/kWh)` |
| Deviation Penalty (₹) | `|Deviation MWh| × 1000 × Penalty Rate (₹/kWh)` |
| Net Revenue (₹) | `Gross Revenue − Deviation Penalty` |

All formulas are verified row-by-row in the **Formula Audit** tab. Tolerance is configurable in **Model Assumptions**.

---

## Project Structure

```
solar-app/
├── src/
│   ├── components/
│   │   ├── shared/          # Card, EmptyState, formatters
│   │   ├── UploadPage.tsx
│   │   ├── OverviewPage.tsx
│   │   ├── ForecastingPage.tsx
│   │   ├── RevenuePage.tsx
│   │   ├── DeviationPage.tsx
│   │   ├── ConsumerPage.tsx
│   │   ├── AssetPage.tsx
│   │   ├── EdgeCasePage.tsx
│   │   ├── DataQualityPage.tsx
│   │   ├── AIRecommendationsPage.tsx
│   │   ├── FormulaAuditPage.tsx
│   │   ├── AssumptionsPage.tsx
│   │   └── CopilotPanel.tsx  # Floating AI chat panel
│   ├── data/
│   │   └── demoDatasets.ts   # Seeded synthetic 7-day dataset
│   ├── store/
│   │   └── appStore.ts       # Zustand global state
│   ├── types/
│   │   └── index.ts          # All TypeScript interfaces
│   ├── utils/
│   │   ├── columnInference.ts  # Fuzzy column mapping engine
│   │   ├── dataTransform.ts    # Row builders, edge case detection, audit
│   │   ├── fileParser.ts       # CSV / XLSX / ZIP parsing
│   │   └── copilot.ts          # Context builder + Groq SSE streaming
│   └── tests/
│       ├── inference.test.ts
│       ├── calculations.test.ts
│       ├── validators.test.ts
│       ├── recommendations.test.ts
│       ├── store.test.ts
│       ├── normalization.test.ts
│       └── dashboard-render.test.tsx
├── public/
│   └── _redirects           # Netlify SPA fallback
├── vite.config.ts
├── tsconfig.app.json
└── package.json
netlify.toml                 # Netlify build config (repo root)
```
