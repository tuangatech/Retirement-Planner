# Married Filing Jointly (Couples) Model

How the simulator models a two-person household, what we deliberately share vs. keep
separate between spouses, and where we sit relative to other retirement tools. The tax
mechanics (MFJ standard deduction, provisional-income SS, RMD age) live in
[`2-tax-model.md`](2-tax-model.md); this document is the couples design and roadmap.

## Design principle: one "you-anchored" timeline

The engine runs a single loop driven by the **primary** person's age
(`retirementAge → lifeExpectancy`), with `year = 2026 + (age − retirementAge)`. The spouse
is represented by an **age offset** (`spouseAgeAtRetirement`) plus their own Social Security.
Everything joint (spending, accounts, taxes, household healthcare) is shared; the spouse is
spouse-aware only where it materially changes the math. We call the two people **"You"** and
**"Your spouse"** — neutral, inclusive of all marriages, and matching the model's asymmetry
(You anchor the timeline).

Because You anchor the timeline, the **event markers** in the results (🎂 Retire, 🏥 Medicare,
💰 Social Security, 📊 RMDs, 💊 HSA depleted) follow **your (primary) age**, not the spouse's.
The Annual Breakdown shows the spouse's age next to yours (`you | spouse`) for context, but the
markers are your milestones. (Healthcare *costs* still switch each spouse to Medicare at their
own 65 internally — that's the two-track cost model, separate from the primary-age markers.)

## Decisions

| # | Matter | Decision |
|---|---|---|
| 1 | Filing status | First-class **single** or **MFJ** (Step 1 selector) |
| 2 | Survivor's penalty & mortality | **Not modeled** (Phase 2). No MFJ→single transition on first death; smaller SS never dropped |
| 3 | Life expectancy | **Single shared** horizon; both assumed alive to it |
| 4 | Retirement timing | **Same year** — sim starts when you retire; spouse rides your calendar at a constant age gap |
| 5 | Younger spouse still working | **Not modeled** (no spouse earned income; only your part-time) |
| 6 | Accounts | **Pooled** (one combined set) |
| 7 | RMD | **Flat age 75**; for the pool, triggered when the **older** spouse turns 75, using that age's divisor on the whole balance |
| 8 | Social Security | **Two own-record streams** summed for the provisional-income formula. COLA and taxable-% are **shared** household values. No spousal (≤50%) or survivor SS rules |
| 9 | Standard deduction | MFJ base + **per-spouse** age-65 additions + senior bonus (senior count 0/1/2 from both ages) |
| 10 | Spending phases | Household spending, keyed to **your** age |
| 11 | Healthcare | **Two tracks** — each spouse pre-Medicare until their own 65, then Medicare — assuming equal per-person costs |

## Shared vs. separate, by wizard step

| Step | Shared | Separate (per person) |
|---|---|---|
| 1 Personal | Retirement year, life expectancy, state, filing status | Spouse **age** |
| 2 Phases | Household spending (by your age) | — |
| 3 Accounts | All balances (pooled) | — |
| 4 Income | COLA, SS taxable %, pensions, rental | **Social Security** (benefit + claiming age) per spouse |
| 5 Healthcare | Cost assumptions (per-person amounts) | **Medicare transition** by each spouse's age |
| 6 Tax/Sim | Rate, inflation, runs, filing status | — |
| 7 Strategy | Withdrawal order (pooled) | — |

## Known simplifications (disclosed)

- **No survivor's penalty / mortality.** Both spouses assumed alive to the shared horizon.
  This makes late-retirement taxes **optimistic** for real couples (the survivor eventually
  files single with a smaller deduction and one SS check). This is the single largest gap.
- **Pooled accounts + one RMD trigger** (older spouse). Over-distributes slightly during a
  large spousal age gap — conservative (taxable income pulled forward; excess reinvested).
- **Equal per-person healthcare costs**; the accuracy that matters (each spouse's Medicare
  timing) is modeled, but we don't take separate premium/OOP figures per spouse.
- **Own-record SS only** — no spousal top-up or survivor step-up.

## How other tools handle these choices

Retirement tools split into two tiers:

- **Comprehensive planners** — Boldin (ex-NewRetirement), ProjectionLab, MaxiFi/ESPlanner,
  Pralana Gold — model the couple as **two distinct people** with individual mortality and a
  full **survivor transition** (filing flips to single, deduction halves, IRMAA thresholds
  drop, the smaller SS ends, accounts pass to the survivor with their own RMD schedule).
  They support **different retirement dates**, **per-spouse life expectancy**, and **spousal/
  survivor SS** rules.
- **FIRE historical simulators** — cFIREsim, FI Calc, FIRECalc — are portfolio + spending
  engines. A couple is entered as **combined balances** and SS as income streams; they
  generally do **not** model MFJ tax brackets, the survivor's penalty, or per-spouse mortality.

**Where we sit:** we match the **FIRE-sim tier** on structure (pooled portfolio, single
shared horizon) but add real MFJ **tax** mechanics (provisional-income SS, MFJ standard
deduction with per-spouse senior additions, older-spouse RMD, two-track healthcare) — a step
beyond the pure FIRE tools, and well short of the comprehensive planners' survivor modeling.
The one gap every serious couples tool closes and we don't yet is the **survivor's penalty**,
which is why it heads the roadmap.

## Roadmap

- **Phase 1 (current):** two-person MFJ — combined SS, MFJ deduction, older-spouse RMD,
  pooled accounts, two-track healthcare. Shared horizon, no survivor penalty.
- **Phase 2 (next, highest value):** survivor's ("widow's") penalty — a mortality /
  first-death model, the MFJ→single filing transition, and dropping the smaller SS. See the
  survivor-penalty notes in [`2-tax-model.md`](2-tax-model.md).
- **Later:** per-spouse life expectancy and different retirement dates; separate per-spouse
  accounts (true per-account RMD timing); spousal/survivor SS benefit rules.

> Phase numbers here track the **couples** model. The tax doc's own roadmap numbers the
> **state-tax** module separately; per-state work is scoped in the slot-5 state-tax doc, not here.

Sources: [Boldin — assumptions when first spouse passes](https://help.boldin.com/en/articles/9293023-assumptions-when-the-first-spouse-passes),
[Boldin — spousal Social Security](https://help.boldin.com/en/articles/5753178-spousal-social-security),
[ProjectionLab — modeling the death of a spouse](https://projectionlab.com/help/life-expectancy-milestone),
[MaxiFi — survivor benefits](https://www.maxifi.com/financial-glossary/survivor-benefits),
[CNBC — the survivor's penalty](https://www.cnbc.com/2026/05/15/survivors-penalty-spouse-dies.html),
[cFIREsim](https://alistair-marshall.github.io/cFIREsim-open/), [FI Calc](https://ficalc.app/),
[FIRECalc](https://www.firecalc.com/).
