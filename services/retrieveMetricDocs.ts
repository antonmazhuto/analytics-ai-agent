import OpenAI from 'openai';
import { runSql } from '../db/runSql';

const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL,
});

export interface RetrievedMetricDoc {
    id: number;
    metric_name: string;
    title: string;
    body: string;
    score: number;
}

export async function retrieveMetricDocs(
    query: string,
    k = 5,
): Promise<RetrievedMetricDoc[]> {
    const embResp = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: [query],
    });

    const queryEmbedding = embResp.data[0].embedding;

    // Vector search in Postgres via pgvector:
    //   `<=>` is cosine DISTANCE; `1 - distance` gives cosine SIMILARITY (the score).
    //   ORDER BY distance + LIMIT k uses the HNSW index — no full-table scan, no JS math.
    const rows = await runSql<RetrievedMetricDoc>(
        `SELECT id, metric_name, title, body,
                1 - (embedding <=> $1::vector) AS score
         FROM metric_docs
         ORDER BY embedding <=> $1::vector
         LIMIT $2`,
        [JSON.stringify(queryEmbedding), k],
    );

    return rows;
}
