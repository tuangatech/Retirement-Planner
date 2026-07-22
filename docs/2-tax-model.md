# Tax Model

This is the single reference for how the simulator models taxes, the constants it uses
(and where they come from), what it deliberately does **not** model, and the roadmap for
married-filing-jointly (MFJ) support.

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
- State-specific rules (SS exemptions, retirement-income exclusions). The flat rate is the
  user's approximation of combined federal + state.
- **Filing status: single only.** See the MFJ roadmap below.

## Roadmap: married filing jointly (MFJ)

MFJ is a multi-part feature, not a filing-status dropdown. It requires:

- **Two people** — separate ages, life expectancies, Social Security benefits and claiming
  ages (plus survivor-benefit rules), and separate tax-deferred accounts with **per-spouse
  RMD ages** keyed to each birth year (73 vs 75 under SECURE 2.0).
- **MFJ tax parameters** — doubled standard deduction, per-spouse age-65 addition and
  senior bonus, and MFJ SS thresholds ($32k/$44k). This part is straightforward and
  already parameterized by `filingStatus` in `taxes.ts`.
- **The survivor's ("widow's") penalty — the hard part.** On the first spouse's death,
  filing switches **MFJ → single** the following year: the standard deduction roughly
  halves, brackets compress, IRMAA thresholds nearly halve, and one Social Security
  benefit stops (the survivor keeps the larger of the two). Household income falls while
  the tax rate rises — a large, real late-retirement effect that a couples model must
  capture. It interacts directly with the mortality assumption (which spouse dies, and when).

Likely touch points if built: the wizard (spouse inputs + filing status),
`income.ts` (two SS streams + survivor benefit), `withdrawals.ts` / `rmd.ts` (per-spouse
RMDs), `yearlyProjection.ts` (filing-status transition on first death), and a
mortality / first-death model. Treat as a multi-phase effort.

References: [CNBC — survivor's penalty](https://www.cnbc.com/2026/05/15/survivors-penalty-spouse-dies.html),
[Hartford Funds](https://www.hartfordfunds.com/practice-management/client-conversations/financial-planning/when-a-spouse-dies-the-surviving-partner-may-face-a-surprise-tax-penalty.html).
