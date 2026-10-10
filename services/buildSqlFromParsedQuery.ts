import { GROUP_BY_COLUMNS, MAX_DAYS, type ParsedAnalyticsQuery } from '../types/analytics';

export interface SqlToolResult {
    sql: string;
    params: (string | number)[];
}

// The builder re-checks everything it interpolates, independently of the AJV validator:
// group_by entries become SQL identifiers, so only allowlisted column names may pass.
const ALLOWED_GROUP_BY: ReadonlySet<string> = new Set(GROUP_BY_COLUMNS);

// Hard cap on returned rows. The query asks for one extra row so the caller can tell
// "exactly ROW_LIMIT rows" from "truncated".
export const ROW_LIMIT = 500;

export function buildSqlFromParsedQuery(parsed: ParsedAnalyticsQuery): SqlToolResult {
    const { metric, time_range } = parsed;

    if (time_range.type !== 'last_n_days') {
        throw new Error(`Unsupported time_range.type: ${String(time_range.type)}`);
    }
    const days = time_range.value;
    if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
        throw new Error(`time_range.value must be an integer from 1 to ${MAX_DAYS}, got ${JSON.stringify(days)}`);
    }

    const groupBy = checkGroupBy(parsed.group_by);

    switch (metric) {
        case 'conversion_rate':
            return buildConversionRateSql(parsed, days, groupBy);
        case 'count':
            return buildCountSql(parsed, days, groupBy);
        default:
            throw new Error(`Unsupported metric: ${String(metric)}`);
    }
}

function checkGroupBy(groupBy: unknown): string[] {
    if (!Array.isArray(groupBy)) {
        throw new Error('group_by must be an array');
    }
    for (const col of groupBy) {
        if (typeof col !== 'string' || !ALLOWED_GROUP_BY.has(col)) {
            throw new Error(`group_by column is not allowed: ${JSON.stringify(col)}`);
        }
    }
    if (new Set(groupBy).size !== groupBy.length) {
        throw new Error('group_by contains duplicate columns');
    }
    return groupBy as string[];
}

// Order-aware funnel:
//   1. cohort = users whose FIRST from_event falls in the window; the user is attributed
//      to the country of that first from_event (one user = one row, no double counting);
//   2. converted = a to_event exists strictly AFTER that first from_event.
// A to_event before the from_event, or without one, does not count.
function buildConversionRateSql(parsed: ParsedAnalyticsQuery, days: number, groupBy: string[]): SqlToolResult {
    const { from_event, to_event } = parsed;

    if (!from_event || !to_event) {
        throw new Error('conversion_rate requires from_event and to_event');
    }
    if (from_event === to_event) {
        throw new Error('conversion_rate requires two different events');
    }

    const select = groupBy.map((col) => `${col}, `).join('');
    const groupClause = groupBy.length > 0 ? `GROUP BY ${groupBy.join(', ')}\nORDER BY ${groupBy.join(', ')}` : '';

    // $1 = from_event, $2 = to_event, $3 = days, $4 = row limit
    const sql = `
WITH first_from AS (
  SELECT DISTINCT ON (user_id) user_id, event_time AS from_time, country
  FROM events
  WHERE event_name = $1
    AND event_time >= NOW() - make_interval(days => $3::int)
  ORDER BY user_id, event_time
),
funnel AS (
  SELECT f.*,
         EXISTS (
           SELECT 1 FROM events e
           WHERE e.user_id = f.user_id
             AND e.event_name = $2
             AND e.event_time > f.from_time
         ) AS converted
  FROM first_from f
)
SELECT
  ${select}COUNT(*)::int AS from_users,
  (COUNT(*) FILTER (WHERE converted))::int AS to_users,
  ROUND(100.0 * COUNT(*) FILTER (WHERE converted) / NULLIF(COUNT(*), 0), 1)::float8 AS conversion_rate
FROM funnel
${groupClause}
LIMIT $4`.trim();

    return { sql, params: [from_event, to_event, days, ROW_LIMIT + 1] };
}

function buildCountSql(parsed: ParsedAnalyticsQuery, days: number, groupBy: string[]): SqlToolResult {
    const { event } = parsed;

    if (!event) {
        throw new Error(`count requires 'event'`);
    }

    const select = groupBy.map((col) => `${col}, `).join('');
    const groupClause = groupBy.length > 0 ? `GROUP BY ${groupBy.join(', ')}\nORDER BY ${groupBy.join(', ')}` : '';

    // $1 = event_name, $2 = days, $3 = row limit
    const sql = `
SELECT
  ${select}COUNT(*)::int AS event_count
FROM events
WHERE event_name = $1
  AND event_time >= NOW() - make_interval(days => $2::int)
${groupClause}
LIMIT $3`.trim();

    return { sql, params: [event, days, ROW_LIMIT + 1] };
}
