// src/lib/calculations/compareStatesTax.ts

/**
 * One-year, cross-state tax comparison: given a household's income situation for a single tax
 * year, computes federal tax and every modeled state's tax side by side.
 *
 * This is intentionally separate from `yearlyProjection.ts`: that module orchestrates a
 * multi-year Monte Carlo simulation from account balances and a withdrawal strategy. This
 * function takes a single year's income directly (no balances, no withdrawal sequencing, no
 * `rng()`) — the standalone State Tax Comparison page's "backend".
 */

import {
    calculateTaxableSocialSecurity,
    calculateStandardDeduction,
    type FilingStatus,
} from './taxes';
import { computeStateTaxDetailed, type StateTaxInputs, type StateTaxDetail } from './stateTax';
import { getStateTaxRules, modeledStates } from './stateTaxRules';
import type { USState } from '@/types';

/**
 * 2026 federal ordinary-income tax brackets (Tax Foundation, the same primary source
 * `docs/2-federal-tax-model.md` cites for the standard deduction). Used only by this
 * standalone comparison tool — the multi-year Monte Carlo engine (`taxes.ts`) keeps its
 * single flat marginal rate on purpose, since the withdrawal gross-up needs it to stay
 * solvable each year (see that doc). This tool has no gross-up iteration, so real brackets
 * are a strict accuracy improvement with no such constraint. Review annually.
 */
const FEDERAL_TAX_BRACKETS_2026: Record<FilingStatus, { rate: number; min: number }[]> = {
    single: [
        { rate: 0.10, min: 0 },
        { rate: 0.12, min: 12400 },
        { rate: 0.22, min: 50400 },
        { rate: 0.24, min: 105700 },
        { rate: 0.32, min: 201775 },
        { rate: 0.35, min: 256225 },
        { rate: 0.37, min: 640600 },
    ],
    married_joint: [
        { rate: 0.10, min: 0 },
        { rate: 0.12, min: 24800 },
        { rate: 0.22, min: 100800 },
        { rate: 0.24, min: 211400 },
        { rate: 0.32, min: 403550 },
        { rate: 0.35, min: 512450 },
        { rate: 0.37, min: 768700 },
    ],
};

/**
 * Applies the real 2026 progressive brackets to taxable income (already net of the
 * standard deduction). Still taxes investment gains as ordinary income — this tool
 * doesn't yet model the 0%/15%/20% LTCG/qualified-dividend preferential rates.
 */
function calculateProgressiveFederalTax(taxableIncome: number, filingStatus: FilingStatus): number {
    const brackets = FEDERAL_TAX_BRACKETS_2026[filingStatus];
    let tax = 0;
    for (let i = 0; i < brackets.length; i++) {
        const { rate, min } = brackets[i];
        if (taxableIncome <= min) break;
        const nextMin = brackets[i + 1]?.min ?? Infinity;
        tax += (Math.min(taxableIncome, nextMin) - min) * rate;
    }
    return tax;
}

export interface StateTaxComparisonInput {
    filingStatus: FilingStatus;
    age: number;
    /** MFJ only. */
    spouseAge?: number;
    year: number;

    socialSecurity: number;
    governmentPensionIncome: number;
    privatePensionIncome: number;
    taxDeferredWithdrawal: number;
    /** Combined long-term capital gains + qualified dividends — taxed identically in this engine. */
    investmentGains: number;
    partTimeWork: number;
    rentalIncome: number;
    /** Only the non-medical share; qualified-medical HSA withdrawals are never taxable and are not entered here. */
    hsaNonMedicalWithdrawal: number;
}

export interface FederalTaxDetail {
    agi: number;
    taxableSocialSecurity: number;
    standardDeduction: number;
    taxableIncome: number;
    tax: number;
}

export interface StateTaxComparisonRow {
    state: USState;
    /** False for a state with no individual income tax (a real $0, not a modeling gap). */
    taxesIncome: boolean;
    detail: StateTaxDetail;
}

export interface StateTaxComparisonResult {
    federal: FederalTaxDetail;
    states: StateTaxComparisonRow[];
}

export function compareStatesTax(input: StateTaxComparisonInput): StateTaxComparisonResult {
    const otherOrdinaryIncome =
        input.governmentPensionIncome +
        input.privatePensionIncome +
        input.partTimeWork +
        input.rentalIncome +
        input.taxDeferredWithdrawal +
        input.investmentGains +
        input.hsaNonMedicalWithdrawal;

    const taxableSocialSecurity = calculateTaxableSocialSecurity(
        input.socialSecurity,
        otherOrdinaryIncome,
        input.filingStatus
    );

    const standardDeduction = calculateStandardDeduction(
        input.age,
        input.year,
        input.filingStatus,
        1,
        true,
        input.spouseAge
    );

    const agi = taxableSocialSecurity + otherOrdinaryIncome;
    const taxableIncome = Math.max(0, agi - standardDeduction);

    const federalTax = calculateProgressiveFederalTax(taxableIncome, input.filingStatus);

    const stateInputs: StateTaxInputs = {
        year: input.year,
        filingStatus: input.filingStatus,
        age: input.age,
        spouseAge: input.spouseAge,
        governmentPensionIncome: input.governmentPensionIncome,
        privatePensionIncome: input.privatePensionIncome,
        partTimeWork: input.partTimeWork,
        rentalIncome: input.rentalIncome,
        taxDeferredWithdrawals: input.taxDeferredWithdrawal,
        brokerageGains: input.investmentGains,
        hsaNonMedicalWithdrawals: input.hsaNonMedicalWithdrawal,
    };

    const states: StateTaxComparisonRow[] = modeledStates().map((state) => {
        const rules = getStateTaxRules(state);
        return {
            state,
            taxesIncome: rules !== undefined && rules.taxesIncome,
            detail: computeStateTaxDetailed(rules, stateInputs),
        };
    });

    return {
        federal: {
            agi,
            taxableSocialSecurity,
            standardDeduction,
            taxableIncome,
            tax: federalTax,
        },
        states,
    };
}
