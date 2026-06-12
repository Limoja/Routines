# Designer Run Report — 2026-06-12T09:31:21

## What I Did

### Context Gathered
Read all mandatory documents:
- `docs/AIInstructor-MASTER-SPECIFICATION.md` (699 lines) — focused on Parts E.2–E.7 (agent intelligence), E.4 (outcome ingestion), E.5 (Law 3), E.6 (anti-pigeon-holing), F.1 (data model), G.1 (API spec)
- `shared-context.md` — current state: 39 endpoints deployed, core loop working, agent is trivial
- `handoff/1-po-review.md` — 37 acceptance criteria across agent intelligence chunk
- `handoff/4-test-report.md` — 69/74 tests pass (42/42 AC code-level, 5 E2E now deployed)

Read all existing agent code in detail:
- `infra/lambda/cognitive/agent.py` (218 lines) — current simple agent: `find_weakest_dimension()`, `generate_card_set()`, `update_dimensions_from_outcomes()`, `build_reflection()`
- `infra/lambda/cognitive/card_banks.py` (253 lines) — hardcoded templates for 8 dims, only "adapt" depth level
- `infra/lambda/journey/handler.py` (153 lines) — `_handle_next()` and `_handle_outcomes()` with simple agent calls
- `infra/lambda/cognitive/handler.py` — profile init + get
- `server-python/tests/test_journey.py` (135 lines) — 8 existing tests with mock patterns
- `server-python/tests/test_cognitive.py` (146 lines) — 9 existing tests
- `server-python/tests/conftest.py` — mock_query fixture pattern
- `infra/lambda/migrate/handler.py` (332 lines) — existing SCHEMA, append pattern

### Design Decisions

1. **Deterministic explore/exploit for testability**: Instead of random/Thompson sampling (per E.2), use a deterministic threshold: if `explore_ratio > 0.5` → explore, else exploit. This makes all tests reproducible. Stochastic selection can be added later.

2. **Two new modules instead of one monolithic agent**: `policy.py` (decisions) and `ingestion.py` (outcome processing). This separates concerns and makes unit testing straightforward — each function is pure (takes data, returns data, no DB).

3. **`agent.py` becomes a thin orchestrator**: It calls `policy.py` for decisions and `ingestion.py` for processing. The existing functions are preserved with enhanced signatures (backward-compatible) so existing tests don't break.

4. **Depth content variants**: Add anchor/author templates to `card_banks.py` alongside existing adapt templates. 3 variants × 3 card types × 8 dimensions = 72 template entries. Each dimension gets:
   - Anchor: "What is {dim}? Here's what it means..."
   - Adapt: (current templates) guided practice
   - Author: "Create something using your {dim} strength..."

5. **Law 3 preserve target stored in reward_function_state**: When Law 3 triggers, the preserve target is stored in `reward_function_state` so the next `_handle_next()` call can override the normal target selection. This persists across requests.

6. **Trend computation deferred to batch**: Computing trends requires querying historical interactions per dimension (last 10 samples). This is expensive per outcome. Design: compute trends lazily in `_handle_next()` when generating the next challenge, not in `_handle_outcomes()`. For now, trend stays "stable" until enough samples accumulate.

7. **`POST /api/journey/discovery` wraps cognitive/init**: Same logic plus creates `reward_function_state`. This is the spec-recommended entry point (G.1) that will eventually replace `cognitive/init` for discovery.

### Output Produced
- **`handoff/2-design-plan.md`** — complete design plan with:
  - 2 new DB tables (DDL with indexes)
  - 3 new API endpoints (summary, stage, discovery)
  - 2 new Python modules (policy.py, ingestion.py) — 15+ pure functions
  - 4 modified files (agent.py, handler.py, card_banks.py, main.py)
  - 5 new/updated test files (70+ total pytest target)
  - 17-phase implementation order
  - Detailed testing notes per AC group

## Test Results
No tests run — design/planning task.

## Screenshot Evidence
N/A — design/planning task.

## What the NEXT Run Should Do (Developer)

### Phase 1 — Database (AC 1–3):
1. Append `reward_function_state` + `agent_prompts` DDL to `infra/lambda/migrate/handler.py` SCHEMA string
2. Verify idempotent migration

### Phase 2 — New Modules (AC 4–12, 17–23):
3. Create `infra/lambda/cognitive/policy.py` with all functions listed in the design
4. Create `infra/lambda/cognitive/ingestion.py` with all per-type ingestion functions
5. Add depth variants to `infra/lambda/cognitive/card_banks.py`

### Phase 3 — Refactor (AC 4–5, 10–12, 17–20):
6. Refactor `infra/lambda/cognitive/agent.py` — use policy.py + ingestion.py
7. Refactor `infra/lambda/journey/handler.py` — enhanced next/outcomes + agent_prompts + reward_state

### Phase 4 — New Endpoints (AC 24–26):
8. Add `GET /api/cognitive/summary` to cognitive handler
9. Add `POST /api/journey/discovery` + `GET /api/journey/stage` to journey handler
10. Add 3 routes to `server-python/main.py`

### Phase 5 — Tests (AC 29–37):
11. Create `test_agent_policy.py` — explore/exploit + depth tests
12. Create `test_ingestion.py` — per-type outcome rule tests
13. Update `test_journey.py` — mode, depth, agent_prompts, Law 3 chain
14. Create `test_new_endpoints.py` — summary, stage, discovery
15. Run full suite — target 70+ tests, 0 regressions

## Blockers / Decisions Needed
- **Deterministic vs stochastic mode selection**: Design uses deterministic threshold. If PO requires stochastic (random sampling against explore_ratio), tests need to mock `random.random()` or use seeded RNG. Recommend deterministic for now.
- **Trend computation timing**: Computing trends requires querying card_interactions history per dimension. This adds DB queries. Recommend: compute trends lazily in `_handle_next()` (not in outcomes), only when generating the next challenge.
- **Frontend depth display**: This chunk is backend-only. The frontend doesn't need changes, but `/api/journey/next` now returns `mode` and `depth` fields. Future chunks should show these as badges in Learn.jsx.
