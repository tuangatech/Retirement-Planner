// src/lib/calculations/withdrawals.ts - PHASE B: Add HSA Support

import { calculateRMD } from './rmd';
import {
    calculateTaxFreeTaxDeferredRoom,
    calculateStandardDeduction,
    calculateTaxableSocialSecurity,
    type FilingStatus,
} from './taxes';
import { calculateHSAWithdrawal } from './hsa';

/**
 * Gross-up convergence. The gross draw solves `gross − tax(gross) = need`, which is a fixed
 * point of `g ↦ need + tax(g)`. It contracts at the marginal tax rate (well under 1), so a
 * handful of passes is exact to the dollar — tighter than the $100 threshold the old flat-rate
 * gross-up used, because with Social Security feedback the residual is what leaks into
 * `netCashFlow` and the whole point of this solve is that it stops leaking.
 */
const MAX_GROSS_UP_PASSES = 10;
const GROSS_UP_THRESHOLD = 1;

/**
 * Gross withdrawal needed to net `netNeeded` after the tax it causes.
 *
 * `taxOnGross` must return the *incremental* tax caused by drawing `gross` — not `gross × rate`.
 * The distinction is the entire fix: an extra dollar of ordinary withdrawal also drags up to
 * $0.85 of Social Security into the taxable base, so the true marginal rate is up to 1.85× the
 * headline rate while SS is being phased in, then falls back once SS hits its 85% cap.
 */
function solveGrossForNet(netNeeded: number, taxOnGross: (gross: number) => number): number {
    let gross = netNeeded;
    for (let pass = 0; pass < MAX_GROSS_UP_PASSES; pass++) {
        const next = netNeeded + taxOnGross(gross);
        if (Math.abs(next - gross) < GROSS_UP_THRESHOLD) return next;
        gross = next;
    }
    return gross;
}

export interface AccountBalances {
    taxDeferred: number;
    roth: number;
    taxable: number;
    hsa: number;
}

export interface WithdrawalAmounts {
    taxDeferred: number;
    roth: number;
    taxable: number;
    hsa: number;
}

export interface IncomeForTax {
    socialSecurity: number;
    pensions: number;
    partTimeWork: number;
    rentalIncome: number;
}

export interface WithdrawalResult {
    withdrawals: WithdrawalAmounts;
    taxOnWithdrawals: number;
    updatedBalances: AccountBalances;
    rmdAmount: number;
    rmdExcess: number;
    hsaForHealthcare: number;  // Amount of healthcare covered by HSA (tax-free)
    iterations: number;
    converged: boolean;
    shortfall: number;
}

/**
 * Executes withdrawals from all accounts including HSA.
 * 
 * WITHDRAWAL ORDER:
 * 1. HSA for healthcare (tax-free, any age)
 * 2. HSA for general expenses (age 65+, taxed)
 * 3. RMDs from tax-deferred (age 75; see RMD_START_AGE)
 * 4. Tax-smart fill (strategy !== 'standard'): draw tax-deferred up to the
 *    standard-deduction floor (~tax-free), then fall through to priority order
 * 5. Regular accounts by priority order
 *
 * @param currentAge - Current age
 * @param cashFlowGap - Initial cash needed (expenses + taxes - income)
 * @param currentBalances - Current account balances (includes HSA)
 * @param healthcareCosts - Total healthcare costs for the year
 * @param allowNonMedicalHSA - Whether HSA can be used for non-medical after 65
 * @param priorityOrder - Withdrawal priority for tax-deferred/roth/taxable
 * @param income - Income sources (for the tax-free-room calculation)
 * @param effectiveTaxRate - Federal marginal tax rate above the standard-deduction floor
 * @param socialSecurityTaxablePercentage - Cap on the taxable share of SS
 * @param costBasisPercentage - Cost basis for taxable account
 * @param strategy - 'standard' uses priorityOrder only; 'tax_smart'/'roth_conversion'
 *   fill the tax-deferred deduction floor first, then follow priorityOrder
 * @param year - Calendar year (for the senior-bonus deduction sunset)
 * @param deductionInflationFactor - Inflation scaling applied to the deduction floor
 * @param filingStatus - Filing status for the deduction and SS thresholds
 * @param spouseAge - MFJ only: spouse's age this year (for the per-spouse age-65 deduction)
 * @param rmdAge - Age governing the RMD trigger; for MFJ pooled accounts this is the
 *   older spouse's age so RMDs start no later than required. Defaults to currentAge.
 * @param rmdStartAge - Age at which RMDs begin (this tool passes RMD_START_AGE = 75). Default 73.
 * @param stateMarginalRate - State tax on the next dollar of ordinary withdrawal, added to the
 *   federal rate when sizing withdrawals. 0 for unmodeled states and for states with no income
 *   tax. Without it the engine under-withdraws by the state tax every year.
 */
export function executeWithdrawals(
    currentAge: number,
    cashFlowGap: number,
    currentBalances: AccountBalances,
    healthcareCosts: number,
    allowNonMedicalHSA: boolean,
    priorityOrder: Array<'taxable' | 'tax_deferred' | 'roth'>,
    income: IncomeForTax,
    effectiveTaxRate: number,
    socialSecurityTaxablePercentage: number,
    costBasisPercentage: number,
    strategy: 'standard' | 'tax_smart' | 'roth_conversion' = 'standard',
    year: number = 2026,
    deductionInflationFactor: number = 1,
    filingStatus: FilingStatus = 'single',
    spouseAge?: number,
    rmdAge: number = currentAge,
    rmdStartAge: number = 73,
    stateMarginalRate: number = 0
): WithdrawalResult {
    const balances = { ...currentBalances };

    // ── The year's tax picture, as a function of how much has been withdrawn ──────────────
    //
    // Every gross-up below sizes draws against this rather than a flat rate. A flat rate is
    // wrong in both directions: it charges tax on a draw that the deduction floor actually
    // shields (harmless — surplus is reinvested), and it *under*-charges inside the Social
    // Security phase-in, where each withdrawn dollar also pulls up to $0.85 of SS into the
    // taxable base. Under-withdrawal is the harmful direction: the year then spends money it
    // never took out, `netCashFlow` goes negative, and depletion risk is understated.
    const fixedOrdinary = income.pensions + income.partTimeWork + income.rentalIncome;
    const deduction = calculateStandardDeduction(
        currentAge,
        year,
        filingStatus,
        deductionInflationFactor,
        true,
        spouseAge
    );

    /** Federal taxable income once `draws` of withdrawal income sits on top of fixed income. */
    const federalTaxableWith = (draws: number): number =>
        Math.max(
            0,
            calculateTaxableSocialSecurity(
                income.socialSecurity,
                fixedOrdinary + draws,
                filingStatus,
                socialSecurityTaxablePercentage
            ) +
                fixedOrdinary +
                draws -
                deduction
        );

    const federalTaxableBeforeDraws = federalTaxableWith(0);

    /**
     * Total tax caused by `draws` of taxable withdrawal income this year — ordinary draws and
     * brokerage *gains* alike, since both land in AGI and both feed provisional income. State
     * tax stays a flat add-on: `stateMarginalRate` already summarises the state's own
     * exclusions and deduction (see docs/5-state-tax-model.md §3).
     */
    const taxOnDraws = (draws: number): number =>
        (federalTaxableWith(draws) - federalTaxableBeforeDraws) * effectiveTaxRate +
        draws * stateMarginalRate;

    /** Taxable withdrawal income booked so far, so each new draw is taxed on top of it. */
    let drawsBooked = 0;

    /** Incremental tax of adding `draws` on top of what is already booked. */
    const marginalTaxOn = (draws: number): number =>
        taxOnDraws(drawsBooked + draws) - taxOnDraws(drawsBooked);

    const withdrawals: WithdrawalAmounts = {
        taxDeferred: 0,
        roth: 0,
        taxable: 0,
        hsa: 0,
    };

    let taxOnWithdrawals = 0;
    let rmdAmount = 0;
    let rmdExcess = 0;
    let hsaForHealthcare = 0;

    // STEP 0 - Use HSA for healthcare first (ALWAYS, any age)
    if (balances.hsa > 0 && healthcareCosts > 0) {
        // FIX: The generalCashFlowGap passed to calculateHSAWithdrawal must be the
        // NON-HEALTHCARE portion of the cash flow gap only.
        //
        // Bug (previous code): Math.max(0, cashFlowGap) was passed, which is the
        // FULL gap (living expenses + healthcare + taxes − income). At age 65+ with
        // allowNonMedicalHSA=true, calculateHSAWithdrawal would then try to cover
        // the healthcare amount a second time via the nonMedicalWithdrawal path —
        // once via medicalWithdrawal (tax-free) and again inside nonMedicalWithdrawal
        // (taxed), causing the HSA to be over-withdrawn and its balance to drop faster
        // than correct.
        //
        // Fix: subtract healthcareCosts before passing so the non-medical path only
        // covers living expenses and taxes — the portions not already handled by
        // medicalWithdrawal.
        const nonHealthcarGap = Math.max(0, cashFlowGap - healthcareCosts);

        // Non-medical HSA withdrawals are ordinary income to the IRS and to the state
        // (docs/5-state-tax-model.md §6). `calculateHSAWithdrawal` takes a flat rate, so pass
        // the average rate across the draw it is about to make rather than the headline rate —
        // probed at the amount it might withdraw, which is where the SS feedback actually bites.
        const hsaEffectiveRate =
            nonHealthcarGap > 0 ? marginalTaxOn(nonHealthcarGap) / nonHealthcarGap : 0;

        const hsaResult = calculateHSAWithdrawal(
            currentAge,
            balances.hsa,
            healthcareCosts,
            nonHealthcarGap,   // FIX: was Math.max(0, cashFlowGap)
            allowNonMedicalHSA,
            hsaEffectiveRate
        );

        withdrawals.hsa = hsaResult.totalWithdrawal;
        hsaForHealthcare = hsaResult.medicalWithdrawal;
        taxOnWithdrawals += hsaResult.taxOnNonMedical;
        // Only the non-medical portion is income; medical HSA draws are never taxed.
        drawsBooked += hsaResult.nonMedicalWithdrawal;

        // Reduce cash flow gap by net HSA benefit
        const netHSABenefit = hsaResult.medicalWithdrawal +
            (hsaResult.nonMedicalWithdrawal - hsaResult.taxOnNonMedical);
        cashFlowGap -= netHSABenefit;

        // Update HSA balance
        balances.hsa = hsaResult.remainingBalance;
    }

    // STEP 1: Handle RMDs, beginning at rmdStartAge (the app models a flat 75). For MFJ
    // pooled accounts the trigger uses the older spouse's age (rmdAge), so distributions
    // start no later than required.
    if (rmdAge >= rmdStartAge) {
        rmdAmount = calculateRMD(rmdAge, balances.taxDeferred, rmdStartAge);

        if (rmdAmount > 0) {
            const actualRMD = Math.min(rmdAmount, balances.taxDeferred);
            withdrawals.taxDeferred = actualRMD;

            // The RMD is forced, so there is nothing to size — but its tax still has to be the
            // real incremental amount. Understating it overstates the RMD's net proceeds, which
            // shrinks the remaining gap and leaves the year short.
            const taxOnRMD = marginalTaxOn(actualRMD);
            drawsBooked += actualRMD;
            const afterTaxRMD = actualRMD - taxOnRMD;

            if (afterTaxRMD >= cashFlowGap) {
                // RMD fully covers need
                rmdExcess = afterTaxRMD - cashFlowGap;
                taxOnWithdrawals += taxOnRMD;

                return {
                    withdrawals,
                    taxOnWithdrawals,
                    updatedBalances: balances,
                    rmdAmount,
                    rmdExcess,
                    hsaForHealthcare,
                    iterations: 1,
                    converged: true,
                    shortfall: 0,
                };
            }

            taxOnWithdrawals += taxOnRMD;
            cashFlowGap -= afterTaxRMD;
        }
    }

    // STEP 1.5: Tax-smart fill — draw tax-deferred up to the standard-deduction floor.
    // In the gap years this converts what would otherwise become fully-taxed RMD dollars
    // (and the SS "tax torpedo" they trigger) into ~tax-free income now, and shrinks
    // future RMDs. Capped by the remaining need (drawing beyond the need is the
    // Roth-conversion tier's job), the tax-free room, and the available balance. Because
    // the draw stays within the deduction floor, its marginal tax is ~0, so gross ≈ net.
    if (strategy !== 'standard' && cashFlowGap > 10) {
        const availableTaxDeferred = balances.taxDeferred - withdrawals.taxDeferred;

        if (availableTaxDeferred > 10) {
            // Non-SS taxable income already present this year. Any RMD already pulled counts;
            // brokerage gains are still zero because taxable draws happen later (STEP 2).
            const otherOrdinaryTaxable =
                income.pensions + income.partTimeWork + income.rentalIncome + withdrawals.taxDeferred;

            const room = calculateTaxFreeTaxDeferredRoom(
                income.socialSecurity,
                otherOrdinaryTaxable,
                socialSecurityTaxablePercentage,
                currentAge,
                year,
                deductionInflationFactor,
                filingStatus,
                true,
                spouseAge
            );

            const fillAmount = Math.min(cashFlowGap, room, availableTaxDeferred);

            if (fillAmount > 0) {
                withdrawals.taxDeferred += fillAmount;
                // Federally this draw sits inside the deduction floor, so `marginalTaxOn`
                // returns ~0 for it — which is the point of the fill. It is not necessarily
                // free at the state level, though: the floor it is sized to is the *federal*
                // one, while a state applies its own, much smaller shield (Georgia's $15k
                // standard deduction, with no retirement exclusion at all before age 62).
                // Charging the real incremental tax is what keeps the year from spending money
                // it never withdrew.
                const taxOnFill = marginalTaxOn(fillAmount);
                drawsBooked += fillAmount;
                taxOnWithdrawals += taxOnFill;
                cashFlowGap -= fillAmount - taxOnFill;
            }
        }
    }

    // STEP 2: Simple withdrawal strategy (try each account in priority order)
    let remainingNeed = cashFlowGap;

    for (const accountType of priorityOrder) {
        if (remainingNeed < 10) break;

        const balanceKey = accountType === 'tax_deferred' ? 'taxDeferred' : accountType;
        const available = balances[balanceKey] - (accountType === 'tax_deferred' ? withdrawals.taxDeferred : 0);

        if (available < 10) continue;

        // How much of a gross draw from this account lands in taxable income: all of a
        // tax-deferred draw, only the gain portion of a brokerage draw, none of a Roth draw.
        const taxableShare =
            accountType === 'tax_deferred' ? 1 : accountType === 'taxable' ? 1 - costBasisPercentage : 0;

        // Size the draw against the real tax it causes. Solving `gross − tax(gross) = need`
        // rather than dividing by a flat rate is what makes this correct inside the Social
        // Security phase-in, where the marginal rate is up to 1.85× the headline rate.
        const grossNeeded =
            taxableShare === 0
                ? remainingNeed
                : solveGrossForNet(remainingNeed, (gross) => marginalTaxOn(gross * taxableShare));

        // Limit to available balance
        const actualGross = Math.min(grossNeeded, available);

        const actualTax = marginalTaxOn(actualGross * taxableShare);
        drawsBooked += actualGross * taxableShare;

        const actualNet = actualGross - actualTax;

        // Record withdrawal
        if (accountType === 'tax_deferred') {
            withdrawals.taxDeferred += actualGross;
        } else if (accountType === 'roth') {
            withdrawals.roth += actualGross;
        } else {
            withdrawals.taxable += actualGross;
        }

        taxOnWithdrawals += actualTax;
        remainingNeed -= actualNet;
    }

    const totalWithdrawn = withdrawals.taxDeferred + withdrawals.roth + withdrawals.taxable + withdrawals.hsa;
    const afterTaxWithdrawn = totalWithdrawn - taxOnWithdrawals;
    const shortfall = Math.max(0, cashFlowGap - afterTaxWithdrawn);

    return {
        withdrawals,
        taxOnWithdrawals,
        updatedBalances: balances,
        rmdAmount,
        rmdExcess,
        hsaForHealthcare,
        iterations: 1,
        converged: true,
        shortfall,
    };
}

export function handleSurplus(
    surplus: number,
    currentBalances: AccountBalances
): AccountBalances {
    return {
        ...currentBalances,
        taxable: currentBalances.taxable + surplus,
    };
}

export function validateWithdrawalInputs(
    currentAge: number,
    balances: AccountBalances,
    priorityOrder: Array<'taxable' | 'tax_deferred' | 'roth'>
): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Number.isFinite(currentAge) || currentAge < 0) {
        errors.push('Invalid age');
    }

    if (balances.taxDeferred < 0 || balances.roth < 0 || balances.taxable < 0 || balances.hsa < 0) {
        errors.push('Account balances cannot be negative');
    }

    if (priorityOrder.length !== 3) {
        errors.push('Priority order must have exactly 3 accounts');
    }

    const uniqueAccounts = new Set(priorityOrder);
    if (uniqueAccounts.size !== 3) {
        errors.push('Priority order must have unique account types');
    }

    const validTypes = new Set(['taxable', 'tax_deferred', 'roth']);
    for (const type of priorityOrder) {
        if (!validTypes.has(type)) {
            errors.push(`Invalid account type: ${type}`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

export function calculateTotalPortfolio(balances: AccountBalances): number {
    return balances.taxDeferred + balances.roth + balances.taxable + balances.hsa;  // ✅ UPDATED
}

export function isPortfolioDepleted(
    balances: AccountBalances,
    threshold: number = 100
): boolean {
    return calculateTotalPortfolio(balances) < threshold;
}