import 'dotenv/config';
import { retrieveMetricDocs } from '../services/retrieveMetricDocs';
import { closePools } from '../db/client';

async function main() {
    const query = 'conversion from sign up to purchase percentage';
    const docs = await retrieveMetricDocs(query, 3);

    console.log(JSON.stringify(docs, null, 2));
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(closePools);
