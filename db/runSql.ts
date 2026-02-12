import { pool } from './client';

export async function runSql<T = any>(sql: string, params: any[]): Promise<T[]> {
    const result = await pool.query(sql, params);
    return result.rows as T[];
}
