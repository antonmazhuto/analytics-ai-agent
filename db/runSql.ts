import type { QueryResultRow } from 'pg';
import { getPool, type DbRole } from './client';

// Defaults to the read-only role; only migrations and the indexer pass 'owner'.
export async function runSql<T extends QueryResultRow = Record<string, unknown>>(
    sql: string,
    params: unknown[],
    role: DbRole = 'readonly',
): Promise<T[]> {
    const result = await getPool(role).query<T>(sql, params);
    return result.rows;
}
