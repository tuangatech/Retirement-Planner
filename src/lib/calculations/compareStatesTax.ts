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
    calculateTotalTaxes,
    calculateTaxableSocialSecurity,
    calculateStandardDeduction,
    type FilingStatus,
} from './taxes';
import { computeStateTaxDetailed, type StateTaxInputs, type StateTaxDetail } from './stateTax';
import { getStateTaxRules, modeledStates } from './stateTaxRules';
import type { USState } from '@/types';

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

    /** Flat rate applied to federal taxable income above the standard deduction (this engine has no real tax brackets). */
    effectiveTaxRate: number;
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

    const federalTaxes = calculateTotalTaxes(
        {
            socialSecurity: input.socialSecurity,
            pensions: input.governmentPensionIncome + input.privatePensionIncome,
            partTimeWork: input.partTimeWork,
            rentalIncome: input.rentalIncome,
        },
        {
            taxDeferred: input.taxDeferredWithdrawal,
            roth: 0,
            taxable: input.investmentGains,
        },
        input.effectiveTaxRate,
        0.85, // statutory SS taxable cap — this tool doesn't expose a state-specific override
        0, // costBasisPercentage — investmentGains is already gain-only, see field doc
        0, // payrollTax — not modeled in this standalone tool
        input.age,
        input.year,
        1,
        input.hsaNonMedicalWithdrawal,
        input.filingStatus,
        true,
        input.spouseAge
    );

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
            tax: federalTaxes.total,
        },
        states,
    };
}
