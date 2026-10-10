import { EVENT_NAMES, GROUP_BY_COLUMNS, MAX_DAYS } from '../types/analytics';

export const SYSTEM_PROMPT = `
You are a product analytics assistant.
Your task is to translate natural language questions about product metrics
into a strict JSON object that describes what metric to calculate.

Rules:
- Always respond with a valid JSON object only, no explanations.
- Do not include any extra fields.
- Use only the events and group_by columns listed below. Do not guess or substitute.
`;

export const USER_PROMPT_TEMPLATE = `
Convert the following question into a JSON object following this TypeScript type:

type EventName = ${EVENT_NAMES.map((e) => `"${e}"`).join(' | ')};

interface ParsedAnalyticsQuery {
  metric: "conversion_rate" | "count";
  from_event?: EventName; // required for conversion_rate
  to_event?: EventName;   // required for conversion_rate
  event?: EventName;      // required for count
  time_range: { type: "last_n_days"; value: number }; // integer, 1..${MAX_DAYS}
  group_by: (${GROUP_BY_COLUMNS.map((c) => `"${c}"`).join(' | ')})[]; // [] = no breakdown
}

Question: """{{question}}"""
Return only JSON.
`;
