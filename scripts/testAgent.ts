import 'dotenv/config';
import { runAgent } from '../services/runAgent';

async function main() {
    const question =
        'Покажи конверсию из sign_up в purchase за последние 7 дней по странам';

    const result = await runAgent(question);

    console.log('Parsed query:', JSON.stringify(result.parsed, null, 2));
    console.log('Rows:', JSON.stringify(result.rows, null, 2));
    console.log('Answer:\n', result.answer);
}

main().catch(console.error);
