import { readFileSync } from 'node:fs';
import type { QueryResult } from 'pg';
import { closePools, getPool } from '../db/client';

// Applies a .sql file as the owner role (DATABASE_URL).
// npm run migrate -> db/schema.sql, npm run seed -> db/seed.sql
async function main() {
    const file = process.argv[2];
    if (!file) throw new Error('Usage: tsx scripts/applySql.ts <file.sql>');

    // A multi-statement string returns one result per statement; print the last SELECT, if any.
    const result = (await getPool('owner').query(readFileSync(file, 'utf8'))) as QueryResult | QueryResult[];
    const last = Array.isArray(result) ? result.at(-1) : result;

    console.log(`Applied ${file}`);
    if (last?.command === 'SELECT' && last.rows.length > 0) console.table(last.rows);
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(closePools);
