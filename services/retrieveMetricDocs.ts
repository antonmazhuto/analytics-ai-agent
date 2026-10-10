import { runSql } from '../db/runSql';
import { EMBEDDING_MODEL, getOpenAI } from './llm';

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
    const embResp = await getOpenAI().embeddings.create({
        model: EMBEDDING_MODEL,
        input: [query],
    });

    const queryEmbedding = embResp.data[0]?.embedding;
    if (!queryEmbedding) throw new Error('Embedding API returned no data');

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
