# PO Review — 2026-06-12

## Current Iteration: 1 — The Thinnest Loop
## Pipeline Status: flowing

## Product Status
- API Health: **UP** — `/api/health` returns `{"status":"ok"}` at 2026-06-12T00:37Z
- Web: **UP** — returns 200 OK
- Iteration 0 **COMPLETE** — merged to main at `6153092` (2026-06-12)
- 53 tests passing: 28 pytest + 6 vitest + 10 E2E + 9 web UI verification
- CI pipeline running: `.github/workflows/test.yml` with parallel pytest + vitest jobs
- Existing features all functional: auth, onboarding, curriculum, lessons, chat, practice
- **No Iteration 1 features exist yet** — no `/api/cognitive/*`, no `/api/journey/*`, no Discovery.jsx, no Learn.jsx

## Previous Work Review
### From Tester Report (Iteration 0 — PASS):
- 22/22 acceptance criteria met
- 28 pytest tests passing (auth: 13, curriculum: 4, progress: 5, chat: 5, health: 1)
- 6 vitest route smoke tests passing
- 10/10 E2E steps passing against production API
- 9/9 web UI curl-based verifications passing
- Playwright tests written but blocked by container env (work in CI ubuntu-latest)

### Bugs from Tester (both low severity):
1. `__pycache__` directories committed to git — needs `.gitignore` fix (may already be fixed in merge)
2. Playwright cannot run in minimal containers — env limitation, not code bug

### Gaps Found (Iteration 0 → 1 transition):
- No new gaps in Iteration 0 deliverables
- All Iteration 0 infrastructure ready to support Iteration 1 development

## Acceptance Criteria for Iteration 1

Iteration 1 is the core product loop: **discovery cards → cognitive profile → agent challenges → profile updates → repeat**. This is the biggest single iteration — the Developer should implement backend-first (endpoints + tables), then frontend pages.

The implementation plan and master spec agree on the scope. The master spec adds detail on option semantics (Part D, Stage 2) and API contracts (Part G.1).

### Chunk A: Database Migration (backend-first)
1. [ ] `POST /api/migrate` creates `cognitive_profiles` table with columns: `user_id UUID PK`, `dimensions JSONB DEFAULT '{}'`, `explore_exploit_ratio JSONB`, `synergy_score FLOAT DEFAULT 0.0`, `journey_stage VARCHAR DEFAULT 'discovery'`, `total_interactions INT DEFAULT 0`, `created_at TIMESTAMP`, `updated_at TIMESTAMP`
2. [ ] `POST /api/migrate` creates `card_interactions` table with columns: `id UUID PK`, `user_id UUID FK`, `session_id UUID`, `card_id VARCHAR`, `card_type VARCHAR`, `option_selected INT`, `option_path VARCHAR`, `time_spent_ms INT`, `prompt_lab_score INT`, `revision_count INT DEFAULT 0`, `cognitive_signal JSONB`, `completed_at TIMESTAMP`
3. [ ] Migration is idempotent (`CREATE TABLE IF NOT EXISTS`)
4. [ ] Existing tables and data are not affected by migration

### Chunk B: Cognitive Profile API
5. [ ] `POST /api/cognitive/init` — authenticated (JWT). Accepts 8 scenario responses. Creates a `cognitive_profiles` row with initial dimension scores computed from the option signals per the master spec option semantics: option 1 (`without_ai`) → +0.10 target dim; option 2 (`human_leads`) → +0.05 target +0.05 strategic; option 3 (`full_outsource`) → −0.10 target IF score > 0.6 else neutral; option 4 (`ai_heavy`) → +0.05 operational +0.05 technical. Returns the initialized profile with all 8 dimensions.
6. [ ] `GET /api/cognitive/profile` — authenticated. Returns the user's cognitive profile: `{dimensions: {creative: {score, confidence, samples, trend}, ...}, explore_exploit_ratio, synergy_score, journey_stage, total_interactions}`. Returns 404 if profile not yet initialized.
7. [ ] `POST /api/cognitive/init` returns 409 if profile already exists for user (prevents overwrite).
8. [ ] All 8 dimension keys match the master spec: `creative`, `strategic`, `analytical`, `operational`, `communication`, `detail`, `empathetic`, `technical`.
9. [ ] Each dimension object has: `{score: 0.0-1.0, confidence: 0.0-1.0, samples: int, trend: "stable"}`.

### Chunk C: Journey API (Agent + Card Generation)
10. [ ] `POST /api/journey/next` — authenticated. Returns `{session_id, agent_prompt_id, challenge_title, cards: [...]}`. The simplest agent: targets the dimension with the lowest score, generates a 3-card set (1 concept + 1 question + 1 summary). Returns appropriate default if no profile exists yet.
11. [ ] `POST /api/journey/outcomes` — authenticated. Accepts `{agent_prompt_id, interactions: [{card_id, card_type, option_selected, option_path, time_spent_ms, ...}]}`. Updates `cognitive_profiles.dimensions` based on interaction signals. Returns `{profile: {...updated}, reflection: {owned: [], ai_helped: [], law3_flags: [], message: "..."}}`.
12. [ ] `POST /api/journey/outcomes` inserts rows into `card_interactions` table for each interaction.
13. [ ] After outcome submission, a subsequent `POST /api/journey/next` may target a different (new weakest) dimension.
14. [ ] Outcome submission is idempotent per `agent_prompt_id` (returns 409 on duplicate).
15. [ ] Card content comes from hardcoded template banks per dimension (ported from `journeyEngine.js` scenario data). No LLM generation in Iteration 1.

### Chunk D: Frontend — Discovery Scenarios Page
16. [ ] `src/pages/Discovery.jsx` exists and renders 8 behavioral scenario cards (one per cognitive dimension).
17. [ ] Each scenario card presents a work scenario with 4 options matching the master spec option semantics: (1) do it yourself, (2) you lead + AI assists, (3) AI end-to-end, (4) AI heavy lifting + you review.
18. [ ] Scenario content is ported from `journeyEngine.js` dimension banks (role priors, scenario contexts already exist).
19. [ ] Progress indicator shows "Card N of 8" during discovery.
20. [ ] After completing all 8 cards, calls `POST /api/cognitive/init` with the 8 responses.
21. [ ] On success, displays CognitiveRadar component with the initialized profile (animated reveal).
22. [ ] "Start Learning" button navigates to `/learn`.
23. [ ] Route `/discover` added to `App.jsx` with `RequireAuth` guard.
24. [ ] Old `/onboarding` route still works (backward compatibility — do NOT remove).

### Chunk E: Frontend — Challenge Player (Learn Page)
25. [ ] `src/pages/Learn.jsx` exists and calls `POST /api/journey/next` on mount.
26. [ ] Renders the 3-card set in sequence: concept → question → summary.
27. [ ] Tracks time spent on each card (start timer on card render, stop on next/submit).
28. [ ] On completing all cards, calls `POST /api/journey/outcomes` with interaction data.
29. [ ] Displays updated CognitiveRadar in sidebar/header after outcome submission.
30. [ ] Shows reflection message from the outcomes response (owned strengths, AI-helped areas).
31. [ ] "Next Challenge" button calls `POST /api/journey/next` again to continue the loop.
32. [ ] Route `/learn` added to `App.jsx` with `RequireAuth` guard.

### Chunk F: Frontend Integration
33. [ ] `src/api.js` has new functions: `cognitiveInit(responses)`, `cognitiveProfile()`, `journeyNext()`, `journeyOutcomes(agentPromptId, interactions)`.
34. [ ] `UserContext.jsx` updated: `cognitiveProfile` state loaded from server (not just localStorage). localStorage used as cache only.
35. [ ] Error handling: 401 redirects to `/login`; API failures show toast messages (no silent `.catch(() => {})`).
36. [ ] Loading states: skeletons or spinners shown while API calls are in flight.

### Chunk G: Tests
37. [ ] New pytest tests for `/api/cognitive/init`, `/api/cognitive/profile`, `/api/journey/next`, `/api/journey/outcomes` (target: 15+ new tests).
38. [ ] E2E test covers the full Iteration 1 loop: signup → discovery (8 cards) → radar reveal → first challenge (3 cards) → outcomes → profile update → second challenge.
39. [ ] Existing Iteration 0 tests (28 pytest, 6 vitest, 10 E2E) still pass — no regressions.

### Law Compliance (P0 — mandatory)
40. [ ] **Law 1 check**: Given a user with `creative` score 0.85, when the agent generates a challenge, no card suggests delegating creative work to AI.
41. [ ] **Law 3 check**: In `POST /api/journey/outcomes`, if user selects `full_outsource` (option 3) on a dimension where their score > 0.6, the `law3_flags` array in the reflection response includes that dimension.
42. [ ] **Law 2 check**: Challenges target the user's weakest dimension, guiding AI use where abilities are lower.

## Bugs to Fix
- **From Tester (Iteration 0):** `__pycache__` directories in git — verify `.gitignore` fix was merged, clean up if not.
- **From Tester (Iteration 0):** Playwright env limitation — not a code bug, tests ready for CI.

## Iteration Status
- Iteration 0: **COMPLETE** (merged 2026-06-12, commit `6153092`)
- Iteration 1: **in-progress** — acceptance criteria written above
- Do NOT advance to Iteration 2 until all 42 criteria are met and deployed

## Priority Order for Developer
1. **Chunk A** — DB migration (tables must exist before anything else)
2. **Chunk B** — Cognitive profile API (backend endpoints)
3. **Chunk C** — Journey API (agent logic + card generation)
4. **Chunk D** — Discovery page frontend
5. **Chunk E** — Learn page frontend
6. **Chunk F** — Integration (UserContext, api.js, error handling)
7. **Chunk G** — Tests
8. **Law compliance** — verify throughout, formal check at end

## Key Implementation Notes
- **Dimension keys**: Use `creative`, `strategic`, `analytical`, `operational`, `communication`, `detail`, `empathetic`, `technical` (matching master spec). Note: `journeyEngine.js` uses `detail_accuracy` and `technical_fluency` — **normalize to master spec keys**.
- **Option semantics**: The master spec (Part D, Stage 2) defines exact score adjustments per option. Follow these precisely.
- **Card generation**: Iteration 1 is deliberately dumb — always exploits (targets weakest dim), no explore/exploit, no LLM generation. Template banks hardcoded per dimension.
- **Backward compatibility**: Old `/onboarding` route MUST still work. Do not remove any existing pages.
- **`journeyEngine.js`** (636 lines) has rich scenario data to port — role priors, dimension configs, explore/exploit policy. Use it as a source, but the server-side implementation is new Python code.
- **Migration pattern**: Follow existing pattern in `infra/migrate/handler.py` — append new `CREATE TABLE IF NOT EXISTS` statements to the SCHEMA string.
