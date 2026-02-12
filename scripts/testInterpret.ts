import { interpretUserQuery} from "../services/interpretUserQuery";

async function main() {
    const query = 'Покажи конверсию из sign_up в purchase за последние 7 дней по странам';

    const parsed = await interpretUserQuery(query);
    console.log(JSON.stringify(parsed, null, 2));
}

main().catch(console.error);
