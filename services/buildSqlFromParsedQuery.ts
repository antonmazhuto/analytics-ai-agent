import { ParsedAnalyticsQuery } from '../types/analytics';

export interface SqlToolResult {
    sql: string;
    params: any[];
}

export function buildSqlFromParsedQuery(parsed: ParsedAnalyticsQuery): SqlToolResult {
    const { metric, time_range, group_by } = parsed;

    if (time_range.type !== 'last_n_days') {
        throw new Error(`Unsupported time_range.type: ${time_range.type}`);
    }

    const days = time_range.value;
    if (typeof days !== 'number') {
        throw new Error(`For last_n_days expected numeric value, got: ${JSON.stringify(days)}`);
    }

    switch (metric) {
        case 'conversion_rate':
            return buildConversionRateSql(parsed, days);
        case 'count':
            return buildCountSql(parsed, days);
        default:
            throw new Error(`Unsupported metric: ${metric}`);
    }
}

function buildConversionRateSql(parsed: ParsedAnalyticsQuery, days: number): SqlToolResult {
    const { from_event, to_event, group_by } = parsed;

    if (!from_event || !to_event) {
        throw new Error(`conversion_rate requires from_event and to_event`);
    }

    const groupByCols = (group_by && group_by.length > 0) ? group_by : ['country'];
    const groupBySelect = groupByCols.join(', ');
    const groupByGroup = groupBySelect;

    // Params: $1 = from_event, $2 = to_event, $3 = days
    const sql = `
WITH user_funnel AS (
  SELECT
    user_id,
    ${groupBySelect},
    BOOL_OR(event_name = $1) AS has_from_event,
    BOOL_OR(event_name = $2) AS has_to_event
  FROM events
  WHERE event_time >= NOW() - ($3 || ' days')::interval
  GROUP BY user_id, ${groupByGroup}
)
SELECT
  ${groupBySelect},
  COUNT(*) FILTER (WHERE has_from_event) AS from_users,
  COUNT(*) FILTER (WHERE has_from_event AND has_to_event) AS to_users,
  CASE
    WHEN COUNT(*) FILTER (WHERE has_from_event) = 0 THEN 0
    ELSE (
      COUNT(*) FILTER (WHERE has_from_event AND has_to_event)::float
      /
      COUNT(*) FILTER (WHERE has_from_event)::float
    ) * 100
  END AS conversion_rate
FROM user_funnel
GROUP BY ${groupByGroup};
`.trim();

    const params = [from_event, to_event, days];

    return { sql, params };
}

function buildCountSql(parsed: ParsedAnalyticsQuery, days: number): SqlToolResult {
    const { event, group_by } = parsed;

    if (!event) {
        throw new Error(`count metric requires 'event' field`);
    }

    const groupByCols = (group_by && group_by.length > 0) ? group_by : [];
    const hasGroup = groupByCols.length > 0;
    const groupBySelect = hasGroup ? groupByCols.join(', ') + ',' : '';
    const groupByGroup = groupByCols.join(', ');

    // $1 = event_name, $2 = days
    const sql = `
SELECT
  ${groupBySelect}
  COUNT(*) AS event_count
FROM events
WHERE event_name = $1
  AND event_time >= NOW() - ($2 || ' days')::interval
${hasGroup ? `GROUP BY ${groupByGroup}` : ''}
;`.trim();

    const params = [event, days];

    return { sql, params };
}
