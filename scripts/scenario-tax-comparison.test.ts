/**
 * Reusable scenario-tax comparison runner.
 *
 * Computes federal + state income tax for one household's income profile across a list of
 * states, by calling this app's real tax-engine functions directly — no UI, no Monte Carlo
 * simulation. Edit the INPUTS block below for a new situation and rerun:
 *
 *   npx vitest run scripts/scenario-tax-comparison.test.ts
 *
 * Results are printed to the console (run with --reporter=verbose if your shell hides
 * stdout on a passing test). Copy the printed numbers into docs/scenario-tax-comparisons.md.
 */
import { describe, it } from 'vitest';
import { calculateTotalTaxes, type FilingStatus } from '@/lib/calculations/taxes';
import { computeStateTax, type StateTaxInputs } from '@/lib/calculations/stateTax';
import { getStateTaxRules } from '@/lib/calculations/stateTaxRules';
import type { USState } from '@/types';

// ---------------------------------------------------------------------------------------------
// EDIT THIS BLOCK for a new situation, then rerun.
// ---------------------------------------------------------------------------------------------
const YEAR = 2026;

const INPUTS = {
    filingStatus: 'married_joint' as FilingStatus,
    primaryAge: 68,
    spouseAge: 66 as number | undefined, // undefined for a single filer

    socialSecurity: 43200, // household total (both spouses, if MFJ)
    pensions: 0, // pension/annuity income (not an account withdrawal)
    partTimeWork: 0,
    rentalIncome: 0,

    taxDeferredWithdrawal: 14000, // 401(k)/traditional IRA distribution

    brokerage: {
        longTermCapitalGains: 6000, // taxable gain
        qualifiedDividends: 1200, // taxable; taxed the same as LTCG in this engine
        costBasisWithdrawn: 8000, // return of principal withdrawn alongside the gain — not taxable
    },

    rothDistribution: 12000, // always $0 taxable; included only so gross cash flow reconciles

    hsaWithdrawal: {
        amount: 9000,
        qualifiedMedical: true, // true => fully tax-free; only a non-medical amount would be taxed
    },

    states: ['GA', 'FL', 'NY'] as USState[],
};
// ---------------------------------------------------------------------------------------------

describe('scenario tax comparison', () => {
    it('computes federal + state tax for the configured household across INPUTS.states', () => {
        const brokerageGain = INPUTS.brokerage.longTermCapitalGains + INPUTS.brokerage.qualifiedDividends;
        const brokerageWithdrawalTotal = brokerageGain + INPUTS.brokerage.costBasisWithdrawn;
        // costBasisPercentage is the SHARE of the withdrawal that is basis, so
        // withdrawal * (1 - costBasisPercentage) recovers just the gain.
        const costBasisPercentage = INPUTS.brokerage.costBasisWithdrawn / brokerageWithdrawalTotal;

        const hsaNonMedicalWithdrawal = INPUTS.hsaWithdrawal.qualifiedMedical
            ? 0
            : INPUTS.hsaWithdrawal.amount;

        const federal = calculateTotalTaxes(
            {
                socialSecurity: INPUTS.socialSecurity,
                pensions: INPUTS.pensions,
                partTimeWork: INPUTS.partTimeWork,
                rentalIncome: INPUTS.rentalIncome,
            },
            {
                taxDeferred: INPUTS.taxDeferredWithdrawal,
                roth: INPUTS.rothDistribution,
                taxable: brokerageWithdrawalTotal,
            },
            0.12, // combinedEffectiveRate — the app's wizard default
            0.85, // socialSecurity.taxablePercentage — the app's wizard default (statutory cap)
            costBasisPercentage,
            0, // payrollTax
            INPUTS.primaryAge,
            YEAR,
            1, // deductionInflationFactor
            hsaNonMedicalWithdrawal,
            INPUTS.filingStatus,
            true, // includeSeniorBonus
            INPUTS.spouseAge
        );

        const stateInputs: StateTaxInputs = {
            year: YEAR,
            filingStatus: INPUTS.filingStatus,
            age: INPUTS.primaryAge,
            spouseAge: INPUTS.spouseAge,
            governmentPensionIncome: 0,
            privatePensionIncome: INPUTS.pensions,
            partTimeWork: INPUTS.partTimeWork,
            rentalIncome: INPUTS.rentalIncome,
            taxDeferredWithdrawals: INPUTS.taxDeferredWithdrawal,
            brokerageGains: brokerageGain,
            hsaNonMedicalWithdrawals: hsaNonMedicalWithdrawal,
        };

        const stateResults = INPUTS.states.map((state) => ({
            state,
            ...computeStateTax(getStateTaxRules(state), stateInputs),
        }));

        const grossIncome =
            INPUTS.socialSecurity +
            INPUTS.pensions +
            INPUTS.partTimeWork +
            INPUTS.rentalIncome +
            INPUTS.taxDeferredWithdrawal +
            brokerageWithdrawalTotal +
            INPUTS.rothDistribution +
            INPUTS.hsaWithdrawal.amount;

        console.log('\n--- Scenario tax comparison ---');
        console.log('Gross income:', grossIncome);
        console.log('Federal tax:', federal.total, federal);
        for (const r of stateResults) {
            console.log(`${r.state} state tax:`, r.tax, `(modeled: ${r.modeled})`);
        }
        console.log('--------------------------------\n');
    });
});
