# Withdrawal Strategy

How the simulator decides where each year's money comes from, why, and how it could be
made more tax-efficient. Implementation:
[`src/lib/calculations/withdrawals.ts`](../src/lib/calculations/withdrawals.ts) and
[`yearlyProjection.ts`](../src/lib/calculations/yearlyProjection.ts).

## What the app does today

Each year, after income (Social Security, pensions, work, rental) is applied, the tool
covers the remaining cash-flow gap (expenses + taxes − income) in this fixed order:

1. **HSA first, for healthcare** — tax-free at any age. If `allowNonMedicalAfter65` is on,
   HSA can also cover general expenses after 65 (taxed as ordinary income).
2. **RMDs (age 73+)** — the required amount is forced out of the tax-deferred account even
   if not needed; any after-tax excess is reinvested into the taxable account.
3. **The rest, by `priorityOrder`** — default **taxable → tax-deferred → Roth**. Each
   withdrawal is "grossed up" so the after-tax proceeds meet the need (tax-deferred fully
   taxable; taxable taxed on the gain portion only; Roth tax-free).
4. **Surplus** (income above spending, or forced-RMD excess) is reinvested into taxable.

Taxes are computed with the provisional-income Social Security formula and a
standard-deduction floor (see [`docs/2-tax-model.md`](2-tax-model.md)).

### Why this default

The default order is the **conventional rule of thumb**: spend the taxable (already-taxed)
account first, let the tax-advantaged accounts keep compounding, and save tax-free Roth
for last. It's simple, defensible, and typically makes a portfolio last a few years longer
than spending retirement accounts first ([Fidelity](https://www.fidelity.com/viewpoints/retirement/tax-savvy-withdrawals),
[TIAA Institute](https://www.tiaa.org/public/institute/publication/2006/tax-efficient-sequencing-accounts-tap)).

### Known limitations of the current model

- **Strict sequencing, not tax-aware.** It empties one bucket before touching the next
  rather than choosing the source that minimizes *lifetime* tax. Research consistently
  finds a blended/tax-bracket-aware approach beats rigid ordering
  ([Morningstar](https://www.morningstar.com/retirement/retirement-withdrawal-sequencing-rules-road),
  [T. Rowe Price](https://www.troweprice.com/personal-investing/resources/insights/tax-efficient-retirement-withdrawal-strategies.html)).
- **No Roth conversions.** The single biggest lever for this tool's audience (see below)
  isn't modeled.
- **"Roth last" can backfire.** Deferring all tax-deferred spending grows the balance that
  later drives large RMDs — the "tax torpedo" that pushes 85% of Social Security into tax
  and can bump IRMAA ([Motley Fool](https://www.fool.com/retirement/2026/03/31/roth-conversions-rmds-and-the-tax-torpedo-a-retire/)).
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
