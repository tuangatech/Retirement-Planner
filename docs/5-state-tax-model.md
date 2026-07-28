# State Tax Model

How the simulator models **state** income tax, which states are modeled, the verified
constants with their primary sources, and the procedure for re-verifying them every year.
Federal tax is a separate model — see [`2-federal-tax-model.md`](2-federal-tax-model.md).

**Status: PRs 1–2 of 3 shipped** (§9). The engine, the rules data, the wizard surface, and the
verifier are in place; the **nine no-income-tax states and Georgia (§4.2) are live**. Virginia
(§4.3) is specified here but not yet implemented — it still falls back to the manual marginal
rate.

Implementation: [`stateTax.ts`](../src/lib/calculations/stateTax.ts) (logic) +
[`stateTaxRules.json`](../src/lib/calculations/stateTaxRules.json) (constants, read by both the
engine and the verifier) + [`stateTaxRules.ts`](../src/lib/calculations/stateTaxRules.ts) (typed
lookup), applied per year in
[`yearlyProjection.ts`](../src/lib/calculations/yearlyProjection.ts) and independently
re-checked by [`scripts/verify_plan.py`](../scripts/verify_plan.py).

---

## 1. Scope

**Modeled: the nine states with no individual income tax, plus GA and VA — eleven in total**
(ten are live; VA is designed here but not yet implemented). Every other state keeps the manual
behavior: the user folds their state's rate into the single marginal rate on Screen 4.

The nine no-income-tax states cost almost nothing to model (`taxesIncome: false` → `return 0`)
and need no annual formula review, only a check that none of them has enacted an income tax:

| State | TY2026 status |
|---|---|
| AK, FL, NV, SD, TX, WY | No individual income tax |
| TN | Hall tax on interest/dividends **repealed for TY2021+** |
| NH | Interest & Dividends tax **repealed effective 1 Jan 2025** (HB 2, 2023 session) |
| WA | No income tax, but a **capital-gains excise tax** applies above a high threshold — see below |

GA and VA cover *structurally different* retiree benefits — GA gives a per-person,
income-type-scoped **exclusion**; VA gives a household-level, means-tested **age deduction** —
and between them exercise every field the rules schema needs for both a flat-rate and a
graduated-rate state. NY and CA are deferred; §10 records what they would add.

### Washington's capital-gains excise tax: disclosed, not modeled

Washington levies a 7% excise tax on long-term capital gains above an inflation-indexed
standard deduction ($278,000 for 2025), with an additional higher tier. It is **not** modeled,
for three reasons: retirement accounts are exempt, so it reaches only taxable-brokerage gains;
clearing the threshold would take roughly a $927,000 brokerage withdrawal in a single year at
70% cost basis; and our model applies a flat cost-basis percentage per withdrawal rather than
tracking realized gains, so it could not compute the liability faithfully.

Disclose it in the Assumptions panel with the threshold named. Do not let the UI say "no state
income tax" for WA without that caveat.

> **Open item before the WA disclosure text is written:** WA DoR references a "new tiered
> rates" special notice that needs to be located and quoted — it likely adds a higher tier
> above ~$1M of gains.

### Why a blended rate is not good enough

Two effects in the modeled states are impossible to express as a single added-on percentage:

- **Georgia's exclusion starts at age 62** ($35,000) and reaches $65,000 only at 65. An
  early retiree pays GA tax on essentially all tax-deferred draws until 62, then watches the
  bill fall toward zero. The state bill is front-loaded into exactly the gap years the
  tax-smart withdrawal strategy targets. The shipped module bears this out: on the default
  plan (retire at 58, $50k spending) GA tax runs $602 → $728 across ages 58–61 and is **$0
  from 62 onward**, once the exclusion covers the draws. No single added-on percentage
  reproduces that shape.
- **Virginia's age deduction phases out dollar-for-dollar**, which *doubles* the marginal rate
  inside the phase-out band (§4.3).

---

## 2. Two rules that govern every state

### Rule 1 — Model unconditional enacted changes; freeze contingent ones

Scheduled future changes come in two kinds:

- **Unconditional** (the statute says the amount changes in year N, full stop) → **model it**,
  keyed by tax year. This matches how the federal OBBBA senior bonus is modeled through its
  dated 2028 sunset.
- **Contingent** (the change happens only if revenue triggers are met) → **freeze at the
  current value**; never model the glidepath. Forecasting a legislature's revenue triggers 30
  years out is inventing tax policy.

Georgia HB 463 contains both kinds in one bill:

| Georgia provision | Kind | Treatment |
|---|---|---|
| Rate 4.99% (TY2026) | enacted | model |
| Rate −0.125%/yr from 2027 → 3.99% floor | **contingent** on revenue triggers | freeze at 4.99% |
| Standard deduction $15,000/$30,000 (TY2026) | enacted | model |
| Deduction +$375/+$750 per year → $18,000/$36,000 | **contingent** | freeze |
| Retirement exclusion 65+ → $70,000 (TY2027) | **unconditional** | model the step-up |

Both frozen Georgia values err in the same direction — the rate can only fall and the
deduction can only rise — so freezing **overstates** GA tax. Conservative, and disclosed.

Virginia's schedule is entirely unconditional, including a reversion cliff (§4.3).

### Rule 2 — When a state is modeled, `combinedEffectiveRate` means federal-only

Computing state tax on top of a rate the user set as federal **+** state double-counts. So
when a state module is active:

- The engine treats `tax.combinedEffectiveRate` as a federal marginal rate.
- The wizard label and the state-guidance box on
  [Screen4Assumptions.tsx](../src/components/wizard/Screen4Assumptions.tsx) must say
  "federal marginal rate" and "your state's tax is computed automatically."
- `socialSecurity.taxablePercentage` becomes a **federal-only** cap: lowering it in a modeled
  state exempts the benefit twice. The wizard help text on
  [Screen2SavingsIncome.tsx](../src/components/wizard/Screen2SavingsIncome.tsx) never mentioned
  state exemptions, so it needed no change — but
  [`1-requirements.md`](1-requirements.md) §4.1 did, and now states the distinction.

§7 covers keeping this from re-valuing already-saved scenarios.

---

## 3. How state tax threads through the engine

State tax is a real cash outflow. It must enter the model in **four** places:

1. **The initial cash-flow gap** — [`yearlyProjection.ts`](../src/lib/calculations/yearlyProjection.ts)
   STEP 4/5, where `initialTotalTax` sets `cashFlowGap`.
2. **The withdrawal gross-up** — [`withdrawals.ts`](../src/lib/calculations/withdrawals.ts)
   STEP 2, which divides by a single flat rate.
3. **The tax-smart fill** — [`withdrawals.ts`](../src/lib/calculations/withdrawals.ts) STEP 1.5.
   This one is easy to miss (PR 1 did) because the fill bypasses the gross-up entirely: it is
   sized to the *federal* deduction floor, so its federal tax is ~0 and the code treated net as
   equal to gross. A state applies its own, much smaller shield — Georgia's $15,000 standard
   deduction, with no retirement exclusion at all before 62 — so the fill can owe state tax, and
   the year must withdraw for it.
4. **The final tax computation** — `calculateTotalTaxes`, reported as a
   `taxes.stateTax` field folded into `taxes.total`.

**All four are required.** Adding state tax only at (4) makes the engine under-withdraw by
the state tax every year: `netCashFlow` goes negative and the plan spends money it never
withdrew, understating depletion risk. Over-withdrawal is harmless by comparison —
[`yearlyProjection.ts`](../src/lib/calculations/yearlyProjection.ts) reinvests surplus to the
taxable account.

### Breaking the circularity

State tax depends on withdrawals, which depend on total tax. Break the loop by computing a
**state marginal rate** up front, passing it into `executeWithdrawals` as an add-on to the
gross-up rate, and letting the reinvest-surplus path absorb the residual. Two details hide inside
that sentence, and both were got wrong on the first attempt — they are worth stating precisely.

**Probe the rate at the year's expected draw, not at fixed income alone.** The obvious move is
to mirror `calculateTaxFreeTaxDeferredRoom` and evaluate the rate on fixed income before
discretionary draws. That reads **0%** for the case that matters most: a 58-year-old retiring
in Georgia with no pension has no fixed income, so a probe against it never clears GA's $15,000
standard deduction — while the actual draws needed to fund the year clear it easily. The whole
state bill then goes unfunded and `netCashFlow` comes out at exactly `−stateTax` every gap
year. Probing at `cashFlowGap` instead — the year's own spending need, already computed and
still not circular — funds it. Treating the entire gap as ordinary income overstates the rate
when the gap is met from Roth or cost basis, which errs toward over-withdrawal.

**Take the rate as a finite difference, not per-state algebra.** "Past the deduction ⇒ 4.99%"
is wrong for Georgia, because the exclusion is *capped by eligible income*: while exclusion room
remains, each extra dollar of tax-deferred draw creates a dollar of exclusion and is untaxed at
the margin — even for a household already paying GA tax on other income. `stateMarginalRate`
therefore re-runs the one real formula over a $1,000 probe withdrawal and divides. That gets the
exclusion growth, the deduction shield, and (when VA lands) its doubled phase-out band for free,
and it blends correctly across a threshold the household is sitting just under.

The resulting rate is still effectively piecewise-constant:

- **No-income-tax states** → always 0.
- **GA** → 0 under the exclusion + standard deduction *and* while exclusion room remains;
  otherwise 4.99%.
- **VA** → 0 below the filing threshold; the bracket rate (5.75% for any realistic retiree);
  **doubled inside the age-deduction phase-out band** (§4.3).

### Both income-taxing states compute from federal AGI

No new income plumbing is needed — every input already exists inside `calculateTotalTaxes`:

```
stateAGI     = federalAGI − federallyTaxableSS       (both states exempt SS)
stateTaxable = max(0, stateAGI − stateBenefit − stateStandardDeduction − stateExemptions)
stateTax     = applyRate(stateTaxable)
```

In the code that subtraction is structural rather than arithmetic. `StateTaxInputs` carries the
*components* of federal AGI — pensions, part-time work, rental, tax-deferred withdrawals,
brokerage gains, non-medical HSA withdrawals — and simply never includes Social Security, so
`stateAGI` is exact by construction and no SS figure has to be passed in correctly. It also
means the field cannot drift: PR 1 declared a `taxableSocialSecurity` input and populated it
with the *gross* benefit, which went unnoticed only because nothing read it yet. A state that
genuinely taxes SS would add the federally taxable amount back here.

---

## 4. Per-state models

### 4.1 The no-income-tax states (AK, FL, NH, NV, SD, TN, TX, WA, WY)

`stateTax = 0`, `modeled = true`. The value is disclosure: the results panel states "no state
income tax" instead of leaving the user to guess. WA additionally carries the capital-gains
caveat from §1.

Annual review for these nine is a single question — has any of them enacted an income tax? —
plus re-checking WA's threshold.

### 4.2 Georgia

> 📊 For an illustrated walkthrough of these rules — the waterfall, the age cliff, and how the
> engine computes them — open
> [`georgia-state-tax-explained.html`](georgia-state-tax-explained.html) in a browser. This
> section remains the authoritative record of the constants and their statutory language.

**Formula**

```
gaAGI     = federalAGI − federallyTaxableSS
gaTaxable = max(0, gaAGI − retirementExclusion − standardDeduction)
gaTax     = gaTaxable × 0.0499
```

**Retirement exclusion** — per person, age-tiered, capped by that person's eligible income:

| Age | TY2026 | TY2027+ |
|---|---|---|
| < 62 | $0 | $0 |
| 62–64 | $35,000 | $35,000 |
| 65+ | $65,000 | **$70,000** |

Eligible income in our model: tax-deferred withdrawals, pensions, rental, brokerage **gains**,
plus at most **$5,000** of part-time work (the earned-income sublimit). Not eligible: Roth and
HSA-for-healthcare (never in federal AGI), Social Security (already subtracted), and HSA
non-medical withdrawals (§6).

MFJ gets up to 2× the tier amount, subject to each spouse qualifying separately — see the
attribution simplification in §6. Two decisions the statute leaves to the implementation:

- **Each spouse's tier comes from their own age**, then the two are summed. A 66-year-old with a
  60-year-old spouse gets $65,000, not $130,000 and not 2 × $35,000.
- **The earned-income sublimit stays $5,000 for MFJ**, not $10,000. IT-511 makes it per
  taxpayer, but this tool models only one part-time income
  ([`1-requirements.md`](1-requirements.md) §4.3 — a spouse's earned income is not an input), so
  there is no second earner to claim it. Doubling a sublimit on income the model cannot attribute
  would compound the over-exclusion in §6 rather than offset it.

**Constants (TY2026)**

| Constant | Value | Primary source |
|---|---|---|
| Flat rate | 4.99% | HB 463: "shall be ~~5.19 percent~~ **4.99 percent** for taxable years beginning on or after January 1, 2026" |
| Standard deduction | $15,000 single / $30,000 MFJ | HB 463 §2-3: "~~$12,000.00~~ **$15,000.00**" / "~~$24,000.00~~ **$30,000.00**" |
| Age-65 addition | **none** | No additional deduction exists under the flat-tax structure (the old $1,300 appears only through TY2022) |
| Exclusion, 62–64 | $35,000 | O.C.G.A. 48-7-27(a)(5)(A)(xiii)–(xiv), unchanged in both |
| Exclusion, 65+ | $65,000 → **$70,000 from TY2027** | HB 463: "(xiv) For taxable years beginning on or after January 1, 2027… **$70,000.00** for each taxpayer meeting the eligibility requirement set forth in division (iii)" |
| Earned-income sublimit | $5,000 | IT-511 p.21: "Up to $5,000 of the maximum allowable exclusion may be earned income." |
| Per person | yes | IT-511 p.21: "available for the taxpayer and their spouse; however, **each must qualify on a separate basis**" |
| Social Security | exempt, and excluded from the exclusion calc | IT-511 p.24: "Social Security and Railroad Retirement… should not be included in the retirement income exclusion calculation." |

> ⚠️ **Trust the IT-511 booklet and the bill text, not the DoR web pages.** As of this
> writing the [Retirees FAQ](https://dor.georgia.gov/retirees-faq) states "$4000.00 of earned
> income" (that is the dependent-exemption figure, which HB 463 moved $4,000 → $5,000 in the
> same bill) and the
> [Standard Deductions page](https://dor.georgia.gov/georgia-standard-deductions-increases)
> stops at TY2024. Verify against IT-511 and the enacted bill.

Not modeled: the $5,000 dependent exemption (retirees rarely have dependents) and the
military retirement exclusion.

### 4.3 Virginia

**Formula**

```
vaAGI     = federalAGI − federallyTaxableSS
afagi     = vaAGI                                    (AFAGI = FAGI − taxable SS/Tier 1 RR)
vaTaxable = max(0, vaAGI − ageDeduction − standardDeduction − personalExemptions)
vaTax     = applyBrackets(vaTaxable)
```

**Brackets** — these do **not** vary by filing status, unlike NY and CA:

| Virginia taxable income | Tax |
|---|---|
| ≤ $3,000 | 2% |
| $3,000 – $5,000 | $60 + 3% of excess |
| $5,000 – $17,000 | $120 + 5% of excess |
| > $17,000 | $720 + 5.75% of excess |

Every retiree with meaningful income lands in the top bracket, so VA behaves like 5.75% with
a fixed ~$258 discount. Implement the real schedule anyway — it is four lines.

**Standard deduction** — unconditional statutory schedule, including a reversion cliff:

| Tax years | Single | Married |
|---|---|---|
| 2025–2026 | $8,750 | $17,500 |
| 2027 | $9,200 | $18,400 |
| 2028–2029 | $9,300 | $18,600 |
| **2030 onward** | **$3,000** | **$6,000** |

Under Rule 1 the 2030 cliff is modeled, because it is enacted and unconditional. **Disclose
prominently** that Virginia has repeatedly extended this deduction rather than let it revert,
so the cliff may never happen — modeling it is the conservative reading of current law, not a
prediction.

**Age deduction** — the exact algorithm, from the Form 760 "Age 65 and Older Deduction
Worksheet":

```
n     = number of taxpayers aged 65+ (1 for single; 0, 1, or 2 for MFJ)
afagi = combined federal AGI − combined federally-taxable SS / Tier 1 RR
limit = $50,000 single / $75,000 married          (per return, on COMBINED income)
cap   = $12,000 × n
ageDeduction = afagi < limit ? cap : max(0, cap − (afagi − limit))
```

Two consequences for the implementation:

- **It is a household-level means test against a pooled cap**, not a per-person benefit, so it
  maps directly onto our pooled-accounts MFJ model — no attribution problem, unlike Georgia's
  exclusion.
- **The phase-out doubles the marginal rate.** Inside the band each extra dollar of income
  also destroys a dollar of deduction, so VA taxable income rises by $2 per $1 earned — an
  effective **11.5%** marginal rate (2 × 5.75%). The band is AFAGI $50,000–$62,000 for a
  single 65-year-old and $75,000–$99,000 for a couple both 65+. This must be reflected in the
  gross-up rate (§3) or withdrawals will be systematically short inside that band.

**Constants (TY2026)**

| Constant | Value | Primary source |
|---|---|---|
| Brackets | 2% / 3% / 5% / 5.75% at $3,000 / $5,000 / $17,000 | VA Tax rate schedule: "over $17,000 … your tax is $720 + 5.75%" |
| Standard deduction | $8,750 single / $17,500 married | § 58.1-322.03; Form 760 instructions: "Filing Status 1 Enter $8,750 / Filing Status 2 Enter $17,500" |
| Age deduction | $12,000 per person 65+ | § 58.1-322.03: "A deduction in the amount of $12,000 for individuals born after January 1, 1939, who have attained the age of 65." |
| Phase-out | $1 per $1 of AFAGI over $50,000 single / $75,000 married | same: "reduced by $1 for every $1 that the taxpayer's adjusted federal adjusted gross income exceeds $50,000 for single taxpayers or $75,000 for married taxpayers" |
| AFAGI definition | FAGI − taxable SS and Tier 1 RR benefits | Form 760 worksheet line 8: "Subtract Line 7 from Line 6… This is your AFAGI" |
| Personal exemption | $930 per filer/spouse | Form 760: "Add $930 to the total to compute the personal exemptions for you and spouse" |
| Age-65 exemption addition | $800 per filer/spouse | Form 760: "You: 65 or over ___ + Blind ___ = Total ___ × $800" |
| Social Security | exempt (subtraction) | § 58.1-322.02(3): "Benefits received under Title II of the Social Security Act…" |
| Retirement/pension exclusion | **none** | VA has no general pension exclusion — the age deduction is the retiree benefit |
| Capital gains | ordinary rates, no preference | VA applies one rate schedule to all income |

Not modeled: the unconditional $12,000 age deduction for those **born on or before January 1,
1939** — they are 87+ in 2026, outside this tool's audience, and modeling them would require a
birth year instead of an age (the same reasoning behind `RMD_START_AGE` in
[`rmd.ts`](../src/lib/calculations/rmd.ts)). Also not modeled: the blind exemption, military
benefits subtraction, and conformity adjustments.

---

## 5. Rules data: schema and where it lives

**Code is the source of truth; this document holds the evidence.** The numbers live in
`src/lib/calculations/stateTaxRules.json`. The tables in §4 carry the *quoted statutory
language*, so if doc and code disagree, the doc is the primary source and the code is the bug.

The constants live in **JSON rather than TypeScript** so that
[`verify_plan.py`](../scripts/verify_plan.py) reads the same file instead of re-declaring them
in Python — no codegen or build step, one file, two readers. `stateTaxRules.ts` is a thin typed
wrapper that imports the JSON and exposes the lookup. Federal `TAX_RULES` is currently
duplicated by hand across [`taxes.ts`](../src/lib/calculations/taxes.ts) and `verify_plan.py`;
do not repeat that pattern for 11+ states.

> **On verifier independence.** Sharing constants makes `verify_plan.py` non-independent for
> *constants* — deliberately. Its job is independently re-deriving the *formulas*, which stay
> separately implemented. A wrong constant is caught by human review against the primary
> source; a wrong formula is caught by the verifier.

Shape the eleven modeled states need. What is committed today is the no-income-tax arm plus
everything Georgia needs; the lines marked `// VA` are what the Virginia PR adds. `reviewedFor`
is one top-level field in the JSON rather than per state — the whole file is reviewed together.

```ts
type StateTaxRules = {
    state: USState;
    sources: Record<string, string>;        // constant name → primary-source URL
    caveat?: string;                        // user-facing: WA's excise tax, GA's frozen escalators
    note?: string;                          // maintainer-facing rationale
} & (
    | { taxesIncome: false }
    | {
        taxesIncome: true;
        socialSecurity: 'exempt';           // widen when a state that taxes SS is added
        rate:
            | { kind: 'flat'; rate: number }
            | { kind: 'graduated'; brackets: Array<{ upTo: number | null; rate: number }> };  // VA
        // Year-keyed: the last entry already in force, else the earliest (`pickForYear`).
        standardDeduction: Array<{ fromYear: number; single: number; married: number }>;
        personalExemption?: { perFiler: number; age65Addition: number };                      // VA
        retirementBenefit?:
            | { kind: 'ga_exclusion'; tiers: Array<{ fromYear: number; age62: number; age65: number }>;
                earnedIncomeSublimit: number }
            | { kind: 'va_age_deduction'; perPerson: number; minAge: number;                  // VA
                threshold: { single: number; married: number }; reductionPerDollar: number };
    }
);
```

`retirementBenefit` is a discriminated union rather than a generalized "exclusion" record —
two structurally different benefits do not justify an abstraction over benefits nobody has
written yet. §10 lists what NY and CA would add, which is what is needed to widen it later
without a rewrite.

---

## 6. Simplifications (all disclosed in the Assumptions panel)

- **Georgia's per-person exclusion vs pooled accounts.** GA requires each spouse to qualify on
  their own income; pooled accounts cannot attribute a withdrawal to a spouse. Applying the
  combined 2× cap to pooled income **over-excludes** when income is lopsided (a couple where
  only one spouse has retirement income should get one exclusion, not two). Same family of
  simplification as the pooled RMD in
  [`4-married-filing-jointly.md`](4-married-filing-jointly.md). Virginia is unaffected — its
  age deduction is already household-level.
- **Georgia's earned-income sublimit is not doubled for MFJ** ($5,000, not $10,000) because only
  one part-time income is modeled — see §4.2.
- **HSA non-medical withdrawals (65+) are fully taxed by the state.** Georgia's exclusion
  enumerates specific categories — interest, dividends, net rental, capital gains, royalties,
  pensions, annuities, limited earned income. A non-qualified HSA distribution is federal
  "other income" and is none of those, so the plain reading denies the exclusion. Conservative,
  and near-zero impact since `allowNonMedicalAfter65` defaults to `false`.
- **Frozen contingent escalators** (GA rate and standard deduction) — overstates GA tax.
- **The state gross-up rate is an estimate, not the year's exact state tax.** It is probed at the
  expected draw rather than solved simultaneously with withdrawals (§3), so a year whose actual
  draws diverge sharply from the cash-flow gap — a large forced RMD, or a gap met mostly from
  Roth — funds somewhat too much or too little state tax. The residual lands in `netCashFlow`
  and, when positive, is reinvested to the taxable account. It is now the *only* remaining source
  of underfunding: the **federal** side is solved exactly, so the same 10,000-run default plan
  that leaked $8,743 per run before that fix leaks **$12** in Georgia and **$0** in a
  no-income-tax state, with a worst single year of −$362 against −$2,613 before. Pinned by tests
  in [`yearlyProjection.test.ts`](../src/lib/calculations/yearlyProjection.test.ts).
- **Tax-smart draws are sized to the federal floor only.** The fill still targets the federal
  standard deduction even in a state whose own shield is smaller, so in Georgia a pre-62 fill
  owes 4.99% on the part above GA's $15,000 deduction. The draw is usually still worth making
  (it shrinks future RMDs and the SS torpedo), and the state tax on it *is* now withdrawn for —
  but the strategy does not optimise against the state, and the UI must not call it "tax-free".
- **Virginia's 2030 deduction cliff is modeled as enacted** — likely overstates VA tax from
  2030 onward.
- **State standard deductions are not inflated.** Neither GA's nor VA's is statutorily indexed;
  both change only by legislation. Holding them flat while income inflates produces real
  bracket creep. This is a deliberate asymmetry with the *federal* base deduction, which
  [`yearlyProjection.ts`](../src/lib/calculations/yearlyProjection.ts) does inflate because it
  genuinely is indexed — do not "fix" the inconsistency.
- **Washington's capital-gains excise tax is not modeled** — see §1 for the threshold and why.
- **No local income taxes** (relevant when NY lands: NYC and Yonkers).
- **No part-year or multi-state residency.** One state for the whole retirement.
- **No state-level credits**, dependent exemptions, itemized deductions, or conformity
  adjustments.

---

## 7. Backward compatibility

Saved scenarios store inputs only and recompute results on load, so changing what
`combinedEffectiveRate` means would silently re-value every existing plan in a modeled state —
a violation of the project's saved-scenario invariant.

Mirror the precedent set by `withdrawalStrategy.strategy`:

- Add `TaxSettings.stateTaxMode?: 'manual' | 'modeled'`.
- The engine treats a missing value as `'manual'`.
- [`scenarioStorage.ts`](../src/lib/storage/scenarioStorage.ts) stamps `'manual'` on load for
  scenarios saved without the field, exactly as it does for the legacy strategy default.
- New scenarios default to `'modeled'`.

Old plans then compute bit-identically and new plans get the module. Opting an old plan in is
also the moment to prompt the user to drop the state points from their rate.

**One consequence worth knowing about Georgia specifically:** `DEFAULT_VALUES.personal.state` is
`'GA'` and `stateTaxMode` defaults to `'modeled'`, so shipping Georgia changed the out-of-the-box
numbers every new user sees — the default plan (retire at 58) now shows a few hundred dollars of
GA tax in its first four years. That is correct behavior, not a regression: saved scenarios are
protected by the `'manual'` default, and a *new* plan in Georgia genuinely owes Georgia tax. Any
future state that becomes the default carries the same consequence.

---

## 8. Wizard surface

**Keep all 51 entries in the Step 1 state selector.** Group them with native `<optgroup>`:

```
── Tax computed automatically ──   AK FL GA NH NV SD TN TX WA WY   (VA joins when it lands)
── Not modeled — add your state's rate manually ──   (the remaining 41)
```

Both groups are derived from `isStateModeled`, so Georgia moved between them the moment its
rules entry existed — no UI change was needed, and Virginia will move the same way.

**Do not replace the list with "modeled states + Other."** Three reasons:

1. **It destroys data.** Scenarios store inputs only, so a user who picks "Other" has their
   actual state erased and their scenario can never be upgraded when that state is modeled.
   Keeping the real code means every future state addition upgrades saved scenarios for free.
2. **It reads as a bug.** Someone hunting for their state and not finding it concludes the tool
   is broken, not that they should pick "Other."
3. **`USState` is already a 51-code union embedded in saved scenarios.** Adding `'OTHER'` means
   supporting both representations permanently.

Adding a state later is moving one code between groups — no migration, no type change.

Also required:

- The helper text under the selector becomes **conditional on the selection**, replacing the
  unconditional "Tax guidance only; state rules aren't modeled."
- Screen 4 shows an opt-in toggle **only when the selected state is modeled**, so a scenario
  loaded in `'manual'` mode (§7) can be switched to `'modeled'`. Without it the legacy default
  is a one-way door.

If the 51-item list length is itself the problem, the fix is a searchable combobox — a separate
change, not part of this work.

---

## 9. Delivery plan

Three PRs. The integration risk and the formulas are deliberately separated.

1. ✅ **Plumbing + the nine no-income-tax states.** Rules JSON and typed wrapper, `stateTax.ts`,
   the engine touch points, `taxes.stateTax` output, the `stateTaxMode` flag and its
   legacy default, `verify_plan.py` mirror, wizard optgroups and conditional copy, WA
   disclosure. Every modeled state returns 0, so the only thing under test is the wiring.
2. ✅ **Georgia.** Exclusion tiers, the TY2027 step-up, earned-income sublimit, tests.
3. **Virginia.** Brackets, age-deduction phase-out, the doubled marginal rate in the gross-up,
   the 2030 cliff, tests.

`verify_plan.py` must move in PR 1, not later: its `Total Tax = Fixed + Payroll + Withdrawal`
check fails as soon as `taxes.stateTax` exists and is nonzero.

**What PR 1's zero-only coverage hid.** With every modeled state at zero, the cash-flow-gap and
final-tax touch points could only be tested with a zero value; only the gross-up took a nonzero
rate directly, as a plain parameter to `executeWithdrawals`. Georgia's end-to-end coverage then
surfaced two defects the wiring tests could not see: the tax-smart fill never charged state tax
at all (§3, touch point 3), and the marginal rate probed from fixed income read 0% for an early
retiree, leaving the whole bill unfunded (§3). Both are fixed. The lesson generalises — a
touch point exercised only with zero is a touch point not yet tested.

---

## 10. Schema survey: what NY and CA would add

Neither is implemented, and neither state's constants are verified here. This table exists so
the schema in §5 can be widened later without a rewrite — it answers "what fields does each
state force?", not "what are the numbers?"

| Dimension | FL/TX | GA | VA | NY | CA |
|---|---|---|---|---|---|
| Income tax | none | flat | graduated | graduated | graduated |
| Brackets vary by filing status | — | n/a | **no** | **yes** | **yes** |
| Brackets indexed annually | — | n/a | no | yes | **yes** |
| Social Security | — | exempt | exempt | exempt | exempt |
| Retiree benefit shape | — | per-person income-type **exclusion** | household **means-tested deduction** | **per-source exclusion** | **none** |
| Benefit is source-dependent | — | no (most income lumped) | no | **yes** (government pension 100%; private/IRA $20k) | — |
| Age threshold | — | 62 / 65 | 65 | **59½** (non-integer) | — |
| Means-tested | — | no | **yes** (AFAGI, $1:$1) | no | no |
| Personal exemption | — | dependents only | deduction | deduction | **credit, not deduction** |
| Local surcharge | — | no | no | **yes** (NYC, Yonkers) | no (but 1% MHST over $1M) |
| Capital gains | — | ordinary | ordinary | ordinary | ordinary |

**What NY forces:** bracket tables keyed by filing status; a *source-partitioned* exclusion;
a non-integer age threshold; locality surcharges.

**Open product question, to settle before NY research begins:** NY's exclusion splits
government from private pension income. Our `Pension` type has no such flag, so NY requires a
new wizard input and a change to the input model — a product decision, not a tax-module one.

**What CA forces:** annually-indexed bracket tables (a maintenance cost every year, not just
on law changes) and personal exemptions as **credits applied after tax is computed**, which is
an ordering change rather than a new field.

---

## 11. Annual review procedure

State constants are year-specific. Once a year, and whenever a modeled state passes a tax bill:

1. Re-verify every constant in §4 against its primary source. Prefer the **enacted bill text
   and the annual instruction booklet** over state DoR web pages, which go stale and sometimes
   contradict each other — cross-check at least two sources per constant and reconcile any
   disagreement against the bill before changing a number.
2. Bump `reviewedFor` in `stateTaxRules.json` (one top-level field for the whole file;
   `stateTaxRules.ts` re-exports it as `STATE_RULES_REVIEWED_FOR`) and update the quoted
   language in §4.
3. Re-check the **contingent** escalators (Rule 1): if a Georgia revenue trigger actually
   fired, the frozen value changes. That is a constants update, not a model change.
4. Run `npm test` and `python3 scripts/verify_plan.py` on a fresh export.

**Using an LLM for this:** treat it as a *change detector*, never as the source of truth —
"here is the 2027 IT-511 and our committed Georgia constants; tell me which moved and quote
the page." That task is bounded, diff-shaped, and human-approved. An extractor asked to simply
produce the constants will return one confident number from whichever page it happened to
read, including a stale one. A wrong constant is this project's most invisible failure mode:
the success rate shifts a couple of points and nothing looks broken.

---

## 12. Sources

**Georgia** — [HB 463 (AS PASSED)](https://www.legis.ga.gov/api/legislation/document/20252026/249080) ·
[Gov. Kemp signing release, 2026-05-11](https://gov.georgia.gov/press-releases/2026-05-11/gov-kemp-signs-legislation-lowering-taxes-and-supporting-economic-growth) ·
[DoR — Important Tax Updates](https://dor.georgia.gov/taxes/important-tax-updates) ·
[DoR — Retirement Income Exclusion](https://dor.georgia.gov/retirement-income-exclusion) ·
[DoR — Retirees FAQ](https://dor.georgia.gov/retirees-faq) ·
[IT-511 Individual Income Tax booklet](https://dor.georgia.gov/document/document/2025-it-511-individual-income-tax-booklet/download)

**Virginia** — [§ 58.1-322.03 (deductions)](https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.03/) ·
[§ 58.1-322.02 (subtractions)](https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.02/) ·
[Form 760 instructions](https://www.tax.virginia.gov/sites/default/files/vatax-pdf/2025-760-instructions.pdf) ·
[Tax rate schedule](https://www.tax.virginia.gov/sites/default/files/vatax-pdf/tax-table-2025.pdf) ·
[Virginia Tax — Deductions](https://www.tax.virginia.gov/deductions) ·
[Virginia Tax — Subtractions](https://www.tax.virginia.gov/subtractions)

**Survey only, constants not verified** — [NY — Information for seniors](https://www.tax.ny.gov/pit/file/information_for_seniors.htm) ·
[CA FTB — Social Security](https://www.ftb.ca.gov/file/personal/income-types/social-security.html) ·
[CA FTB Pub. 1005 — Pension and Annuity Guidelines](https://www.ftb.ca.gov/forms/2024/2024-1005-publication.pdf)
