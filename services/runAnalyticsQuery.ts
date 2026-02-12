import { ParsedAnalyticsQuery } from '../types/analytics';
import { buildSqlFromParsedQuery } from './buildSqlFromParsedQuery';
import { runSql } from '../db/runSql';

export async function runAnalyticsQuery(parsed: ParsedAnalyticsQuery) {
    const { sql, params } = buildSqlFromParsedQuery(parsed);
    const rows = await runSql(sql, params);
    return rows;
}
