## What & why

<!-- What does this change, and what problem does it solve? Link the issue if there is one. -->

Closes #

## How I verified it

<!-- Be specific. "Ran the tests" is less useful than "added a regression test for the age-65
     HSA case that failed before this change". -->

## Checklist

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes (no new errors)
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Scope is tight — every changed line traces to the purpose above

### If this touches `src/lib/calculations/` or the worker

- [ ] Added or updated tests, including a case that would have failed before this change
- [ ] Determinism intact — still exactly **two `rng()` calls per simulated year**, same seed +
      inputs ⇒ identical results
- [ ] Calculation modules stayed pure — no I/O, React, globals, `Date.now()`, or `Math.random()`
- [ ] Ran `python3 scripts/verify_plan.py` on a fresh export and noted the result above
- [ ] Considered saved scenarios: results are recomputed from stored inputs, so this change alters
      what existing saved scenarios report — described below if so

### If this changes the model or its limitations

- [ ] Updated the relevant file in `docs/` (tax constants cite an IRS/SSA/CMS source)
- [ ] Updated the Disclosures tab (`AssumptionsPanel.tsx`) so the simplification is disclosed
- [ ] UI copy doesn't imply a benefit the user won't actually get

## Notes for the reviewer

<!-- Anything you're unsure about, deliberately left out, or want pushback on. -->
