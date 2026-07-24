# Retirement Planning Simulator

**The Honest Retirement Calculator**

A privacy-first, Monte Carlo simulation-based retirement planning tool that helps individuals determine if their retirement plan will work. Built with transparency and statistical accuracy in mind, this tool honestly discloses its limitations rather than creating false confidence.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-blue)](https://reactjs.org/)

### 👉 [**Try the live demo**](https://retirement-planner-blond.vercel.app/) — no install, runs entirely in your browser

---

## 🎯 Product Summary

**"Tell me what you'll have AT retirement, and I'll tell you if it will last."**

This tool focuses exclusively on the retirement phase—no pre-retirement accumulation modeling. Users input their projected retirement balances, and the simulator models whether those assets will sustain them through retirement.

### Key Features

- **🎲 Monte Carlo Simulation** — 10,000 runs with randomized market returns
- **📊 Probabilistic Results** — success rate and outcome distribution (10th/50th/90th percentiles)
- **💰 HSA Integration** — tax-free healthcare coverage, with age-65+ flexibility
- **🏥 Phase-Based Spending** — Go-Go, Slow-Go, and No-Go years
- **💳 Multiple Income Sources** — Social Security (with earnings test), pensions, part-time work, rental
- **🔒 Privacy-First** — no server, no accounts, no tracking; everything runs in your browser
- **💾 Scenario Management** — save and compare scenarios in browser `localStorage`
- **📈 Rich Visualizations** — interactive charts (Recharts)
- **🧾 Exportable & Verifiable** — CSV export plus a JSON bundle checked by `scripts/verify_plan.py`
- **⚠️ Honest Limitations** — mandatory disclosure of what the tool does NOT model

### Target Audience

Early retirees, the FIRE community, and DIY planners who want transparent, statistically honest projections.

---

## 🛠️ Tech Stack

- **React 18** + **TypeScript 5** — UI and type-safe logic
- **Vite 5** — build tool and dev server
- **React Router 6** — client-side routing (Landing → Wizard → Results → Scenarios/Compare)
- **Tailwind CSS 3** + **shadcn/ui** (Radix UI primitives) — styling and components
- **Recharts 2** — charts · **Lucide** — icons
- **React Context API** — global state (no Redux)
- **Web Workers** — Monte Carlo runs off the main thread
- **localStorage** — scenario persistence (inputs only, not results)
- **Vitest** — unit tests for the calculation engine

---

## 🚀 Getting Started

> **Just want to try it?** Use the [**live demo**](https://retirement-planner-blond.vercel.app/) — no setup required. The steps below are only for running it locally.

### Prerequisites

- **Node.js** v18+ and **npm** v9+
- A modern browser with Web Worker support (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)

### Installation

```bash
git clone https://github.com/tuangatech/Retirement-Planner.git
cd Retirement-Planner
npm install
npm run dev
```

Then open **http://localhost:5175**.

### Available Scripts

```bash
npm run dev          # Start Vite dev server (hot reload) on port 5175
npm run build        # Type-check + production build to ./dist
npm run preview      # Serve the production build locally
npm test             # Run the Vitest unit-test suite once
npm run test:watch   # Vitest in watch mode (re-runs on change)
npm run lint         # ESLint (flat config); errors block, style nits are warnings
npm run type-check   # TypeScript check, no emit
```

> **Testing:** unit tests (Vitest) cover the pure calculation modules in
> `src/lib/calculations/` — taxes, RMDs, Social Security, HSA, withdrawals, the
> seeded RNG, and the depletion/success metric. They're the fast regression net;
> the JSON export + `verify_plan.py` workflow below is the end-to-end cross-check.
> Test files live next to the code they cover as `*.test.ts`.

---

## ✅ Verifying the Calculations

Every simulation can be independently re-checked against a Python re-implementation of the expected-value formulas.

1. Run a simulation, go to the **Annual Breakdown** tab, and click **JSON** to download `retirement-verification-<yyyymmdd-hhmm>.json` (contains all inputs, settings, and the p10/p50/p90 year-by-year projections).
2. Move that file into the **`scripts/`** folder.
3. Run the verifier (it auto-picks the newest bundle in `scripts/`):

```bash
python3 scripts/verify_plan.py                    # newest bundle, median (p50)
python3 scripts/verify_plan.py --percentile p10   # check the worst-case run
python3 scripts/verify_plan.py --json path/to/file.json --tolerance 0.03
```

It re-derives income, expenses, healthcare premiums/out-of-pocket, taxes, and the cash-flow identity from the inputs, and exits non-zero if any deterministic check fails. Downloaded bundles are git-ignored. See `docs/5-technical-implementation.md` §4.2 for details.

---

## 📦 Project Structure

```
Retirement-Planner/
├── src/
│   ├── components/        # UI: ui/ (shadcn), common/, wizard/, results/,
│   │                      #     scenarios/, comparison/
│   ├── contexts/          # InputsContext (inputs), ResultsContext (worker + results)
│   ├── lib/
│   │   ├── calculations/  # Calculation engine (see below)
│   │   ├── storage/       # localStorage scenario management
│   │   ├── exportVerification.ts  # JSON verification bundle
│   │   ├── constants.ts   # Default values, RMD table, SS factors
│   │   └── utils.ts, format.ts
│   ├── workers/           # monte-carlo.worker.ts (simulation engine)
│   ├── pages/             # LandingPage, WizardPage, ResultsPage,
│   │                      # ScenariosPage, ComparisonPage
│   ├── types/index.ts     # All TypeScript interfaces
│   ├── App.tsx, main.tsx, index.css
├── scripts/               # verify_plan.py + downloaded verification bundles
├── docs/                  # requirements, system-design, technical-implementation, tax-model
├── public/                # Static assets
├── vite.config.ts, tsconfig.json, tailwind.config.js, components.json
└── package.json
```

**Routes:** `/` (landing) → `/wizard/:step` (6-step wizard) → `/results` (5 tabs: Summary, Monte Carlo, Cash Flow, Annual Breakdown, Disclosures); plus `/scenarios` and `/compare`.

---

## 🧮 Calculation Engine

Located in `src/lib/calculations/` — independent, pure, unit-testable modules:

```
random.ts            Seeded RNG (Mulberry32) + Box-Muller normal returns
rmd.ts               Required Minimum Distributions (IRS Uniform Lifetime Table)
socialSecurity.ts    Claiming-age adjustment, COLA, earnings test
income.ts            Pensions, part-time work, rental income
expenses.ts          Phase-based spending + healthcare (pre-Medicare & Medicare)
taxes.ts             Effective-rate model + iterative gross-up
withdrawals.ts       Withdrawal sequencing, RMD enforcement, HSA-first
hsa.ts               HSA tax-advantaged withdrawal logic
yearlyProjection.ts  Orchestrates all modules for one year
```

The `monte-carlo.worker.ts` worker runs 10,000 full simulations and aggregates success rate, percentiles, and the p10/p50/p90 projections. A seeded PRNG makes results reproducible.

**Performance:** 10,000 runs complete in a few seconds.

---

## 🚢 Deployment (Vercel)

The app is a static SPA—no backend or environment variables.

1. Import the GitHub repo into Vercel once. Vercel auto-detects the **Vite** preset and runs the build for you (output `dist`) — you don't build locally.
2. **Every push to `master` triggers a production deploy**; other branches and PRs get preview deploys. That's the whole workflow—just push.

A **`vercel.json`** at the repo root rewrites all paths to `index.html`, so deep links and page refreshes (e.g. `/results`) don't 404 under the app's client-side routing. It's already included—no action needed.

> Building locally is optional — Vercel builds on its servers. If you want to sanity-check a production bundle before pushing, `npm run build` (and `npm run preview`) are available, but they aren't part of the deploy step.

---

## 🔒 Privacy & Data

All calculations run in your browser—**no server, no accounts, no tracking, no cookies**. Scenarios are saved to `localStorage` (inputs only; results are recalculated on load because they're too large to store).

⚠️ Don't use on a shared/public computer—anyone with browser access can view saved scenarios.

Configuration lives in `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, and `components.json`; no `.env` is required.

---

## 📖 Documentation

- **[1-requirements.md](docs/1-requirements.md)** — product requirements
- **[2-tax-model.md](docs/2-tax-model.md)** — tax logic, constants/sources, and MFJ roadmap
- **[3-withdrawal-strategy.md](docs/3-withdrawal-strategy.md)** — withdrawal order and tax-efficiency suggestions
- **[4-system-design.md](docs/4-system-design.md)** — architecture and design
- **[5-technical-implementation.md](docs/5-technical-implementation.md)** — implementation guide (incl. verification workflow)

### Key Design Decisions

1. **No pre-retirement modeling** — focuses only on the retirement phase.
2. **Simplified tax model** — single effective rate rather than full brackets.
3. **Mandatory assumptions panel** — honest disclosure of limitations.
4. **localStorage only** — no cloud sync keeps it simple and private.
5. **Web Workers** — keep the UI responsive during 2–10s simulations.

---

## 📝 License

MIT — see [LICENSE](LICENSE).

---

**Made with ❤️ for the FIRE community**
