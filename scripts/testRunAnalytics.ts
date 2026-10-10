import { runAnalyticsQuery } from '../services/runAnalyticsQuery';
import { ParsedAnalyticsQuery } from '../types/analytics';

async function main() {
    const parsed: ParsedAnalyticsQuery = {
        metric: 'conversion_rate',
        from_event: 'sign_up',
        to_event: 'purchase',
        time_range: {
            type: 'last_n_days',
            value: 7,
        },
        group_by: ['country'],
    };

    const result = await runAnalyticsQuery(parsed);
    console.log('Result:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
