import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeAnalytics, templateAnswer } from '../services/summarizeAnalytics';
import type { ChatFn, ChatParams, LlmChoice } from '../services/llm';
import type { AnalyticsResult } from '../services/runAnalyticsQuery';
import type { ParsedAnalyticsQuery } from '../types/analytics';

const parsed: ParsedAnalyticsQuery = {
    metric: 'conversion_rate',
    from_event: 'sign_up',
    to_event: 'purchase',
    time_range: { type: 'last_n_days', value: 30 },
    group_by: [],
};

const result: AnalyticsResult = {
    rows: [{ from_users: 1704, to_users: 775, conversion_rate: 45.5 }],
    truncated: false,
};

function text(content: string, finish_reason = 'stop'): LlmChoice {
    return { finish_reason, message: { content } };
}

function fakeChat(responses: LlmChoice[]) {
    const calls: ChatParams[] = [];
    const chat: ChatFn = async (params) => {
        calls.push(params);
        const next = responses.shift();
        if (!next) throw new Error('fake LLM: no more scripted responses');
        return next;
    };
    return { chat, calls };
}

const noDocs = async () => [];

test('summarize: an invented number triggers one retry, then the template fallback', async () => {
    const { chat, calls } = fakeChat([
        text('Конверсия 45.5%, это на 12% выше, чем в прошлом месяце.'),
        text('Конверсия 45.5%, рост 12%.'),
    ]);

    const summary = await summarizeAnalytics('q', parsed, result, { chat, retrieveDocs: noDocs });

    assert.equal(summary.source, 'template');
    assert.equal(summary.answer, templateAnswer(parsed, result));
    assert.equal(calls.length, 2);
    assert.match(String(calls[1]?.messages.at(-1)?.content), /numbers not present in the data: 12/);
});

test('summarize: numbers from the rows pass, incl. rounding, comma decimals and grouped thousands', async () => {
    const { chat } = fakeChat([
        text('За 30 дней из 1 704 зарегистрировавшихся купили 775: конверсия 45,5% (около 46%).'),
    ]);

    const summary = await summarizeAnalytics('q', parsed, result, { chat, retrieveDocs: noDocs });

    assert.equal(summary.source, 'llm');
});

test('summarize: finish_reason=length is rejected and retried', async () => {
    const { chat, calls } = fakeChat([text('Конверсия за 30 дней сост', 'length'), text('Конверсия 45.5%.')]);

    const summary = await summarizeAnalytics('q', parsed, result, { chat, retrieveDocs: noDocs });

    assert.deepEqual(summary, { answer: 'Конверсия 45.5%.', source: 'llm' });
    assert.equal(calls.length, 2);
    assert.ok((calls[0]?.max_tokens ?? 0) >= 600);
});

test('summarize: RAG failure falls back to no docs instead of failing the answer', async () => {
    const { chat, calls } = fakeChat([text('Конверсия 45.5%.')]);

    const summary = await summarizeAnalytics('q', parsed, result, {
        chat,
        retrieveDocs: async () => {
            throw new Error('embeddings API down');
        },
    });

    assert.equal(summary.source, 'llm');
    assert.match(String(calls[0]?.messages[1]?.content), /Metric documentation[^\n]*\n"""\[\]"""/);
});

test('summarize: user text with $& and {{rows}} is inserted literally', async () => {
    const { chat, calls } = fakeChat([text('Конверсия 45.5%.')]);
    const question = 'сколько стоит $& и {{rows}}?';

    await summarizeAnalytics(question, parsed, result, { chat, retrieveDocs: noDocs });

    const prompt = String(calls[0]?.messages[1]?.content);
    assert.ok(prompt.includes(`"""${question}"""`));
    assert.equal(prompt.split('"from_users": 1704').length, 2, 'rows must be inserted exactly once');
});
