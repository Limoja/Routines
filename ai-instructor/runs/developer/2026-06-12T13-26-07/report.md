# Developer Run Report — 2026-06-12T13-26-07

## What I Did

Fixed the P0 production bug: `POST /api/journey/next` returning 500, breaking the core learning loop.

### Root Cause
psycopg2 sends Python string params to PostgreSQL UUID/JSONB columns without explicit type casts. The `agent_prompts` INSERT has 3 UUID + 4 JSONB params — the first endpoint with this many typed columns. Implicit PostgreSQL casting failed on this INSERT.

### Files Changed (4 files, +98/-10 lines)

| File | Change |
|------|--------|
| `infra/lambda/journey/handler.py` | Added `::uuid`/`::jsonb` casts to 5 SQL operations. Added diagnostic logging to `_handle_next()` |
| `infra/lambda/migrate/handler.py` | Added `ALTER TABLE` for `preserve_target` column. Added DO block for `agent_prompt_id` type migration |
| `infra/lambda/cognitive/handler.py` | Added `::uuid`/`::jsonb` casts to `cognitive_profiles` INSERT |
| `server-python/tests/test_journey.py` | Added 2 integration tests: `test_next_with_initialized_profile_full_flow`, `test_outcomes_law3_full_chain` |

### Functions Modified
- `_handle_next()` — added 7 `print()` logging statements + `::uuid`/`::jsonb` casts in agent_prompts INSERT
- `_get_or_create_reward_state()` — `::uuid`/`::jsonb` casts in reward_function_state INSERT
- `_handle_outcomes()` — `::uuid`/`::jsonb` casts in card_interactions INSERT + cognitive_profiles UPDATE
- `_update_reward_state()` — `::uuid`/`::jsonb` casts in reward_function_state UPDATE
- `_handle_discovery()` — `::uuid`/`::jsonb` casts in cognitive_profiles INSERT
- `cognitive.handler: POST /api/cognitive/init` — `::uuid`/`::jsonb` casts in cognitive_profiles INSERT

## Test Results

```
90 passed, 0 failed (88 existing + 2 new)
```

Full output saved to: `evidence/pytest-output.txt`
Diff stat saved to: `evidence/diff-stat.txt`

## Deployment Status
- Commit: `4af5fbe` on `routine-team-ai`, merged to `main`
- GitHub Actions deploy: run 27418818774 (in progress)
- Post-deploy required: `POST /api/migrate` to apply new ALTER TABLE migrations

## What the NEXT Run Should Do

1. **Check deploy status**: `gh run view 27418818774` — if failed, check logs for build/deploy errors
2. **Run migration**: `curl -X POST https://ai-inst-production-api...ukwest.azurecontainerapps.io/api/migrate`
3. **Verify P0 fix**: Full E2E against production — signup → discovery → `/api/journey/next` → outcomes → next
4. **If still 500**: Check Azure logs for `[journey/next] Step N:` — last step printed is the failure point
5. **After P0 confirmed fixed**: Move to next priority gap (ChallengePlayer with more card types, or Profile page)

## Blockers
- Deploy relies on GitHub Actions (no Azure CLI in container). If deploy fails, manual intervention may be needed.
- Production verification cannot happen until deploy completes + migration runs.
