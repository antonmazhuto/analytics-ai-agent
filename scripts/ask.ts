import 'dotenv/config';
import { createAgentGraph } from '../graph/agentGraph';
import { pool } from '../db/client';
import { interpretUserQuery } from '../services/interpretUserQuery';
import { runAnalyticsQuery } from '../services/runAnalyticsQuery';
import { summarizeAnalytics } from '../services/summarizeAnalytics';

// Usage: npm run ask -- "Покажи конверсию из sign_up в purchase за последние 7 дней по странам"
async function main() {
    const question = process.argv.slice(2).join(' ').trim();
    if (!question) {
        console.error('Usage: npm run ask -- "<question>"');
        process.exitCode = 2;
        return;
    }

    const graph = createAgentGraph({
        interpret: (q) => interpretUserQuery(q),
        runQuery: runAnalyticsQuery,
        summarize: summarizeAnalytics,
    });

    const finalState = await graph.invoke({ question });

    console.log('Parsed query:', JSON.stringify(finalState.parsed, null, 2));
    console.log('Rows:', JSON.stringify(finalState.rows, null, 2));
    if (finalState.errors.length > 0) console.log('Errors:', finalState.errors);
    console.log('\nAnswer:\n' + finalState.answer);
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
