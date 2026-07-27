---
name: verify-ui
description: Launch the app and drive it with headless Chromium to verify UI, routing, or dependency changes for real. Walks the wizard, runs a full simulation, checks all results tabs and route guards, and can diff icon rendering across a lucide bump. Use when a change needs proof beyond type-check/tests — router upgrades, icon-library bumps, wizard/MFJ UI work, or any Dependabot PR whose CI green is meaningless.
---

# Verify the UI for real

`npm test` covers the calculation engine only — **nothing in the suite exercises routing,
rendering, or the worker.** So a green gate says nothing about whether the app still works.
This skill closes that gap by actually driving the app.

Use it when:

- Upgrading `react-router-dom`, `react`, `recharts`, `tailwindcss`, or `lucide-react`
- Changing the wizard, results tabs, or anything MFJ-gated
- Reviewing a Dependabot PR where CI green proves only "it compiles"

`chromium-cli` is **not** available on macOS (it exists only in Anthropic's Linux sandbox),
so this uses Playwright directly.

## 1. One-time setup

Playwright lives in this skill directory, not the project — it must never reach
`package.json`.

```bash
cd .claude/skills/verify-ui && npm install && npx playwright install chromium
```

## 2. Start the dev server

```bash
lsof -ti:5175 -sTCP:LISTEN | xargs kill 2>/dev/null   # free the port first
npm run dev > /tmp/vite-dev.log 2>&1 &
curl -sf --retry 40 --retry-delay 1 --retry-connrefused http://localhost:5175 -o /dev/null && echo UP
```

**macOS has no `timeout`** — use `curl --retry-connrefused` to poll, never `sleep`.

## 3. Drive it

```bash
node .claude/skills/verify-ui/drive.mjs
```

20 assertions: landing → `useNavigate` into the wizard → MFJ selection → all 4 steps via
Next/Back → every scope badge → a full 10,000-run simulation → all 5 results tabs →
`/scenarios` → `/compare` guard → deep-link refresh → catch-all. Prints a PASS/FAIL list
plus every console and page error.

Exit 0 means clean. **Read the screenshots in `shots/`** — an assertion can pass against a
half-rendered page.

## 4. For icon-library bumps only

Run once per version and diff. `icons.mjs` does an SVG census (counts every `<svg>`, flags
any 0-size or path-less one), crops the icon-dense regions, and dumps raw path geometry.

```bash
# baseline on current main
node .claude/skills/verify-ui/icons.mjs before

# then on the bumped branch
node .claude/skills/verify-ui/icons.mjs after

# compare
diff .claude/skills/verify-ui/out/attrs_before.txt .claude/skills/verify-ui/out/attrs_after.txt
```

Identical counts + zero broken + no geometry diff ⇒ nothing changed. A geometry diff is
*not* automatically a problem: lucide 0.263→1.27 redrew `CircleCheck` and `TrendingUp` from
`<polyline>` to `<path>` with pixel-identical output. Confirm visually before worrying.

## 5. Testing a Dependabot PR properly

Test the PR **merged with main**, not on its own stale base:

```bash
git fetch origin '+refs/pull/N/head:refs/remotes/origin/pr/N'
git checkout -b trial/prN main && git merge --no-edit origin/pr/N
npm install && npm run type-check && npm run lint && npm test && npm run build
# ...then drive it (steps 2–3)
```

Cleanup — **`npm install` dirties `package-lock.json`**, which blocks `git checkout`:

```bash
git checkout -- package-lock.json
git checkout main && git branch -D trial/prN && npm ci
```

Never judge a behind-base PR from `git diff main origin/pr/N` — that shows the diff against
a stale base and will look like it reverts things a real three-way merge preserves.

## Gotchas that will bite you

- **A hard `page.goto()` wipes `InputsContext`.** Filing status isn't persisted, so jumping
  straight to `/wizard/3` silently reverts to single-filer and every MFJ badge vanishes.
  Move between steps with the **Next** button.
- **Results live in memory only.** Refreshing `/results` correctly bounces to `/wizard/1`
  ([ResultsPage.tsx:47](../../../src/pages/ResultsPage.tsx#L47)). Assert the guard; don't
  fight it.
- **`/compare` needs `?a=&b=`.** Bare `/compare` correctly bounces to `/scenarios`
  ([ComparisonPage.tsx:25](../../../src/pages/ComparisonPage.tsx#L25)).
- **The wizard has 4 steps**, not 6 — landing-page copy and `/wizard/7` references
  elsewhere are stale.
- **The simulation takes seconds.** Wait for `[role="tablist"]` with a 60s timeout, not a
  fixed delay.
- Radix tabs don't expose `value` on `[role="tab"]`; select by index.

## Stopping

```bash
lsof -ti:5175 -sTCP:LISTEN | xargs kill
```
