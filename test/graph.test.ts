import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAgentGraph } from '../graph/agentGraph';
import type { AgentDeps } from '../graph/nodes';
import type { ParsedAnalyticsQuery } from '../types/analytics';

const parsed: ParsedAnalyticsQuery = {
    metric: 'count',
    event: 'purchase',
    time_range: { type: 'last_n_days', value: 7 },
    group_by: [],
};

function deps(overrides: Partial<AgentDeps>, calls: string[]): AgentDeps {
    return {
        interpret: async () => {
            calls.push('interpret');
            return parsed;
        },
        runQuery: async () => {
            calls.push('runQuery');
            return [{ event_count: 42 }];
        },
        summarize: async () => {
            calls.push('summarize');
            return 'Покупок: 42';
        },
        ...overrides,
    };
}

test('graph: happy path goes interpret -> sql -> summarize', async () => {
    const calls: string[] = [];
    const final = await createAgentGraph(deps({}, calls)).invoke({ question: 'q' });

    assert.deepEqual(calls, ['interpret', 'runQuery', 'summarize']);
    assert.equal(final.answer, 'Покупок: 42');
    assert.deepEqual(final.errors, []);
});

test('graph: interpret error routes to refusal and never touches SQL', async () => {
    const calls: string[] = [];
    const final = await createAgentGraph(
        deps({ interpret: async () => { throw new Error('model gave up'); } }, calls),
    ).invoke({ question: 'q' });

    assert.deepEqual(calls, []);
    assert.match(final.answer ?? '', /Не удалось ответить.*model gave up/);
});

test('graph: SQL error routes to refusal and never calls the summarizer', async () => {
    const calls: string[] = [];
    const final = await createAgentGraph(
        deps({ runQuery: async () => { throw new Error('statement timeout'); } }, calls),
    ).invoke({ question: 'q' });

    assert.deepEqual(calls, ['interpret']);
    assert.match(final.answer ?? '', /statement timeout/);
    assert.equal(final.errors.length, 1);
});
