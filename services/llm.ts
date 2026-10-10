import 'dotenv/config';
import OpenAI from 'openai';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';

// OpenRouter model ids are provider-prefixed.
export const CHAT_MODEL = process.env.LLM_MODEL ?? 'openai/gpt-4.1-mini';
// Tied to vector(1536) in db/schema.sql: changing it means re-creating metric_docs.
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? 'openai/text-embedding-3-small';

let client: OpenAI | undefined;

// One client per process, created on first use so tests and DB-only scripts never need an API key
// (the SDK constructor throws when no key is configured).
export function getOpenAI(): OpenAI {
    if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set (see .env.example)');
    client ??= new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: process.env.OPENROUTER_BASE_URL,
        timeout: 20_000,
        maxRetries: 2,
    });
    return client;
}

// The part of a chat completion choice the agent reads. Real SDK choices satisfy it,
// and tests can build fakes without the full SDK type.
export interface LlmChoice {
    finish_reason: string | null;
    message: {
        content: string | null;
        tool_calls?: { type: string; function?: { name: string; arguments: string } }[];
    };
}

export type ChatParams = Omit<ChatCompletionCreateParamsNonStreaming, 'model'>;
export type ChatFn = (params: ChatParams) => Promise<LlmChoice>;

// Default LLM call; services take a ChatFn parameter so tests can inject a fake.
export const chat: ChatFn = async (params) => {
    const response = await getOpenAI().chat.completions.create({ model: CHAT_MODEL, ...params });
    const choice = response.choices[0];
    if (!choice) throw new Error('LLM returned no choices');
    return choice;
};
