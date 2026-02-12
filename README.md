# Product Analytics AI Agent (Node.js, TypeScript)

Minimal product analytics AI agent built with Node.js/TypeScript.  
The agent takes a natural language question, converts it into a structured query, runs SQL against a Postgres `events` table, and generates a human‑readable explanation of the results.

---

## High‑level Architecture

The agent flow consists of three main steps:

1. **Interpret user query (LLM → structured JSON)**
    - Input: natural language question (e.g. “Show conversion from sign_up to purchase for the last 7 days by country”).
    - Output: `ParsedAnalyticsQuery` (metric type, events, time range, group_by).
    - Implementation:
        - `services/interpretUserQuery.ts`
        - `types/analytics.ts` — TypeScript types
        - `schemas/parsedAnalyticsQuerySchema.ts` — JSON Schema
        - `validation/parsedAnalyticsValidator.ts` — AJV validation + error messages
        - Uses LLM with strict JSON output, JSON parsing, AJV validation and simple retry if schema validation fails.

2. **Run analytics query (structured JSON → SQL → Postgres rows)**
    - Input: `ParsedAnalyticsQuery`.
    - Output: rows from the `events` table (e.g. conversion per country).
    - Implementation:
        - `services/buildSqlFromParsedQuery.ts` — builds SQL + params for supported metrics (e.g. `conversion_rate`, `count`).
        - `db/client.ts` — Postgres connection (`pg` + `DATABASE_URL`).
        - `db/runSql.ts` — thin wrapper `runSql(sql, params)` around `pool.query`.
        - `services/runAnalyticsQuery.ts` — orchestrates SQL building and execution.

3. **Summarize analytics (LLM → human‑readable answer)**
    - Input: user question, `ParsedAnalyticsQuery`, SQL result rows.
    - Output: short explanation in Russian for the user.
    - Implementation:
        - `prompts/summarizeAnalyticsPrompt.ts` — system + user prompt template.
        - `services/summarizeAnalytics.ts` — calls LLM to generate explanation.
        - `services/runAgent.ts` — end‑to‑end agent: interpret → runAnalyticsQuery → summarize.

---

## Project Structure

```text
analytics-agent/
  db/
    client.ts                    # Postgres Pool client (pg)
    runSql.ts                    # runSql<T>(sql, params) -> rows
  prompts/
    interpretQueryPrompt.ts      # system/user prompt for interpretation
    summarizeAnalyticsPrompt.ts  # prompts for summarizer
  schemas/
    parsedAnalyticsQuerySchema.ts # JSON Schema for ParsedAnalyticsQuery
  services/
    interpretUserQuery.ts        # LLM + JSON + AJV + retry
    buildSqlFromParsedQuery.ts   # ParsedAnalyticsQuery -> { sql, params }
    runAnalyticsQuery.ts         # ParsedAnalyticsQuery -> rows
    summarizeAnalytics.ts        # LLM summarizer
    runAgent.ts                  # end-to-end agent flow
  types/
    analytics.ts                 # MetricType, TimeRange, ParsedAnalyticsQuery
    events.ts                    # EventRow type
  validation/
    parsedAnalyticsValidator.ts  # AJV validator for ParsedAnalyticsQuery
  scripts/
    testInterpret.ts             # test interpretUserQuery
    testRunAnalytics.ts          # test runAnalyticsQuery
    testAgent.ts                 # test full agent
  docker-compose.yml             # local Postgres
  .env                           # env vars (DATABASE_URL, OPENAI_*)
