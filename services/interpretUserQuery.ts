import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { RETRY_PROMPT_TEMPLATE, SYSTEM_PROMPT, USER_PROMPT_TEMPLATE } from '../prompts/interpretQueryPrompt';
import { fillTemplate } from '../prompts/fillTemplate';
import { parsedAnalyticsQuerySchema } from '../schemas/parsedAnalyticsQuerySchema';
import type { ParsedAnalyticsQuery } from '../types/analytics';
import { validateParsedAnalyticsQuery } from '../validation/parsedAnalyticsValidator';
import { buildSqlFromParsedQuery } from './buildSqlFromParsedQuery';
import { chat as defaultChat, type ChatFn, type LlmChoice } from './llm';

export type InterpretResult =
    | { kind: 'query'; query: ParsedAnalyticsQuery }
    | { kind: 'cannot_answer'; reason: string };

const TOOLS: ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'build_metric_query',
            description: 'Describe the metric to compute. Code builds parameterized SQL from these arguments.',
            // Same schema AJV enforces below; the model sees the rules, AJV is still the authority.
            parameters: parsedAnalyticsQuerySchema,
        },
    },
    {
        type: 'function',
        function: {
            name: 'cannot_answer',
            description: 'Use when the question cannot be expressed with the supported metrics, events, columns or time range.',
            parameters: {
                type: 'object',
                additionalProperties: false,
                properties: { reason: { type: 'string' } },
                required: ['reason'],
            },
        },
    },
];

export interface InterpretOptions {
    chat?: ChatFn;
    maxRetries?: number;
}

export async function interpretUserQuery(
    question: string,
    { chat = defaultChat, maxRetries = 2 }: InterpretOptions = {},
): Promise<InterpretResult> {
    const baseMessages: ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: fillTemplate(USER_PROMPT_TEMPLATE, { question }) },
    ];
    let retryPrompt: string | undefined;
    let lastError = '';

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        let output: string | undefined;
        try {
            const choice = await chat({
                messages: retryPrompt ? [...baseMessages, { role: 'user', content: retryPrompt }] : baseMessages,
                tools: TOOLS,
                tool_choice: 'required',
                temperature: 0,
                max_tokens: 300,
            });
            output = describeOutput(choice);
            return parseChoice(choice);
        } catch (e) {
            lastError = errorMessage(e);
            // Logged on every rejection: the rate of these is the degradation signal for this step.
            console.warn(`[interpret] attempt ${attempt}/${maxRetries + 1} rejected: ${lastError}`);
            // A network/provider error has no model output to correct: retry the same prompt.
            if (output !== undefined) {
                retryPrompt = fillTemplate(RETRY_PROMPT_TEMPLATE, { previousOutput: output, error: lastError });
            }
        }
    }

    throw new Error(`interpretUserQuery failed after ${maxRetries + 1} attempts: ${lastError}`);
}

// Every way the model can break the contract ends up as a thrown Error whose message
// is fed back to the model on the next attempt.
function parseChoice(choice: LlmChoice): InterpretResult {
    if (choice.finish_reason === 'length') {
        throw new Error('Output was truncated (finish_reason=length)');
    }

    const call = choice.message.tool_calls?.[0]?.function;
    if (!call) throw new Error('Expected a tool call, got none');

    let args: unknown;
    try {
        args = JSON.parse(call.arguments);
    } catch {
        throw new Error('Tool arguments are not valid JSON');
    }

    if (call.name === 'cannot_answer') {
        const reason = typeof args === 'object' && args !== null ? (args as { reason?: unknown }).reason : undefined;
        if (typeof reason !== 'string' || reason.trim() === '') {
            throw new Error('cannot_answer requires a non-empty "reason" string');
        }
        return { kind: 'cannot_answer', reason };
    }

    if (call.name !== 'build_metric_query') {
        throw new Error(`Unknown tool: ${call.name}`);
    }

    const validation = validateParsedAnalyticsQuery(args);
    if (!validation.ok) {
        throw new Error(`Schema validation failed: ${validation.errors}`);
    }

    // Executability check: the builder is pure, so a query it would reject is caught here
    // and corrected by the model, instead of failing later in the SQL step.
    try {
        buildSqlFromParsedQuery(validation.value);
    } catch (e) {
        throw new Error(`Not executable: ${errorMessage(e)}`);
    }

    return { kind: 'query', query: validation.value };
}

function describeOutput(choice: LlmChoice): string {
    const call = choice.message.tool_calls?.[0]?.function;
    const text = call ? `${call.name}(${call.arguments})` : choice.message.content || '(empty response)';
    return text.slice(0, 1000);
}

function errorMessage(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}
