import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSqlFromParsedQuery, ROW_LIMIT } from '../services/buildSqlFromParsedQuery';
import type { ParsedAnalyticsQuery } from '../types/analytics';

const funnel: ParsedAnalyticsQuery = {
    metric: 'conversion_rate',
    from_event: 'sign_up',
    to_event: 'purchase',
    time_range: { type: 'last_n_days', value: 37 },
    group_by: ['country'],
};

const count: ParsedAnalyticsQuery = {
    metric: 'count',
    event: 'purchase',
    time_range: { type: 'last_n_days', value: 37 },
    group_by: [],
};

// TypeScript types are erased at runtime: the builder must reject bad input even if the validator was skipped.
function unchecked(q: object): ParsedAnalyticsQuery {
    return q as ParsedAnalyticsQuery;
}

test('builder: group_by injection attempt throws', () => {
    for (const col of ['country; DROP TABLE events; --', 'user_id', 'country, (SELECT 1)']) {
        assert.throws(
            () => buildSqlFromParsedQuery(unchecked({ ...funnel, group_by: [col] })),
            /group_by column is not allowed/,
        );
    }
});

test('builder: count without event throws', () => {
    assert.throws(() => buildSqlFromParsedQuery(unchecked({ ...count, event: undefined })), /count requires 'event'/);
});

test('builder: conversion_rate needs two different events', () => {
    assert.throws(() => buildSqlFromParsedQuery({ ...funnel, to_event: 'sign_up' }), /two different events/);
});

test('builder: out-of-range or fractional days throw', () => {
    for (const value of [0, 366, 7.5]) {
        assert.throws(() => buildSqlFromParsedQuery({ ...count, time_range: { type: 'last_n_days', value } }), /integer from 1/);
    }
});

test('builder: values only travel as placeholders', () => {
    for (const q of [funnel, count]) {
        const { sql, params } = buildSqlFromParsedQuery(q);

        for (const p of params) {
            if (typeof p === 'string') assert.ok(!sql.includes(p), `value ${p} leaked into SQL text`);
        }
        assert.ok(!sql.includes('37'), 'days leaked into SQL text');

        const placeholders = new Set(sql.match(/\$\d+/g));
        assert.equal(placeholders.size, params.length);
        assert.equal(params.at(-1), ROW_LIMIT + 1);
        assert.match(sql, /LIMIT \$\d+$/);
    }
});

test('builder: funnel is order-aware and attributes each user once', () => {
    const { sql, params } = buildSqlFromParsedQuery(funnel);

    assert.deepEqual(params.slice(0, 3), ['sign_up', 'purchase', 37]);
    assert.doesNotMatch(sql, /BOOL_OR/i);
    // One row per user: the first from_event and its country.
    assert.match(sql, /DISTINCT ON \(user_id\) user_id, event_time AS from_time, country/);
    assert.match(sql, /ORDER BY user_id, event_time/);
    // Converted only if the to_event happened strictly after that first from_event.
    assert.match(sql, /EXISTS \([\s\S]*e\.event_name = \$2[\s\S]*e\.event_time > f\.from_time/);
});

test('builder: empty group_by means no breakdown (no silent default to country)', () => {
    for (const q of [{ ...funnel, group_by: [] }, count]) {
        const { sql } = buildSqlFromParsedQuery(q);
        assert.doesNotMatch(sql, /GROUP BY/);
    }
});
