import { z } from 'zod';

export const AgentStateSchema = z.object({
    question: z.string(),
    parsed: z.any().optional(), // later Schema ParsedAnalyticsQuery
    rows: z.array(z.any()).optional(),
    answer: z.string().optional(),
    errors: z.array(z.string()).default([]),
});

export type AgentState = z.infer<typeof AgentStateSchema>;
