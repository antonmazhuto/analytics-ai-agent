import OpenAI from 'openai';
import { ParsedAnalyticsQuery } from '../types/analytics';
import {
    SUMMARIZER_SYSTEM_PROMPT,
    SUMMARIZER_USER_PROMPT_TEMPLATE,
} from '../prompts/summarizeAnalyticsPrompt';
import "dotenv/config";
import {getMetricDocsForParsedQuery} from "./enrichParsedQueryWithDocs";

const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL,
});

function buildSummarizerPrompt(
    question: string,
    parsed: ParsedAnalyticsQuery,
    rows: any[],
    docs: any[],
): string {
    return SUMMARIZER_USER_PROMPT_TEMPLATE
        .replace('{{question}}', question)
        .replace('{{parsed}}', JSON.stringify(parsed, null, 2))
        .replace('{{rows}}', JSON.stringify(rows, null, 2))
        .replace('{{docs}}', JSON.stringify(docs, null, 2));
}

export async function summarizeAnalytics(
    question: string,
    parsed: ParsedAnalyticsQuery,
    rows: any[],
): Promise<string> {
    const docs = await getMetricDocsForParsedQuery(parsed);

    const prompt = buildSummarizerPrompt(question, parsed, rows, docs);

    const response = await client.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
            { role: 'system', content: SUMMARIZER_SYSTEM_PROMPT },
            { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 100,
    });

    return response.choices[0]?.message?.content ?? '';
}
