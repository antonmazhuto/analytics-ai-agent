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

    for (let i = 0; i < docs.length; i++) {
        await runSql(sql, [
            docs[i].metric_name,
            docs[i].title,
            docs[i].body,
            // pgvector expects a text literal like '[0.1,0.2,...]', not a JS/PG array.
            JSON.stringify(vectors[i]),
        ]);
    }
}
