import Ajv, { JSONSchemaType } from 'ajv';
import { ParsedAnalyticsQuery } from '../types/analytics';
import { parsedAnalyticsQuerySchema } from '../schemas/parsedAnalyticsQuerySchema';

const ajv = new Ajv({
    allErrors: true,
    strict: false,
});

const validateParsedAnalyticsQuery = ajv.compile<ParsedAnalyticsQuery>(
    parsedAnalyticsQuerySchema as unknown as JSONSchemaType<ParsedAnalyticsQuery>,
);

export { validateParsedAnalyticsQuery };
