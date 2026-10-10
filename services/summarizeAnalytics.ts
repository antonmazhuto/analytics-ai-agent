import type { ParsedAnalyticsQuery } from '../types/analytics';
import {
    SUMMARIZER_RETRY_TEMPLATE,
    SUMMARIZER_SYSTEM_PROMPT,
    SUMMARIZER_USER_PROMPT_TEMPLATE,
} from '../prompts/summarizeAnalyticsPrompt';
import { fillTemplate } from '../prompts/fillTemplate';
import { getMetricDocsForParsedQuery } from './enrichParsedQueryWithDocs';
import type { RetrievedMetricDoc } from './retrieveMetricDocs';
import type { AnalyticsResult } from './runAnalyticsQuery';
import { findForeignNumbers, numbersInRows } from './numberCheck';
import { chat as defaultChat, type ChatFn } from './llm';

export interface SummaryResult {
    answer: string;
    source: 'llm' | 'template';
}

export interface SummarizeOptions {
    chat?: ChatFn;
    retrieveDocs?: (parsed: ParsedAnalyticsQuery) => Promise<RetrievedMetricDoc[]>;
}

const MAX_ATTEMPTS = 2; // one retry, then the deterministic template

export async function summarizeAnalytics(
    question: string,
    parsed: ParsedAnalyticsQuery,
    result: AnalyticsResult,
    { chat = defaultChat, retrieveDocs = getMetricDocsForParsedQuery }: SummarizeOptions = {},
): Promise<SummaryResult> {
    // Docs are optional context: a failed embedding call or DB lookup must not cost the answer.
    let docs: RetrievedMetricDoc[] = [];
    try {
        docs = await retrieveDocs(parsed);
    } catch (e) {
        console.warn(`[summarize] metric docs retrieval failed, continuing without docs: ${errorMessage(e)}`);
    }

    const prompt = fillTemplate(SUMMARIZER_USER_PROMPT_TEMPLATE, {
        question,
        parsed: JSON.stringify(parsed, null, 2),
        rows: JSON.stringify(result.rows, null, 2),
        truncated: result.truncated ? 'yes' : 'no',
        docs: JSON.stringify(docs, null, 2),
    });
    const allowedNumbers = [...numbersInRows(result.rows), parsed.time_range.value, result.rows.length];
    let retryPrompt: string | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const choice = await chat({
                messages: [
                    { role: 'system', content: SUMMARIZER_SYSTEM_PROMPT },
                    { role: 'user', content: prompt },
                    ...(retryPrompt ? [{ role: 'user' as const, content: retryPrompt }] : []),
                ],
                temperature: 0.3,
                max_tokens: 600,
            });

            if (choice.finish_reason === 'length') throw new Error('answer was truncated (finish_reason=length)');
            const answer = choice.message.content?.trim();
            if (!answer) throw new Error('empty answer');

            const foreign = findForeignNumbers(answer, allowedNumbers);
            if (foreign.length > 0) throw new Error(`numbers not present in the data: ${foreign.join(', ')}`);

            return { answer, source: 'llm' };
        } catch (e) {
            const reason = errorMessage(e);
            console.warn(`[summarize] attempt ${attempt}/${MAX_ATTEMPTS} rejected: ${reason}`);
            retryPrompt = fillTemplate(SUMMARIZER_RETRY_TEMPLATE, { error: reason });
        }
    }

    console.warn('[summarize] falling back to the template answer');
    return { answer: templateAnswer(parsed, result), source: 'template' };
}

// Deterministic answer built only from the rows: always correct, never pretty.
export function templateAnswer(parsed: ParsedAnalyticsQuery, { rows, truncated }: AnalyticsResult): string {
    const days = parsed.time_range.value;
    const title =
        parsed.metric === 'conversion_rate'
            ? `Конверсия ${parsed.from_event} → ${parsed.to_event} за последние ${days} дн.`
            : `Количество событий ${parsed.event} за последние ${days} дн.`;

    if (rows.length === 0) return `${title}: нет данных.`;

    const lines = rows.map(
        (row) => '- ' + Object.entries(row).map(([key, value]) => `${key}: ${String(value)}`).join(', '),
    );
    if (truncated) lines.push(`(показаны первые ${rows.length} строк)`);
    return [`${title}:`, ...lines].join('\n');
}

function errorMessage(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}
