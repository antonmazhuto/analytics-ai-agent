import 'dotenv/config';
import { graph } from '../graph/agentGraph';
import type { AgentState } from '../graph/state';

async function main() {
    const initial: AgentState = {
        question:
            'Покажи конверсию из sign_up в purchase за последние 7 дней по странам',
        parsed: undefined,
        rows: undefined,
        answer: undefined,
        errors: [],
    };

    const finalState = await graph.invoke(initial);

    console.log('Final state:', JSON.stringify(finalState, null, 2));
    console.log('Answer:\n', finalState.answer);
    console.log('Errors:', finalState.errors);
}

main().catch(console.error);
