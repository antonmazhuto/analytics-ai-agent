import OpenAI from 'openai';
import { runSql } from '../db/runSql';
import { cosineSimilarity } from './vectorMath';

const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL,
});

interface MetricDocRow {
    id: number;
    metric_name: string;
    title: string;
    body: string;
    embedding: number[];
}

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

    const rows = await runSql<MetricDocRow>(
        'SELECT id, metric_name, title, body, embedding FROM metric_docs',
        [],
    );

    const scored = rows.map(row => ({
        ...row,
        score: cosineSimilarity(queryEmbedding, row.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, k).map(r => ({
        id: r.id,
        metric_name: r.metric_name,
        title: r.title,
        body: r.body,
        score: r.score,
    }));
}
