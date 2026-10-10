import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pool } from '../db/client';

// Applies db/schema.sql: enables pgvector, creates metric_docs, builds the HNSW index.
async function main() {
    const schemaPath = join(__dirname, '..', 'db', 'schema.sql');
    const sql = readFileSync(schemaPath, 'utf8');

    await pool.query(sql);
    console.log('Migration applied: pgvector extension, metric_docs table, HNSW index');

    await pool.end();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
