import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateParsedAnalyticsQuery } from '../validation/parsedAnalyticsValidator';

const valid = {
    metric: 'conversion_rate',
    from_event: 'sign_up',
    to_event: 'purchase',
    time_range: { type: 'last_n_days', value: 7 },
    group_by: ['country'],
};

function errorsFor(input: object): string {
    const result = validateParsedAnalyticsQuery(input);
    assert.equal(result.ok, false, `expected ${JSON.stringify(input)} to be rejected`);
    return result.ok ? '' : result.errors;
}

test('schema: accepts a valid funnel query', () => {
    assert.equal(validateParsedAnalyticsQuery(valid).ok, true);
});

test('schema: rejects what the builder cannot execute', () => {
    assert.match(errorsFor({ ...valid, metric: 'sum' }), /metric must be equal to one of the allowed values/);
    assert.match(errorsFor({ ...valid, time_range: { type: 'absolute', value: 7 } }), /time_range\/type/);
    assert.match(errorsFor({ ...valid, time_range: { type: 'last_n_days', value: 7.5 } }), /must be integer/);
    assert.match(errorsFor({ ...valid, time_range: { type: 'last_n_days', value: 400 } }), /must be <= 365/);
    assert.match(errorsFor({ ...valid, group_by: ['user_id'] }), /group_by\/0 must be equal to one of the allowed values/);
    assert.match(errorsFor({ ...valid, group_by: ['country', 'country'] }), /group_by/);
    assert.match(errorsFor({ ...valid, from_event: 'signup' }), /from_event must be equal to one of the allowed values/);
    assert.match(errorsFor({ ...valid, filter: 'x' }), /must NOT have additional properties/);
});

test('schema: metric-specific required fields', () => {
    assert.match(errorsFor({ ...valid, to_event: undefined }), /must have required property 'to_event'/);
    assert.match(
        errorsFor({ metric: 'count', time_range: { type: 'last_n_days', value: 7 }, group_by: [] }),
        /must have required property 'event'/,
    );
});
