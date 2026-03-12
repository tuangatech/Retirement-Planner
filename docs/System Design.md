# Retirement Planning Simulator - System Design Document (v2.1)

## 1. SYSTEM ARCHITECTURE OVERVIEW

### 1.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                         │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    React Application                        │ │
│  │                                                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │ │
│  │  │  Landing UI  │  │   Wizard UI  │  │  Results UI      │ │ │
│  │  │  (Home Page) │  │  (6 Steps)   │  │ (Dashboard)      │ │ │
│  │  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘ │ │
│  │         │                  │                    │           │ │
│  │         └──────────────────┼────────────────────┘           │ │
│  │                            │                                │ │
│  │  ┌─────────────────────────▼─────────────────────────────┐ │ │
│  │  │           State Management (React Context)            │ │ │
│  │  │  ┌──────────────────┐  ┌────────────────────────────┐ │ │ │
│  │  │  │  InputsContext   │  │    ResultsContext          │ │ │ │
│  │  │  │  (User Inputs)   │  │  (Simulation Results)      │ │ │ │
│  │  │  └──────────────────┘  └────────────────────────────┘ │ │ │
│  │  └───────────────────────┬──────────────────────────────┘ │ │
│  │                           │                                │ │
│  │  ┌────────────────────────▼───────────────────────────┐   │ │
│  │  │           Calculation Engine Layer (9 Modules)     │   │ │
│  │  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌────────┐         │   │ │
│  │  │  │Random│  │ RMD  │  │  SS  │  │ Income │         │   │ │
│  │  │  └───┬──┘  └───┬──┘  └───┬──┘  └───┬────┘         │   │ │
│  │  │      │         │         │         │               │   │ │
│  │  │  ┌───▼──────────▼─────────▼─────────▼──────┐      │   │ │
│  │  │  │  Expenses  │  Taxes  │  Withdrawals    │      │   │ │
│  │  │  │  (+ HSA)   │         │  (+ HSA Logic)  │      │   │ │
│  │  │  └────┬───────────┬──────────┬─────────────┘      │   │ │
│  │  │       │           │          │                    │   │ │
│  │  │  ┌────▼───────────▼──────────▼──────────┐         │   │ │
│  │  │  │      Yearly Projection Assembly      │         │   │ │
│  │  │  └─────────────────┬────────────────────┘         │   │ │
│  │  │                    │                              │   │ │
│  │  │  ┌─────────────────▼────────────────────────┐     │   │ │
│  │  │  │  Monte Carlo Engine (Web Worker)        │     │   │ │
│  │  │  │  • Run 1000+ simulations                │     │   │ │
│  │  │  │  • Progress reporting                   │     │   │ │
│  │  │  │  • Results aggregation                  │     │   │ │
│  │  │  └──────────────────────────────────────────┘     │   │ │
│  │  └────────────────────────────────────────────────────┘   │ │
│  │                                                              │ │
│  │  ┌────────────────────────────────────────────────────────┐│ │
│  │  │         Visualization Layer (Recharts)                 ││ │
│  │  │  • Success Gauge                                       ││ │
│  │  │  • Cash Flow Chart (Income/Expenses/Portfolio)        ││ │
│  │  │  • Monte Carlo Chart (Spaghetti + Confidence Bands)   ││ │
│  │  │  • Annual Breakdown Table (Virtualized)               ││ │
│  │  │  • Assumptions Panel (Mandatory Disclosure)           ││ │
│  │  └────────────────────────────────────────────────────────┘│ │
│  │                                                              │ │
│  │  ┌────────────────────────────────────────────────────────┐│ │
│  │  │         Storage Layer (localStorage)                   ││ │
│  │  │  • Profile Management  • Input Persistence             ││ │
│  │  └────────────────────────────────────────────────────────┘│ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### 1.2 Calculation Module Dependencies (Detailed)

```
┌──────────────────────────────────────────────────────────────┐
│                    Calculation Engine                         │
│                                                               │
│  Module 1: Random Number Generation                          │
│  ┌────────────────────────────────┐                          │
│  │  • createSeededRNG()            │                          │
│  │  • generateNormalReturn()       │─────────┐               │
│  │  • Box-Muller Transform         │         │               │
│  └────────────────────────────────┘         │               │
│           No Dependencies                    │               │
│                                              ↓               │
│  Module 2: RMD Calculations        Module 8: Yearly         │
│  ┌────────────────────────────────┐  Projection     ┌───────┤
│  │  • calculateRMD()               │         │       │       │
│  │  • IRS Uniform Table            │─────────┤       │       │
│  └────────────────────────────────┘         │       │       │
│           No Dependencies                    │       │       │
│                                              │       │       │
│  Module 3: Social Security                  │       │       │
│  ┌────────────────────────────────┐         │       │       │
│  │  • calculateSSBenefit()         │         │       │       │
│  │  • applyEarningsTest()          │──┐      │       │       │
│  │  • COLA, Claiming Adjustments   │  │      │       │       │
│  └────────────────────────────────┘  │      │       │       │
│           No Dependencies             │      │       │       │
│                                       ↓      │       │       │
│  Module 4: Income Calculations        │      │       │       │
│  ┌────────────────────────────────┐  │      │       │       │
│  │  • calculateYearlyIncome()      │◄─┘      │       │       │
│  │  • Pensions, Work, Rental       │─────────┤       │       │
│  └────────────────────────────────┘         │       │       │
│     Depends: Module 3 (SS)                  │       │       │
│                                              │       │       │
│  Module 5: Expense Calculations             │       │       │
│  ┌────────────────────────────────┐         │       │       │
│  │  • calculateYearlyExpenses()    │         │       │       │
│  │  • Phase-based, Healthcare      │─────────┤       │       │
│  │  • HSA Coverage (NEW)           │         │       │       │
│  └────────────────────────────────┘         │       │       │
│           No Dependencies                    │       │       │
│                                              │       │       │
│  Module 6: Tax Calculations                 │       │       │
│  ┌────────────────────────────────┐         │       │       │
│  │  • calculateTotalTaxes()        │         │       │       │
│  │  • Tax gross-up formulas        │─────────┤       │       │
│  └────────────────────────────────┘         │       │       │
│           No Dependencies                    │       │       │
│                                              ↓       │       │
│  Module 7: Withdrawal Algorithm             │       │       │
│  ┌────────────────────────────────┐         │       │       │
│  │  • executeWithdrawals()         │         │       │       │
│  │  • RMD enforcement              │◄────────┤       │       │
│  │  • HSA Logic (NEW)              │         │       │       │
│  │  • Priority order + Tax gross-up│         │       │       │
│  └────────────────────────────────┘         │       │       │
│     Depends: Module 2 (RMD)                 │       │       │
│              Module 6 (Taxes)               ↓       │       │
│              Module 10 (HSA - NEW)                  │       │
│                                                     │       │
│  Module 8: Yearly Projection Assembly              │       │
│  ┌────────────────────────────────┐                │       │
│  │  • calculateYearlyProjection()  │◄───────────────┘       │
│  │  • runCompleteSimulation()      │                        │
│  │  • Orchestrates ALL modules     │                        │
│  └────────────────────────────────┘                        │
│     Depends: Modules 1-7, 10                               │
│                    │                                        │
│                    ↓                                        │
│  Module 9: Monte Carlo Web Worker                          │
│  ┌────────────────────────────────┐                        │
│  │  • runMonteCarloSimulation()    │◄───────────────────────┘
│  │  • Calls Module 8 (1000+ runs) │
│  │  • Aggregates percentiles       │
│  └────────────────────────────────┘
│     Depends: Module 1, Module 8
│
│  Module 10: HSA Calculations (NEW)
│  ┌────────────────────────────────┐
│  │  • calculateHSAWithdrawal()     │
│  │  • Healthcare tax-free coverage │
│  │  • Age 65+ general withdrawals  │
│  └────────────────────────────────┘
│           No Dependencies
└──────────────────────────────────────────────────────────────┘
```

---

## 2. DATA MODELS (TypeScript Interfaces)

### 2.1 Core Input Types (Updated for v1.3)

```typescript
// Core concept: "Tell me what you'll have AT retirement"
// No pre-retirement modeling - all inputs are at retirement age

export interface PersonalInfo {
    retirementAge: number;        // Starting point (50-75)
    lifeExpectancy: number;       // Ending point (70-110)
    state: USState;               // For reference only
    // Note: Single filers only - no filingStatus field needed
}

export interface RetirementPhase {
    name: 'go_go' | 'slow_go' | 'no_go';
    startAge: number;
    endAge: number;
    annualSpending: number;       // In retirement-year dollars
}

export interface OneTimeExpense {
    id: string;
    description: string;
    amount: number;               // In retirement-year dollars
    age: number;                  // Age when expense occurs
}

// Investment accounts - balances AT RETIREMENT
export interface InvestmentAccount {
    balanceAtRetirement: number;  // What you'll have when you retire
    expectedReturnRate: number;   // Return DURING retirement
    costBasisPercentage?: number; // Only for taxable (Advanced mode)
}

// HSA Account (NEW in v1.2)
export interface HSAAccount {
    balanceAtRetirement: number;
    expectedReturnRate: number;
    allowNonMedicalAfter65: boolean;  // Default: TRUE (enabled)
}

export interface SocialSecurity {
    monthlyBenefitAtFRA: number;  // At age 67 (from SSA.gov)
    claimingAge: number;          // When to start (62-70)
    colaRate: number;
    taxablePercentage: number;    // Simplified (0-85%)
}

export interface Pension {
    id: string;
    name: string;
    monthlyAmount: number;        // In retirement-year dollars
    startAge: number;
    colaRate: number;
}

export interface PartTimeWork {
    enabled: boolean;
    annualIncome: number;         // Gross income
    startAge: number;             // Typically = retirement age
    endAge: number;
}

export interface RentalIncome {
    enabled: boolean;
    annualNetIncome: number;      // After expenses
    startAge: number;
    endAge: number | null;
    inflationAdjusted: boolean;
}

export interface PreMedicareCosts {
    monthlyPremium: number;
    annualOutOfPocket: number;
}

export interface MedicareCosts {
    partBStandardPremium: number;
    partDPremium: number;
    expectIRMAA: boolean;         // Advanced mode only
    irmaaSurcharge: number;       // If IRMAA enabled
    medigapPremium: number;
    outOfPocketByPhase: {
        phase1: number;
        phase2: number;
        phase3: number;
    };
}

export interface TaxSettings {
    combinedEffectiveRate: number;  // Simplified (10-40%)
}

export interface SimulationSettings {
    numberOfRuns: 1000 | 5000 | 10000;  // Advanced mode
    generalInflationRate: number;
    healthcareInflationRate: number;    // Advanced mode
    returnStdDeviation: number;         // Advanced mode
}

export interface UserInputs {
    personal: PersonalInfo;
    phases: [RetirementPhase, RetirementPhase, RetirementPhase];
    oneTimeExpenses: OneTimeExpense[];
    accounts: {
        taxDeferred: InvestmentAccount;
        roth: InvestmentAccount;
        taxable: InvestmentAccount;
        hsa: HSAAccount;  // NEW
    };
    withdrawalStrategy: {
        priorityOrder: Array<'taxable' | 'tax_deferred' | 'roth'>;
        // HSA handled automatically - always used first for healthcare
    };
    income: {
        socialSecurity: SocialSecurity;
        pensions: Pension[];
        partTimeWork: PartTimeWork;
        rentalIncome: RentalIncome;
    };
    healthcare: {
        preMedicare: PreMedicareCosts;
        medicare: MedicareCosts;
    };
    tax: TaxSettings;
    simulation: SimulationSettings;
    mode: 'basic' | 'advanced';
}
```

### 2.2 Calculation Result Types (Enhanced with HSA)

```typescript
// Yearly Projection (one year in one simulation run)
interface YearlyProjection {
  age: number;
  year: number;
  phase: 'go_go' | 'slow_go' | 'no_go';
  
  income: {
    socialSecurity: number;
    socialSecurityFull: number;
    socialSecurityReduction: number;
    pensions: number;
    partTimeWork: number;
    rentalIncome: number;
    totalBeforeWithdrawals: number;
  };
  
  expenses: {
    living: number;
    healthcarePremiums: number;
    healthcareOutOfPocket: number;
    oneTimeExpenses: number;
    total: number;
  };
  
  taxes: {
    onFixedIncome: number;
    onWithdrawals: number;
    payrollTax: number;
    total: number;
  };
  
  // HSA tracking (NEW)
  hsa: {
    balanceStart: number;
    healthcareCoverage: number;      // Tax-free healthcare withdrawals
    nonMedicalWithdrawal: number;    // Age 65+ general withdrawals (taxed)
    investmentReturn: number;
    balanceEnd: number;
  };
  
  portfolio: {
    withdrawals: {
      taxDeferred: number;
      roth: number;
      taxable: number;
      total: number;
    };
    rmdAmount: number;
    rmdExcess: number;
    investmentReturns: {
      taxDeferred: number;
      roth: number;
      taxable: number;
      total: number;
    };
    balances: {
      taxDeferred: number;
      roth: number;
      taxable: number;
      total: number;
    };
  };
  
  netCashFlow: number;
  shortfall: number;
  portfolioDepleted: boolean;
}

// Single Simulation Run (minimal storage)
interface SimulationRun {
  runId: number;
  success: boolean;
  ageOfDepletion: number | null;
  finalBalance: number;
}

// Selected Run (with full projections for visualization)
interface SelectedRun {
  runId: number;
  percentile: 'p10' | 'p50' | 'p90';
  projections: YearlyProjection[];
}

// Aggregated Results (from Monte Carlo)
interface SimulationResults {
  timestamp: number;
  numberOfRuns: number;
  successRate: number;
  
  percentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  
  failedRuns: {
    count: number;
    medianAgeOfDepletion: number | null;
  };
  
  selectedRuns: {
    p10: SelectedRun;
    p50: SelectedRun;
    p90: SelectedRun;
  };
  
  sampleRuns: Array<{
    runId: number;
    projections: YearlyProjection[];
  }>;
  
  // HSA summary statistics (NEW)
  hsaMetrics: {
    yearsOfHealthcareCoverage: number;  // Median scenario
    totalHealthcareCoveredTaxFree: number;
    hsaDepletionAge: number | null;
  };
}
```

### 2.3 Storage Types (Unchanged)

```typescript
// Profile stored in localStorage
export interface SavedProfile {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    inputs: UserInputs;  // Only inputs, NOT results
}

// localStorage schema
interface LocalStorageSchema {
    'retirement-planner-profiles': SavedProfile[];
}

// Max 10 profiles, ~50-100KB each
// Total storage: ~500KB-1MB
```

---

## 3. STATE MANAGEMENT ARCHITECTURE (Enhanced)

### 3.1 Context Structure

**Two Primary Contexts:**

1. **InputsContext** - Manages all user inputs (~50-55 fields)
2. **ResultsContext** - Manages simulation results and Web Worker communication

### 3.2 InputsContext Pattern (Updated)

```typescript
Purpose: Centralize all user inputs with granular update functions

State:
  - inputs: UserInputs (full state tree)
  - Derived state: mode ('basic' | 'advanced')

Methods (20+ update functions):
  - updatePersonal(data: Partial<PersonalInfo>)
  - updatePhases(data: Partial<RetirementPhase>[])
  - addOneTimeExpense(expense: OneTimeExpense)
  - removeOneTimeExpense(id: string)
  - updateAccount(type: 'taxDeferred' | 'roth' | 'taxable', data: Partial<InvestmentAccount>)
  - updateHSA(data: Partial<HSAAccount>)  // NEW
  - updateSocialSecurity(data: Partial<SocialSecurity>)
  - addPension() / removePension(id) / updatePension(id, data)
  - updatePartTimeWork(data: Partial<PartTimeWork>)
  - updateRentalIncome(data: Partial<RentalIncome>)
  - updateHealthcare(type: 'preMedicare' | 'medicare', data: any)
  - updateTax(data: Partial<TaxSettings>)
  - updateSimulation(data: Partial<SimulationSettings>)
  - setMode(mode: 'basic' | 'advanced')
  - resetToDefaults()
  - loadFromProfile(profile: UserInputs)

Implementation:
  - React Context API (no Redux)
  - useCallback for performance
  - Immutable updates with spread operators
  - Type-safe with TypeScript

Usage:
  const { inputs, updatePersonal, updateHSA } = useInputs();
  updatePersonal({ retirementAge: 65 });
  updateHSA({ balanceAtRetirement: 50000 });
```

### 3.3 ResultsContext Pattern (Updated)

```typescript
Purpose: Manage Monte Carlo simulation execution and results

State:
  - results: SimulationResults | null
  - isCalculating: boolean
  - calculationProgress: number (0-100)

Methods:
  - calculate(): Promise<void>
    → Creates Web Worker
    → Posts START message with inputs
    → Listens for PROGRESS messages
    → Receives COMPLETE message with results
    → Terminates worker
    → Updates state
  - clearResults()

Usage:
  const { results, isCalculating, calculationProgress, calculate } = useResults();
  
  // Trigger calculation
  await calculate(); // Automatically navigates to /results
  
  // Display progress
  {isCalculating && <ProgressBar value={calculationProgress} />}
  
  // Display results
  {results && <ResultsDashboard results={results} />}
```

### 3.4 Web Worker Communication Pattern

```typescript
Main Thread (ResultsContext)           Worker Thread (monte-carlo.worker.ts)
────────────────────────────           ──────────────────────────────────────

calculate() called
   ↓
Create worker instance
   ↓
worker.postMessage({                   onmessage(event)
  type: 'START',                  →      if (event.data.type === 'START')
  inputs: UserInputs,                      runMonteCarloSimulation()
  numberOfRuns: 1000                         ├─ Loop 1000 times
})                                           │   ├─ createSeededRNG(runId)
   ↓                                         │   ├─ runCompleteSimulation()
worker.onmessage(event)            ←  postMessage({  │   └─ store result
   if (PROGRESS)                      type: 'PROGRESS',  if (runId % 100 === 0)
     setProgress(%)                   progress: 35%    })
   ↓                                         │
                                             └─ Continue loop
   ↓                                         ↓
worker.onmessage(event)            ←  postMessage({
   if (COMPLETE)                      type: 'COMPLETE',
     setResults(data)                 results: SimulationResults
     navigate('/results')           })
   ↓
worker.terminate()
```

---

## 4. CALCULATION ENGINE DESIGN (Complete Implementation)

### 4.1 Module Dependency Graph

```
Module 1: Random Number Generation
├─ createSeededRNG(seed) → RNG function
├─ generateNormalReturn(mean, stdDev, rng) → number
└─ generateAccountReturns(rates, stdDev, rng) → { taxDeferred, roth, taxable, hsa }
     │
     └─────────────────────────────────────────────────┐
                                                        │
Module 2: RMD Calculations                             │
├─ calculateRMD(age, balance) → number                 │
├─ RMD_TABLE: { 73: 26.5, ..., 100: 6.4 }             │
└─ Starting age 73 (SECURE Act 2.0)                    │
     │                                                  │
     └──────────────────┐                              │
                        │                              │
Module 3: Social Security                             │
├─ calculateSocialSecurityBenefit() → number          │
├─ applyEarningsTest() → reduced benefit              │
├─ SS_ADJUSTMENT_FACTORS: { 62: 0.70, ..., 70: 1.24 } │
└─ EARNINGS_TEST_LIMITS: { BEFORE_FRA: 23400, ... }   │
     │                                                  │
     ↓                                                  │
Module 4: Income Calculations                          │
├─ calculateYearlyIncome() → income breakdown          │
├─ calculatePensionIncome() → number                   │
├─ calculatePartTimeWorkIncome() → { gross, payrollTax}│
├─ calculateRentalIncome() → number                    │
└─ Depends: Module 3 (Social Security)                 │
     │                                                  │
     ├──────────────────┐                              │
     │                  │                              │
     ↓                  ↓                              │
Module 5: Expenses     Module 6: Taxes                │
├─ calculateYearlyExpenses()  ├─ calculateTotalTaxes()│
├─ determinePhase()           ├─ calculateGrossUpForNet()
├─ calculateLivingExpenses()  ├─ Tax by account type  │
├─ calculateHealthcareCosts() └─ Iterative convergence│
└─ calculateOneTimeExpenses()        │                │
     │                               │                │
     └───────────────┬───────────────┘                │
                     │                                │
                     ↓                                │
Module 10: HSA Calculations (NEW)                     │
├─ calculateHSAWithdrawal() → HSAWithdrawalResult     │
├─ Healthcare coverage (tax-free)                     │
├─ Age 65+ general withdrawals (taxed)                │
└─ Triple tax advantage logic                         │
     │                                                 │
     └─────────────────┬───────────────────────────────┘
                       │
                       ↓
Module 7: Withdrawal Algorithm
├─ executeWithdrawals() → WithdrawalResult
├─ RMD enforcement (calls Module 2)
├─ HSA integration (calls Module 10)
├─ Tax gross-up iteration (calls Module 6)
├─ Priority order execution
└─ Depends: Module 2 (RMD), Module 6 (Taxes), Module 10 (HSA)
     │
     └─────────────────┬───────────────────────────────┘
                       │
                       ↓
Module 8: Yearly Projection Assembly
├─ calculateYearlyProjection() → YearlyProjection
├─ runCompleteSimulation() → { success, projections[] }
├─ Orchestrates ALL modules 1-7, 10
└─ Depends: ALL previous modules
     │
     ↓
Module 9: Monte Carlo Web Worker
├─ runMonteCarloSimulation() → SimulationResults
├─ Calls Module 8 (runCompleteSimulation) 1000+ times
├─ Aggregates results (success rate, percentiles)
└─ Depends: Module 1 (Random), Module 8 (Yearly Projection)
```

### 4.2 Monte Carlo Algorithm (Implemented)

```
FUNCTION runMonteCarloSimulation(inputs, numberOfRuns):
  allRuns = []
  finalBalances = []
  successCount = 0
  fullProjectionRuns = Map()
  
  // Determine which runs to store full projections
  p10Index = floor(numberOfRuns × 0.10)
  p50Index = floor(numberOfRuns × 0.50)
  p90Index = floor(numberOfRuns × 0.90)
  sampleIndices = selectRandomSample(numberOfRuns, 200)
  
  FOR runId FROM 0 TO numberOfRuns:
    // Create seeded RNG for reproducibility
    seed = createRunSeed(runId)
    rng = createSeededRNG(seed)
    
    // Run single simulation (Module 8)
    result = runCompleteSimulation(inputs, rng)
    
    // Store minimal result
    allRuns.push({ runId, success, ageOfDepletion, finalBalance })
    finalBalances.push(result.finalBalance)
    
    IF result.success:
      successCount++
    
    // Store full projections for selected runs
    IF runId IN sampleIndices:
      fullProjectionRuns.set(runId, result.projections)
    
    // Report progress every 100 runs
    IF runId % 100 == 0:
      postMessage({ type: 'PROGRESS', progress: runId / numberOfRuns × 100 })
  
  // Calculate statistics
  successRate = successCount / numberOfRuns
  sortedBalances = sort(finalBalances)
  percentiles = {
    p10: sortedBalances[p10Index],
    p25: sortedBalances[floor(numberOfRuns × 0.25)],
    p50: sortedBalances[p50Index],
    p75: sortedBalances[floor(numberOfRuns × 0.75)],
    p90: sortedBalances[p90Index]
  }
  
  // Get selected runs (re-run if not in sample)
  selectedRuns = {
    p10: getOrCreateSelectedRun(p10Index, inputs, fullProjectionRuns),
    p50: getOrCreateSelectedRun(p50Index, inputs, fullProjectionRuns),
    p90: getOrCreateSelectedRun(p90Index, inputs, fullProjectionRuns)
  }
  
  // Calculate HSA metrics (NEW)
  hsaMetrics = calculateHSAMetrics(selectedRuns.p50.projections)
  
  RETURN { 
    successRate, 
    percentiles, 
    selectedRuns,
    sampleRuns,
    failedRuns: { count, medianAgeOfDepletion },
    hsaMetrics  // NEW
  }


FUNCTION runCompleteSimulation(inputs, rng):
  balances = initialize from inputs
  hsaBalance = inputs.accounts.hsa.balanceAtRetirement
  projections = []
  ageOfDepletion = null
  
  FOR age FROM retirementAge TO lifeExpectancy:
    year = retirementAge + (age - retirementAge)
    
    // Calculate yearly projection (Module 8)
    projection = calculateYearlyProjection(
      age, year, inputs, balances, hsaBalance, rng
    )
    
    projections.push(projection)
    
    // Update balances for next year
    balances = projection.portfolio.balances
    hsaBalance = projection.hsa.balanceEnd
    
    // Check for depletion
    IF balances.total <= 0 AND hsaBalance <= 0:
      IF ageOfDepletion == null:
        ageOfDepletion = age
      // Continue simulation with income-only survival
  
  success = (ageOfDepletion == null OR ageOfDepletion >= lifeExpectancy)
  finalBalance = balances.total + hsaBalance
  
  RETURN { success, ageOfDepletion, finalBalance, projections }
```

### 4.3 HSA Withdrawal Logic (NEW in v1.2)

```
FUNCTION calculateHSAWithdrawal(
  currentAge,
  hsaBalance,
  healthcareCosts,
  generalCashFlowGap,
  allowNonMedicalAfter65,
  effectiveTaxRate
):
  // No HSA balance - return zeros
  IF hsaBalance <= 0:
    RETURN { all zeros }
  
  medicalWithdrawal = 0
  nonMedicalWithdrawal = 0
  taxOnNonMedical = 0
  
  // STEP 1: Cover healthcare costs (tax-free, any age)
  IF healthcareCosts > 0:
    medicalWithdrawal = MIN(healthcareCosts, hsaBalance)
  
  remainingHSA = hsaBalance - medicalWithdrawal
  
  // STEP 2: If age >= 65 and HSA has excess, use for general expenses (taxed)
  IF currentAge >= 65 AND allowNonMedicalAfter65 AND remainingHSA > 0 AND generalCashFlowGap > 0:
    // Calculate gross withdrawal needed to net the cash flow gap
    grossNeeded = generalCashFlowGap / (1 - effectiveTaxRate)
    
    // Limited by remaining HSA balance
    actualGross = MIN(grossNeeded, remainingHSA)
    
    nonMedicalWithdrawal = actualGross
    taxOnNonMedical = actualGross × effectiveTaxRate
  
  totalWithdrawal = medicalWithdrawal + nonMedicalWithdrawal
  finalBalance = hsaBalance - totalWithdrawal
  
  RETURN {
    medicalWithdrawal,
    nonMedicalWithdrawal,
    taxOnNonMedical,
    totalWithdrawal,
    remainingBalance: MAX(0, finalBalance),
    healthcareCovered: medicalWithdrawal
  }
```

---

## 5. COMPONENT HIERARCHY (Complete)

### 5.1 Component Tree (Updated with Landing Page)

```
App
├── InputsProvider
│   └── ResultsProvider
│       └── BrowserRouter
│           ├── Route: "/" → LandingPage (NEW)
│           │   ├── Hero Section
│           │   │   └── "The Honest Retirement Calculator"
│           │   ├── Key Features
│           │   │   ├── Transparent Limitations
│           │   │   ├── Monte Carlo Simulation
│           │   │   └── Privacy-First Design
│           │   ├── Target Audience
│           │   │   └── FIRE Community, Early Retirees
│           │   └── CTA Button → "/wizard"
│           │
│           ├── Route: "/wizard" → WizardPage
│           │   ├── Header
│           │   │   ├── Logo
│           │   │   ├── BasicAdvancedToggle
│           │   │   └── ProfileMenu (Save/Load)
│           │   ├── WizardProgress (step indicator)
│           │   ├── WizardStep (current step component)
│           │   │   ├── Step1PersonalInfo
│           │   │   ├── Step2Phases
│           │   │   ├── Step3Accounts (includes HSA)
│           │   │   ├── Step4Income
│           │   │   ├── Step5Healthcare
│           │   │   └── Step6TaxSettings
│           │   └── WizardNavigation (Back/Next/Calculate)
│           │
│           └── Route: "/results" → ResultsPage
│               ├── Header
│               ├── PageHeader (with action buttons)
│               │   ├── Edit Inputs Button
│               │   ├── Save Scenario Button
│               │   └── Export CSV Button
│               ├── TabNavigation
│               │   ├── Summary Tab (active)
│               │   ├── Cash Flow Tab
│               │   ├── Monte Carlo Tab
│               │   └── Breakdown Tab
│               └── TabContent
│                   ├── SummaryTab
│                   │   ├── SummaryDashboard
│                   │   │   ├── SuccessGauge (color-coded)
│                   │   │   ├── MetricsCards (4 cards)
│                   │   │   │   └── HSA Coverage Card (NEW)
│                   │   │   └── OutcomeCards (p10/p50/p90)
│                   │   └── AssumptionsPanel (MANDATORY)
│                   │       ├── Investment Assumptions
│                   │       ├── Tax Simplifications
│                   │       ├── Healthcare Limitations
│                   │       ├── HSA Treatment (NEW)
│                   │       ├── Spending Assumptions
│                   │       ├── What's NOT Modeled
│                   │       └── Legal Disclaimer
│                   ├── CashFlowTab (lazy loaded)
│                   │   └── CashFlowChart
│                   │       ├── Stacked Income Bars
│                   │       ├── Stacked Expense Bars
│                   │       ├── Portfolio Balance Lines (p10/p50/p90)
│                   │       ├── HSA Balance Line (NEW)
│                   │       ├── Event Markers
│                   │       └── Custom Tooltips
│                   ├── MonteCarloTab (lazy loaded)
│                   │   └── MonteCarloChart
│                   │       ├── Spaghetti Lines (~100 runs)
│                   │       ├── Confidence Band (p10-p90)
│                   │       ├── Highlighted Percentiles
│                   │       └── Interpretation Cards
│                   └── BreakdownTab (lazy loaded)
│                       └── AnnualTable
│                           ├── Percentile Selector
│                           ├── Data Table (all years)
│                           ├── HSA Columns (NEW)
│                           ├── Event Markers (icons)
│                           └── CSV Export Button
```

### 5.2 Key Component Responsibilities (Enhanced)

**Landing Page Components (NEW):**

**LandingPage:**
- Hero section with value proposition
- Feature highlights (transparency, Monte Carlo, privacy)
- Target audience positioning
- Clear CTA to start wizard
- Optional FAQ/About sections

**Wizard Components:**

**Step3Accounts:**
- Includes HSA account section (NEW)
- HSA balance at retirement input
- HSA expected return input
- Advanced: "Allow non-medical after 65" toggle
- HSA explanation box with strategy tips

**Results Components:**

**SummaryDashboard:**
- Display success probability with color coding
- Show 4 key metrics cards (includes HSA coverage)
- Display portfolio outcome range (p10/p50/p90)
- HSA coverage years metric (NEW)
- Provide actionable guidance based on success rate

**AssumptionsPanel:**
- MANDATORY disclosure of all limitations
- HSA tax treatment explanation (NEW)
- Organized by category
- "What's NOT Modeled" section
- Legal disclaimer

**CashFlowChart:**
- Recharts ComposedChart (bars + lines)
- Dual Y-axes (cash flow left, portfolio right)
- Stacked bars for income/expenses
- Multiple portfolio lines (p10/p50/p90)
- HSA balance tracking line (NEW)
- Custom tooltips with HSA details
- Event markers in legend

**AnnualTable:**
- Full data table (30-70 rows)
- Percentile toggle (p10/p50/p90)
- HSA columns (balance, healthcare coverage, withdrawals) (NEW)
- Event icons (🎂🏥💰📊)
- CSV export with HSA data
- Horizontal scroll for many columns

---

## 6. STORAGE SCHEMA (Unchanged)

```typescript
// localStorage key
const PROFILES_KEY = 'retirement-planner-profiles';

// Storage structure
interface StoredData {
  profiles: SavedProfile[];
}

interface SavedProfile {
  id: string;              // UUID
  name: string;            // User-provided name
  createdAt: number;       // Timestamp
  updatedAt: number;       // Timestamp
  inputs: UserInputs;      // ONLY inputs, NOT results
}

// Constraints
const MAX_PROFILES = 10;
const ESTIMATED_SIZE_PER_PROFILE = 50_000; // ~50KB
const MAX_TOTAL_SIZE = 500_000; // ~500KB

// Operations
function saveProfile(name: string, inputs: UserInputs): void
function loadProfile(id: string): UserInputs
function deleteProfile(id: string): void
function listProfiles(): SavedProfile[]

// Important: Results are NOT stored
// Recalculated on every load (2-10 seconds acceptable)
```

---

## 7. PERFORMANCE OPTIMIZATION STRATEGIES (Enhanced)

### 7.1 Code Splitting (Implemented)

```
Strategy: Lazy load heavy chart components

Implementation:
  const CashFlowChart = lazy(() => 
    import('./components/results/CashFlowChart').then(m => ({ default: m.CashFlowChart }))
  );
  const MonteCarloChart = lazy(() => 
    import('./components/results/MonteCarloChart').then(m => ({ default: m.MonteCarloChart }))
  );
  const AnnualTable = lazy(() => 
    import('./components/results/AnnualTable').then(m => ({ default: m.AnnualTable }))
  );

Benefits:
  - Initial bundle size reduced by ~40%
  - Charts load only when tab activated
  - Summary tab loads instantly
  - Better perceived performance

Usage:
  <Suspense fallback={<LoadingSpinner />}>
    <CashFlowChart results={results} inputs={inputs} />
  </Suspense>
```

### 7.2 Web Worker for Monte Carlo (Implemented)

```
Why:
  - Monte Carlo with 10,000 runs takes 8-12 seconds
  - Running on main thread freezes UI
  - Web Workers run calculations in separate thread
  - UI remains responsive with progress updates

Implementation:
  // Main thread (ResultsContext)
  const worker = new Worker(new URL('../workers/monte-carlo.worker.ts', import.meta.url));
  worker.postMessage({ type: 'START', inputs, numberOfRuns });
  worker.onmessage = (e) => {
    if (e.data.type === 'PROGRESS') {
      setProgress(e.data.progress);
    } else if (e.data.type === 'COMPLETE') {
      setResults(e.data.results);
      worker.terminate();
    }
  };

Benefits:
  - Main thread never blocked
  - Smooth progress bar updates
  - User can cancel calculation
  - Better user experience
```

### 7.3 useMemo for Data Transformations

```
Pattern: Cache expensive transformations

Example:
  const chartData = useMemo(() => {
    return projections.map(p => ({
      age: p.age,
      income: p.income.total,
      expenses: p.expenses.total,
      portfolio: p.portfolio.balances.total,
      hsa: p.hsa.balanceEnd  // NEW
    }));
  }, [projections]);

Benefits:
  - Recalculates only when projections change
  - Not recalculated on every render
  - Reduces CPU usage
  - Faster component updates
```

### 7.4 Chart Rendering Optimizations (Implemented)

```
Strategies:
  1. Limit spaghetti chart lines
     - Show max 100 runs (not all 10,000)
     - Pre-select in worker: selectRandomSample(numberOfRuns, 200)
     - Stored in results.sampleRuns
  
  2. Optimize data structure
     - Chart data: Only fields needed for visualization
     - Remove unused fields
     - Transform once in useMemo
  
  3. Lazy load charts
     - Only load when tab activated
     - Use React.lazy() + Suspense
     - Summary tab loads first (no heavy charts)
  
  4. Recharts optimizations
     - dot={false} for line charts (faster rendering)
     - Reduced stroke width for sample runs (0.5px)
     - Limited Legend items

Performance Results:
  - Tab switching: <200ms
  - Chart initial render: <500ms
  - Tooltip interaction: <50ms
  - Export CSV: <1 second
```

### 7.5 Memory Management (Implemented)

```
Strategy: Store only what's needed for visualization

In Worker:
  For each run:
    - Store minimal data: { runId, success, finalBalance, ageOfDepletion }
    - Size: ~50 bytes per run
    - 10,000 runs = ~500KB
  
  For selected runs (p10/p50/p90 + 200 sample):
    - Store full projections: YearlyProjection[]
    - Size: ~50KB per run with full projections
    - 203 runs = ~10MB in memory
  
  Total memory: ~10.5MB for 10,000 run simulation

In localStorage:
  - NEVER store results (too large: 5-10MB)
  - Only store inputs (~50-100KB)
  - Recalculate on load (2-10 seconds acceptable)

Benefits:
  - No memory leaks
  - Fast calculations
  - No localStorage quota issues
  - Fresh results on every load
```

---

## 8. ROUTING ARCHITECTURE (Updated)

### 8.1 Route Structure

```
/ (root)
  └─ LandingPage
      ├─ Hero + Value Proposition
      ├─ Features + Benefits
      └─ CTA → /wizard

/wizard
  └─ WizardPage
      ├─ Step 1: Personal Info
      ├─ Step 2: Phases
      ├─ Step 3: Accounts (+ HSA)
      ├─ Step 4: Income
      ├─ Step 5: Healthcare
      └─ Step 6: Tax & Simulation
      
      [Calculate Button] → /results

/results
  └─ ResultsPage
      ├─ Tab: Summary (default)
      ├─ Tab: Cash Flow
      ├─ Tab: Monte Carlo
      └─ Tab: Breakdown
      
      [Edit Inputs] → /wizard
```

### 8.2 Navigation Flow

```
User Journey:
  1. Land on / (homepage)
  2. Click "Start Planning" → /wizard
  3. Complete 6 wizard steps
  4. Click "Calculate" (triggers Web Worker)
  5. Progress bar (2-10 seconds)
  6. Auto-navigate to /results
  7. View results in tabs
  8. Click "Edit Inputs" → Back to /wizard (state preserved)

State Preservation:
  - All inputs preserved in InputsContext
  - Results cleared when returning to wizard
  - Recalculated when "Calculate" clicked again
  - localStorage profiles independent of current session
```

---

## 9. DEPLOYMENT ARCHITECTURE (Ready)

### 9.1 Build Configuration (Updated)

```
Target: Static Site (no server needed)

Build Command:
  npm run build

Output:
  dist/
    ├── index.html
    ├── assets/
    │   ├── index-{hash}.js          (~200KB)
    │   ├── vendor-{hash}.js         (~500KB - React, Router)
    │   ├── charts-{hash}.js         (~300KB - Recharts, lazy loaded)
    │   ├── calculations-{hash}.js   (~50KB - Our modules)
    │   ├── hsa-{hash}.js            (~10KB - HSA module, NEW)
    │   └── styles-{hash}.css        (~50KB - Tailwind)
    └── workers/
        └── monte-carlo.worker-{hash}.js  (~100KB)

Total Initial Load: ~750KB (gzipped: ~200KB)
Lazy Loaded: ~300KB (charts, when needed)

Optimization:
  - Code splitting (manual chunks)
  - Tree shaking (removes unused code)
  - Minification (terser)
  - Compression (gzip/brotli at CDN level)
```

### 9.2 Hosting Options

```
Recommended: Vercel or Netlify

Deployment:
  1. Connect GitHub repo
  2. Auto-detect Vite project
  3. Build command: npm run build
  4. Output directory: dist
  5. Deploy on every push to main

Features:
  - Global CDN
  - Automatic HTTPS
  - Zero-downtime deployments
  - Preview deployments for PRs
  - Custom domain support

Cost: Free tier sufficient for this project
```

---

## 10. USER INTERFACE PATTERNS

### 10.1 Progressive Disclosure (Basic/Advanced Mode)

**Purpose:** Avoid overwhelming casual users while providing depth for sophisticated planners. The 5-7 advanced inputs represent nuanced settings that casual users don't need but sophisticated planners value for fine-tuning projections.

**Basic Mode (Default):** ~50 core inputs
- Hides: Monte Carlo settings, cost basis %, IRMAA details, standard deviation, healthcare inflation, HSA non-medical toggle
- Uses sensible defaults for hidden fields (70% cost basis, 1000 runs, 18% std dev, 5% healthcare inflation, HSA non-medical enabled)

**Advanced Mode:** ~55-57 inputs visible
- Shows all Basic mode inputs PLUS 5-7 additional advanced settings
- Toggle button at top of each wizard step

**Complete Differences:**

| Feature | Basic Mode | Advanced Mode |
|---------|-----------|---------------|
| **Account Settings** |
| Cost basis % (taxable) | Hidden (uses 70% default) | Visible, adjustable |
| HSA non-medical toggle | Hidden (enabled by default) | Visible, user can disable |
| **Healthcare** |
| IRMAA checkbox | Hidden (disabled) | Visible, can enable |
| IRMAA surcharge | Hidden | Visible if checkbox enabled |
| Healthcare inflation | Hidden (uses 5% default) | Visible, adjustable (0-15%) |
| **Tax & Simulation** |
| Number of runs | Hidden (uses 1,000) | Visible, selectable (1K/5K/10K) |
| Return std deviation | Hidden (uses 18%) | Visible, adjustable (5-30%) |

**Toggle Behavior:**
- Settings persist when switching modes
- Default values used for hidden fields
- No data loss when toggling

### 10.2 Validation Strategy

```
Real-Time Validation:
  - Age ranges enforced (retirement < life expectancy)
  - Phase ages sequential
  - Non-negative amounts (except returns)
  - SS claiming age 62-70
  - Tax rates 0-100%

Visual Feedback:
  - Red border on invalid fields
  - Inline error message below field
  - Next button disabled if errors
  - Success checkmark on valid input

Error Messages:
  - Clear, actionable language
  - Example: "Life expectancy must be greater than retirement age (currently 65)"
  - No jargon or technical codes
```

---

## 11. ERROR HANDLING & EDGE CASES (Implemented)

### 11.1 Web Worker Error Handling

```typescript
In ResultsContext:
  worker.onerror = (error) => {
    console.error('Worker error:', error);
    alert('Calculation failed. Please try again.');
    setIsCalculating(false);
    worker.terminate();
  };
  
  worker.onmessage = (e) => {
    if (e.data.type === 'ERROR') {
      alert(`Simulation error: ${e.data.error}`);
      setIsCalculating(false);
      worker.terminate();
    }
  };

In Worker:
  try {
    const results = runMonteCarloSimulation(inputs, numberOfRuns);
    postMessage({ type: 'COMPLETE', results });
  } catch (error) {
    postMessage({ 
      type: 'ERROR', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
```

### 11.2 Edge Cases Handled

```
Portfolio Depletion:
  - Continue simulation with income-only survival
  - Track age of depletion
  - Show shortfall in results
  - Success = false if depleted before life expectancy

HSA Depletion (NEW):
  - Healthcare costs switch to portfolio withdrawals
  - Tracked separately in results
  - Shows "HSA depleted at age X"

RMD > Cash Flow Need:
  - Excess reinvested to taxable account
  - Tracked separately
  - May increase taxable income

Zero Portfolio Balance:
  - Income-only survival mode
  - No withdrawals possible
  - Continues simulation to life expectancy

Tax Gross-Up Convergence:
  - Max 10 iterations
  - Threshold: $100 difference
  - Falls back to 20% tax if doesn't converge
  - Logs warning for debugging
```

---

## 12. PROJECT FILE STRUCTURE

### A. Complete File Manifest

```
src/
├── components/
│   ├── common/
│   │   ├── Header.tsx
│   │   └── ProfileManager.tsx
│   ├── landing/                    ← NEW (v1.2)
│   │   └── LandingPage.tsx
│   ├── wizard/
│   │   ├── Step1PersonalInfo.tsx
│   │   ├── Step2Phases.tsx
│   │   ├── Step3Accounts.tsx       ← UPDATED (HSA)
│   │   ├── Step4Income.tsx
│   │   ├── Step5Healthcare.tsx
│   │   ├── Step6TaxSettings.tsx
│   │   ├── WizardProgress.tsx
│   │   └── WizardNavigation.tsx
│   └── results/
│       ├── SummaryDashboard.tsx    ← UPDATED (HSA metrics)
│       ├── AssumptionsPanel.tsx    ← UPDATED (HSA disclosure)
│       ├── CashFlowChart.tsx       ← UPDATED (HSA line)
│       ├── MonteCarloChart.tsx
│       └── AnnualTable.tsx         ← UPDATED (HSA columns)
├── contexts/
│   ├── InputsContext.tsx           ← UPDATED (updateHSA method)
│   └── ResultsContext.tsx
├── lib/
│   ├── calculations/
│   │   ├── index.ts
│   │   ├── random.ts
│   │   ├── rmd.ts
│   │   ├── socialSecurity.ts
│   │   ├── income.ts
│   │   ├── expenses.ts
│   │   ├── taxes.ts
│   │   ├── withdrawals.ts          ← UPDATED (HSA integration)
│   │   ├── yearlyProjection.ts     ← UPDATED (HSA tracking)
│   │   └── hsa.ts                  ← NEW (Module 10)
│   ├── storage/
│   │   └── profileStorage.ts
│   ├── constants.ts                ← UPDATED (HSA defaults)
│   └── utils.ts
├── pages/
│   ├── LandingPage.tsx             ← NEW
│   ├── WizardPage.tsx
│   ├── ResultsPage.tsx
│   └── CalculationTest.tsx
├── workers/
│   └── monte-carlo.worker.ts       ← UPDATED (HSA metrics)
├── types/
│   └── index.ts                    ← UPDATED (HSA types)
├── App.tsx                         ← UPDATED (/ route)
└── main.tsx
```

### B. Third-Party Dependencies (Updated)

```
Production:
  react, react-dom: ^18.2.0
  react-router-dom: ^6.20.0
  recharts: ^2.10.0
  lucide-react: ^0.263.1
  tailwindcss: ^3.4.0
  clsx: ^2.1.0
  tailwind-merge: ^2.2.0
  date-fns: ^3.0.0

Development:
  vite: ^5.0.0
  @vitejs/plugin-react: ^4.2.0
  vitest: ^1.1.0
  @testing-library/react: ^14.1.0
  @types/react: ^18.2.0
  @types/react-router-dom: ^5.3.0
  @types/recharts: ^1.8.0
  typescript: ^5.3.0
```

### C. Browser Compatibility

```
Modern Browsers Only:
  - Chrome 90+ (Web Workers, ES6+)
  - Firefox 88+ (Web Workers, ES6+)
  - Safari 14+ (Web Workers, ES6+)
  - Edge 90+ (Web Workers, ES6+)

NOT Supported:
  - Internet Explorer (any version)
  - Legacy browsers without Web Worker support

Required Features:
  - localStorage (profile persistence)
  - Web Workers (Monte Carlo calculations)
  - ES6+ JavaScript (arrow functions, classes, modules)
  - CSS Grid & Flexbox (layout)
```

---

## 13. VISUALIZATION ARCHITECTURE

### 13.1 Chart Component Design

```
Recharts Configuration Pattern:

1. Data Transformation (useMemo):
   RawData → ChartData
   - Extract needed fields
   - Format for Recharts
   - Cache with useMemo

2. Chart Configuration:
   <ResponsiveContainer>
     <ComposedChart data={chartData}>
       <CartesianGrid />
       <XAxis />
       <YAxis /> (can have multiple)
       <Tooltip />
       <Legend />
       <Bar /> (for categorical data)
       <Line /> (for continuous data)
       <Area /> (for ranges/bands)
     </ComposedChart>
   </ResponsiveContainer>

3. Custom Tooltips:
   - Rich data display
   - Formatted numbers
   - Conditional content
   - Event indicators
   - HSA details (NEW)
```

### 13.2 Color Palette (Consistent)

```
Success Rate:
  Green:  #059669 (≥90% success)
  Yellow: #eab308 (75-89% success)
  Orange: #f97316 (50-74% success)
  Red:    #dc2626 (<50% success)

Income (Cash Flow Chart):
  Social Security: #3b82f6 (blue)
  Pensions:        #10b981 (green)
  Part-Time Work:  #8b5cf6 (purple)
  Rental Income:   #f59e0b (amber)

Expenses (Cash Flow Chart):
  Living:          #ef4444 (red)
  Healthcare:      #ec4899 (pink)
  Taxes:           #8b5cf6 (purple)
  One-Time:        #f97316 (orange)

Portfolio Lines:
  10th Percentile: #dc2626 (red, dashed)
  Median:          #059669 (green, solid)
  90th Percentile: #2563eb (blue, dashed)
  HSA Balance:     #14b8a6 (teal, solid) ← NEW

Backgrounds:
  Success zones:   Green/Yellow/Orange/Red -50 (light tints)
  Cards:           White with colored borders
  Panels:          Gray-50 to Blue-50 gradient
  HSA sections:    Teal-50 background ← NEW
```

---

## 14. PERFORMANCE BENCHMARKS (Actual)

### 14.1 Calculation Performance

```
Monte Carlo Simulation (Web Worker):
  1,000 runs:   ~2 seconds   (500 runs/sec)
  5,000 runs:   ~5 seconds   (1000 runs/sec)
  10,000 runs:  ~10 seconds  (1000 runs/sec)

Single Simulation:
  30-year projection: ~2ms
  50-year projection: ~3ms
  With HSA tracking:  ~2.5ms (minimal overhead)
  
Memory Usage:
  During calculation: ~10-15MB
  After completion: ~500KB (selected runs only)
  HSA data adds: ~5KB per run
  
UI Responsiveness:
  Main thread never blocked ✅
  Progress updates: Every 100 runs (~200ms intervals)
  Smooth at 60 FPS ✅
```

### 14.2 Rendering Performance

```
Results Page:
  Initial load (Summary tab): ~300ms
  Tab switching: <200ms
  Chart rendering: <500ms
  CSV export: <1 second
  
Charts:
  Cash Flow Chart: ~400ms (60-70 data points + HSA line)
  Monte Carlo Chart: ~600ms (100 lines × 60 points)
  Annual Table: ~200ms (virtualization not needed for <100 rows)
  
Lazy Loading:
  First tab (Summary): Instant (no charts)
  Chart tabs: 400-600ms (lazy loaded on demand)
```

---

**END OF SYSTEM DESIGN DOCUMENT**

**Document Version:** 2.1  
**Last Updated:** 2025-02-12  
**Major Changes from v2.0:**
- Aligned with Requirements v1.3 (removed pre-retirement modeling)
- Removed `currentAge`, `currentYear`, `annualContribution` fields
- Updated HSA `allowNonMedicalAfter65` default to `true`
- Added landing page to routing architecture (v1.2 feature)
- Clarified "retirement-year dollars" terminology throughout
- Updated field count for Basic/Advanced modes (50 vs 55-57)
- Enhanced HSA integration documentation throughout
- Added HSA metrics to simulation results
- Updated component tree with landing page route

**Status:** Production Ready - Aligned with Requirements v1.3