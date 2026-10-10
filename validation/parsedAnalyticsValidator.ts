import Ajv from 'ajv';
import type { ParsedAnalyticsQuery } from '../types/analytics';
import { parsedAnalyticsQuerySchema } from '../schemas/parsedAnalyticsQuerySchema';

// Default strict mode: unknown keywords in the schema are a compile error, not silently ignored.
const ajv = new Ajv({ allErrors: true });

const validate = ajv.compile<ParsedAnalyticsQuery>(parsedAnalyticsQuerySchema);

export type ValidationResult =
    | { ok: true; value: ParsedAnalyticsQuery }
    | { ok: false; errors: string };

export function validateParsedAnalyticsQuery(input: unknown): ValidationResult {
    if (validate(input)) return { ok: true, value: input };
    // Human-readable text, e.g. "args/time_range/value must be <= 365"; fed back to the model on retry.
    return { ok: false, errors: ajv.errorsText(validate.errors, { dataVar: 'args' }) };
}
