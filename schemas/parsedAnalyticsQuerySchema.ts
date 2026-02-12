export const parsedAnalyticsQuerySchema = {
    type: 'object',
    properties: {
        metric: {
            type: 'string',
            enum: ['conversion_rate', 'count', 'sum'],
        },
        from_event: {
            type: 'string',
        },
        to_event: {
            type: 'string',
        },
        event: {
            type: 'string',
        },
        time_range: {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    enum: ['last_n_days', 'absolute'],
                },
                value: {
                    oneOf: [
                        {
                            type: 'number', // для last_n_days
                        },
                        {
                            type: 'object', // для абсолютного диапазона
                            properties: {
                                from: { type: 'string' },
                                to: { type: 'string' },
                            },
                            required: ['from', 'to'],
                        },
                    ],
                },
            },
            required: ['type', 'value'],
        },
        group_by: {
            type: 'array',
            items: { type: 'string' },
        },
    },
    required: ['metric', 'time_range', 'group_by'],
};
