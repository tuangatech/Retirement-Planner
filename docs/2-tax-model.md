# Tax Model

This is the single reference for how the simulator models taxes, the constants it uses
(and where they come from), what it deliberately does **not** model, and the roadmap for
**married-filing-jointly (MFJ)** and **per-state income-tax** support.

Implementation lives in [`src/lib/calculations/taxes.ts`](../src/lib/calculations/taxes.ts)
and is applied per year in [`yearlyProjection.ts`](../src/lib/calculations/yearlyProjection.ts).
It is independently re-checked by [`scripts/verify_plan.py`](../scripts/verify_plan.py).

## How taxes are computed each year

1. **Taxable Social Security — provisional-income formula (IRC §86).**
   `calculateTaxableSocialSecurity()` computes provisional income = (all AGI items except
   SS) + ½ of SS benefits, then applies the tiered 0% / up-to-50% / up-to-85% formula.
   The result is capped at the user's `taxablePercentage` setting (default 0.85, the
   statutory max). A user may lower it to approximate a state SS exemption.

2. **Standard-deduction "tax-free floor."** `calculateStandardDeduction()` = base
   standard deduction + age-65 addition (once age ≥ 65) + the 2025–2028 OBBBA senior
   bonus. The base + age-65 portion is scaled by general inflation from retirement (the
   standard deduction is inflation-indexed in reality); the senior bonus is applied flat
   and only through its sunset year. The SS provisional thresholds are **not** inflated —
   they're statutorily frozen, which is what gradually pulls more SS into tax over time
   (the "tax torpedo").

3. **Taxable base.** taxable SS + pensions + part-time work + rental + tax-deferred
   withdrawals + brokerage **gain** portion (`withdrawal × (1 − costBasis)`) + non-medical
   HSA withdrawals (age 65+). Roth withdrawals and HSA-for-healthcare are never taxed.

4. **Marginal rate above the floor.** The deduction is subtracted from the taxable base
   (fixed income first, remainder shields withdrawals), and the user's
   `combinedEffectiveRate` is applied to what's left. Because deductions and the SS
   formula are modeled explicitly, this rate is a **marginal (bracket-ish) rate**, not a
   blended effective rate — default **12%**.

5. **Payroll tax** (7.65% FICA) applies only to part-time work income, separately.

6. **Withdrawal gross-up** still sizes withdrawals at the flat rate (conservative); any
   resulting over-withdrawal surplus is reinvested to the taxable account in
   `yearlyProjection.ts` so no cash leaks.

## Constants (`TAX_RULES` in `taxes.ts`)

> ⚠️ These are year-specific (approx. 2025/2026 federal law). **Review annually** and keep
> `scripts/verify_plan.py`'s `TAX_RULES` in sync with the TypeScript source.

| Constant | Single | MFJ | Source |
|---|---|---|---|
| Base standard deduction (2026) | $16,100 | $32,200 | [Tax Foundation](https://taxfoundation.org/data/all/federal/2026-tax-brackets/), [IRS Rev. Proc. 2025-32](https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill) |
| Additional standard deduction, age 65+ (2026) | $2,050 | $1,650 / spouse | [Kiplinger](https://www.kiplinger.com/taxes/new-tax-deduction-change-over-65) |
| OBBBA senior bonus (2025–2028) | $6,000 / person | $6,000 / person | [National Tax Tools](https://nationaltaxtools.com/guides/senior-standard-deduction-obbba/) |
| SS provisional thresholds (frozen) | $25,000 / $34,000 | $32,000 / $44,000 | [Congress.gov CRS RL32552](https://www.congress.gov/crs-product/RL32552) |
| SS max taxable fraction | 85% | 85% | IRC §86 |

The code uses the **2026** values above (base $16,100 single / $32,200 MFJ; age-65
addition $2,050 single / $1,650 per spouse). Review and bump these each tax year; the
model is otherwise year-agnostic.

## Verified reference: the "Zero Tax Bill" scenario

`docs/zero-tax-bill-georgia-retiree.pdf` describes a Georgia MFJ couple (both 65+) with $80,400 gross
income owing $0 federal and $0 Georgia tax. Its reasoning was verified against current
2026 sources and is **accurate**:

- 2026 MFJ standard deduction $32,200 + $1,650/spouse = $35,500 (both 65+).
- OBBBA senior bonus $6,000/person, 2025–2028, phase-out above $150k MFJ.
- SS provisional thresholds MFJ $32k/$44k, frozen since 1983/1993.
- 2026 0% long-term capital-gains bracket up to $98,900 taxable income (MFJ).
- RMD age 73 (born 1951–1959) / 75 (born 1960+) under SECURE 2.0.
- Georgia exempts 100% of Social Security (doesn't count toward the cap) and up to
  $65,000/person of retirement income at 65+; flat rate 4.99% in 2026.

Sources: [Tax Foundation](https://taxfoundation.org/data/all/federal/2026-tax-brackets/),
[IRS Rev. Proc. 2025-32](https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill),
[Congress.gov CRS](https://www.congress.gov/crs-product/RL32552),
[Kiplinger — capital gains](https://www.kiplinger.com/taxes/irs-updates-capital-gains-tax-thresholds),
[IRS — RMDs](https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs),
[Georgia DoR](https://dor.georgia.gov/retirement-income-exclusion).

The tool now reproduces this qualitatively for a comparable **single** Georgia retiree
(SS mostly untaxed; withdrawals largely shielded by the deduction floor). Exact $0 parity
requires MFJ support (below).

## What is NOT modeled (simplifications)

- Full 10–37% progressive brackets — a single flat marginal rate is used above the floor.
- 0% / 15% / 20% long-term capital-gains brackets — brokerage gains are taxed at the flat rate.
- Itemized deductions, tax credits, and the OBBBA senior-bonus MAGI phase-out.
- State-specific rules (SS exemptions, retirement-income exclusions) — the flat rate is the
  user's approximation of combined federal + state. **Per-state modules (FL/TX/GA first) are
  on the roadmap below.**
- **Filing status: single only** today. **Two-person MFJ is the next phase** — see the roadmap.

## Roadmap

The model is expanding along two axes decided in planning: **married-filing-jointly (MFJ)**
as a first-class filing status, and **per-state income-tax modules** (starting with Georgia).
Both are sequenced below.

### Locked-in scope (planning decisions)

- **MFJ = two-person, no survivor penalty.** Model a spouse's age and Social Security plus
  the MFJ tax parameters, and assume **both spouses are alive through the shared
  life-expectancy horizon**. The survivor's penalty is deferred to Phase 3.
- **Accounts are pooled.** One combined set of accounts and **one representative RMD age (the
  older spouse's)** — spouses do not hold separately tracked balances. Documented as a
  simplification both here and on the Disclosures page.
- **State scope: FL, TX, GA first.** NY/CA deferred — their graduated bracket tables (per
  filing status, per year) are the real maintenance cost. Every other state keeps today's
  manual "fold state into your marginal rate" behavior.

### Phase 1 — Two-person MFJ (federal)

The federal MFJ *constants* already exist in `TAX_RULES` (doubled standard deduction,
`$32k/$44k` SS thresholds, per-spouse senior bonus) and `filingStatus` is already threaded
through `taxes.ts` → `withdrawals.ts` → `yearlyProjection.ts`. What's missing is modeling
the *second person*:

- **Filing-status + spouse inputs** in the wizard (Step 1): a Single/MFJ selector; when MFJ,
  a spouse age and spouse Social Security (benefit at FRA, claiming age, COLA).
- **Two SS streams.** `income.ts` computes the spouse's benefit from the spouse's age and
  claiming age and sums both benefits before the provisional-income formula (one combined
  `taxablePercentage` cap). The earnings test applies to the working spouse only.
- **Per-spouse senior additions.** `calculateStandardDeduction` takes a senior *count* (0/1/2)
  derived from the two ages, so the age-65 addition and OBBBA senior bonus phase in per spouse.
- **RMD.** RMDs are modeled to begin at a **flat age 75** (`RMD_START_AGE` in `rmd.ts`).
  Under SECURE 2.0 the start age is 75 for anyone **born 1960 or later**; this tool's
  audience is the **FIRE community**, who are essentially all born after 1960, so we use a
  flat 75 rather than asking for a birth year — which keeps the tool **age-relative** (it
  cares only about your retirement age and balances, not the calendar). Born 1951–1959 would
  be age 73; that cohort is largely already retired and outside the audience, so it is not
  modeled. For a couple, accounts are **pooled**: there is one combined tax-deferred balance
  and **one household RMD**, triggered when the **older spouse** reaches 75, applying that
  age's Uniform-Lifetime divisor to the whole pool. This slightly **over-distributes** during
  a large spousal age gap (the younger spouse's share is forced out before their own age 75)
  — a small, conservative bias (taxable income pulled forward; the excess is reinvested to the
  taxable account). Accurate per-spouse RMD timing would require separate per-spouse balances
  (deferred with the rest of the pooled-account simplification).
- **Disclosures + docs.** Surface the pooled-accounts / one-RMD-age and no-survivor-penalty
  simplifications, and make the "single filer only" copy conditional on the selected status.

Simplifications (disclosed): pooled accounts with one RMD age; both spouses assumed alive to
the shared horizon (no survivor penalty, no mortality model); the spouse has no separate
part-time, pension, or HSA inputs in this phase.

### Phase 2 — Per-state income-tax modules (FL / TX / GA)

State taxation of retirees varies along six axes — this is the maintenance surface:

1. **Whether there is an income tax at all** (FL, TX: none).
2. **Rate structure** — flat (GA) vs graduated brackets that differ by filing status (NY, CA).
3. **Social Security treatment** — GA/NY/CA all exempt it, but ~9 states tax some.
4. **Retirement-income exclusion** — amount, per-person vs per-return, age threshold, and
   source-dependence (NY splits government vs private pensions; GA lumps most together; CA
   excludes nothing).
5. **State standard deduction / exemptions.**
6. **Capital-gains treatment** — CA taxes long-term gains as ordinary income.

| State | Income tax | SS | Retirement exclusion | Rate (2026) | Effort |
|---|---|---|---|---|---|
| FL | none | — | — | 0% | trivial |
| TX | none | — | — | 0% | trivial |
| GA | flat | exempt | $65k/person 65+ ($35k 62–64) | 4.99% (HB 463) | low |
| NY | graduated | exempt | govt pension 100%; private/IRA $20k/person 59½+ | 4–10.9% | high (deferred) |
| CA | graduated | exempt | none | 1–13.3% | high (deferred) |

**Architecture:** a small registry under `src/lib/calculations/stateTax/`, one file per modeled
state, with a common signature `computeStateTax(components, ages, filingStatus, year) →
{ tax, modeled }`. FL/TX return `0`; GA implements the SS exemption + per-person
retirement-income exclusion + GA standard deduction + flat rate. Unmodeled states fall back to
the manual-rate behavior, so we never maintain all 50. Each module carries a
`// review annually (YYYY law)` note and is mirrored in `verify_plan.py`. When a module is
active, the Step 6 rate is treated as **federal-only** and the state guidance changes to
"computed automatically."

**New per-year output:** a `taxes.stateTax` field kept separate from federal tax for
transparency in the Annual Breakdown. Touch points: `yearlyProjection.ts`, the
`YearlyProjection.taxes` shape, `AnnualTable`, the cash-flow chart, `exportVerification.ts`,
`verify_plan.py`, and tests.

**Disclosures:** show the selected state's modeled rules in the existing Disclosures/Assumptions
panel (not a new page) — GA renders "SS exempt / $65k per person 65+ / 4.99% flat (2026 GA law,
review annually)"; FL/TX render "no state income tax"; unmodeled states keep the manual-rate note.

GA 2026 sources: [HB 463 — 4.99% flat](https://www.countrytaxcalc.com/tax-calculator/usa/georgia/),
[retirement-income exclusion](https://brevy.com/financial/georgia/retirement-income-tax),
[Georgia DoR](https://dor.georgia.gov/retirement-income-exclusion).

### Phase 3 — Survivor's ("widow's") penalty (deferred)

The hard part, and why MFJ is multi-phase. On the first spouse's death, filing switches
**MFJ → single** the following year: the standard deduction roughly halves, brackets compress,
IRMAA thresholds nearly halve, and one Social Security benefit stops (the survivor keeps the
larger of the two). Household income falls while the tax rate rises — a large, real
late-retirement effect that requires a **mortality / first-death model** to place in time.
Touch points: `yearlyProjection.ts` (filing-status transition on first death), `income.ts`
(survivor benefit), and the mortality model.

References: [CNBC — survivor's penalty](https://www.cnbc.com/2026/05/15/survivors-penalty-spouse-dies.html),
[Hartford Funds](https://www.hartfordfunds.com/practice-management/client-conversations/financial-planning/when-a-spouse-dies-the-surviving-partner-may-face-a-surprise-tax-penalty.html).
