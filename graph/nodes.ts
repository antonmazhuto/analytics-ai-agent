import type { AgentState } from './state';
import { interpretUserQuery } from '../services/interpretUserQuery';
import { runAnalyticsQuery } from '../services/runAnalyticsQuery';
import { summarizeAnalytics } from '../services/summarizeAnalytics';

export async function interpretNode(state: AgentState): Promise<AgentState> {
    try {
        const parsed = await interpretUserQuery(state.question);
        return {
            ...state,
            parsed,
        };
    } catch (e) {
        return {
            ...state,
            errors: [...state.errors, `interpret failed: ${String(e)}`],
        };
    }
}

export async function sqlNode(state: AgentState): Promise<AgentState> {
    if (!state.parsed) {
        return {
            ...state,
            errors: [...state.errors, 'sqlNode: no parsed query'],
        };
    }

    try {
        const rows = await runAnalyticsQuery(state.parsed);
        return {
            ...state,
            rows,
        };
    } catch (e) {
        return {
            ...state,
            errors: [...state.errors, `sql failed: ${String(e)}`],
        };
    }
}

export async function summarizeNode(state: AgentState): Promise<AgentState> {
    if (!state.parsed || !state.rows) {
        return {
            ...state,
            errors: [...state.errors, 'summarizeNode: missing parsed or rows'],
        };
    }

    try {
        const answer = await summarizeAnalytics(
            state.question,
            state.parsed,
            state.rows,
        );
        return {
            ...state,
            answer,
        };
    } catch (e) {
        return {
            ...state,
            errors: [...state.errors, `summarize failed: ${String(e)}`],
        };
    }
}
