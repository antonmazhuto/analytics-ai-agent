import { StateGraph, START, END } from '@langchain/langgraph';
import { AgentState, type AgentStateValue } from './state';
import { createNodes, type AgentDeps } from './nodes';

// Any error or explicit refusal recorded so far short-circuits to the refusal node.
function nextOrRefuse<T extends string>(next: T) {
    return (state: AgentStateValue): T | 'refuse' =>
        state.errors.length > 0 || state.refusal !== undefined ? 'refuse' : next;
}

export function createAgentGraph(deps: AgentDeps) {
    const nodes = createNodes(deps);

    return new StateGraph(AgentState)
        .addNode('interpret', nodes.interpret)
        .addNode('sql', nodes.sql)
        .addNode('summarize', nodes.summarize)
        .addNode('refuse', nodes.refuse)
        .addEdge(START, 'interpret')
        .addConditionalEdges('interpret', nextOrRefuse('sql'), ['sql', 'refuse'])
        .addConditionalEdges('sql', nextOrRefuse('summarize'), ['summarize', 'refuse'])
        .addConditionalEdges('summarize', nextOrRefuse(END), [END, 'refuse'])
        .addEdge('refuse', END)
        .compile();
}
