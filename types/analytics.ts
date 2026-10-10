// Single source of truth for what the SQL builder can execute.
// The JSON Schema, the interpret prompt and the builder's own allowlist are all derived from these lists.
export const METRICS = ['conversion_rate', 'count'] as const;
export const EVENT_NAMES = ['page_view', 'sign_up', 'add_to_cart', 'purchase'] as const;
export const GROUP_BY_COLUMNS = ['country'] as const;
export const MAX_DAYS = 365;

export type MetricType = (typeof METRICS)[number];
export type EventName = (typeof EVENT_NAMES)[number];
export type GroupByColumn = (typeof GROUP_BY_COLUMNS)[number];

export interface TimeRange {
    type: 'last_n_days';
    value: number; // integer, 1..MAX_DAYS
}

export interface ParsedAnalyticsQuery {
    metric: MetricType;
    from_event?: EventName; // conversion_rate
    to_event?: EventName;   // conversion_rate
    event?: EventName;      // count
    time_range: TimeRange;
    group_by: GroupByColumn[]; // [] = no breakdown
}
