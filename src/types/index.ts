// src/types/index.ts

import { YearlyProjection } from '@/lib/calculations/yearlyProjection';

export type USState = 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'FL' | 'GA' |
    'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME' | 'MD' | 'MA' | 'MI' |
    'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH' | 'NJ' | 'NM' | 'NY' | 'NC' | 'ND' |
    'OH' | 'OK' | 'OR' | 'PA' | 'RI' | 'SC' | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' |
    'WA' | 'WV' | 'WI' | 'WY' | 'DC';

export interface PersonalInfo {
    retirementAge: number;
    lifeExpectancy: number;
    state: USState;
    // Optional; the tax model defaults to 'single' when unset. (A filing-status
    // selector in the wizard is a future enhancement.)
    filingStatus?: 'single' | 'married_joint';
}

export interface RetirementPhase {
    name: 'go_go' | 'slow_go' | 'no_go';
    startAge: number;
    endAge: number;
    annualSpending: number;
}

export interface OneTimeExpense {
    id: string;
    description: string;
    amount: number;
    age: number;
}

export interface InvestmentAccount {
    balanceAtRetirement: number;
    expectedReturnRate: number;
    costBasisPercentage?: number; // Only for taxable accounts
}

export interface HSAAccount {
    balanceAtRetirement: number;
    expectedReturnRate: number;
    allowNonMedicalAfter65: boolean;  // Default: false - healthcare withdrawals after 65 only
}

export interface SocialSecurity {
    monthlyBenefitAtFRA: number;
    claimingAge: number;
    colaRate: number;
    taxablePercentage: number;
}

export interface Pension {
    id: string;
    name: string;
    monthlyAmount: number;
    startAge: number;
    colaRate: number;
}

export interface PartTimeWork {
    enabled: boolean;
    annualIncome: number;
    startAge: number;
    endAge: number;
}

export interface RentalIncome {
    enabled: boolean;
    annualNetIncome: number;
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
    expectIRMAA: boolean;
    irmaaSurcharge: number;
    medigapPremium: number;
    outOfPocketByPhase: {
        phase1: number;
        phase2: number;
        phase3: number;
    };
}

export interface TaxSettings {
    combinedEffectiveRate: number;
}

export interface SimulationSettings {
    numberOfRuns: 1000 | 5000 | 10000;
    generalInflationRate: number;
    healthcareInflationRate: number;
    returnStdDeviation: number;
}

export interface UserInputs {
    personal: PersonalInfo;
    phases: [RetirementPhase, RetirementPhase, RetirementPhase];
    oneTimeExpenses: OneTimeExpense[];
    accounts: {
        taxDeferred: InvestmentAccount;
        roth: InvestmentAccount;
        taxable: InvestmentAccount;
        hsa: HSAAccount;  // ✅ NEW
    };
    withdrawalStrategy: {
        priorityOrder: Array<'taxable' | 'tax_deferred' | 'roth'>;
        // Note: HSA is handled separately - always used first for healthcare

        /**
         * Which sequencing strategy the engine applies:
         * - 'standard'        — spend strictly by priorityOrder (the conventional rule of thumb).
         * - 'tax_smart'       — each gap year, draw tax-deferred up to the standard-deduction
         *                       floor (≈ tax-free), then fall through to priorityOrder. Default.
         * - 'roth_conversion' — tax-smart PLUS Roth conversions in the gap years (Advanced;
         *                       not yet implemented — shown as "coming soon" in the wizard).
         * Optional so pre-existing saved scenarios (which lack it) stay valid; the engine and
         * the storage loader default a missing value to keep old plans faithful to how they
         * were computed.
         */
        strategy?: 'standard' | 'tax_smart' | 'roth_conversion';

        /** Advanced tier only: taxable-income ceiling to convert up to. Unused until Roth conversions ship. */
        conversionCeiling?: number;
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

export interface SimulationRun {
    runId: number;
    success: boolean;
    ageOfDepletion: number | null;
    finalBalance: number;
}

export interface SelectedRun {
    runId: number;
    percentile: 'p10' | 'p50' | 'p90';
    projections: YearlyProjection[];
}

export interface SimulationResults {
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

    // Optional fields not needed for storage/comparison
    sampleRuns?: Array<{
        runId: number;
        projections: YearlyProjection[];
    }>;
}