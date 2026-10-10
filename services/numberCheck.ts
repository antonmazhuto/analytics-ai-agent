// Every number in an LLM answer must come from the data; anything else counts as invented.

// "7", "45.5", "45,5", "1 704" (regular, no-break or narrow no-break space as thousands separator).
const NUMBER_RE = /\d{1,3}(?:[   ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g;

export function extractNumbers(text: string): number[] {
    return (text.match(NUMBER_RE) ?? []).map((raw) => Number(raw.replace(/[   ]/g, '').replace(',', '.')));
}

// Numeric values from result rows (node-pg returns bigint/numeric columns as strings).
export function numbersInRows(rows: Record<string, unknown>[]): number[] {
    return rows.flatMap((row) =>
        Object.values(row).flatMap((v) => {
            const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
            return Number.isFinite(n) ? [n] : [];
        }),
    );
}

// Tolerates rounding to 0.1 or to an integer, and a 0..1 fraction written as a percentage.
function matchesValue(n: number, v: number): boolean {
    const candidates = v > 0 && v < 1 ? [v, v * 100] : [v];
    return candidates.some((c) => Math.abs(n - c) <= 0.05 + 1e-9 || n === Math.round(c));
}

export function findForeignNumbers(text: string, allowed: number[]): number[] {
    return extractNumbers(text).filter((n) => !allowed.some((v) => matchesValue(n, v)));
}
