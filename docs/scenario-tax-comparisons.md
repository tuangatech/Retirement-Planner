# Scenario tax comparisons

Worked examples that run one household's income profile through this app's actual tax engine
(`calculateTotalTaxes` in `taxes.ts`, `computeStateTax` in `stateTax.ts`) and compare the result
across several states side by side. All figures use tax year **2026** — the standard deduction,
OBBBA senior bonus, Social Security provisional-income thresholds, and state bracket/exclusion
constants currently committed in `taxes.ts` and `stateTaxRules.json`.

Add new situations as new `## Situation N` sections, computed on the live
[State Tax Comparison page](https://retirement-planner-blond.vercel.app/state-tax-comparison)
(see "How to run this comparison" below). This is a living document — numbers here reflect
whatever was entered on that page, not a fixed historical record.

---

## Situation 1: MFJ couple, ages 68 & 66

| Income source | Annual amount | Taxable? |
|---|---|---|
| Social Security (both spouses combined) | $43,200 | Partially — via the federal provisional-income formula |
| 401(k)/traditional IRA distribution | $14,000 | Yes — ordinary income |
| Long-term capital gains (brokerage) | $6,000 | Yes — gain |
| Qualified dividends | $1,200 | Yes — taxed the same as the gain above in this engine |
| Brokerage cost basis withdrawn | $8,000 | No — return of principal, never income |
| Roth IRA distribution (qualified) | $12,000 | No — by law (IRC §408A), not an engine gap |
| HSA withdrawal (qualified medical) | $9,000 | No — by law (IRC §223), not an engine gap |
| **Total gross cash flow** | **$93,400** | |

**On the $8,000 cost basis**: a brokerage withdrawal is composed of gain plus a return of the
money originally invested (cost basis). Only the gain is income — withdrawing your own principal
back is never taxed. Here the household withdraws $14,000 total from the brokerage account
($6,000 gain + $8,000 basis); the engine needs that split to tax only the $6,000.

### Income composition and engine mapping

Neither this engine's federal model nor any modeled state gives long-term capital gains or
qualified dividends a preferential rate over ordinary income (see caveats below), so LTCG and
dividends are combined into one taxable "brokerage gain" figure — this loses no fidelity versus
treating them separately.

| Component | Engine field | Value used |
|---|---|---|
| Social Security | `income.socialSecurity` | $43,200 |
| 401(k)/IRA distribution | `withdrawals.taxDeferred` / `taxDeferredWithdrawals` | $14,000 |
| LTCG + qualified dividends (gain) | `brokerageGains` (state); derived for federal via `costBasisPercentage` | $7,200 |
| Brokerage cost basis | `costBasisPercentage` (federal only — state's `brokerageGains` is already gain-only, so basis is simply never included there) | $8,000 of a $15,200 federal withdrawal input → 52.6% cost basis |
| Roth IRA distribution | — | Always $0 taxable; not entered into any taxable-income field |
| HSA withdrawal | `hsaNonMedicalWithdrawals` / `hsaNonMedicalWithdrawal` | $0 (all $9,000 is qualified medical, so none of it is entered as taxable) |

The $93,400 total above reconciles every dollar in the situation table: $43,200 + $14,000 +
$7,200 (gain) + $8,000 (basis) + $12,000 (Roth) + $9,000 (HSA) = $93,400. Only $43,200 (partially)
and $21,200 ($14,000 + $7,200) are ever taxable anywhere below.

### How to run this comparison

Enter the numbers below on the live
[State Tax Comparison page](https://retirement-planner-blond.vercel.app/state-tax-comparison)
(or locally at `/state-tax-comparison`). It calls the same `calculateTotalTaxes` /
`computeStateTaxDetailed` functions as this document, updates live as you type, and shows all 13
modeled states side by side — not just the three below — each with its own expandable breakdown.

| Field on the page | Value |
|---|---|
| Filing Status | Married filing jointly |
| Your Age / Spouse's Age | 68 / 66 |
| Social Security (household total) | $43,200 |
| 401(k) / Traditional IRA Withdrawal | $14,000 |
| Taxable Investment Income | $7,200 (LTCG + qualified dividends combined) |
| Other Cash Withdrawn | $8,000 (the brokerage cost basis) |
| Roth IRA / 401(k) Distribution | $12,000 |
| HSA Withdrawal (qualified medical checked) | $9,000 |

Government Pension, Private Pension/Annuity, Part-Time Work, and Rental Income are left at $0 for
this situation.

### Results

| | Federal | Georgia | Florida | New York |
|---|---|---|---|---|
| **Tax owed** | **$0** | **$0** | **$0** | **$0** |

### Federal walkthrough

- Non-SS AGI items: $14,000 (401k) + $7,200 (gain + dividends) = **$21,200**
- Provisional income: $21,200 + ½ × $43,200 = **$42,800** → falls in the 50%-tier band ($32,000–$44,000 MFJ)
- Taxable Social Security: min($21,600, 50% × ($42,800 − $32,000)) = **$5,400**
- Standard deduction (2026 MFJ, both spouses 65+): $32,200 base + $1,650 × 2 (age-65 addition) + $6,000 × 2 (OBBBA senior bonus) = **$47,500**
- Taxable income: max(0, $5,400 + $21,200 − $47,500) = **$0** → **federal tax $0**

### Georgia walkthrough

- State AGI: $14,000 + $7,200 = **$21,200** (Social Security is excluded by construction — see caveats)
- Retirement-income exclusion: both spouses 65+ → $65,000 × 2 = $130,000 cap, applied against $21,200 of eligible income (401k + gain, both enumerated categories) → excludes the full **$21,200**
- Taxable income: max(0, $21,200 − $21,200 − $30,000 standard deduction) = **$0** → **Georgia tax $0**

### Florida walkthrough

Florida has no individual income tax. `computeStateTax` returns a genuine, engine-computed
**$0** (`modeled: true`) rather than "not modeled."

### New York walkthrough

- State AGI: same as Georgia's, **$21,200**
- New York's retirement benefit is source-scoped, unlike Georgia's: only the $14,000 401(k)
  distribution is eligible for the private-pension exclusion (brokerage gains and dividends are
  never eligible, regardless of age) — both spouses are 68/66, both ≥ 60 (the app's whole-year
  stand-in for the statutory 59½), so the cap is $20,000 × 2 = $40,000, applied against $14,000
  of eligible income → excludes the full **$14,000**
- New York's standard deduction is fixed by statute at **$16,050 MFJ**
- Taxable income: max(0, $21,200 − $14,000 − $16,050) = max(0, **−$8,850**) = **$0** → **New York tax $0**

New York's benefit doesn't reach the $7,200 of brokerage gain/dividends the way Georgia's
exclusion does, but the $16,050 standard deduction alone still absorbs that remainder here. A
situation with more brokerage income relative to 401(k)/pension income would expose the gap
between Georgia and New York that this one doesn't.

### Caveats specific to this app's engine (not this situation)

- **Federal tax here is a flat-rate approximation, not a real bracket calculation.** This app has
  no ordinary-income bracket table and no 0%/15%/20% LTCG/qualified-dividend preferential rate —
  `calculateTotalTaxes` applies one user-supplied effective tax rate to taxable income above the
  deduction floor. It doesn't affect this situation (taxable income floors at $0 either way), but
  it will matter for any future situation where AGI exceeds the standard deduction.
- Social Security taxation *is* the real IRC §86 provisional-income formula, not an approximation.
- State AGI structurally excludes Social Security for every modeled state (Georgia, Florida, New
  York, and the rest) — there's no explicit "subtract SS" step because SS is simply never added
  to the fields state AGI is built from.
- New York's private-pension exclusion is modeled per person starting at age 60 (whole years only)
  rather than the statutory 59½ — conservative, since it can delay eligibility by up to a year.
- New York City/Yonkers local income tax and Georgia's post-TY2026 contingent rate cuts are not
  modeled (see `docs/5-state-tax-model.md` for the full list of state-tax simplifications).

---

## Terms used in this document

- **AGI (Adjusted Gross Income)** — federal taxable income before deductions: wages, ordinary
  withdrawals, taxable Social Security, and investment gains, minus a small set of above-the-line
  adjustments (none of which this engine models).
- **MFJ (Married Filing Jointly)** — a married couple filing one federal/state return together;
  most of this app's married-couple thresholds and deductions are doubled or per-spouse under MFJ.
- **LTCG (Long-Term Capital Gain)** — profit from selling an investment held over a year. Real IRS
  law taxes LTCG at preferential 0/15/20% rates; this app's engine does not model that preference
  (see caveats).
- **Cost basis** — the original amount invested in an asset. Only the gain above cost basis is
  taxable when the asset is sold or withdrawn; the basis portion is a tax-free return of principal.
- **Provisional income** — the IRS §86 formula that determines how much of Social Security is
  federally taxable: non-SS AGI plus half of the Social Security benefit.
- **Standard deduction** — the flat dollar amount of income exempt from tax before any rate is
  applied, available to every filer regardless of actual expenses. Both the IRS and most states
  that tax income define their own standard deduction.
- **OBBBA senior bonus deduction** — a temporary federal deduction ($6,000/person, age 65+, tax
  years 2025–2028) from the One Big Beautiful Bill Act, on top of the regular standard deduction
  and its age-65 addition.
- **Retirement-income exclusion / pension exclusion** — a state-level subtraction that removes
  some or all retirement income (pensions, 401(k)/IRA withdrawals, sometimes investment income)
  from state taxable income. Georgia's and New York's versions differ in which income types
  qualify and by how much (see the per-state walkthroughs above).
- **State AGI** — this app's shorthand for federal AGI minus federally taxable Social Security,
  which is the starting point every modeled state's calculation builds from.
- **HSA non-medical withdrawal** — money taken out of a Health Savings Account for something other
  than qualified medical expenses; taxable as ordinary income after age 65. Withdrawals for
  qualified medical expenses are always tax-free, at any age.
- **Modeled (state)** — `computeStateTax` distinguishes a state it has real rules for (even a $0
  no-income-tax state like Florida) from a state with no rules at all, where the app instead
  relies on a user-entered flat rate.
