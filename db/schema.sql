-- Applied by `npm run migrate` as the owner role (DATABASE_URL). Idempotent.

-- Enable the pgvector extension: adds the `vector` type + similarity operators/indexes.
CREATE EXTENSION IF NOT EXISTS vector;

-- Product events the agent queries. Synthetic data comes from db/seed.sql.
CREATE TABLE IF NOT EXISTS events (
    id          bigserial   PRIMARY KEY,
    user_id     bigint      NOT NULL,
    event_name  text        NOT NULL,
    event_time  timestamptz NOT NULL,
    country     text        NOT NULL
);

-- Every generated query filters by event_name and a time window.
CREATE INDEX IF NOT EXISTS events_name_time_idx ON events (event_name, event_time);

-- Documentation snippets per metric, stored with their embedding.
-- embedding is vector(1536) — matches OpenAI text-embedding-3-small output size.
CREATE TABLE IF NOT EXISTS metric_docs (
    id          serial PRIMARY KEY,
    metric_name text        NOT NULL UNIQUE,
    title       text        NOT NULL,
    body        text        NOT NULL,
    embedding   vector(1536) NOT NULL
);

-- HNSW index for fast approximate nearest-neighbour search by cosine distance.
-- vector_cosine_ops pairs with the `<=>` (cosine distance) operator used in retrieval.
CREATE INDEX IF NOT EXISTS metric_docs_embedding_idx
    ON metric_docs
    USING hnsw (embedding vector_cosine_ops);

-- Read-only role for everything the agent runs at question time (analytics SQL + RAG lookup),
-- used via ANALYTICS_DATABASE_URL. If a bad query ever got past the validator and the builder,
-- it could still only SELECT from these two tables, in a read-only transaction, for 5 seconds.
-- The password is a local demo value, same as the owner's in docker-compose.yml.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'analytics_ro') THEN
        CREATE ROLE analytics_ro LOGIN PASSWORD 'analytics_ro';
    END IF;
END
$$;
ALTER ROLE analytics_ro SET default_transaction_read_only = on;
ALTER ROLE analytics_ro SET statement_timeout = '5s';
GRANT USAGE ON SCHEMA public TO analytics_ro;
GRANT SELECT ON events, metric_docs TO analytics_ro;
