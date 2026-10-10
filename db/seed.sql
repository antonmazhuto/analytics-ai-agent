-- Synthetic product events for the demo (~10k rows), applied by `npm run seed` as the owner role.
-- Deterministic (setseed) and relative to NOW(), so "last 7 days" always has data. Re-runnable.
--
-- 2150 users, each with a home country and one funnel segment:
--   converter   sign_up, then add_to_cart and purchase later          -> counts as converted
--   signup_only sign_up, never purchases                               -> in cohort, not converted
--   buy_first   purchase BEFORE sign_up                                -> in cohort, NOT converted
--   no_signup   purchase without any sign_up                           -> not in the sign_up cohort at all
--   browser     page views only
-- About 5% of page views and 10% of converter purchases come from 'FR' (travel/VPN),
-- so a user can have events in two countries. The funnel must attribute each user once,
-- to the country of their sign_up; 'FR' must never show up as a sign_up cohort.

TRUNCATE events RESTART IDENTITY;
SELECT setseed(0.42);

CREATE TEMP TABLE seed_users ON COMMIT DROP AS
SELECT
    u AS user_id,
    (ARRAY['US', 'DE', 'BR', 'IN'])[1 + u % 4] AS country,
    NOW() - random() * interval '30 days' AS signup_time,
    CASE
        WHEN r < 0.35 THEN 'converter'
        WHEN r < 0.75 THEN 'signup_only'
        WHEN r < 0.80 THEN 'buy_first'
        WHEN r < 0.90 THEN 'no_signup'
        ELSE 'browser'
    END AS segment
FROM (SELECT u, random() AS r FROM generate_series(1, 2150) AS u) AS s;

-- page_view: 3 per user in the two days before signup_time
INSERT INTO events (user_id, event_name, event_time, country)
SELECT user_id, 'page_view', signup_time - random() * interval '2 days',
       CASE WHEN random() < 0.05 THEN 'FR' ELSE country END
FROM seed_users, generate_series(1, 3);

-- sign_up
INSERT INTO events (user_id, event_name, event_time, country)
SELECT user_id, 'sign_up', signup_time, country
FROM seed_users
WHERE segment IN ('converter', 'signup_only', 'buy_first');

-- converter: add_to_cart, then purchase strictly after sign_up (never in the future)
CREATE TEMP TABLE seed_purchases ON COMMIT DROP AS
SELECT user_id, country,
       signup_time + (NOW() - signup_time) * (0.1 + 0.9 * random()) AS purchase_time
FROM seed_users
WHERE segment = 'converter';

INSERT INTO events (user_id, event_name, event_time, country)
SELECT user_id, 'add_to_cart', purchase_time - interval '5 minutes', country
FROM seed_purchases;

INSERT INTO events (user_id, event_name, event_time, country)
SELECT user_id, 'purchase', purchase_time,
       CASE WHEN random() < 0.10 THEN 'FR' ELSE country END
FROM seed_purchases;

-- buy_first: purchase 1-49 hours BEFORE sign_up
INSERT INTO events (user_id, event_name, event_time, country)
SELECT user_id, 'purchase', signup_time - interval '1 hour' - random() * interval '2 days', country
FROM seed_users
WHERE segment = 'buy_first';

-- no_signup: purchase with no sign_up at all
INSERT INTO events (user_id, event_name, event_time, country)
SELECT user_id, 'purchase', signup_time, country
FROM seed_users
WHERE segment = 'no_signup';

SELECT event_name, COUNT(*) AS events
FROM events
GROUP BY event_name
ORDER BY event_name;
