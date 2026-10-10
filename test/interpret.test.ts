import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretUserQuery } from '../services/interpretUserQuery';
import type { ChatFn, ChatParams, LlmChoice } from '../services/llm';
import { fillTemplate } from '../prompts/fillTemplate';

const validArgs = {
    metric: 'conversion_rate',
    from_event: 'sign_up',
    to_event: 'purchase',
    time_range: { type: 'last_n_days', value: 7 },
    group_by: ['country'],
};

function toolCall(name: string, args: string, finish_reason = 'tool_calls'): LlmChoice {
    return { finish_reason, message: { content: null, tool_calls: [{ type: 'function', function: { name, arguments: args } }] } };
}

// Fake LLM: replays scripted responses and records every request.
function fakeChat(responses: (LlmChoice | Error)[]) {
    const calls: ChatParams[] = [];
    const chat: ChatFn = async (params) => {
        calls.push(params);
        const next = responses.shift();
        if (!next) throw new Error('fake LLM: no more scripted responses');
        if (next instanceof Error) throw next;
        return next;
    };
    return { chat, calls };
}

function lastUserMessage(params: ChatParams | undefined): string {
    const msg = params?.messages.at(-1);
    assert.equal(msg?.role, 'user');
    return typeof msg?.content === 'string' ? msg.content : '';
}

test('interpret: garbage -> schema-invalid -> valid succeeds in 3 calls with errors fed back', async () => {
    const invalid = JSON.stringify({ ...validArgs, time_range: { type: 'last_n_days', value: 9999 } });
    const { chat, calls } = fakeChat([
        toolCall('build_metric_query', '{"metric": "conversion_rate", '),
        toolCall('build_metric_query', invalid),
        toolCall('build_metric_query', JSON.stringify(validArgs)),
    ]);

    const result = await interpretUserQuery('конверсия sign_up -> purchase за 7 дней по странам', { chat });

    assert.deepEqual(result, { kind: 'query', query: validArgs });
    assert.equal(calls.length, 3);

    // Every call forces a tool call and leaves room for the arguments.
    for (const c of calls) {
        assert.equal(c.tool_choice, 'required');
        assert.deepEqual(c.tools?.map((t) => (t.type === 'function' ? t.function.name : t.type)), ['build_metric_query', 'cannot_answer']);
        assert.ok((c.max_tokens ?? 0) >= 300);
    }

    // First retry: the garbage output and the JSON error.
    assert.equal(calls[0]?.messages.length, 2);
    const firstRetry = lastUserMessage(calls[1]);
    assert.match(firstRetry, /\{"metric": "conversion_rate", /);
    assert.match(firstRetry, /not valid JSON/);

    // Second retry: the schema-invalid output and the AJV error text.
    const secondRetry = lastUserMessage(calls[2]);
    assert.ok(secondRetry.includes(invalid));
    assert.match(secondRetry, /args\/time_range\/value must be <= 365/);
});

test('interpret: three garbage outputs throw', async () => {
    const { chat, calls } = fakeChat([
        toolCall('build_metric_query', 'nope'),
        { finish_reason: 'stop', message: { content: 'Sure! Here is your SQL: SELECT ...' } },
        toolCall('build_metric_query', '{{{'),
    ]);

    await assert.rejects(interpretUserQuery('q', { chat }), /failed after 3 attempts: Tool arguments are not valid JSON/);
    assert.equal(calls.length, 3);
    assert.match(lastUserMessage(calls[2]), /Sure! Here is your SQL[\s\S]*Expected a tool call, got none/);
});

test('interpret: finish_reason=length triggers a retry', async () => {
    const { chat, calls } = fakeChat([
        toolCall('build_metric_query', JSON.stringify(validArgs).slice(0, 40), 'length'),
        toolCall('build_metric_query', JSON.stringify(validArgs)),
    ]);

    const result = await interpretUserQuery('q', { chat });

    assert.equal(result.kind, 'query');
    assert.equal(calls.length, 2);
    assert.match(lastUserMessage(calls[1]), /truncated \(finish_reason=length\)/);
});

test('interpret: cannot_answer returns a refusal', async () => {
    const { chat, calls } = fakeChat([toolCall('cannot_answer', JSON.stringify({ reason: 'revenue is not tracked' }))]);

    const result = await interpretUserQuery('какая выручка за месяц?', { chat });

    assert.deepEqual(result, { kind: 'cannot_answer', reason: 'revenue is not tracked' });
    assert.equal(calls.length, 1);
});

test('interpret: executability errors from the builder are fed back as text', async () => {
    const sameEvents = JSON.stringify({ ...validArgs, to_event: 'sign_up' });
    const { chat, calls } = fakeChat([
        toolCall('build_metric_query', sameEvents),
        toolCall('build_metric_query', JSON.stringify(validArgs)),
    ]);

    await interpretUserQuery('q', { chat });

    assert.match(lastUserMessage(calls[1]), /Not executable: conversion_rate requires two different events/);
});

test('interpret: a network error is retried with the same prompt', async () => {
    const { chat, calls } = fakeChat([new Error('ECONNRESET'), toolCall('build_metric_query', JSON.stringify(validArgs))]);

    const result = await interpretUserQuery('q', { chat });

    assert.equal(result.kind, 'query');
    assert.deepEqual(calls[1]?.messages, calls[0]?.messages);
});

test('fillTemplate: user text is inserted literally', () => {
    const question = 'cost $& and $1 {{error}}';
    const out = fillTemplate('Q: {{question}} E: {{error}}', { question, error: 'boom' });
    assert.equal(out, 'Q: cost $& and $1 {{error}} E: boom');
});
