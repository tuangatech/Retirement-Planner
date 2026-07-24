# CLAUDE.md

Privacy-first retirement **simulator** (React 18 + TS + Vite). Client-side Monte Carlo, no
backend. "Tell me what you'll have at retirement, and I'll tell you if it lasts."

## Commands
```bash
npm run dev          # Vite dev server, port 5175
npm test             # Vitest (once)   ·  npm run test:watch
npm run type-check   # tsc --noEmit    ·  npm run lint (ESLint flat config)
npm run build        # tsc && vite build
python3 scripts/verify_plan.py   # independent cross-check of an exported JSON bundle
```

## Layout
- `src/lib/calculations/` — pure, unit-tested engine (taxes, rmd, socialSecurity, income,
  expenses, withdrawals, hsa, random, yearlyProjection). Tests are co-located `*.test.ts`.
- `src/workers/monte-carlo.worker.ts` — runs 10,000 sims off the main thread (fixed count).
- `src/contexts/` — InputsContext (inputs) + ResultsContext (worker). `src/pages/`, `src/components/`.
- `docs/1-…5-` — requirements, tax model, withdrawal strategy, system design, implementation.
- Import alias: `@/` → `src/`. Indentation: 4 spaces.

## Key invariants (don't break)
- **Determinism:** seeded Mulberry32 RNG; exactly 2 `rng()` calls per simulated year. Same
  seed + inputs ⇒ identical results.
- **Success metric:** `success = ageOfDepletion === null`; failed runs report `finalBalance = 0`
  (never use `finalBalance > 0` — stranded pennies would misreport failures).
- **Tax model:** IRS provisional-income SS + standard-deduction floor + one marginal rate above
  it. Single filer only. Constants are year-specific — see `docs/2-tax-model.md`.
- **Saved scenarios** store inputs only (results recomputed on load). Never silently change how
  an old scenario was computed — legacy `withdrawalStrategy.strategy` defaults to `'standard'`.

## Coding conventions & practices (staff-level)
- **Match the surrounding code.** Mirror the file's existing naming, structure, and comment
  density rather than importing a personal style.
- **Keep the engine pure.** Calculation modules take inputs and return values — no I/O, no React,
  no globals, no `Date.now()`/`Math.random()`. This is what makes them testable and deterministic.
- **Change engine behavior ⇒ add/adjust tests** in the same PR, including a regression case that
  would have caught the bug. Run `type-check`, `lint`, `test`, and `build` green before committing.
- **Comment the *why*, not the *what*.** Non-obvious tax/withdrawal rules and deliberate
  simplifications get a short rationale; self-evident code does not.
- **Honesty over false confidence.** This tool discloses its limitations. When you simplify or
  cap something, surface it (assumptions panel / docs), don't hide it. UI copy must not imply a
  benefit the user won't actually get.
- **Separate display from model.** Tooltips, formatting, and charts are presentational; never
  slip business logic into them. One source of truth for each number.
- **Scope tightly, prefer the smallest correct change,** and flag pre-existing issues you find
  rather than silently reworking unrelated code. Recommend, don't sprawl.
- **Verify claims.** Prove correctness with `verify_plan.py` or a test/spot-check before saying
  something works; report failures plainly.

## Git
Commit to `master` only when asked. **Short** messages, **no `Co-Authored-By` / attribution
trailers.** Confirm before force-pushing or anything hard to reverse.
