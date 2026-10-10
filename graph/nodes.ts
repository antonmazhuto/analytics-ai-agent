import type { ParsedAnalyticsQuery } from '../types/analytics';
import type { InterpretResult } from '../services/interpretUserQuery';
import type { AnalyticsResult } from '../services/runAnalyticsQuery';
import type { AgentStateUpdate, AgentStateValue } from './state';

// Services are injected so the graph can be tested without an LLM or a database.
export interface AgentDeps {
    interpret: (question: string) => Promise<InterpretResult>;
    runQuery: (parsed: ParsedAnalyticsQuery) => Promise<AnalyticsResult>;
    summarize: (question: string, parsed: ParsedAnalyticsQuery, result: AnalyticsResult) => Promise<string>;
}

function errorMessage(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

export function createNodes(deps: AgentDeps) {
    return {
        async interpret(state: AgentStateValue): Promise<AgentStateUpdate> {
            try {
                const result = await deps.interpret(state.question);
                return result.kind === 'query' ? { parsed: result.query } : { refusal: result.reason };
            } catch (e) {
                return { errors: [`interpret failed: ${errorMessage(e)}`] };
            }
        },

        async sql(state: AgentStateValue): Promise<AgentStateUpdate> {
            if (!state.parsed) return { errors: ['sql: no parsed query'] };
            try {
                return { result: await deps.runQuery(state.parsed) };
            } catch (e) {
                return { errors: [`sql failed: ${errorMessage(e)}`] };
            }
        },

        async summarize(state: AgentStateValue): Promise<AgentStateUpdate> {
            if (!state.parsed || !state.result) return { errors: ['summarize: missing parsed query or result'] };
            try {
                return { answer: await deps.summarize(state.question, state.parsed, state.result) };
            } catch (e) {
                return { errors: [`summarize failed: ${errorMessage(e)}`] };
            }
        },

        // Terminal node for every failure path: the user gets an explicit "cannot answer"
        // instead of a summary built on top of a failed step.
        refuse(state: AgentStateValue): AgentStateUpdate {
            if (state.refusal) return { answer: `Не могу ответить на этот вопрос: ${state.refusal}` };
            return { answer: `Не удалось ответить на вопрос: ${state.errors.join('; ')}` };
        },
    };
}
