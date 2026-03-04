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

    const sql = `
    INSERT INTO metric_docs (metric_name, title, body, embedding)
    VALUES ($1, $2, $3, $4)
  `;

    for (let i = 0; i < docs.length; i++) {
        await runSql(sql, [
            docs[i].metric_name,
            docs[i].title,
            docs[i].body,
            vectors[i], // double precision[]
        ]);
    }
}
