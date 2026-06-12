# Designer Run Report — 2026-06-12T00:41:35

## What I Did

### Context Gathered
Read all mandatory documents in full:
- `docs/AIInstructor-MASTER-SPECIFICATION.md` (699 lines) — authoritative product spec, especially Parts D (user journey), E (IRL agent), F (data model), G (API spec)
- `docs/AIInstructor-IMPLEMENTATION-PLAN.md` — Iteration 1 section with architecture diagram and build checklist
- `docs/AIInstructor-Revised-Architecture.md` — IRL agent architecture, scenario card design, cognitive dimensions
- `shared-context.md` — updated project state (Iteration 0 complete, 53 tests passing)
- `iteration.md` — Iteration 1 in-progress
- `handoff/1-po-review.md` — 42 acceptance criteria across 7 chunks

Read source files for design precision:
- `infra/lambda/migrate/handler.py` — existing SCHEMA string (332 lines), migration pattern
- `server-python/main.py` — FastAPI route pattern (_make_event, _to_response)
- `src/data/journeyEngine.js` — DIMENSIONS, SCENARIO_TEMPLATES, option signals, createCognitiveProfile, getProfileSummary (636 lines)
- `src/components/CognitiveRadar.jsx` — existing radar component (reads from cognitiveProfile dimensions)
- `src/api.js` — API client pattern
- `src/context/UserContext.jsx` — context provider pattern
- `src/App.jsx` — routing pattern, RequireAuth/RedirectIfAuth
- `server-python/tests/conftest.py` — existing test fixtures to extend
- `infra/lambda/auth/handler.py` — handler pattern reference
- `infra/lambda/shared/db.py`, `jwt_auth.py`, `response.py` — shared module patterns

### Design Decisions Made

1. **Dimension key normalization**: journeyEngine.js uses `detail_accuracy` and `technical_fluency`. Master spec uses `detail` and `technical`. Server code uses master spec canonical keys. Frontend CognitiveRadar already handles arbitrary keys from the profile object.

2. **No `agent_prompts` table in Iteration 1**: The implementation plan explicitly states this comes in Iteration 3 (explore/exploit). Instead, `agent_prompt_id` is a UUID VARCHAR used as a correlation key in `card_interactions`.

3. **Cold start profile**: Per master spec E.8, all dimensions start at `{score: 0.5, confidence: 0.15, samples: 0, trend: "stable"}`. Discovery responses apply option signals on top of this baseline. No role priors influence scores (role priors seed scenario context flavor only).

4. **Card content**: Hardcoded per-dimension template banks ported from journeyEngine.js SCENARIO_TEMPLATES. No LLM generation in Iteration 1 (deliberately dumb agent per implementation plan).

5. **Discovery scenario content on frontend**: 8 scenarios hardcoded in Discovery.jsx, not fetched from server. Only the computed profile is sent to the server via `POST /api/cognitive/init`.

6. **Law 3 in init**: Option 3 (`full_outsource`) during discovery applies `-0.10` penalty IF current score > 0.6. Since all dimensions start at 0.5, this penalty will NOT trigger during initial discovery (no dimension starts > 0.6). It WILL trigger in subsequent journey outcomes after dimensions have been updated.

### Output Produced
- **`handoff/2-design-plan.md`** — complete design plan with:
  - 2 new DB tables (DDL)
  - 4 new API endpoints (full contracts)
  - 7 new Python files (handlers, agent, card banks)
  - 2 new frontend pages (Discovery.jsx, Learn.jsx)
  - 3 modified frontend files (api.js, App.jsx, UserContext.jsx)
  - 16+ new pytest tests across 2 test files
  - 2 new vitest test files
  - 5 new E2E steps
  - 12-phase implementation order
  - Law compliance verification plan

## Test Results
No tests run — this is a design/planning task.

## Screenshot Evidence
N/A — design/planning task.

## What the NEXT Run Should Do (Developer)

**Phase 1 — Database migration** (Chunk A, AC 1–4):
1. Open `infra/lambda/migrate/handler.py`
2. Append the `cognitive_profiles` and `card_interactions` CREATE TABLE blocks from the design plan to the SCHEMA string (before the trigger function section)
3. Deploy and run `POST /api/migrate`

**Phase 2 — Card banks** (data layer):
4. Create `infra/lambda/cognitive/__init__.py` (empty)
5. Create `infra/lambda/cognitive/card_banks.py` — port `SCENARIO_TEMPLATES` from `journeyEngine.js` with keys normalized (`detail_accuracy`→`detail`, `technical_fluency`→`technical`). Define `DISCOVERY_SCENARIOS`, `CONCEPT_TEMPLATES`, `QUESTION_TEMPLATES`, `SUMMARY_TEMPLATES` dicts.

**Phase 3 — Agent logic** (Chunk C):
6. Create `infra/lambda/cognitive/agent.py`:
   - `DIMENSION_CONFIG` — 8 dims with labels, icons
   - `find_weakest_dimension(dimensions)` → returns key with lowest score
   - `generate_card_set(target_dim, config)` → 3 cards (concept, question, summary)
   - `update_dimensions_from_outcomes(dimensions, interactions)` → updated dimensions per E.4 rules
   - `build_reflection(before, after, law3_flags)` → reflection payload

**Phase 4 — Cognitive handler** (Chunk B, AC 5–9):
7. Create `infra/lambda/cognitive/handler.py` with `POST /api/cognitive/init` and `GET /api/cognitive/profile`
8. Add routes to `server-python/main.py`

**Phase 5 — Journey handler** (Chunk C, AC 10–15):
9. Create `infra/lambda/journey/__init__.py` (empty)
10. Create `infra/lambda/journey/handler.py` with `POST /api/journey/next` and `POST /api/journey/outcomes`
11. Add routes to `server-python/main.py`

**Phase 6 — Backend tests** (Chunk G, AC 37):
12. Create `server-python/tests/test_cognitive.py` (8+ tests)
13. Create `server-python/tests/test_journey.py` (8+ tests)
14. Update `conftest.py` to patch the new handler modules' `query` references

**Phase 7 — Frontend** (Chunks D, E, F, AC 16–36):
15. Add 4 API functions to `src/api.js`
16. Update `src/context/UserContext.jsx`
17. Create `src/pages/Discovery.jsx` + `Discovery.css`
18. Create `src/pages/Learn.jsx` + `Learn.css`
19. Add routes to `src/App.jsx`

**Phase 8 — Tests + E2E** (Chunk G, AC 38–39):
20. Extend `scripts/e2e_test.sh` with 5 new steps
21. Run full regression suite

## Blockers / Decisions Needed
- **None identified.** The design plan is complete with exact file paths, function signatures, SQL DDL, API contracts, and implementation order.
- All decisions from PO review are resolved: mock DB pattern for tests, master spec dimension keys, no role priors on scores, hardcoded card templates.
