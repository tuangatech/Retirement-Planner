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

## Situation 1: MFJ couple, ages 57 & 55

| Income source | Annual amount | Taxable? |
|---|---|---|
| Social Security (both spouses combined) | $43,000 | Partially — via the federal provisional-income formula |
| 401(k)/traditional IRA distribution | $14,000 | Yes — ordinary income |
| Taxable investment income (capital gains, dividends, interest) | $8,000 | Yes — all taxed the same in this engine |
| Other cash withdrawn (brokerage cost basis / bank principal) | $9,000 | No — return of principal, never income |
| Roth IRA distribution (qualified) | $12,000 | No — by law (IRC §408A), not an engine gap |
| HSA withdrawal (qualified medical) | $9,000 | No — by law (IRC §223), not an engine gap |
| **Total gross cash flow** | **$95,000** | |

**On the $9,000 of other cash withdrawn**: this is money simply moving, not being earned — a
brokerage withdrawal's return of principal (cost basis), or straight-up bank/HYSA/CD principal.
It's never income, so it counts toward the household's total cash flow but never toward any
taxable-income figure below.

### Income composition and engine mapping

This engine's federal model and every modeled state tax capital gains, dividends, and interest
at the same rate as ordinary income — there's no 0%/15%/20% LTCG preference and no separate
treatment for interest (see caveats below). That's why the page has a single "Taxable Investment
Income" field rather than separate ones per income type.

| Component | Engine field | Value used |
|---|---|---|
| Social Security | `income.socialSecurity` | $43,000 |
| 401(k)/IRA distribution | `withdrawals.taxDeferred` / `taxDeferredWithdrawals` | $14,000 |
| Taxable investment income | `brokerageGains` (state) / `taxable` withdrawal, gain-only (federal) | $8,000 |
| Other cash withdrawn | Not entered into any taxable-income field — it never affects tax | $9,000 |
| Roth IRA distribution | — | Always $0 taxable; not entered into any taxable-income field |
| HSA withdrawal | `hsaNonMedicalWithdrawals` / `hsaNonMedicalWithdrawal` | $0 (all $9,000 is qualified medical, so none of it is entered as taxable) |

The $95,000 total above reconciles every dollar in the situation table: $43,000 + $14,000 +
$8,000 (investment income) + $9,000 (other cash) + $12,000 (Roth) + $9,000 (HSA) = $95,000. Only
$43,000 (partially) and $22,000 ($14,000 + $8,000) are ever taxable anywhere below.

### How to run this comparison

Enter the numbers below on the live
[State Tax Comparison page](https://retirement-planner-blond.vercel.app/state-tax-comparison)
(or locally at `/state-tax-comparison`). It calls the same `calculateTotalTaxes` /
`computeStateTaxDetailed` functions as this document, updates live as you type, and shows all 13
modeled states side by side — not just the three below — each with its own expandable breakdown.

| Field on the page | Value |
|---|---|
| Filing Status | Married filing jointly |
| Your Age / Spouse's Age | 57 / 55 |
| Social Security (household total) | $43,000 |
| 401(k) / Traditional IRA Withdrawal | $14,000 |
| Taxable Investment Income | $8,000 (capital gains, dividends, interest combined) |
| Other Cash Withdrawn | $9,000 (the brokerage cost basis) |
| Roth IRA / 401(k) Distribution | $12,000 |
| HSA Withdrawal (qualified medical checked) | $9,000 |

Government Pension, Private Pension/Annuity, Part-Time Work, and Rental Income are left at $0 for
this situation.

### Results

| | Federal | Georgia | Florida | New York |
|---|---|---|---|---|
| **Tax owed** | **$0** | **$0** | **$0** | **$232** |

### Federal walkthrough

- Non-SS AGI items: $14,000 (401k) + $8,000 (investment income) = **$22,000**
- Provisional income: $22,000 + ½ × $43,000 = **$43,500** → falls in the 50%-tier band ($32,000–$44,000 MFJ)
- Taxable Social Security: min($21,500, 50% × ($43,500 − $32,000)) = **$5,750**
- Standard deduction (2026 MFJ, neither spouse 65+): **$32,200** base only — no age-65 addition, no OBBBA senior bonus
- Taxable income: max(0, $5,750 + $22,000 − $32,200) = **$0** → **federal tax $0**

### Georgia walkthrough

- State AGI: $14,000 + $8,000 = **$22,000** (Social Security is excluded by construction — see caveats)
- Retirement-income exclusion: Georgia's exclusion starts at age 62; neither spouse (57, 55) has
  reached it yet → **$0** excluded
- Taxable income: max(0, $22,000 − $0 − $30,000 standard deduction) = **$0** → **Georgia tax $0**

### Florida walkthrough

Florida has no individual income tax. `computeStateTax` returns a genuine, engine-computed
**$0** (`modeled: true`) rather than "not modeled."

### New York walkthrough

- State AGI: same as Georgia's, **$22,000**
- New York's private-pension exclusion starts at age 60 (the app's whole-year stand-in for the
  statutory 59½); neither spouse (57, 55) has reached it yet → **$0** excluded
- New York's standard deduction is fixed by statute at **$16,050 MFJ**
- Taxable income: max(0, $22,000 − $0 − $16,050) = **$5,950**
- New York tax: $5,950 falls entirely within the bottom MFJ bracket (up to $8,500, taxed at
  3.90%) → $5,950 × 3.90% = $232.05 → **New York tax $232**

At this age, neither state's retirement-income exclusion applies at all — Georgia's starts at 62,
New York's at 60 — so the result comes down entirely to standard-deduction size. Georgia's
$30,000 MFJ deduction fully absorbs the $22,000 state AGI; New York's smaller, fixed $16,050
deduction does not, leaving $5,950 taxable. The same household five to seven years older, once
both exclusions are active, would owe $0 everywhere instead.

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
