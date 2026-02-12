export type MetricType = 'conversion_rate' | 'count' | 'sum';

export interface TimeRange {
    type: 'last_n_days' | 'absolute';
    // last_n_days -> value = days as number
    // absolute -> value = { from: ISO, to: ISO }
    value: number | { from: string; to: string };
}

export interface ParsedAnalyticsQuery {
    metric: MetricType;
    from_event?: string; // for conversion_rate
    to_event?: string;   // for conversion_rate
    event?: string;      // for count/sum
    time_range: TimeRange;
    group_by: string[];
}
