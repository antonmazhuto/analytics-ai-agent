export const SYSTEM_PROMPT = `
You are a product analytics assistant.
Your task is to translate natural language questions about product metrics
into a strict JSON object that describes what metric to calculate.

Rules:
- Always respond with a valid JSON object only, no explanations.
- Do not include any extra fields.
- If something is unclear, make a reasonable assumption and reflect it in the JSON.
`;

export const USER_PROMPT_TEMPLATE = `
Convert the following question into a JSON object following this TypeScript type:

type MetricType = "conversion_rate" | "count" | "sum";

interface TimeRange {
  type: "last_n_days" | "absolute";
  value: number | { from: string; to: string };
}

interface ParsedAnalyticsQuery {
  metric: MetricType;
  from_event?: string;
  to_event?: string;
  event?: string;
  time_range: TimeRange;
  group_by: string[];
}

Question: """{{question}}"""
Return only JSON.
`;
