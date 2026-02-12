import { interpretUserQuery } from './interpretUserQuery';
import { runAnalyticsQuery } from './runAnalyticsQuery';
import { summarizeAnalytics } from './summarizeAnalytics';

export async function runAgent(userQuestion: string) {
    // Step 1: LLM → ParsedAnalyticsQuery
    const parsed = await interpretUserQuery(userQuestion);

    // Step 2: ParsedAnalyticsQuery → SQL → rows
    const rows = await runAnalyticsQuery(parsed);

    // Step 3: LLM‑summarizer
    const answer = await summarizeAnalytics(userQuestion, parsed, rows);

    return {
        parsed,
        rows,
        answer,
    };
}
