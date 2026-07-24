# Retirement Planning Simulator — Technical Implementation Guide (v2.1)

A **guidance document**: what the pieces are, where they live, and the non-obvious
decisions behind them. It is intentionally light on code — read the source for exact
implementations (paths are given throughout).

---

## 1. Project Setup

Scaffolded with Vite (`react-ts`). Core deps: `react-router-dom`, `recharts`,
`lucide-react`, `date-fns`, `clsx`, `tailwind-merge`; Tailwind CSS + shadcn/ui; Vitest
for unit tests.

Critical configuration (see [`vite.config.ts`](../vite.config.ts) and [`tsconfig.json`](../tsconfig.json)):

- **Dev server on port 5175.**
- **Path alias `@/` → `src/`** (mirrored in both `vite.config.ts` and `tsconfig.json`).
- **`worker: { format: 'es' }`** — required so the Monte Carlo worker can `import` the
  calculation modules.
- **`manualChunks`** splits `react` / `charts` / `calculations` for a smaller initial load.
- TypeScript **strict**; `paths` supplies the `@/` alias (no `baseUrl` needed under
  `moduleResolution: "bundler"`).
- **Vitest** config lives in the `test` block of `vite.config.ts` (Node environment,
  discovers `src/**/*.test.ts`).

---

## 2. Implementation Status (Phases)

- **Phase 1 — Core Setup ✅** types (`src/types/index.ts`), constants
  (`src/lib/constants.ts`), the two contexts, routing.
- **Phase 2 — Wizard UI ✅** 7 step components + navigation, validation, Basic/Advanced
  toggle, profile management.
- **Phase 3 — Calculation Engine ✅** pure modules in `src/lib/calculations/`: `random`,
  `rmd`, `socialSecurity`, `income`, `expenses`, `taxes`, `withdrawals`, `hsa`,
  `yearlyProjection`, plus the Monte Carlo Web Worker (`src/workers/monte-carlo.worker.ts`,
  fixed at 10,000 runs).
- **Phase 4 — Results UI ✅** summary dashboard, mandatory Disclosures/Assumptions panel,
  cash-flow chart, Monte Carlo chart, annual breakdown table + CSV/JSON export.
- **Phase 5 — Additional Features 🔄** scenario comparison ✅; PDF export ⏳.
- **Phase 6 — Testing & Polish** unit tests ✅ (see §4); integration/UI tests ⏳.

---

## 3. Architecture Notes

- **Web Worker protocol.** The main thread ([`src/contexts/ResultsContext.tsx`](../src/contexts/ResultsContext.tsx))
  spawns [`monte-carlo.worker.ts`](../src/workers/monte-carlo.worker.ts) via
  `new URL(..., import.meta.url)` with `{ type: 'module' }`, posts
  `{ type: 'START', inputs, numberOfRuns }`, and listens for `PROGRESS` / `COMPLETE` /
  `ERROR`. Always branch on `e.data.type` before reading the payload.
- **Calculation modules** are pure and re-exported from an `index.ts` barrel; import via
  `@/lib/calculations`. Purity + determinism invariants are documented in
  [`CLAUDE.md`](../CLAUDE.md) (seeded RNG, 2 `rng()` calls/year, `success ===
  (ageOfDepletion === null)`).
- **Lazy loading.** Result charts are `React.lazy` + `Suspense`, so the Summary tab and the
  initial bundle stay light; each chart loads only when its tab is opened.
- **Exports.** [`AnnualTable.tsx`](../src/components/results/AnnualTable.tsx) builds the CSV;
  [`exportVerification.ts`](../src/lib/exportVerification.ts) builds the JSON verification
  bundle consumed by `verify_plan.py` (§4.2).

---

## 4. Testing

Two complementary layers guard calculation correctness:

1. **Vitest unit tests** — fast, automatic, run on every change. Cover the pure modules in
   `src/lib/calculations/`.
2. **`verify_plan.py`** — an independent Python re-implementation that re-derives a full
   exported run end-to-end (§4.2). Catches drift between UI output and inputs.

### 4.1 Unit Tests (Vitest)

```bash
npm test           # run once (CI-style)
npm run test:watch # watch mode
```

Test files sit next to the code they cover (e.g. `src/lib/calculations/taxes.test.ts`).
Current coverage (**76 tests**):

| File | What it locks down |
|------|--------------------|
| `taxes.test.ts` | provisional-income SS taxability across all three tiers + user cap; standard-deduction floor (age-65 addition, OBBBA senior bonus, 2028 sunset, inflation indexing); the tax-free-room solver (incl. SS-torpedo feedback); gain-only brokerage tax; gross-up round-trip |
| `rmd.test.ts` | age-73 start gate; Uniform Lifetime Table divisors; age-100 fallback for 101+ |
| `socialSecurity.test.ts` | claiming-age factors (62→70), COLA compounding, earnings-test withholding |
| `hsa.test.ts` | healthcare tax-free at any age; no non-medical use before 65; taxed non-medical after 65; balance caps |
| `withdrawals.test.ts` | portfolio totals & `$100` depletion threshold; forced RMD from tax-deferred regardless of priority; the tax-smart fill (floor-limited, need-capped, RMD counts toward the floor); shortfall reporting; HSA-first spending |
| `random.test.ts` | seeded determinism; single shared market shock across accounts (correlation fix); 2-`rng()`-calls-per-year contract |
| `yearlyProjection.test.ts` | the **success metric** — `success === (ageOfDepletion === null)`, failed runs report `$0` (guards the "$9 median" regression); tax-smart vs standard sequencing regression |

> Not covered by unit tests: React components/UI, the Web Worker wrapper, and localStorage
> persistence. The engine is the correctness-critical surface; the UI is exercised manually
> and via the verification bundle.

### 4.2 Independent Verification (JSON bundle + verify_plan.py)

Every run can be checked against an **independent re-implementation** of the expected-value
formulas in Python. This catches drift between what the UI shows and what the inputs imply.

- **Export (app side):** the **"JSON" button** on the Annual Breakdown tab downloads
  `retirement-verification-<yyyymmdd-hhmm>.json` (full `inputs`, `results`, and the
  year-by-year `projections` for p10 / p50 / p90), built by `src/lib/exportVerification.ts`.
- **Verify (script side):** `scripts/verify_plan.py` re-derives every deterministic value
  from `inputs` and compares against the projection — Social Security, pensions, rental,
  living expenses, healthcare premiums/out-of-pocket, income tax (provisional-income SS +
  standard-deduction floor + marginal rate, mirroring `TAX_RULES` in `taxes.ts`), payroll
  tax, the component sums, and the cash-flow identity. Implied per-account returns are
  range-checked (informational; balances are stochastic).

```bash
# Save the downloaded bundle into scripts/, then:
python3 scripts/verify_plan.py                          # newest bundle in scripts/
python3 scripts/verify_plan.py --percentile p10         # check the worst-case run
python3 scripts/verify_plan.py --json path/to/file.json --tolerance 0.03
```

The script picks the newest bundle by modification time and exits non-zero if any
deterministic check fails. Downloaded bundles are git-ignored.

> Keep the Python `TAX_RULES` in `verify_plan.py` in sync with the TypeScript `TAX_RULES`
> in `taxes.ts`. The tax model and its year-specific constants/sources are documented in
> [`docs/2-tax-model.md`](2-tax-model.md).

---

## 5. Performance Notes

- **Fixed at 10,000 runs**, off the main thread in a Web Worker; a progress bar updates
  every 100 runs. Completes in a few seconds.
- **Worker memory:** store only minimal per-run data (success, final balance, depletion
  age) for all runs, and keep full year-by-year projections for just the handful of runs
  surfaced in the UI (p10/p50/p90). This keeps memory in the ~10 MB range rather than
  hundreds of MB.
- **Charts** memoize their derived data (`useMemo` keyed on `results`), so switching tabs
  or resizing the window doesn't recompute.

---

## 6. Results Dashboard

`ResultsPage` is a tabbed layout:

- **Summary** (default) — success gauge, metric cards, portfolio p10/p50/p90 outcomes, and
  the **mandatory Disclosures/Assumptions panel**.
- **Cash Flow** — stacked income/expense bars with portfolio balance line(s) (Recharts
  `ComposedChart`).
- **Monte Carlo** — the **simplified 3-line chart**: p10 / p50 / p90 portfolio trajectories
  over time (not a spaghetti chart).
- **Annual Breakdown** — per-year table with hover breakdowns for each composite figure,
  plus CSV and JSON export.

Non-summary tabs are lazy-loaded (§3).

---

## 7. Deployment (Vercel, Git-based)

Push-to-deploy via Vercel's GitHub integration — Vercel runs the build on its servers; you
do **not** run `npm run build` or the Vercel CLI locally to deploy.

1. Import the repo into Vercel once (auto-detects Vite; output `dist`).
2. Push to `master` → production deploy. Other branches / PRs → preview deploys.
3. `vercel.json` (repo root) rewrites all routes to `index.html` so client-side routes
   (`/results`, `/wizard/1`) don't 404 on refresh.

Optional local sanity check (not part of deploy): `npm run build` then `npm run preview`
(serves at `http://localhost:4173`).

---

## 8. Common Pitfalls

- **Worker fails to load in production** → use the `new URL('./worker.ts', import.meta.url)`
  pattern with `{ type: 'module' }`, and keep `worker: { format: 'es' }` in `vite.config.ts`.
- **Recharts tooltip shows `undefined`** → null-check the payload in the custom tooltip.
- **Chart re-renders constantly** → wrap the data transform in `useMemo`.
- **404 on refresh (prod)** → SPA rewrite in `vercel.json` (already configured).
- **`useNavigate` not working** → the component must be inside `<BrowserRouter>`.

---

## 9. Code Organization

```
src/
├── components/
│   ├── ui/              # shadcn/ui primitives
│   ├── wizard/          # 7 step components + navigation + the timeline
│   ├── results/         # summary, charts, annual table, assumptions panel
│   ├── comparison/      # scenario compare
│   └── common/          # Header, Footer, ScenarioManager
├── contexts/            # InputsContext, ResultsContext
├── lib/
│   ├── calculations/    # pure engine (9 modules) + co-located *.test.ts
│   ├── storage/         # localStorage scenario management
│   ├── constants.ts     # defaults, RMD table, SS factors
│   ├── exportVerification.ts, format.ts, utils.ts, analytics.ts
├── types/index.ts       # all TypeScript interfaces
├── workers/             # monte-carlo.worker.ts
└── pages/               # Landing, Wizard, Results, Scenarios, Comparison
```

---

## 10. Quick Reference

```bash
npm run dev          # dev server (http://localhost:5175)
npm test             # Vitest once   ·  npm run test:watch
npm run type-check   # tsc --noEmit  ·  npm run lint
npm run build        # tsc && vite build
npm run preview      # serve the production build
```

Routes: `/` (landing) → `/wizard/:step` (7 steps) → `/results`; plus `/scenarios` and
`/compare`.

Docs: [1-requirements](1-requirements.md) · [2-tax-model](2-tax-model.md) ·
[3-withdrawal-strategy](3-withdrawal-strategy.md) · [4-system-design](4-system-design.md).

---

**END OF TECHNICAL IMPLEMENTATION GUIDE** · v2.1 (trimmed to a guidance document)
