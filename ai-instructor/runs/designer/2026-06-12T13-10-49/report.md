# Designer Run Report — 2026-06-12T13:10:49

## What I Did

Produced a design plan (`handoff/2-design-plan.md`) to fix the P0 production bug: `POST /api/journey/next` returns 500, breaking the core learning loop.

### Analysis Performed

Read and analyzed the following files to diagnose the 500 error:
- `infra/lambda/journey/handler.py` — full journey handler (397 lines)
- `infra/lambda/cognitive/agent.py` — agent logic with generate_card_set, update_dimensions_from_outcomes (254 lines)
- `infra/lambda/cognitive/policy.py` — explore/exploit policy, depth selection (215 lines)
- `infra/lambda/cognitive/ingestion.py` — per-card-type outcome rules (163 lines)
- `infra/lambda/cognitive/card_banks.py` — card templates + dimension config (350 lines)
- `infra/lambda/cognitive/handler.py` — cognitive profile CRUD (145 lines)
- `infra/lambda/shared/db.py` — psycopg2 query helper (49 lines)
- `infra/lambda/shared/jwt_auth.py` — JWT auth (39 lines)
- `infra/lambda/shared/response.py` — response helpers (52 lines)
- `infra/lambda/migrate/handler.py` — migration DDL (lines 340-414)
- `server-python/main.py` — FastAPI routes (lines 305-344)

### Root Cause Analysis

**The bug is in the `agent_prompts` INSERT statement** in `_handle_next()` (journey/handler.py lines 142-159).

Evidence:
1. All working endpoints (`cognitive/init`, `journey/discovery`, `journey/stage`, `cognitive/summary`) either SELECT only or INSERT into tables with 1 UUID column + 1-2 JSONB columns
2. The failing `journey/next` is the **only** endpoint that INSERTs into a table with **3 UUID columns + 4 JSONB columns** in a single statement
3. The `query()` helper passes `json.dumps()` strings via `%s` — psycopg2 sends these as SQL string literals, relying on PostgreSQL's implicit VARCHAR→JSONB and VARCHAR→UUID casting
4. While simple cases (1-2 JSONB params) work, the complex case (3 UUID + 4 JSONB) is the unique stress point

**Three specific fixes designed:**
1. **`::jsonb` explicit casts** — Add `::jsonb` to all JSONB parameters in INSERT/UPDATE statements
2. **`::uuid` explicit casts** — Add `::uuid` to all UUID parameters (especially `agent_prompt_id` and `session_id` from `str(uuid.uuid4())`)
3. **`ALTER TABLE ... ADD COLUMN IF NOT EXISTS preserve_target`** — The `reward_function_state` table may be missing the `preserve_target` column if created by an earlier migration before the column was added to DDL

### Files the Design Plan Modifies

| File | Change |
|------|--------|
| `infra/lambda/journey/handler.py` | Fix 5 INSERT/UPDATE statements with `::uuid`/`::jsonb` casts + add diagnostic logging |
| `infra/lambda/cognitive/handler.py` | Fix 1 INSERT with `::uuid`/`::jsonb` casts (consistency) |
| `infra/lambda/migrate/handler.py` | Add `ALTER TABLE ... ADD COLUMN IF NOT EXISTS preserve_target` |
| `server-python/tests/test_journey.py` | Add `test_journey_next_with_initialized_profile` + `test_journey_outcomes_with_law3` |

## Test Results

No code changes were made (design only). All existing tests are referenced as passing:
- 88 pytest (44 legacy + 44 agent intelligence) — all green locally
- 10 vitest — all green

## What the NEXT Run Should Do (Developer)

### Step 1: Fix migration
- Open `infra/lambda/migrate/handler.py`
- Append `ALTER TABLE reward_function_state ADD COLUMN IF NOT EXISTS preserve_target VARCHAR;` to the SCHEMA string (before closing `"""`)

### Step 2: Fix journey handler INSERT/UPDATE casts
- Open `infra/lambda/journey/handler.py`
- In `_handle_next()` (INSERT agent_prompts): change `%s` to `%s::uuid` for id, user_id, session_id; change `%s` to `%s::jsonb` for target_dimensions, preserve_dimensions, scenario_context, cards_requested
- In `_get_or_create_reward_state()` (INSERT reward_function_state): add `::uuid` and `::jsonb` casts
- In `_update_reward_state()` (UPDATE reward_function_state): add `::jsonb` and `::uuid` casts
- In `_handle_outcomes()` (INSERT card_interactions): add `::uuid` and `::jsonb` casts
- In `_handle_discovery()` (INSERT cognitive_profiles): add `::uuid` and `::jsonb` casts

### Step 3: Fix cognitive handler (consistency)
- Open `infra/lambda/cognitive/handler.py`
- Fix the INSERT cognitive_profiles: add `::uuid` and `::jsonb` casts

### Step 4: Add diagnostic logging
- In `_handle_next()`, add `print(f"[journey/next] Step N: ...")` before each major operation (7 steps total)

### Step 5: Add tests
- Add `test_journey_next_with_initialized_profile` and `test_journey_outcomes_with_law3` to `tests/test_journey.py`

### Step 6: Run tests, push, deploy, verify
- `python -m pytest server-python/tests/ -v` — expect 90+ tests green
- Push to `routine-team-ai` branch
- Run `POST /api/migrate` in production
- Verify: `POST /api/journey/next` returns 200

## Blockers / Decisions Needed

None. The plan is specific enough for the Developer to execute without ambiguity.
