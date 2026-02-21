/**
 * Currency formatting utilities for the OnlineSchool frontend.
 * All monetary values are in UZS (Uzbek soʻm).
 */

/**
 * Formats a number as UZS currency.
 * Example: 1800000 → "1 800 000 UZS"
 */
export function formatUZS(amount: number | string | null | undefined): string {
    if (amount === null || amount === undefined) return '— UZS';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '— UZS';

    return new Intl.NumberFormat('uz-UZ', {
        style: 'decimal',
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
    }).format(num) + ' UZS';
}

/**
 * Formats a number as compact UZS (e.g., 1 800 000 → "1.8M UZS")
 * Useful for small summary cards.
 */
export function formatUZSCompact(amount: number | string | null | undefined): string {
    if (amount === null || amount === undefined) return '— UZS';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '— UZS';

    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B UZS`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M UZS`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K UZS`;
    return `${num} UZS`;
}
