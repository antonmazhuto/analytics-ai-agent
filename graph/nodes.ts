import type { ParsedAnalyticsQuery } from '../types/analytics';
import type { AgentStateUpdate, AgentStateValue, Row } from './state';

// Services are injected so the graph can be tested without an LLM or a database.
export interface AgentDeps {
    interpret: (question: string) => Promise<ParsedAnalyticsQuery>;
    runQuery: (parsed: ParsedAnalyticsQuery) => Promise<Row[]>;
    summarize: (question: string, parsed: ParsedAnalyticsQuery, rows: Row[]) => Promise<string>;
}

function errorMessage(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

export function createNodes(deps: AgentDeps) {
    return {
        async interpret(state: AgentStateValue): Promise<AgentStateUpdate> {
            try {
                return { parsed: await deps.interpret(state.question) };
            } catch (e) {
                return { errors: [`interpret failed: ${errorMessage(e)}`] };
            }
        },

        async sql(state: AgentStateValue): Promise<AgentStateUpdate> {
            if (!state.parsed) return { errors: ['sql: no parsed query'] };
            try {
                return { rows: await deps.runQuery(state.parsed) };
            } catch (e) {
                return { errors: [`sql failed: ${errorMessage(e)}`] };
            }
        },

        async summarize(state: AgentStateValue): Promise<AgentStateUpdate> {
            if (!state.parsed || !state.rows) return { errors: ['summarize: missing parsed query or rows'] };
            try {
                return { answer: await deps.summarize(state.question, state.parsed, state.rows) };
            } catch (e) {
                return { errors: [`summarize failed: ${errorMessage(e)}`] };
            }
        },

        // Terminal node for every failure path: the user gets an explicit "cannot answer"
        // instead of a summary built on top of a failed step.
        refuse(state: AgentStateValue): AgentStateUpdate {
            return { answer: `Не удалось ответить на вопрос: ${state.errors.join('; ')}` };
        },
    };
}
