import OpenAI from 'openai';
import { runSql } from '../db/runSql';
import "dotenv/config";

const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL,
});

interface MetricDocInput {
    metric_name: string;
    title: string;
    body: string;
}

export async function indexMetricDocs(docs: MetricDocInput[]) {
    const texts = docs.map(d => `${d.title}\n\n${d.body}`);

    const resp = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
    });

    const vectors = resp.data.map(d => d.embedding);

    // Upsert on metric_name so re-running the indexer refreshes rows instead of duplicating.
    const sql = `
    INSERT INTO metric_docs (metric_name, title, body, embedding)
    VALUES ($1, $2, $3, $4::vector)
    ON CONFLICT (metric_name)
    DO UPDATE SET title = EXCLUDED.title,
                  body = EXCLUDED.body,
                  embedding = EXCLUDED.embedding
  `;

    for (const [i, doc] of docs.entries()) {
        const vector = vectors[i];
        if (!vector) throw new Error(`No embedding returned for ${doc.metric_name}`);
        await runSql(sql, [
            doc.metric_name,
            doc.title,
            doc.body,
            // pgvector expects a text literal like '[0.1,0.2,...]', not a JS/PG array.
            JSON.stringify(vector),
        ]);
    }
}
