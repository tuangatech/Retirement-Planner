// src/lib/exportVerification.ts

/**
 * Verification bundle export.
 *
 * Produces a single self-describing JSON file per simulation run that contains
 * EVERYTHING needed to independently re-check the numbers:
 *   - the full set of user inputs and simulation settings
 *   - the aggregate results (success rate, percentiles, failed-run stats)
 *   - the complete year-by-year projections for the p10 / p50 / p90 runs
 *
 * This replaces the old, drift-prone workflow where scripts/verify_plan.py
 * re-declared the plan inputs by hand as a Python literal and read a separate
 * CSV. With this bundle, inputs AND results live in one file, so the verifier
 * can never fall out of sync with what the app actually ran.
 *
 * The companion verifier is scripts/verify_plan.py (run with --json <file>).
 */

import type { SimulationResults, UserInputs } from '@/types';

export const VERIFICATION_SCHEMA = 'retirement-verification/v1';

export interface VerificationBundle {
    schema: string;
    generatedAt: string;
    startYear: number | null;
    inputs: UserInputs;
    results: {
        timestamp: number;
        numberOfRuns: number;
        successRate: number;
        percentiles: SimulationResults['percentiles'];
        failedRuns: SimulationResults['failedRuns'];
        selectedRunIds: {
            p10: number;
            p50: number;
            p90: number;
        };
    };
    projections: {
        p10: SimulationResults['selectedRuns']['p10']['projections'];
        p50: SimulationResults['selectedRuns']['p50']['projections'];
        p90: SimulationResults['selectedRuns']['p90']['projections'];
    };
}

/**
 * Assembles the verification bundle object (no I/O — easy to unit test).
 */
export function buildVerificationBundle(
    results: SimulationResults,
    inputs: UserInputs
): VerificationBundle {
    return {
        schema: VERIFICATION_SCHEMA,
        generatedAt: new Date().toISOString(),
        startYear: results.selectedRuns.p50.projections[0]?.year ?? null,
        inputs,
        results: {
            timestamp: results.timestamp,
            numberOfRuns: results.numberOfRuns,
            successRate: results.successRate,
            percentiles: results.percentiles,
            failedRuns: results.failedRuns,
            selectedRunIds: {
                p10: results.selectedRuns.p10.runId,
                p50: results.selectedRuns.p50.runId,
                p90: results.selectedRuns.p90.runId,
            },
        },
        projections: {
            p10: results.selectedRuns.p10.projections,
            p50: results.selectedRuns.p50.projections,
            p90: results.selectedRuns.p90.projections,
        },
    };
}

/**
 * Formats a Date as a local-time `yyyymmdd-hhmm` stamp for filenames,
 * e.g. 2026-07-21 14:30 → "20260721-1430".
 */
function fileTimestamp(d: Date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
        `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
        `-${pad(d.getHours())}${pad(d.getMinutes())}`
    );
}

/**
 * Builds the bundle and triggers a browser download as a .json file.
 */
export function exportVerificationBundle(
    results: SimulationResults,
    inputs: UserInputs
): void {
    const bundle = buildVerificationBundle(results, inputs);
    const json = JSON.stringify(bundle, null, 2);

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `retirement-verification-${fileTimestamp()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
