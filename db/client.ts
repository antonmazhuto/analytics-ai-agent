import 'dotenv/config';
import { Pool } from 'pg';

// Two roles: the owner (DATABASE_URL) runs migrations, seeding and indexing;
// everything the agent executes at question time goes through the read-only role.
export type DbRole = 'owner' | 'readonly';

const ENV_BY_ROLE: Record<DbRole, string> = {
    owner: 'DATABASE_URL',
    readonly: 'ANALYTICS_DATABASE_URL',
};

const pools = new Map<DbRole, Pool>();

// Pools are created lazily so importing this module never needs a database.
export function getPool(role: DbRole): Pool {
    let pool = pools.get(role);
    if (!pool) {
        const envVar = ENV_BY_ROLE[role];
        const connectionString = process.env[envVar];
        if (!connectionString) throw new Error(`${envVar} is not set (see .env.example)`);

        pool = new Pool({
            connectionString,
            max: 5,
            connectionTimeoutMillis: 5_000, // fail fast when the DB is unreachable
            statement_timeout: 5_000,       // the server cancels long queries
            query_timeout: 10_000,          // the client gives up even if the server never answers
        });
        pools.set(role, pool);
    }
    return pool;
}

export async function closePools(): Promise<void> {
    await Promise.all([...pools.values()].map((pool) => pool.end()));
    pools.clear();
}
