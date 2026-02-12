import { SYSTEM_PROMPT, USER_PROMPT_TEMPLATE } from '../prompts/interpretQueryPrompt';
import { ParsedAnalyticsQuery } from '../types/analytics';
import OpenAI from 'openai';
import "dotenv/config";
import {validateParsedAnalyticsQuery} from "../validation/parsedAnalyticsValidator";

const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL,
});

function buildUserPrompt(question: string, validationErrors?: string): string {
    const base = USER_PROMPT_TEMPLATE.replace('{{question}}', question);

    if (!validationErrors) return base;

    return `
        ${base}
        
        Previous answer was invalid. Validation errors:
        ${validationErrors}
        
        Please fix the JSON to strictly match the type. Return only JSON.
    `;
}

function extractJson(content: string): string {
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
        return content;
    }
    return content.slice(jsonStart, jsonEnd + 1);
}

async function callLLM(prompt: string) {
    const response = await client.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
        ],
        temperature: 0,
        max_tokens: 100,
    });

    return response.choices[0]?.message?.content ?? '';
}

export async function interpretUserQuery(
    question: string,
    maxRetries = 2,
): Promise<ParsedAnalyticsQuery> {
    let attempt = 0;
    let lastError: unknown = null;
    let validationErrorsText: string | undefined;

    while (attempt <= maxRetries) {
        const prompt = buildUserPrompt(question, validationErrorsText);
        const content = await callLLM(prompt);

        let parsed: unknown;
        try {
            const jsonString = extractJson(content);
            parsed = JSON.parse(jsonString);
        } catch (e) {
            lastError = new Error(`Failed to parse JSON from LLM: ${e}.\nRaw content: ${content}`);
            validationErrorsText = String(lastError);
            attempt += 1;
            continue;
        }

        const valid = validateParsedAnalyticsQuery(parsed);
        if (valid) {
            return parsed as ParsedAnalyticsQuery;
        }

        const errors = validateParsedAnalyticsQuery.errors ?? [];
        validationErrorsText = errors
            .map(err => `${err.instancePath} ${err.message}`)
            .join('; ');
        lastError = new Error(`Validation failed: ${validationErrorsText}. Raw: ${content}`);
        attempt += 1;
    }

    throw lastError ?? new Error('interpretUserQuery failed without specific error');
}
