import 'dotenv/config';
import { retrieveMetricDocs } from '../services/retrieveMetricDocs';

async function main() {
    const query = 'conversion from sign up to purchase percentage';
    const docs = await retrieveMetricDocs(query, 3);

    console.log(JSON.stringify(docs, null, 2));
}

main().catch(console.error);
