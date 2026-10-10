import { EVENT_NAMES, GROUP_BY_COLUMNS, MAX_DAYS, METRICS } from '../types/analytics';

// Authoritative contract for the model's output. It is also sent to the model
// as the `build_metric_query` tool parameters, so the model sees the same rules AJV enforces.
export const parsedAnalyticsQuerySchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        metric: { type: 'string', enum: [...METRICS] },
        from_event: { type: 'string', enum: [...EVENT_NAMES] },
        to_event: { type: 'string', enum: [...EVENT_NAMES] },
        event: { type: 'string', enum: [...EVENT_NAMES] },
        time_range: {
            type: 'object',
            additionalProperties: false,
            properties: {
                type: { type: 'string', enum: ['last_n_days'] },
                value: { type: 'integer', minimum: 1, maximum: MAX_DAYS },
            },
            required: ['type', 'value'],
        },
        group_by: {
            type: 'array',
            items: { type: 'string', enum: [...GROUP_BY_COLUMNS] },
            uniqueItems: true,
            maxItems: GROUP_BY_COLUMNS.length,
        },
    },
    required: ['metric', 'time_range', 'group_by'],
    allOf: [
        {
            if: { properties: { metric: { const: 'conversion_rate' } }, required: ['metric'] },
            then: { required: ['from_event', 'to_event'] },
        },
        {
            if: { properties: { metric: { const: 'count' } }, required: ['metric'] },
            then: { required: ['event'] },
        },
    ],
};
