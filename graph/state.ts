import { Annotation } from '@langchain/langgraph';
import type { ParsedAnalyticsQuery } from '../types/analytics';
import type { AnalyticsResult } from '../services/runAnalyticsQuery';

// Annotation.Root replaces the old `channels` config, which is deprecated in @langchain/langgraph 1.x
// (node_modules/@langchain/langgraph/dist/graph/state.d.ts: "Use `Annotation.Root`, `StateSchema`, ...").
export const AgentState = Annotation.Root({
    question: Annotation<string>,
    parsed: Annotation<ParsedAnalyticsQuery | undefined>,
    result: Annotation<AnalyticsResult | undefined>,
    answer: Annotation<string | undefined>,
    // Errors accumulate across nodes instead of overwriting each other.
    errors: Annotation<string[]>({
        reducer: (left, right) => left.concat(right),
        default: () => [],
    }),
});

export type AgentStateValue = typeof AgentState.State;
export type AgentStateUpdate = typeof AgentState.Update;
