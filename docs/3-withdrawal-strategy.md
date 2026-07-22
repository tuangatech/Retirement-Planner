# Withdrawal Strategy

How the simulator decides where each year's money comes from, why, and how it could be
made more tax-efficient. Implementation:
[`src/lib/calculations/withdrawals.ts`](../src/lib/calculations/withdrawals.ts) and
[`yearlyProjection.ts`](../src/lib/calculations/yearlyProjection.ts).

## What the app does today

The user picks a **strategy** on the "Withdrawal Strategy" wizard step (after Tax); it
defaults to **Tax-smart sequencing**. Each year, after income (Social Security, pensions,
work, rental) is applied, the tool covers the remaining cash-flow gap
(expenses + taxes − income) in this order:

1. **HSA first, for healthcare** — tax-free at any age. If `allowNonMedicalAfter65` is on,
   HSA can also cover general expenses after 65 (taxed as ordinary income).
2. **RMDs (age 73+)** — the required amount is forced out of the tax-deferred account even
   if not needed; any after-tax excess is reinvested into the taxable account.
3. **Tax-smart fill** *(when strategy ≠ `standard`)* — draw tax-deferred up to the
   standard-deduction floor (≈ tax-free), capped by the spending need. This uses the free
   deduction room every gap year and shrinks future RMDs. Implemented as
   `calculateTaxFreeTaxDeferredRoom()` (which accounts for the SS-torpedo feedback) in
   [`taxes.ts`](../src/lib/calculations/taxes.ts).
4. **The rest, by `priorityOrder`** — default **taxable → tax-deferred → Roth**. Each
   withdrawal is "grossed up" so the after-tax proceeds meet the need (tax-deferred fully
   taxable; taxable taxed on the gain portion only; Roth tax-free).
5. **Surplus** (income above spending, or forced-RMD excess) is reinvested into taxable.

The available strategies are **Standard order** (steps skip #3), **Tax-smart sequencing**
(default), and **Gap-year Roth conversions** (Advanced — documented below, not yet wired).
Taxes are computed with the provisional-income Social Security formula and a
standard-deduction floor (see [`docs/2-tax-model.md`](2-tax-model.md)).

### Why tax-smart is the default

Plain `taxable`-first is the conventional rule of thumb — spend the already-taxed account
first, let tax-advantaged accounts compound, save Roth for last
([Fidelity](https://www.fidelity.com/viewpoints/retirement/tax-savvy-withdrawals),
[TIAA Institute](https://www.tiaa.org/public/institute/publication/2006/tax-efficient-sequencing-accounts-tap)).
But deferring *all* tax-deferred spending grows the balance that later drives large RMDs —
the "tax torpedo" that pushes 85% of Social Security into tax
([Motley Fool](https://www.fool.com/retirement/2026/03/31/roth-conversions-rmds-and-the-tax-torpedo-a-retire/)).
Tax-smart sequencing keeps the conventional order but first *uses the standard-deduction
floor every gap year* with near-tax-free tax-deferred draws, which research consistently
finds beats rigid ordering
([Morningstar](https://www.morningstar.com/retirement/retirement-withdrawal-sequencing-rules-road),
[T. Rowe Price](https://www.troweprice.com/personal-investing/resources/insights/tax-efficient-retirement-withdrawal-strategies.html)).
In the unit-tested gap-year scenario it cut lifetime tax by ~$35k and left ~$256k more behind
vs. standard.

### Known limitations of the current model

- **Fill capped at the spending need.** Tax-smart sequencing never draws tax-deferred
  *beyond* what's needed for spending, so leftover deduction room in very-low-spend years
  goes unused — filling that gap is the Roth-conversion tier (below), not yet built.
- **No Roth conversions.** The Advanced tier (converting past the spending need) is
  documented but not yet implemented.
- **Fixed cost basis.** The taxable account's cost-basis % is held constant instead of
  rising as gains are realized.

## Suggestions (research-backed)

Split into things a **user** can do with today's tool and things the **app** could add.

### For users, with the tool as-is

- **Use the "gap years."** Between retirement and RMD age (73/75) — often 5–12 years —
  taxable income is usually low. This is the sweet spot to realize tax-deferred income
  cheaply ([Fourthought](https://fourthought.com/roth-conversions-before-rmds-using-the-gap-years-wisely/)).
  You can approximate this by setting the withdrawal order to **tax-deferred first** during
  those years, or by modeling a scenario that draws tax-deferred down early.
- **Delay Social Security to increase the gap.** Claiming later (up to 70) leaves more
  low-income years for cheap tax-deferred withdrawals/conversions and raises the eventual
  (partly-untaxed) benefit.
- **Compare scenarios.** Use the Scenarios/Compare feature to test different `priorityOrder`
  choices and claiming ages against the success rate and lifetime tax.

### For the app (future enhancements)

1. **Roth conversion modeling (highest value).** Let the user convert a target amount (or
   "fill to the top of the X% bracket") from tax-deferred to Roth during the gap years.
   This is the dominant recommendation across the literature for this demographic
   ([Fourthought](https://fourthought.com/roth-conversions-before-rmds-using-the-gap-years-wisely/),
   [Motley Fool](https://www.fool.com/retirement/2026/03/31/roth-conversions-rmds-and-the-tax-torpedo-a-retire/)).
   Requires care: a conversion raises provisional income and can trigger the SS tax
   torpedo and a two-year-lagged IRMAA surcharge.
2. **Bracket-fill / tax-aware sequencing.** Instead of strict order, draw tax-deferred up
   to a target taxable-income ceiling (e.g., top of the 12% bracket), then switch to
   taxable/Roth for the remainder. Would need the tax model to expose a bracket ceiling.
3. **Proportional withdrawals.** Draw from taxable and tax-advantaged roughly in
   proportion to smooth the tax bracket across retirement — a common middle ground
   ([Boldin](https://www.boldin.com/retirement/order-of-accounts-for-retirement-withdrawals/)).
4. **IRMAA / SS-torpedo awareness.** Surface when a year's withdrawals push provisional
   income across a Social Security taxability tier or a Medicare IRMAA threshold.

These are listed roughly in value order; #1 (Roth conversions) is the natural next feature
and pairs directly with the provisional-income tax model already in place.

---

## Plan: guided withdrawal-strategy wizard step

**Status:** Simple + **Medium (Tax-smart, default) shipped**; Advanced (Roth conversions)
still proposed. Goal: make the budget last longer by cutting
*lifetime* tax — the only controllable leakage in this model — while keeping the choice
understandable. Instead of one hidden engine default, offer a short spectrum of named
strategies (simple → complex) and default to the sensible middle.

### Design principle

This is a **simulator, not a to-do list.** Each strategy is applied automatically by the
engine; the user is not executing withdrawals year by year. So each strategy is described
by *what the simulator does*, with a smaller *in real life* note for the actions and
caveats a person would actually face (and which the tool does not model).

### The three tiers

| Tier | Name | What the simulator does | In real life | Best for |
|---|---|---|---|---|
| Simple | **Standard order** | Spend `taxable → tax-deferred → Roth`. The conventional rule of thumb (today's default). | Nothing special. | "Keep it simple," or a baseline to compare against. |
| **Medium — DEFAULT** | **Tax-smart sequencing** | Each gap year, draw tax-deferred up to the standard-deduction floor (≈ tax-free), then taxable, then Roth. Uses the free room every year and shrinks future RMDs. | Nothing to do — it just mirrors a sensible draw order. | Most users. Automatic, no inputs. |
| Advanced | **Gap-year Roth conversions** | Tax-smart sequencing **plus** convert extra tax-deferred → Roth up to a ceiling you set, during the low-income gap years. | Execute conversions with your custodian by Dec 31; watch the ACA subsidy cliff (pre-65) and the 2-year-lagged IRMAA surcharge. | Larger tax-deferred balances; users comfortable with IRMAA/ACA trade-offs. |

**Default = Medium.** Roth conversions are the highest-ceiling strategy but require a user
parameter and carry real-world caveats the tool does not model (ACA premium subsidies, the
IRMAA lookback), so they are opt-in rather than the default.

Dropped on purpose: **proportional withdrawals.** In this flat-rate-above-a-floor tax model
it is a smoothing heuristic that is generally tax-inferior to filling the deduction floor,
so it adds a choice without a clear win.

### Retirement timeline & milestones (illustrative retirement age 58)

```
        58         63          65           67            70          73
  ───────●──────────●───────────●────────────●─────────────●───────────●───────▶ life exp.
      RETIRE     IRMAA       MEDICARE      SS at FRA      SS max       RMDs
                lookback     Part B/D      (example       delay        BEGIN
                year for     begins        claim age)                  (forced,
                age-65                                                  fully taxed)

  │◄──────────────── GAP YEARS — you control taxable income ────────────────►│
  │◄──── pre-Medicare: ACA premium-subsidy cliff in play ────►│
  │◄─────────────── prime Roth-conversion runway ──────────────────►│
                                          (runway shrinks if you claim SS earlier)
```

**What each strategy is doing before each milestone:**

- **Before 65 (Medicare starts).** These are usually the lowest-income years and the best
  time to draw down or convert tax-deferred. *Caveats the simulator does not model:* on an
  ACA plan, large conversions/withdrawals can forfeit the premium subsidy; and income in the
  year you turn **63** sets your **age-65 IRMAA** Medicare-premium surcharge (2-year lookback).
- **Before Social Security starts (any age up to 70).** Social Security is not yet in the
  provisional-income formula, so tax-deferred draws and conversions are cheapest here.
  Delaying SS widens this runway and raises the eventual (partly-untaxed) benefit.
- **Before 73 (RMDs begin).** Draw the tax-deferred balance down so forced RMDs don't spike
  provisional income into the 85%-taxable Social Security tier (the "tax torpedo"). After 73
  the RMD is forced and this control is gone. (RMD age is 75 for those born 1960+; the engine
  currently uses 73 for everyone.)

### Implementation outline

*(Medium tier below is now implemented; Advanced remains the outline for the next pass.)*

**Engine (Medium tier — the core change).** In `executeWithdrawals`, before the priority
loop, add a *fill-the-free-room* step: compute `freeRoom = ceiling − alreadyTaxableIncome`
(taxable SS via the provisional formula + pensions + part-time + rental + brokerage gain +
any RMD), then draw tax-deferred by `min(remainingNeed, freeRoom, taxDeferredBalance)`.
Default `ceiling` = the year's standard-deduction floor. Handle the torpedo feedback (each
$1 of tax-deferred can add up to $0.85 of taxable SS) with one refinement pass and a slightly
conservative fill. This also lets the gross-up become floor-aware, reducing the over-withdrawal
that the "reinvest surplus" patch in `yearlyProjection.ts` currently absorbs.

**Engine (Advanced tier — Roth conversions).** Add a conversion step in `yearlyProjection`:
in gap years, convert tax-deferred → Roth up to the user's ceiling beyond the spending need,
paying the tax from the taxable account, and feed the conversion into provisional income.

**Types & defaults.** Extend `withdrawalStrategy` in `src/types/index.ts` with
`strategy: 'standard' | 'tax_smart' | 'roth_conversion'` (default `'tax_smart'`) and an
optional `conversionCeiling?: number`. Keep `priorityOrder` as the fall-through order (and the
`'standard'` behavior). Engine reads the new field with a `?? 'tax_smart'` fallback, so saved
scenarios (inputs-only, recomputed on load) adopt the new default with no migration.

**UI.** A dedicated **"Withdrawal strategy"** wizard step showing the three cards
(name + "what the simulator does" + "in real life" + "best for") and the milestone diagram,
defaulting to Medium; the Advanced card reveals a single conversion-ceiling input. (Alternative:
fold into `Step6TaxSettings.tsx` as a prominent card to avoid lengthening the wizard.)

**Tests.** `withdrawals.test.ts`: gap-year fill to the floor, taxable untouched; RMD years
unaffected; `'standard'` reproduces today's order; ceiling override respected; torpedo room
shrinks correctly. `yearlyProjection.test.ts`: longevity/lifetime-tax regression showing
`tax_smart` ≥ `standard`, balances never negative.

**Docs & verification.** Fold shipped tiers into "What the app does today"; confirm
`scripts/verify_plan.py` (cash-flow identity, not ordering) stays green on a fresh bundle.
