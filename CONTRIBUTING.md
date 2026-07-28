# Contributing

Thanks for looking at this project. It's a retirement **simulator** whose whole pitch is honesty:
transparent math, documented assumptions, and an explicit list of what it does *not* model. That
goal shapes what a good contribution looks like here, so this document is worth skimming before
you write code.

---

## 🙋 Ways to help (no code required)

- **Just use it and tell us what broke.** Run the [live demo](https://retirement-planner-blond.vercel.app/),
  put in a plausible plan, and file anything confusing, wrong, or ugly.
- **Check the math.** Export the JSON bundle from the Annual Breakdown tab and run
  `python3 scripts/verify_plan.py`. If it disagrees with the app, that's a great bug report.
- **Challenge an assumption.** If you know tax, Medicare, or Social Security rules better than the
  code does, say so — cite the IRS/SSA/CMS source and we'll fix it or document the simplification.
- **Improve the docs.** The `docs/` folder explains the model; gaps there are real bugs.

Issues labeled **`good first issue`** are scoped to be safe entry points.

---

## 🎯 Scope

**In scope — the retirement phase only.** You tell the tool what you'll have *at* retirement, and
it tells you whether it lasts.

Deliberately **out of scope**:

- **Pre-retirement accumulation.** No "how do I get there" modeling. This is the project's single
  biggest boundary; PRs that add a savings/accumulation phase will be declined.
- **Any server-side anything.** No backend, no accounts, no analytics, no error reporting, no
  cloud sync. Privacy is a feature, not a default we haven't gotten around to changing. A PR that
  sends user inputs off-device won't be merged.
- **Individualized advice.** The tool shows outcomes; it doesn't tell people what to do.

**Known gaps that are fair game** (all currently disclosed in the app's Disclosures tab):
state income tax, ACA subsidies for pre-Medicare coverage, long-term care costs, the survivor's
penalty for couples, per-spouse (non-pooled) accounts, variable inflation, dynamic spending
guardrails, and fat-tail return modeling. Several of these have design notes in `docs/`.

If a change is large, **open an issue first** so we can agree on the approach before you spend
time on it.

---

## 🚀 Development setup

```bash
git clone https://github.com/tuangatech/retirement-planner.git
cd retirement-planner
npm install
npm run dev          # http://localhost:5175
```

Requires **Node.js 18+** and a browser with Web Worker support.

### The gate

Everything below must be green before you open a PR. CI runs exactly these four, so a green local
run means a green CI run:

```bash
npm run type-check   # tsc --noEmit
npm run lint         # ESLint; errors block, style warnings don't
npm test             # Vitest, once
npm run build        # tsc && vite build
```

`npm run test:watch` is the fast loop while you work.

---

## 🗺️ Repo map

```
src/lib/calculations/   The engine. Pure, deterministic, unit-tested. Start here.
src/workers/            monte-carlo.worker.ts — 10,000 sims off the main thread
src/contexts/           InputsContext (inputs) · ResultsContext (worker + results)
src/components/         ui/ (shadcn), common/, wizard/, results/, scenarios/, comparison/
src/pages/              Landing · Wizard · Results · Scenarios · Comparison
src/types/index.ts      Every shared interface
scripts/verify_plan.py  Independent Python cross-check of an exported bundle
docs/                   The model, written down (see the README's Documentation section)
```

Imports use the `@/` alias for `src/` (`import { foo } from '@/lib/utils'`).

---

## ⚠️ Invariants — please don't break these

These are the things a well-meaning PR breaks most often. Each one exists for a reason.

1. **Determinism.** The simulation uses a seeded Mulberry32 RNG and makes **exactly two `rng()`
   calls per simulated year**. Same seed + same inputs ⇒ byte-identical results. If you add a
   random draw, you change every historical result — so don't, unless that's explicitly the point
   of the PR, and say so loudly if it is.

2. **The success metric.** `success = ageOfDepletion === null`. Failed runs report
   `finalBalance = 0`. **Never** test success with `finalBalance > 0` — stranded pennies would
   silently misreport failures as successes.

3. **Engine purity.** Modules in `src/lib/calculations/` take inputs and return values. No I/O, no
   React, no globals, no `Date.now()`, no `Math.random()`. That purity is exactly what makes the
   engine testable and reproducible.

4. **Display is not the model.** Tooltips, formatters, and charts present numbers; they never
   compute business logic. One source of truth per number.

5. **Don't retroactively change saved scenarios.** Scenarios persist *inputs only* — results are
   recomputed on load. So changing engine behavior silently changes what an old saved scenario
   reports. Legacy scenarios missing `withdrawalStrategy.strategy` currently fall back to
   `'tax_smart'` (see `src/lib/calculations/yearlyProjection.ts`); if you touch that default,
   explain the migration story in the PR.

6. **Tax constants are year-specific.** Federal constants are documented with sources in
   `docs/2-federal-tax-model.md`; per-state constants in `docs/5-state-tax-model.md`.
   Update the doc in the same PR as the constant, and cite the IRS/SSA/CMS or state DoR source.

7. **Never overstate.** UI copy must not imply a benefit the user won't actually get. If you
   simplify or cap something, surface it in the Disclosures tab and the docs. Hiding a
   simplification is worse than the simplification itself.

---

## 🧪 Tests

- Tests live next to the code they cover: `taxes.ts` → `taxes.test.ts`.
- **Any change to engine behavior needs tests in the same PR**, including a regression case that
  would have failed before your fix.
- Bug fixes: write the failing test first, then make it pass. Include it in the PR so the bug
  can't come back.

### Verifying calculation changes end-to-end

Unit tests are the fast net; `verify_plan.py` is the independent cross-check. It re-derives income,
expenses, healthcare, taxes, and the cash-flow identity in Python and exits non-zero on any
mismatch.

```bash
# 1. Run a simulation → Annual Breakdown tab → JSON → save into scripts/
python3 scripts/verify_plan.py                    # newest bundle, median (p50)
python3 scripts/verify_plan.py --percentile p10   # worst-case run
```

If you change the engine, run this too and mention the result in your PR. Downloaded bundles are
git-ignored — don't commit one.

---

## 🎨 Code conventions

- **4-space indentation.** TypeScript throughout; avoid `any` where you reasonably can.
- **Match the surrounding code.** Mirror the file's existing naming, structure, and comment
  density rather than importing a personal style.
- **Comment the *why*, not the *what*.** Non-obvious tax and withdrawal rules and deliberate
  simplifications get a short rationale. Self-evident code doesn't.
- **Scope tightly.** Every changed line should trace to the stated purpose of the PR. Don't
  reformat or refactor adjacent code — flag it separately instead.

`CLAUDE.md` in the repo root carries the same conventions in a form AI coding assistants pick up
automatically. If you use one, point it there.

---

## 🔀 Pull requests

1. Branch off `main` (`feat/…`, `fix/…`, `docs/…`).
2. Keep it focused — one concern per PR.
3. Run the gate. Add tests for engine changes.
4. Fill in the PR template: what changed, why, and how you verified it.
5. Update `docs/` and the Disclosures panel if you changed the model or its limitations.

Short, plain commit messages are preferred. Reviews aim to be quick and specific; if something
gets declined it'll come with a reason.

---

## 🐛 Reporting bugs

Use the issue templates. Pick **Calculation discrepancy** for wrong-number reports — it asks for
the exported JSON bundle, which makes the problem reproducible instead of a guessing game.

> **🔒 Never paste your real financial data into a public issue.** Round or fake the numbers, or
> build a synthetic scenario that shows the same problem. The exported bundle contains every input
> you entered — scrub it before attaching.

---

## 🔧 Troubleshooting

**`Cannot find module '@/types'`** — restart the TypeScript server in your editor (VS Code:
`Cmd/Ctrl+Shift+P` → "TypeScript: Restart TS Server").

**Port 5175 already in use** — change `server.port` in `vite.config.ts`.

**Stale build or weird Vite errors** — `rm -rf node_modules/.vite && npm run dev`.

**Tailwind styles missing** — confirm `src/index.css` still has the `@tailwind` directives.

---

## ❓ Questions

Open an issue. For anything touching tax or withdrawal logic, read `docs/2-federal-tax-model.md` and
`docs/3-withdrawal-strategy.md` first — the answer is often already written down, with sources.

By contributing, you agree your contributions are licensed under the [MIT License](LICENSE).
