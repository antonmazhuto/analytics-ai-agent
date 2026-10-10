import type { ParsedAnalyticsQuery } from '../types/analytics';
import { retrieveMetricDocs, type RetrievedMetricDoc } from './retrieveMetricDocs';

export async function getMetricDocsForParsedQuery(parsed: ParsedAnalyticsQuery): Promise<RetrievedMetricDoc[]> {
    const queryText = `metric: ${parsed.metric}, group_by: ${parsed.group_by.join(', ')}`;
    return retrieveMetricDocs(queryText, 3);
}
