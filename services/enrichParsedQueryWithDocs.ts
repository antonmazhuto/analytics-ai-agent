import { ParsedAnalyticsQuery } from '../types/analytics';
import { retrieveMetricDocs } from './retrieveMetricDocs';

export async function getMetricDocsForParsedQuery(
    parsed: ParsedAnalyticsQuery,
) {
    const queryText = `metric: ${parsed.metric}, group_by: ${parsed.group_by.join(
        ', ',
    )}`;
    const docs = await retrieveMetricDocs(queryText, 3);
    return docs;
}
