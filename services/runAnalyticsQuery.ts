import type { ParsedAnalyticsQuery } from '../types/analytics';
import { buildSqlFromParsedQuery, ROW_LIMIT } from './buildSqlFromParsedQuery';
import { runSql } from '../db/runSql';

export interface AnalyticsResult {
    rows: Record<string, unknown>[];
    truncated: boolean; // true when the query hit ROW_LIMIT and rows were cut
}

export async function runAnalyticsQuery(parsed: ParsedAnalyticsQuery): Promise<AnalyticsResult> {
    const { sql, params } = buildSqlFromParsedQuery(parsed);
    const rows = await runSql(sql, params);
    return {
        rows: rows.slice(0, ROW_LIMIT),
        truncated: rows.length > ROW_LIMIT,
    };
}
