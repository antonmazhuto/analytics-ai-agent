import 'dotenv/config';
import { indexMetricDocs } from '../services/indexMetricDocs';

async function main() {
    await indexMetricDocs([
        {
            metric_name: 'conversion_rate',
            title: 'Conversion rate from sign_up to purchase',
            body: 'Conversion rate is the percentage of users who performed event B after event A in a given time window.',
        },
        {
            metric_name: 'count',
            title: 'Event count',
            body: 'Simple count of events matching given filters in a time period.',
        },
    ]);

    console.log('Metric docs indexed');
}

main().catch(console.error);
