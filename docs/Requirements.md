# Retirement Planning Simulator - Requirements Document (v1.3)

## 1. EXECUTIVE SUMMARY

A US-focused retirement planning **simulation tool** for individuals that models phase-based spending, multiple income sources, HSA optimization, and provides probabilistic success analysis through Monte Carlo simulation. This tool answers: **"Will my retirement plan work?"** using simplified assumptions with transparent disclosure of limitations.

**Target User:** General public (US individuals planning retirement)  
**Scope:** Single person planning with honest limitations disclosure  
**Philosophy:** Simplified inputs with comprehensive assumptions disclosure  
**Storage:** Browser localStorage (inputs only, results recalculated on load)

**Core Concept:** "Tell me what you'll have AT retirement, and I'll tell you if it will last"

**Key Simplification:** This tool does NOT model:
- Pre-retirement savings/contributions
- Portfolio growth before retirement
- Accumulation phase calculations

Users provide their **projected retirement balances**, and we model the **retirement phase only** (from retirement age to life expectancy).

**Recent Updates (v1.3):**
- **Removed pre-retirement modeling** - Focus exclusively on retirement phase
- **Simplified inputs** - No current age, no contributions, no growth-before-retirement
- **Clarified language** - All amounts in "retirement-year dollars"
- Retained HSA modeling, landing page, and statistical accuracy improvements from v1.2

---

## 2. USER PROFILE & RETIREMENT TIMELINE

**Purpose:** Establish retirement timeline and tax context for all calculations. These fundamental parameters drive retirement duration, tax filing considerations, and phase transitions throughout the simulation.

### 2.1 Personal Information (4 inputs - SIMPLIFIED)

- **Retirement age** (50-75) - Your retirement starting point
- **Life expectancy** (default: 95, range: 70-110) - Planning horizon
- **Current state** (dropdown, 50 US states + DC) - For reference only

**Implementation Details:**
- Retirement duration calculated as: `lifeExpectancy - retirementAge`
- All dollar inputs represent values **at retirement start** (retirement-year dollars)
- Tool supports **single filers only** - couples support planned for future versions
- State stored for reference only (no state-specific tax modeling)
- Display can show "X years of retirement" prominently

### 2.2 Retirement Phase Definitions (3 phases)

**Purpose:** Model changing spending patterns across retirement. Research shows spending typically decreases as retirees age, moving from active travel years to more sedentary phases with increased healthcare needs.

**Phase Structure:**
1. **Go-Go Years** (Active retirement: travel, hobbies, activities)
2. **Slow-Go Years** (Reduced activity: less travel, more home-based)
3. **No-Go Years** (Limited mobility: increased care needs)

**Per Phase Inputs:**
- Starting age (must be sequential: retirement age → phase 2 → phase 3)
- Annual spending (retirement-year dollars, inflation-adjusted forward)
- One-time expenses (optional, 0-5 per phase):
  - Year (relative to retirement: year 1, 2, 3...)
  - Amount (retirement-year dollars)
  - Description (e.g., "New car", "Roof replacement")

**Implementation Details:**
- Phase 1 must start at retirement age
- Phases must be sequential and non-overlapping
- Each phase continues until next phase starts or life expectancy reached
- One-time expenses applied in specific simulation year
- All amounts inflation-adjusted from retirement year forward
- Spending includes everything except healthcare (modeled separately)

**Validation:**
- Phase start ages must be: `retirementAge ≤ phase2Age ≤ phase3Age ≤ lifeExpectancy`
- At least one phase required (defaults to single phase if not specified)
- One-time expenses must fall within phase boundaries

---

## 3. INVESTMENT ACCOUNTS AT RETIREMENT

**Purpose:** Define your portfolio composition **AT retirement**. We don't model growth before retirement - just tell us what you'll have when you retire.

### 3.1 Account Types (4 types)

**For each account type, provide:**
- **Balance at retirement** (projected amount when you retire, in retirement-year dollars)
- **Expected annual return during retirement** (default: 7%, range: -10% to +20%)
- **Expected standard deviation** (default: 18%, range: 5-30%, Advanced mode only)

**Account Types:**

**1. Tax-Deferred (Traditional 401k/IRA):**
- Withdrawals taxed as ordinary income
- Subject to RMDs starting age 73
- Most common account type

**2. Roth (Roth 401k/IRA):**
- Contributions were taxed, growth tax-free
- Withdrawals completely tax-free
- No RMDs during owner's lifetime

**3. Taxable (Brokerage):**
- Non-retirement investment account
- Cost basis: User specifies % of balance (default: 50%)
- Only gains taxed on withdrawal (balance - cost basis)
- Example: $100k balance, 50% cost basis = $50k taxable on full withdrawal

**4. ✅ HSA (Health Savings Account):**
- Triple tax advantage: tax-free in, growth, and healthcare withdrawals
- Healthcare withdrawals tax-free at any age
- Non-healthcare withdrawals after age 65 taxed as ordinary income
- Automatically used for healthcare costs first (optimal strategy)

**Implementation Details:**
- Users enter projected balance at retirement (not current balance)
- All accounts optional (can have zero balance)
- Multiple accounts of same type not supported (sum into one)
- Returns are account-specific (can differ by account type)
- No contribution limits, no growth tracking before retirement

### 3.2 Return Assumptions

**Per Account Configuration:**
- **Annual return:** -10% to +20% (default: 7%)
  - Represents expected average return during retirement
  - Applied each simulation year
  
- **Standard deviation:** 5-30% (default: 18%, Advanced mode only)
  - Represents volatility/uncertainty
  - Used in Monte Carlo to generate return sequences

**Blended Portfolio Return (Educational):**
If user has multiple accounts with different returns, tool can calculate weighted average:
```
Blended Return = Σ(Account Balance × Return) / Total Balance
Example: $400k @ 7% + $100k @ 5% = $28k + $5k = $33k / $500k = 6.6%
```

**Implementation:**
- Box-Muller transform generates normally distributed random returns
- Independent returns per account (no correlation modeling - limitation disclosed)
- Returns applied only during retirement years (age ≥ retirement age)
- Negative returns possible (market losses)

### 3.3 Withdrawal Priority (User Configurable)

**Purpose:** Optimize tax efficiency by withdrawing from accounts in the right order.

Generally optimal strategy:
1. **Taxable first** (lowest tax - only gains taxed)
2. **Tax-Deferred middle** (deferred tax - full withdrawal taxed)
3. **Roth last** (never taxed - preserve longest)

**HSA Special Treatment (Priority 0 - Automatic):**
- HSA **always used first** for healthcare costs (tax-free, any age)
- Cannot be reordered by user
- Optimal strategy built into simulation

**User-Configurable Order (Priority 1-3):**
- Taxable, Tax-Deferred, Roth can be reordered via drag-and-drop
- Default order: Taxable → Tax-Deferred → Roth
- Some users may prefer different strategies

**RMD Override (Age 73+):**
- RMDs calculated from IRS Uniform Lifetime Table
- RMD withdrawals **forced** from Tax-Deferred accounts regardless of priority
- If RMD > cash flow need, excess reinvested to Taxable account
- RMD calculated independently in each Monte Carlo run based on that run's balance

**Complete Withdrawal Logic (Execution Order):**

1. **HSA for Healthcare (Automatic, Priority 0):**
   - Use HSA to cover all healthcare costs (premiums + out-of-pocket) - TAX-FREE
   - Applied before any other withdrawals
   - Available at any age

2. **RMD Enforcement (Age 73+, Priority Override):**
   - Calculate RMD from Tax-Deferred balance
   - Withdraw full RMD amount (required by law)
   - If RMD > cash flow gap, excess → Taxable account
   - RMD counts as taxable income

3. **HSA for General Expenses (Age 65+, After Healthcare):**
   - If HSA balance remains after covering healthcare AND age ≥ 65:
   - Use HSA for general cash flow needs (taxed as ordinary income)
   - Calculated with tax gross-up: `grossNeeded = net / (1 - effectiveTaxRate)`

4. **Normal Priority Sequence (User-Specified):**
   - Attempt withdrawals in user-specified order (Priority 1-3)
   - Withdraw from each account until need met or account depleted
   - Move to next priority if account insufficient

5. **Account Depletion Handling:**
   - If account insufficient, use available balance and move to next account
   - Track shortfall if all accounts depleted
   - No withdrawals possible after total portfolio depletion (income-only survival)

**Tax Gross-Up Calculation:**
- Iterative convergence (2-5 iterations typical)
- Accounts for taxes on the withdrawal itself
- Convergence threshold: $100 or less change between iterations
- Example: Need $10k net, 20% tax rate → withdraw ~$12,500 gross

---

## 4. INCOME SOURCES DURING RETIREMENT

**Purpose:** Model non-portfolio income that reduces withdrawal needs. More income = less portfolio depletion = higher success rates.

### 4.1 Social Security

**FRA Benefit (Full Retirement Age):**
- Dollar amount at age 67 (obtain from SSA.gov estimate)
- Enter amount in **retirement-year dollars** (inflation-adjusted if retiring in future)

**Claiming Age:** 62-70 (default: 67)
- **Early claiming (62-66):** Reduced benefit (actuarial adjustment)
  - ~70% of FRA benefit at age 62
  - ~86% at age 65
- **Full benefit:** 100% at FRA (age 67)
- **Delayed claiming (68-70):** Increased benefit
  - 8% increase per year after FRA
  - 124% at age 70 (maximum)

**COLA (Cost of Living Adjustment):**
- Applied annually at user-specified rate (default: 2.5%)
- Compounds from claiming year forward

**Earnings Test (if claiming before FRA + working):**
- Applies only if: `age < FRA` AND `claiming SS` AND `part-time work income > threshold`
- 2025 threshold: $22,320/year
- Reduction: $1 benefit lost for every $2 over threshold
- Complex multi-year calculation (implemented in ss.ts module)
- Benefits not permanently lost (recalculated at FRA)

**SS Taxable Percentage:**
- User-specified: 0-85% (default: 50%)
- Simplified vs actual provisional income formula (limitation disclosed)
- Applied to SS income for tax calculation

**Implementation Details:**
- Benefit starts at claiming age (may be different from retirement age)
- If claiming age > retirement age, benefit starts later
- COLA inflation compounds from claiming year, not retirement year
- Full calculation in `calculateSSBenefit()` module
- Earnings test in `applyEarningsTest()` module

### 4.2 Pensions

**Purpose:** Model defined benefit pension income (less common today, but still relevant for many).

**Per Pension (0-5 entries):**
- **Annual amount** (retirement-year dollars)
- **Start age** (age when pension begins, may differ from retirement age)
- **COLA rate** (default: 0% = fixed nominal, range: 0-5%)

**Implementation Details:**
- Pension starts at specified start age (can be before/after retirement age)
- If start age > retirement age, no benefit until that age
- COLA compounds from pension start year (if > 0%)
- Multiple pensions additive (total pension income = sum of all)
- No survivor benefit modeling (limitation)

**Example:**
- Pension 1: $30,000/year starting age 65, 2% COLA
- Pension 2: $15,000/year starting age 67, 0% COLA

### 4.3 Part-Time Work During Retirement

**Annual income:** Gross income (retirement-year dollars, or first-year amount)
**Work end age:** Age when part-time work stops

**Tax Treatment:**
- Subject to **income tax** (included in taxable income)
- Subject to **payroll tax** (7.65% FICA - separate from income tax)
- Total tax burden higher than portfolio withdrawals

**Interaction with Social Security:**
- If claiming SS before FRA, work income triggers earnings test
- May reduce or eliminate SS benefits temporarily
- Benefits recalculated at FRA (no permanent loss)

**Implementation Details:**
- Income only received if `age < workEndAge`
- No inflation adjustment assumed (nominal amount or user re-enters each planning year)
- Payroll tax calculated separately: `income × 0.0765`
- Income tax applied to (work income + SS + pensions + withdrawals)

### 4.4 Rental Income

**Annual income:** Net rental income after expenses (retirement-year dollars)
**Income end age:** When rental income stops (e.g., selling property)

**Inflation Adjustment:**
- Applied at general inflation rate
- Compounds from retirement year

**Implementation Details:**
- Simplified: No property tax, maintenance, vacancy, depreciation modeling
- Assumes net income already accounts for expenses
- Net income inflated annually from retirement year
- Stops at specified end age (property sold, lease ends, etc.)
- No capital gains modeling on property sale (limitation)

---

## 5. HEALTHCARE COSTS

**Purpose:** Healthcare is often the largest variable expense in retirement. Costs vary significantly by age phase and Medicare enrollment. Proper modeling prevents under-budgeting.

### 5.1 Pre-Medicare (Age < 65)

**Monthly premium:** Individual health insurance (ACA marketplace or other)
- Default: $800/month ($9,600/year)
- Highly variable by age, location, plan
- Enter amount in retirement-year dollars

**Annual out-of-pocket:** Deductibles, copays, medications
- Default: $3,000/year
- Separate from premiums
- Includes all non-premium healthcare spending

**Implementation:**
- Applied each year until age 65
- Both premium and out-of-pocket inflated at healthcare inflation rate
- No ACA subsidy modeling (limitation - may be significant for early retirees)

### 5.2 Medicare (Age ≥ 65)

**Enrollment:** Automatic at age 65
**2025 Base Premiums (inflated forward at 5% default):**
- Part B (Medical): $174.70/month ($2,096/year)
- Part D (Prescription): $33/month ($396/year)
- Part A (Hospital): Usually $0 if worked 40+ quarters

**IRMAA (Income-Related Monthly Adjustment Amount):**
- High earners pay surcharges on Part B and Part D
- Based on MAGI (Modified Adjusted Gross Income)
- User estimates **monthly surcharge** (simplified)
- 2025 thresholds: $103k (single) / $206k (MFJ) and up
- Calculator: medicare.gov/basics/costs

**Medigap (Supplemental Insurance):**
- Optional: Covers Part A/B gaps
- Monthly premium: User-specified (typical: $150-300/month)
- Enter $0 if not purchasing Medigap

**Annual Out-of-Pocket:**
- Costs not covered by Medicare/Medigap
- Default: $2,000/year
- Varies by health status

**Implementation Details:**
- Medicare premiums + IRMAA + Medigap + out-of-pocket = total healthcare
- All costs inflated at healthcare inflation rate (default 5%)
- ✅ HSA automatically covers healthcare costs (if available)
- IRMAA simplified (user estimates, not calculated from MAGI - limitation disclosed)

### 5.3 Phase-Based Out-of-Pocket

**Purpose:** Healthcare needs increase with age and declining health.

**User specifies out-of-pocket for each retirement phase:**
- Go-Go years: Lower (healthier, active)
- Slow-Go years: Moderate (more doctor visits)
- No-Go years: Higher (chronic conditions, more care)

**Implementation:**
- Out-of-pocket amount switches at phase transition ages
- Inflated independently at healthcare inflation rate
- Added to premiums for total healthcare cost
- ✅ HSA covers total healthcare (premiums + out-of-pocket) tax-free

---

## 6. TAX MODELING (SIMPLIFIED)

**Purpose:** Taxes significantly impact withdrawal needs. Simplified effective rate approach balances accuracy with usability.

### 6.1 Effective Tax Rate

**User-specified rate:** 10-40% (default: 22%)
- Represents average tax rate on all taxable income
- Simplified vs actual bracket calculations (limitation disclosed)
- Applied to: Tax-Deferred withdrawals, Taxable gains, SS taxable portion, pensions, work income

**Not Taxed:**
- Roth withdrawals (tax-free)
- ✅ HSA withdrawals for healthcare (tax-free)
- Taxable account cost basis (already taxed)

**Guidance for Single Filers:**
- 10-15% for $30-50k annual income
- 15-20% for $50-100k annual income  
- 20-25% for $100k+ annual income
- Higher if significant additional income, lower if minimal

**Note:** This tool currently supports single filers only. Married couples filing jointly should use separate retirement calculators or wait for future updates.

**Implementation:**
- Tax = Taxable Income × Effective Rate
- No deductions, credits, or actual bracket modeling
- State taxes not included (user adjusts federal rate if desired)

### 6.2 Payroll Tax

**Rate:** 7.65% (FICA: 6.2% Social Security + 1.45% Medicare)
- Applied **only** to part-time work income
- Separate from income tax
- No cap assumed (simplified)

**Implementation:**
- Payroll tax = Work Income × 0.0765
- Added to total tax burden
- Not applied to portfolio withdrawals, SS, or pensions

### 6.3 Tax Gross-Up

**Purpose:** When withdrawing from taxable accounts, must withdraw extra to cover taxes on the withdrawal itself.

**Example:**
- Need $10,000 net (after-tax)
- Effective tax rate: 20%
- Must withdraw: $10,000 / (1 - 0.20) = $12,500 gross
- Tax: $12,500 × 0.20 = $2,500
- Net received: $12,500 - $2,500 = $10,000 ✓

**Implementation:**
- Iterative convergence algorithm (2-5 iterations)
- Threshold: $100 or less change between iterations
- Prevents under-withdrawing for tax needs
- Applied to Tax-Deferred and Taxable gains

---

## 7. SIMULATION SETTINGS

### 7.1 Return Volatility

**Standard deviation of returns:** Default 18% (range: 5-30%, Advanced mode only)

**Purpose:** Models market uncertainty through Monte Carlo simulation.

**Implementation:**
- Box-Muller transform generates normally distributed returns
- Each Monte Carlo run uses different random return sequence
- Seeded PRNG (Mulberry32) ensures reproducibility for same inputs
- Same volatility applied to all accounts (correlation modeling future enhancement)

### 7.2 Inflation Rates

**General inflation:** Default 3.0% (range: 0-10%)
- Applied to: Living expenses, one-time expenses, rental income, pensions with COLA

**Healthcare inflation:** Default 5.0% (range: 0-15%, Advanced mode only)
- Applied to: All healthcare costs (premiums, out-of-pocket, IRMAA, Medigap)

**Implementation Details:**
- Both compound annually from retirement start
- Separate tracking for general vs healthcare categories
- Formula: `amount × (1 + rate)^yearsFromRetirement`
- Higher healthcare inflation reflects historical trends

### 7.3 Number of Simulation Runs

**Options:** 1,000 / 5,000 / 10,000 (default: 1,000, Advanced mode only)

**Purpose:** More runs = smoother percentile curves, more reliable statistics.

**Performance Targets:**
- 1K runs: ~2 seconds
- 5K runs: ~5 seconds  
- 10K runs: ~10 seconds

**Implementation:**
- Runs in Web Worker (non-blocking UI)
- Progress bar updates every 100 runs
- Results include: success rate, percentile outcomes, final balances

---

## 8. OUTPUT & VISUALIZATION

### 8.1 Summary Dashboard

**Large Display:** Success probability % with color-coded gauge
- Green (≥90%): High confidence
- Yellow (75-89%): Moderate confidence
- Orange (50-74%): Concerning
- Red (<50%): High risk

**Key Metrics Cards:**
- **Timeline:** Years of retirement (retirement age → life expectancy)
- **Portfolio:** Total starting balance, projected median/10th/90th percentile final balance
- **Lifetime Totals (Median Scenario):**
  - Total spending across all phases
  - Total taxes paid
  - Total healthcare costs
  - ✅ Total HSA coverage (tax-free healthcare withdrawals)
- **Critical Ages:**
  - Retirement start
  - Medicare enrollment (65)
  - Social Security claiming age
  - RMD start (73)
  - Phase transitions
- **Portfolio Outcomes:**
  - 10th percentile (worst 10% of outcomes)
  - Median (50th percentile)
  - 90th percentile (best 10% of outcomes)
- ✅ **HSA Coverage Years:** How many years healthcare fully covered by HSA

### 8.2 Assumptions & Limitations Panel (MANDATORY)

**Purpose:** Honest disclosure builds trust and sets realistic expectations. Users must understand what the tool does NOT model to avoid false confidence.

**Must display prominently on results page:**

**Investment Assumptions:**
- Returns: Independent normal distributions, no asset correlations
- No fat-tail crash modeling (2008-style events understated)
- Standard deviation user-specified (default 18%)
- No rebalancing between accounts

**Tax Assumptions:**
- Simplified effective rate (not actual brackets)
- SS taxation user-specified % (not provisional income formula)
- IRMAA estimated by user (not precise MAGI calculation)
- No deductions, credits, or state-specific rules
- ✅ HSA healthcare withdrawals correctly modeled as tax-free

**Healthcare Assumptions:**
- Medicare premiums: 2025 base, 5% inflation
- Out-of-pocket: User estimates only
- **Long-term care NOT modeled** (could be $50k-150k+/year)
- No ACA subsidy calculation for pre-65
- ✅ HSA assumed to cover healthcare first (optimal strategy)

**Spending Assumptions:**
- Constant within each phase (inflation-adjusted)
- **No automatic adjustments** for market performance
- No guardrails or dynamic spending rules

**Mortality Assumptions:**
- **Fixed life expectancy** (no probability distribution)
- May live longer or shorter than specified
- No longevity insurance modeling

**What's NOT Modeled:**
- Pre-retirement accumulation/contributions
- Asset correlations, fat-tail crashes
- Long-term care costs
- Couples/spousal strategies
- Actual tax calculations (brackets, deductions)
- Dynamic spending flexibility
- Estate planning, legacy goals
- Inflation variability (uses fixed rates)
- ACA subsidies (pre-65 healthcare)
- Roth conversions
- State taxes

**Disclaimer:** Educational projections only. Not financial, tax, or legal advice. Actual outcomes will vary. Consult qualified professionals before making decisions.

### 8.3 Visualizations

**Year-by-Year Cash Flow Chart:**
- **Stacked bars - Income sources:**
  - Social Security (blue)
  - Pensions (green)
  - Part-Time Work (purple)
  - Rental Income (amber)
  - Portfolio Withdrawals (gray)
  - ✅ HSA Withdrawals (pink) - shown separately when used
  
- **Stacked bars - Expenses:**
  - Living expenses (red)
  - Healthcare costs (pink)
  - Taxes (purple)
  - One-time expenses (orange)
  
- **Line overlays:**
  - Portfolio balance (median)
  - Confidence bands: 25th-75th percentile (dark), 10th-90th percentile (light)
  - ✅ HSA balance depletion over time
  
- **Event markers:**
  - Retirement start
  - Medicare eligibility (65)
  - Social Security claiming
  - RMD start (73)
  - Phase transitions (Go-Go → Slow-Go → No-Go)

**Monte Carlo Uncertainty Chart:**
- 100-200 simulation paths (thin gray lines, low opacity)
- Highlighted percentiles:
  - 10th percentile (red dashed) - "Worst 10% of Outcomes"
  - 50th percentile (green solid) - "Median Outcome"
  - 90th percentile (blue dashed) - "Best 10% of Outcomes"
- Confidence band shading (25th-75th percentile)
- ✅ **Improved terminology:** Statistical accuracy over assumption language
  - "Worst 10% of Outcomes" not "Pessimistic"
  - "Median Outcome" not "Expected"
  - "Best 10% of Outcomes" not "Optimistic"

**Final Balance Distribution (Histogram):**
- X-axis: Final portfolio balance
- Y-axis: Frequency (number of simulation runs)
- Color-coded bars by success/failure
- Shows full range of possible outcomes

**Annual Breakdown Table (Expandable):**
- All years from retirement to life expectancy
- Columns: Age, Income Sources, Expenses, Taxes, Withdrawals (by account), End Balances (by account)
- ✅ **HSA columns:** HSA healthcare coverage (tax-free), HSA balance remaining
- Show median scenario by default (can toggle to 10th/90th percentile)
- Export to CSV with full account details
- Sortable, filterable for analysis

---

## 9. USER INTERFACE & WORKFLOW

### 9.1 Landing Page (NEW in v1.2)

**Purpose:** Clear value proposition before entering wizard.

**Components:**
- Hero section: "The Honest Retirement Calculator"
- Key differentiators:
  - "Shows its limitations transparently"
  - "Monte Carlo simulation with probabilistic outcomes"
  - "No signup, no tracking, completely private"
- Target audience: Early retirement planners, FIRE community
- Call-to-action: "Start Planning" → Wizard Step 1
- Optional: "Learn More" → FAQ/About section

### 9.2 Wizard Interface (6 Steps)

**Navigation:**
- Progress indicator (1 of 6, 2 of 6, etc.)
- Back/Next buttons (validation on Next)
- Save draft to localStorage (auto-save on each step)

**Step 1: Personal Information**
- Retirement age, life expectancy, state

**Step 2: Retirement Phases**
- 3 phases: spending amounts, start ages, one-time expenses

**Step 3: Investment Accounts**
- 4 account types: balances at retirement, returns, withdrawal priority

**Step 4: Income Sources**
- Social Security, pensions, part-time work, rental income

**Step 5: Healthcare**
- Pre-Medicare costs, Medicare parts, out-of-pocket by phase

**Step 6: Taxes & Simulation**
- Effective tax rate, inflation rates, simulation runs
- **Calculate button** → Web Worker → Results page

**Basic/Advanced Toggle:**
- Basic: ~50 core inputs (hides 5-7 technical settings)
- Advanced: ~55 inputs (shows all Basic + technical options)
- Defaults appropriate for most users (70% cost basis, 1K runs, 18% volatility, 5% healthcare inflation)

### 9.3 Results Dashboard

**Layout:**
- Summary cards (top): Success rate, key metrics, outcomes
- **Mandatory Assumptions Panel:** Expandable, always visible, must acknowledge
- Tabs/sections:
  - Overview (summary + assumptions)
  - Cash Flow Chart
  - Monte Carlo Paths
  - Histogram
  - Annual Breakdown Table
- Actions: Save scenario, Export CSV, Start over, Modify inputs

### 9.4 Profile Management

**Features:**
- Save scenario: Name + inputs (not results) to localStorage
- Load scenario: Recalculate simulation on load
- Multiple profiles: Up to 10 scenarios (storage limit ~50-100KB each)
- Delete/Reset: With confirmation dialogs

**Storage Strategy:**
- Inputs only (not results) to save space
- Results recalculated on load
- JSON format in localStorage
- Key: `retirement-planner-profiles`

### 9.5 Responsive Design

**Desktop (≥1024px):**
- Full width, side-by-side comparisons
- Multi-column layouts
- Rich tooltips and hover states

**Tablet (768-1023px):**
- Single column, stacked sections
- Simplified charts (fewer data points)
- Touch-friendly targets (44px minimum)

**Mobile (<768px):**
- Vertical scroll, simplified charts
- Collapsible sections
- Essential info prioritized
- Streamlined wizard (one input per screen if needed)

**Print:**
- Includes assumptions panel
- Removes interactive elements (buttons, tooltips)
- Optimized for letter/A4 paper
- Charts rendered as static images

---

## 10. VALIDATION & ERROR HANDLING

### 10.1 Input Validation (Real-Time)

**Age Validation:**
- Retirement age: 50-75
- Life expectancy: 70-110
- Life expectancy > retirement age (enforced)
- Phase ages: Sequential and within retirement → life expectancy range
- Medicare age: Automatically 65 (not user input)
- RMD age: Automatically 73 (not user input)

**Amount Validation:**
- Non-negative: All dollar amounts (except returns can be negative)
- Account balances: ≥$0
- ✅ HSA balance: ≥$0
- Returns: -10% to +20% (realistic range)
- Tax rates: 0-100%
- Inflation: 0-20% (extreme upper bound)

**Logical Validation:**
- SS claiming age: 62-70
- If claiming before FRA + working: Show earnings test warning
- Taxable account cost basis: 0-100% of balance
- Phase start ages: Must be sequential
- One-time expenses: Must fall within phase date ranges

**Error Messages:**
- Inline, below field
- Clear, actionable language
- Example: "Life expectancy must be greater than retirement age"

### 10.2 Calculation Validation

**Portfolio Balance Checks:**
- Warn if total portfolio < $100k (may be too low)
- Warn if spending > 10% of portfolio (high withdrawal rate)
- Validate RMD calculations against IRS tables

**Healthcare Cost Checks:**
- Warn if pre-Medicare < $500/month (likely too low for ACA)
- Warn if no Medigap + low out-of-pocket (may be underestimating)

**Tax Validation:**
- Ensure effective rate reasonable for income level
- Warn if rate < 10% or > 35% (unusual)

**Monte Carlo Validation:**
- Verify percentile relationships: 10th ≤ 25th ≤ 50th ≤ 75th ≤ 90th
- Check for infinite loops in tax gross-up
- Validate account balance never goes negative within a year (should hit zero and stop)

---

## 11. EDUCATIONAL FEATURES

### 11.1 Contextual Help (? Icons & Tooltips)

**Key Topics:**
- **Blended return rate:** How to calculate weighted average across accounts
- **RMD (Required Minimum Distribution):** What it is, when it starts, how calculated
- **SS Earnings Test:** How working reduces benefits before FRA
- **Effective vs marginal tax rate:** Difference explained with examples
- **IRMAA:** Income thresholds, surcharge amounts, where to look up
- **Monte Carlo simulation:** What it means, why percentiles matter
- **Success rate:** Definition ("% of simulations where portfolio lasts until age X")
- ✅ **HSA triple tax advantage:** Tax-free contributions, growth, and healthcare withdrawals; after 65 becomes like Traditional IRA for non-medical

### 11.2 FAQ (Expandable Panel or Separate Page)

**Common Questions:**

1. **"Where do I enter bonds in my 401k?"**
   - Answer: Calculate blended return rate across all assets in account. Example provided.

2. **"Does this tool support married couples?"**
   - Answer: Not currently. The tool is designed for single filers only. Supporting married couples requires modeling joint tax filing, survivor benefits, and coordinated withdrawal strategies - features planned for a future version.

3. **"I want to work part-time and claim SS early. What happens?"**
   - Answer: Earnings test may reduce benefits. Explain calculation, link to SSA.gov.

4. **"How accurate is this tool?"**
   - Answer: Educational estimates only. List key limitations. Recommend CFP consultation.

5. **"What does success rate mean?"**
   - Answer: % of simulations where portfolio lasts until life expectancy. 90%+ is strong, <75% needs adjustment.

6. **"What's not included in this tool?"**
   - Answer: Long-term care, couples, actual tax brackets, dynamic spending, state taxes, etc.

7. ✅ **"How should I use my HSA?"**
   - Answer: Cover healthcare tax-free (optimal). After 65, can use for any expense but taxed like Traditional IRA. Preserve as long as possible for maximum tax benefit.

8. **"Why do I need to provide balances at retirement, not current balances?"**
   - Answer: This tool models retirement phase only. Use a compound interest calculator to project your current balances forward to retirement age.

### 11.3 External Resources

**Links to Official Sources:**
- **Social Security Administration:** ssa.gov/benefits/retirement/estimator.html
- **Medicare:** medicare.gov/basics/costs
- **IRS RMD Tables:** irs.gov (Publication 590-B)
- **Find a CFP:** cfp.net/find-a-cfp-professional

**Educational Articles (Optional):**
- "Understanding Monte Carlo Simulation"
- "Safe Withdrawal Rates: The 4% Rule"
- "Tax-Efficient Withdrawal Strategies"
- "Medicare Enrollment: What You Need to Know"

---

## 12. TECHNICAL SPECIFICATIONS

### 12.1 Technology Stack

**Frontend:**
- React 18+ with TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui components
- Recharts (visualizations)

**Router:**
- React Router v6
- Routes: Landing page (`/`) → Wizard (`/plan`) → Results (`/results`)

**State Management:**
- React Context API
- React Hook Form with Zod validation
- No Redux (unnecessary complexity for single-page tool)

**Calculations:**
- Custom TypeScript modules:
  - `monteCarlo.ts` - Main simulation engine
  - `withdrawal.ts` - Withdrawal sequencing logic
  - `tax.ts` - Tax calculations and gross-up
  - `ss.ts` - Social Security benefit calculations
  - `rmd.ts` - Required Minimum Distribution calculations
  - ✅ `hsa.ts` - HSA withdrawal logic (healthcare + non-medical)
  - `inflation.ts` - Inflation adjustments
  - `prng.ts` - Seeded random number generator (Mulberry32)

**Workers:**
- Web Workers for Monte Carlo simulation (prevents UI blocking)
- Progress callbacks every 100 runs

**Storage:**
- localStorage for profile management
- JSON serialization
- Key: `retirement-planner-profiles`
- Max 10 profiles (~500KB-1MB total)

**Export:**
- CSV export using Papa Parse or custom CSV generator
- Full annual breakdown with account details

**Deployment:**
- Vercel or Netlify (static site, no backend)
- CDN for fast global access
- HTTPS enforced

### 12.2 Performance Requirements

**Calculation Speed:**
- 1K simulations: <2 seconds
- 5K simulations: <5 seconds
- 10K simulations: <10 seconds

**UI Responsiveness:**
- Web Worker prevents UI blocking during calculations
- Progress bar updates smoothly (every 100 runs)
- Chart rendering: <500ms after data ready

**Bundle Size:**
- Initial load: <500KB (gzipped)
- Code splitting for charts (lazy load)

**Browser Support:**
- Modern browsers only (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- No IE11 support

### 12.3 Validation & Testing

**Input Validation:**
- Real-time validation with inline errors
- Age logic enforced (retirement < life expectancy, sequential phases)
- Non-negative amounts (except returns)
- ✅ HSA balance non-negative
- Clear, actionable error messages

**Calculation Testing:**
- Unit tests for all calculation modules
- Verify RMD calculations against IRS tables
- Validate percentile relationships (10th ≤ 50th ≤ 90th)
- Test tax gross-up convergence (no infinite loops)
- ✅ Verify HSA withdrawal logic (healthcare first, non-medical after 65)

**End-to-End Testing:**
- Test full wizard flow
- Verify results accuracy against manual calculations
- Test profile save/load/delete
- Test CSV export format

**Edge Cases:**
- Zero portfolio balance (income-only retirement)
- Very high/low spending rates
- Extreme return scenarios (all negative, all positive)
- RMD > cash flow need (excess reinvestment)
- Account depletion mid-retirement
- ✅ HSA depletion before healthcare costs end

### 12.4 Security & Privacy

**Privacy-First Design:**
- **No server, no accounts, no tracking**
- All calculations client-side (JavaScript in browser)
- No data sent to external servers
- No analytics beyond basic page views (optional)

**Data Storage:**
- localStorage not encrypted (plain JSON)
- Warning: "Do not use on shared/public computers"
- No sensitive data required (no SSN, account numbers, names)

**Content Security:**
- CSP headers prevent XSS
- No inline scripts
- HTTPS only (enforced by hosting)

---

## 13. FUTURE ENHANCEMENTS

### 13.1 High Priority (v2.0)

1. **Asset allocation modeling per account**
   - Specify stocks/bonds/cash per account
   - Model correlations between asset classes
   - More realistic return sequences

2. **Dynamic spending / guardrails**
   - Adjust spending based on portfolio performance
   - Implement guardrails (e.g., Guyton-Klinger)
   - Show spending adjustments in results

3. **Probabilistic mortality**
   - Use actuarial tables (SSA life tables)
   - Model range of lifespans, not fixed
   - Show probabilities of outliving portfolio

4. **Couples planning**
   - Joint life expectancy
   - Survivor benefits (SS, pensions)
   - Coordinated healthcare (spousal coverage)

### 13.2 Medium Priority (v2.5)

5. **Long-term care modeling**
   - Optional LTC insurance
   - Self-funding estimates ($50k-150k+/year)
   - Probability of needing care by age

6. **Roth conversion optimization**
   - Model conversions during low-income years
   - Tax impact analysis
   - Long-term tax savings

7. **Advanced tax modeling**
   - Actual federal brackets (not just effective rate)
   - State taxes by state
   - Deductions, credits (standard/itemized)

8. **ACA subsidy calculation**
   - Pre-65 healthcare cost reduction
   - MAGI-based subsidy estimation
   - Cliffs and phase-outs

### 13.3 Lower Priority (v3.0+)

9. **User accounts / cloud sync**
   - Optional account creation
   - Sync profiles across devices
   - Collaboration with advisors

10. **Smart recommendations / AI insights**
    - "Your withdrawal rate is high. Consider..."
    - Optimization suggestions
    - Scenario comparisons

11. **Legacy/inheritance goals**
    - Target end balance
    - Estate planning considerations
    - Beneficiary modeling

12. **Professional advisor features**
    - Client management
    - Branded reports
    - Advanced scenarios

13. **Mobile native app**
    - iOS/Android apps
    - Offline mode
    - Push notifications for rebalancing

---

## 14. ACCEPTANCE CRITERIA

### 14.1 Functional Requirements ✅

- ✅ Landing page with clear value proposition and routing
- ✅ 6-step wizard with validation
- ✅ Basic/Advanced toggle works correctly
- ✅ Monte Carlo simulation accurate (verified against manual calculations)
- ✅ All visualizations display correctly (cash flow, paths, histogram, table)
- ✅ HSA modeling (healthcare tax-free, non-medical after 65 taxed)
- ✅ Profile save/load/delete in localStorage
- ✅ Assumptions panel mandatory and prominent on results page
- ✅ CSV export with full account details

### 14.2 User Experience ✅

- ✅ Intuitive navigation (landing → wizard → results)
- ✅ Clear error messages with actionable guidance
- ✅ Helpful tooltips/FAQ (including HSA strategy)
- ✅ Improved terminology (Monte Carlo percentiles vs assumptions)
- ✅ Responsive design (desktop/tablet/mobile)
- ✅ Print-friendly results page
- ✅ Performance targets met (<3 sec load, calculations as specified)

### 14.3 Calculation Accuracy ✅

- ✅ RMDs match IRS Uniform Lifetime Table
- ✅ SS benefit adjustments accurate (62-70 claiming ages)
- ✅ SS earnings test correctly applied (pre-FRA only)
- ✅ Tax gross-up converges correctly (<5 iterations, $100 threshold)
- ✅ HSA tax treatment accurate (healthcare tax-free, non-medical taxed after 65)
- ✅ Inflation applied consistently (general vs healthcare rates)
- ✅ All limitations disclosed prominently in assumptions panel

### 14.4 Data Persistence ✅

- ✅ Profiles persist across browser sessions
- ✅ Only inputs stored (results recalculated on load)
- ✅ HSA balance persisted correctly in profiles
- ✅ No data loss on page refresh
- ✅ 10 profiles max within localStorage limits
- ✅ CSV export includes HSA details

---

## 15. ASSUMPTIONS & CONSTRAINTS

### 15.1 Key Assumptions

**User Capabilities:**
- User can obtain Social Security estimate from ssa.gov
- User can project account balances to retirement age (or use external calculator)
- User comfortable with probabilistic results (not guarantees)
- This is educational, not professional financial advice

**Technical Assumptions:**
- Browser supports ES6+ JavaScript and Web Workers
- localStorage available and not disabled
- Modern browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- ✅ User has HSA balance projected at retirement (no contribution modeling)

**Financial Assumptions:**
- Returns follow normal distribution (no fat tails)
- All accounts share same volatility (no correlation modeling)
- Inflation rates constant (not variable)
- Spending constant within each phase (no dynamic adjustment)

### 15.2 Key Constraints

**Scope Limitations:**
- Single person only (no couples, no joint planning)
- US-only (tax rules, Social Security, Medicare)
- No long-term care modeling (separate insurance decision)
- Simplified tax (effective rate only, no brackets/deductions)
- No pre-retirement accumulation/contribution modeling
- Fixed life expectancy (no probabilistic mortality)

**Technical Constraints:**
- Browser storage only (no cloud, no backend)
- No real-time data feeds (user inputs all values)
- Client-side only (all calculations in browser)
- No asset correlations (accounts independent)
- Normal distribution only (no fat-tail crash modeling)
- No IRS contribution limit enforcement (user provides final balances)

**Data Constraints:**
- ✅ HSA: No contribution limits, no family coverage, no employer match modeling
- No state-specific tax rules
- No actual MAGI calculation (user estimates IRMAA)
- No ACA subsidy calculation
- No Roth conversion optimization
- No dynamic spending rules (guardrails)

### 15.3 Required Disclaimers

**Must appear on results page:**

"**Educational Projections Only. Not Financial, Tax, or Legal Advice.**

This tool provides educational estimates based on simplified assumptions. Actual outcomes will vary significantly due to:
- Market performance (returns may differ from assumptions)
- Tax law changes
- Healthcare cost variability
- Life expectancy uncertainty
- Inflation fluctuations
- Personal circumstances

**Past performance does not indicate future results.**

Consult qualified professionals (CFP, CPA, attorney) before making financial decisions. This tool cannot replace personalized professional advice."

---

## 16. GLOSSARY

**COLA:** Cost of Living Adjustment (annual inflation increase to benefits)

**FRA:** Full Retirement Age (67 for most people born 1960+)

**IRMAA:** Income-Related Monthly Adjustment Amount (Medicare surcharge for high earners)

**MAGI:** Modified Adjusted Gross Income (used for IRMAA determination)

**RMD:** Required Minimum Distribution (mandatory withdrawals from tax-deferred accounts starting age 73)

**Cost Basis:** Original investment amount in taxable account (not taxed on withdrawal)

**Monte Carlo:** Statistical simulation method using randomized returns to model uncertainty

**Success Rate:** Percentage of simulations where portfolio lasts until life expectancy

**Effective Tax Rate:** Average tax rate (total tax ÷ total income), not marginal rate

**Tax Gross-Up:** Withdrawing extra amount to cover taxes on the withdrawal itself

**Box-Muller Transform:** Algorithm to generate normally distributed random numbers from uniform random numbers

**PRNG:** Pseudo-Random Number Generator (Mulberry32 algorithm for reproducible randomness)

**Percentile:** Statistical rank (10th percentile = worst 10% of outcomes, 50th = median, 90th = best 10%)

✅ **HSA:** Health Savings Account - Triple tax advantage (tax-free contributions, growth, and healthcare withdrawals; after 65 works like Traditional IRA for non-medical expenses)

---

**END OF REQUIREMENTS DOCUMENT v1.3**

**Document Version:** 1.3  
**Last Updated:** 2025-02-12  
**Major Changes from v1.2:**
- Removed pre-retirement modeling (current age, contributions, years until retirement)
- Simplified to retirement-phase-only focus
- Clarified all inputs are "at retirement" or "retirement-year dollars"
- Streamlined account section (removed contribution logic)
- Updated future enhancements (removed HSA contribution modeling)
- Maintained all v1.2 improvements (HSA, landing page, terminology)

**Status:** Ready for Implementation