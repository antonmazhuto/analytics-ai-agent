-- pgvector-backed schema for metric documentation (RAG retrieval layer).

-- Enable the pgvector extension: adds the `vector` type + similarity operators/indexes.
CREATE EXTENSION IF NOT EXISTS vector;

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
