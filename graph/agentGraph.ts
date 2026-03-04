import { StateGraph, START, END } from '@langchain/langgraph';
import type { AgentState } from './state';
import { interpretNode, sqlNode, summarizeNode } from './nodes';

const builder = new StateGraph<AgentState>({
    channels: {
        question: {
            initial: (state?: AgentState) => state?.question ?? '',
        },
        parsed: {
            initial: (state?: AgentState) => state?.parsed ?? undefined,
        },
        rows: {
            initial: (state?: AgentState) => state?.rows ?? undefined,
        },
        answer: {
            initial: (state?: AgentState) => state?.answer ?? undefined,
        },
        errors: {
            initial: (state?: AgentState) => state?.errors ?? [],
        },
    },
});

builder.addNode('interpret', interpretNode);
builder.addNode('sql', sqlNode);
builder.addNode('summarize', summarizeNode);

builder.addEdge(START, 'interpret');
builder.addEdge('interpret', 'sql');
builder.addEdge('sql', 'summarize');
builder.addEdge('summarize', END);

export const graph = builder.compile();
