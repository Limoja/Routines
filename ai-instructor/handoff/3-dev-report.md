# Dev Report — 2026-06-12

## Based on Design Plan: 2026-06-12

## Changes Made

### Backend — New Files
- `infra/lambda/cognitive/policy.py`: Explore/exploit policy engine with 8 functions: `compute_explore_ratio`, `decide_mode`, `select_target_dimension`, `select_depth`, `compute_preserve_dimensions`, `apply_confidence_ceiling`, `update_exploration_queue`, `compute_trend`
- `infra/lambda/cognitive/ingestion.py`: Full per-card-type outcome ingestion with 7 functions: `ingest_scenario_outcome`, `ingest_question_outcome`, `ingest_prompt_lab_outcome`, `ingest_practice_outcome`, `ingest_concept_outcome`, `ingest_summary_outcome`, `apply_law3`

### Backend — Modified Files
- `infra/lambda/cognitive/agent.py`: Refactored to delegate to `policy.py` + `ingestion.py`. `generate_card_set` now accepts `depth` parameter. `update_dimensions_from_outcomes` routes to per-type ingestion + returns `preserve_targets`. `build_reflection` enhanced with `preserve_messages`.
- `infra/lambda/cognitive/card_banks.py`: Added depth-variant templates (anchor/author) for concept, question, summary + helper functions `get_concept_template()`, `get_question_template()`, `get_summary_template()`.
- `infra/lambda/cognitive/handler.py`: Added `GET /api/cognitive/summary` endpoint returning `{strengths, weaknesses, uncertain}`.
- `infra/lambda/journey/handler.py`: Major refactor — `_handle_next` uses explore/exploit policy, creates `agent_prompts` row, returns `mode`/`depth`. `_handle_outcomes` routes to per-type ingestion, applies full Law 3, updates `reward_function_state`. Added `_handle_stage` and `_handle_discovery`.
- `infra/lambda/migrate/handler.py`: Added DDL for `reward_function_state` and `agent_prompts` tables with indexes.
- `server-python/main.py`: Added 3 new routes: `/api/cognitive/summary`, `/api/journey/stage`, `/api/journey/discovery`.

### Tests — New Files
- `server-python/tests/test_agent_policy.py`: 14 tests — explore/exploit, depth, anti-pigeon-holing
- `server-python/tests/test_ingestion.py`: 14 tests — all outcome types, Law 3, score clamping
- `server-python/tests/test_new_endpoints.py`: 8 tests — summary, stage, discovery endpoints

### Tests — Modified Files
- `server-python/tests/test_journey.py`: Updated 4 existing tests, added 6 new tests (mode/depth/agent_prompts/Law3)
- `server-python/tests/conftest.py`: Updated `mock_query` fixture for new modules

## Test Results
- pytest: **88 passing**, 0 failing (44 existing + 44 new)
- vitest: **10 passing** (no frontend changes)

## Deployment
- Branch: routine-team-ai (commit `062d6fd`)
- Dev API status: UP ✅
- **Migration required**: `POST /api/migrate` to create `reward_function_state` and `agent_prompts` tables

## What's Ready to Test
1. `GET /api/cognitive/summary` — strengths/weaknesses/uncertain classification
2. `GET /api/journey/stage` — journey stage + mastery eligibility
3. `POST /api/journey/discovery` — creates profile + reward state
4. `POST /api/journey/next` — returns `mode` (explore/exploit) and `depth` (anchor/adapt/author)
5. `POST /api/journey/outcomes` — full Law 3 chain (score -0.02 + preserve target + reflection message)
6. Explore/exploit policy — deterministic, early-journey biased explore, forced re-exploration every 25 interactions
7. Anti-pigeon-holing — confidence ceiling 0.95, declining strong dims prioritized

## Issues / Blockers
- **Deployment needed**: New tables and endpoints require deployment before E2E testing
- **Migration step**: `POST /api/migrate` must be called after deployment

## Implementation Status
- [x] Database: `reward_function_state` and `agent_prompts` tables
- [x] `policy.py`: All 8 functions (explore/exploit, depth, anti-pigeon-holing)
- [x] `ingestion.py`: All 7 ingest functions + `apply_law3`
- [x] `agent.py`: Refactored with policy + ingestion, backward-compatible
- [x] `card_banks.py`: Depth variants (anchor/author) + helpers
- [x] `cognitive/handler.py`: `GET /api/cognitive/summary`
- [x] `journey/handler.py`: Full refactor with policy, agent_prompts, reward_state
- [x] `main.py`: 3 new routes
- [x] Tests: 88 passing (44 new across 3 test files + 6 new journey tests)
- [ ] Frontend: mode/depth badges on Learn.jsx (optional — deferred)
- [ ] E2E: Re-run after deployment
