// src/components/common/ScopeBadge.tsx

/**
 * ScopeBadge Component
 *
 * Marks whether a wizard section wants ONE combined household figure or a per-person one.
 * Render it only for married-filing-jointly plans — for a single filer the distinction is
 * noise.
 *
 * Presentational only, but the scope it names has to match what the engine actually does:
 * accounts are pooled into one household balance, healthcare cost inputs are per-person
 * amounts applied to each spouse's own Medicare timeline and summed, and part-time work is
 * modeled as YOUR earnings alone (it feeds your Social Security earnings test, and a
 * spouse's own work isn't modeled). See `docs/4-married-filing-jointly.md`.
 *
 * @example
 * {isMFJ && <ScopeBadge scope="household" />}
 */

export type InputScope = 'household' | 'per-person' | 'you-only';

const SCOPES: Record<InputScope, { label: string; title: string; tone: string }> = {
    household: {
        label: 'Household',
        title: 'Enter one combined figure covering you and your spouse.',
        tone: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    'per-person': {
        label: 'Per person',
        title:
            'Enter one person’s amount — it is applied to each spouse separately and summed. ' +
            'Both spouses are assumed to cost the same.',
        tone: 'bg-teal-50 text-teal-700 border-teal-200',
    },
    'you-only': {
        label: 'You only',
        title: 'Only your figure is modeled — your spouse’s is not.',
        tone: 'bg-amber-50 text-amber-700 border-amber-200',
    },
};

export function ScopeBadge({ scope, className = '' }: { scope: InputScope; className?: string }) {
    const { label, title, tone } = SCOPES[scope];

    return (
        <span
            title={title}
            className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${tone} ${className}`}
        >
            {label}
        </span>
    );
}
