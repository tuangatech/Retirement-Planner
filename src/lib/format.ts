// src/lib/formatMoney.ts

export function formatMoney(value: number): string {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';

    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
    return `${sign}$${abs.toFixed(0)}`;
}