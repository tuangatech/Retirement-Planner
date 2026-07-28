# Federal Tax Model

This is the single reference for how the simulator models **federal** income tax, the
constants it uses (and where they come from), and what it deliberately does **not** model.
Per-state income tax is a separate model with its own constants and annual-review cycle —
see [`5-state-tax-model.md`](5-state-tax-model.md).

Implementation lives in [`src/lib/calculations/taxes.ts`](../src/lib/calculations/taxes.ts)
and is applied per year in [`yearlyProjection.ts`](../src/lib/calculations/yearlyProjection.ts).
It is independently re-checked by [`scripts/verify_plan.py`](../scripts/verify_plan.py).

## How taxes are computed each year

1. **Taxable Social Security — provisional-income formula (IRC §86).**
   `calculateTaxableSocialSecurity()` computes provisional income = (all AGI items except
   SS) + ½ of SS benefits, then applies the tiered 0% / up-to-50% / up-to-85% formula.
   The result is capped at the user's `taxablePercentage` setting (default 0.85, the
   statutory max). In an **unmodeled** state a user may lower it to approximate a state SS
   exemption; in a **modeled** state it is a federal-only cap, because the state module
   already exempts SS and lowering it would exempt the benefit twice
   ([`5-state-tax-model.md`](5-state-tax-model.md) §2, Rule 2).

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

6. **Withdrawal gross-up** solves `gross − tax(gross) = need` against the *incremental* tax the
   draw causes, plus the state marginal rate when a state module is active. This matters because
   the marginal rate is **not** the headline rate: it is 0% inside the deduction floor, rises to
   as much as **1.85×** the headline rate while the provisional-income formula is pulling Social
   Security into tax, then falls back once SS hits its 85% cap. A flat rate was previously used
   here and described as "conservative", which was backwards — it *under*-withdrew by ~$8,700 per
   run over a retirement, letting the plan spend money it never took out and flattering the
   success rate by roughly half a point. Any remaining over-withdrawal surplus is reinvested to
   the taxable account in `yearlyProjection.ts` so no cash leaks.

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
  $65,000/person of retirement income at 65+; flat rate 4.99% in 2026 (HB 463). Georgia
  constants and their primary sources now live in [`5-state-tax-model.md`](5-state-tax-model.md).

Sources: [Tax Foundation](https://taxfoundation.org/data/all/federal/2026-tax-brackets/),
[IRS Rev. Proc. 2025-32](https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill),
[Congress.gov CRS](https://www.congress.gov/crs-product/RL32552),
[Kiplinger — capital gains](https://www.kiplinger.com/taxes/irs-updates-capital-gains-tax-thresholds),
[IRS — RMDs](https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs),
[Georgia DoR — retirement income exclusion](https://dor.georgia.gov/retirement-income-exclusion),
[Georgia DoR — important tax updates (2026 rate)](https://dor.georgia.gov/taxes/important-tax-updates).

**Georgia side: reproduced exactly.** With MFJ and the Georgia module both shipped, the couple's
$80,400 — $43,200 of it Social Security — owes **$0 Georgia tax**: SS is exempt, and the
remaining $37,200 sits inside their $130,000 combined retirement exclusion. This is pinned by a
regression test in [`stateTax.test.ts`](../src/lib/calculations/stateTax.test.ts).

**Federal side: still not exactly $0**, and the reason is a documented limitation rather than a
missing feature. The PDF's federal zero leans on the **0% long-term capital-gains bracket** in
the list above, which this tool does not model — brokerage gains are taxed at the flat marginal
rate. Take the couple's non-SS $37,200 as *tax-deferred* withdrawals instead and the federal bill
is **$993.60**: taxable SS $18,580 + withdrawals $37,200 = $55,780 against a $47,500 deduction,
taxed at 12%. Also pinned by a test ([`taxes.test.ts`](../src/lib/calculations/taxes.test.ts)),
so the gap stays visible rather than being rediscovered. The qualitative result holds — SS mostly
untaxed, withdrawals largely shielded by the deduction floor — and closing it fully means
modeling the LTCG brackets, not fixing a bug.

## What is NOT modeled (simplifications)

- Full 10–37% progressive brackets — a single flat marginal rate is used above the floor.
- 0% / 15% / 20% long-term capital-gains brackets — brokerage gains are taxed at the flat rate.
- Itemized deductions, tax credits, and the OBBBA senior-bonus MAGI phase-out.
- State-specific rules **outside the ten modeled states** (the nine with no individual income
  tax, plus Georgia) — there, the flat rate remains the user's approximation of combined federal
  + state. Inside a modeled state the engine computes state tax and this rate is federal-only.
  See [`5-state-tax-model.md`](5-state-tax-model.md); Virginia is designed but not yet built.

## Roadmap

The federal model expands along one remaining axis: the **survivor's penalty** (Phase 3).
Phase 1 (two-person MFJ) has shipped. **Per-state income tax moved to its own document** —
see [`5-state-tax-model.md`](5-state-tax-model.md) for the per-state design, constants, and
annual-review procedure; the nine no-income-tax states and Georgia are live, Virginia is next.

### Locked-in scope (planning decisions)

- **MFJ = two-person, no survivor penalty.** Model a spouse's age and Social Security plus
  the MFJ tax parameters, and assume **both spouses are alive through the shared
  life-expectancy horizon**. The survivor's penalty is deferred to Phase 3.
- **Accounts are pooled.** One combined set of accounts and **one representative RMD age (the
  older spouse's)** — spouses do not hold separately tracked balances. Documented as a
  simplification both here and on the Disclosures page.

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

### Phase 2 — Per-state income-tax modules (moved, partly shipped)

This phase now has its own document: [`5-state-tax-model.md`](5-state-tax-model.md). It
covers the per-state scope, the verified constants with primary sources, the rules-data schema,
how state tax threads into the withdrawal engine, and the annual-review procedure. It is
versioned separately because it is re-verified every year, per state. Shipped so far: the nine
no-income-tax states and Georgia; Virginia is specified but not yet built.

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
