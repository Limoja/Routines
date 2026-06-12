# Dev Report — 2026-06-12

## Based on Design Plan: 2026-06-12T13:10

## Changes Made

### Backend
- `infra/lambda/journey/handler.py`: Added explicit `::uuid` and `::jsonb` SQL type casts to all 5 DB write operations (agent_prompts INSERT, reward_function_state INSERT, reward_function_state UPDATE, card_interactions INSERT, cognitive_profiles INSERT/UPDATE). Added diagnostic `print()` logging to `_handle_next()` steps 1–7.
- `infra/lambda/migrate/handler.py`: Added `ALTER TABLE reward_function_state ADD COLUMN IF NOT EXISTS preserve_target VARCHAR` migration. Added `DO $$` block to migrate `card_interactions.agent_prompt_id` from VARCHAR to UUID type.
- `infra/lambda/cognitive/handler.py`: Added `::uuid` and `::jsonb` casts to `cognitive_profiles` INSERT for consistency.

### Frontend
- None required. Frontend already calls `/api/journey/next` correctly.

### Bug Fixes
- **P0: `POST /api/journey/next` returns 500**: Root cause was psycopg2 sending Python string params to PostgreSQL UUID/JSONB columns without explicit type casts. The `agent_prompts` INSERT has 3 UUID columns + 4 JSONB columns — the first endpoint with this many typed params. Fixed by adding `::uuid` and `::jsonb` casts to all SQL templates.
- **Missing `preserve_target` column**: If `reward_function_state` was created in an earlier migration run before this column was added to the DDL, the column would be missing, causing `_update_reward_state` UPDATE to fail. Fixed with idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- **`card_interactions.agent_prompt_id` type mismatch**: Column was VARCHAR in original DDL but code passes UUID strings. Fixed with DO block to ALTER TYPE.

## Test Results
- pytest: **90 passing**, 0 failing (+2 new tests)
- vitest: 10 passing (unchanged, not rerun)

### New Tests
- `test_next_with_initialized_profile_full_flow` — AC1-6: verifies mode, depth, agent_prompt_id, 3-card set, target_dimensions, preserve_dimensions all present in response
- `test_outcomes_law3_full_chain` — AC10-12: verifies Law 3 enforcement chain (law3_flags, preserve_messages with "superpower")

## Deployment
- Branch: routine-team-ai (commit `4af5fbe`) — merged to main
- GitHub Actions deploy workflow triggered: run 27418818774
- Dev API status: UP (pre-deploy health confirmed)
- **Migration required post-deploy**: `POST /api/migrate` must be called to add `preserve_target` column

## What's Ready to Test
1. `POST /api/journey/next` — should return 200 with `{mode, depth, agent_prompt_id, cards}`
2. `POST /api/journey/outcomes` — should return 200 with `{profile, reflection}`
3. Full E2E loop: signup → discovery → next → outcomes → next (second challenge)

## Issues / Blockers
- **Deploy in progress** — GitHub Actions workflow run 27418818774. Needs monitoring.
- **Post-deploy step required**: `POST https://ai-inst-production-api...ukwest.azurecontainerapps.io/api/migrate` to run the new ALTER TABLE migrations.
- No Azure CLI in container environment — cannot deploy directly, relying on GitHub Actions.

## Implementation Status
- [x] Add ALTER TABLE migration for `preserve_target` column
- [x] Fix all INSERT/UPDATE SQL type casts in `journey/handler.py` (5 operations)
- [x] Fix INSERT SQL type casts in `cognitive/handler.py`
- [x] Add diagnostic logging to `_handle_next()` steps 1-7
- [x] Add targeted integration tests (2 new tests)
- [x] Run full test suite (90/90 pass)
- [x] Push to `routine-team-ai` branch (commit `4af5fbe`)
- [x] Merge to main and trigger deploy workflow
- [ ] Verify production: `POST /api/journey/next` returns 200
- [ ] Run migration in production: `POST /api/migrate`
- [ ] Verify full E2E loop against production
