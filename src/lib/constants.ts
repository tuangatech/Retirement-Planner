// src/lib/constants.ts - PHASE B: Add HSA Defaults

import type { USState, UserInputs } from '@/types';

export const US_STATES: { value: USState; label: string }[] = [
    { value: 'AL', label: 'Alabama' },
    { value: 'AK', label: 'Alaska' },
    { value: 'AZ', label: 'Arizona' },
    { value: 'AR', label: 'Arkansas' },
    { value: 'CA', label: 'California' },
    { value: 'CO', label: 'Colorado' },
    { value: 'CT', label: 'Connecticut' },
    { value: 'DE', label: 'Delaware' },
    { value: 'FL', label: 'Florida' },
    { value: 'GA', label: 'Georgia' },
    { value: 'HI', label: 'Hawaii' },
    { value: 'ID', label: 'Idaho' },
    { value: 'IL', label: 'Illinois' },
    { value: 'IN', label: 'Indiana' },
    { value: 'IA', label: 'Iowa' },
    { value: 'KS', label: 'Kansas' },
    { value: 'KY', label: 'Kentucky' },
    { value: 'LA', label: 'Louisiana' },
    { value: 'ME', label: 'Maine' },
    { value: 'MD', label: 'Maryland' },
    { value: 'MA', label: 'Massachusetts' },
    { value: 'MI', label: 'Michigan' },
    { value: 'MN', label: 'Minnesota' },
    { value: 'MS', label: 'Mississippi' },
    { value: 'MO', label: 'Missouri' },
    { value: 'MT', label: 'Montana' },
    { value: 'NE', label: 'Nebraska' },
    { value: 'NV', label: 'Nevada' },
    { value: 'NH', label: 'New Hampshire' },
    { value: 'NJ', label: 'New Jersey' },
    { value: 'NM', label: 'New Mexico' },
    { value: 'NY', label: 'New York' },
    { value: 'NC', label: 'North Carolina' },
    { value: 'ND', label: 'North Dakota' },
    { value: 'OH', label: 'Ohio' },
    { value: 'OK', label: 'Oklahoma' },
    { value: 'OR', label: 'Oregon' },
    { value: 'PA', label: 'Pennsylvania' },
    { value: 'RI', label: 'Rhode Island' },
    { value: 'SC', label: 'South Carolina' },
    { value: 'SD', label: 'South Dakota' },
    { value: 'TN', label: 'Tennessee' },
    { value: 'TX', label: 'Texas' },
    { value: 'UT', label: 'Utah' },
    { value: 'VT', label: 'Vermont' },
    { value: 'VA', label: 'Virginia' },
    { value: 'WA', label: 'Washington' },
    { value: 'WV', label: 'West Virginia' },
    { value: 'WI', label: 'Wisconsin' },
    { value: 'WY', label: 'Wyoming' },
    { value: 'DC', label: 'District of Columbia' },
];

export const DEFAULT_VALUES: UserInputs = {
    personal: {
        retirementAge: 60,
        lifeExpectancy: 90,
        state: 'GA',
        // filingStatus: 'single',
    },
    phases: [
        { name: 'go_go', startAge: 60, endAge: 74, annualSpending: 50000 },
        { name: 'slow_go', startAge: 75, endAge: 85, annualSpending: 40000 },
        { name: 'no_go', startAge: 86, endAge: 90, annualSpending: 36000 },
    ],
    oneTimeExpenses: [],
    accounts: {
        taxDeferred: {  // e.g., Traditional IRA, 401(k)
            balanceAtRetirement: 400000,
            expectedReturnRate: 0.07,
        },
        roth: {         // e.g., Roth IRA, Roth 401(k)
            balanceAtRetirement: 300000,
            expectedReturnRate: 0.08,
        },
        taxable: {      // e.g., Brokerage Account
            balanceAtRetirement: 100000,
            expectedReturnRate: 0.08,
            costBasisPercentage: 0.70,
        },        
        hsa: {  // HSA Account (Health Savings Account)
            balanceAtRetirement: 150000,       // Typical HSA balance for someone retiring at 58
            expectedReturnRate: 0.06,          // Conservative growth (similar to tax-deferred)
            allowNonMedicalAfter65: false,      // Keep HSA for healthcare only (instead of Allowing general withdrawals after 65)
        },
    },
    withdrawalStrategy: {
        priorityOrder: ['taxable', 'tax_deferred', 'roth'],
        // Note: HSA is not in priority order - it's ALWAYS used first for healthcare
    },
    income: {
        socialSecurity: {
            monthlyBenefitAtFRA: 2500,
            claimingAge: 67,
            colaRate: 0.030,
            taxablePercentage: 0.85,
        },
        pensions: [],
        partTimeWork: {
            enabled: false,
            annualIncome: 0,
            startAge: 62,
            endAge: 70,
        },
        rentalIncome: {
            enabled: false,
            annualNetIncome: 0,
            startAge: 60,
            endAge: null,
            inflationAdjusted: true,
        },
    },
    healthcare: {
        preMedicare: {
            monthlyPremium: 900,
            annualOutOfPocket: 3000,
        },
        medicare: {
            partBStandardPremium: 200,
            partDPremium: 55,
            expectIRMAA: false,
            irmaaSurcharge: 0,
            medigapPremium: 215,
            outOfPocketByPhase: {
                phase1: 4000,
                phase2: 6500,
                phase3: 12000,
            },
        },
    },
    tax: {
        combinedEffectiveRate: 0.18,
    },
    simulation: {
        numberOfRuns: 5000,
        generalInflationRate: 0.03,
        healthcareInflationRate: 0.03,
        returnStdDeviation: 0.17,
    },
    mode: 'basic',
};