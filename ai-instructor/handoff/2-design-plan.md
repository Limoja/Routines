# Design Plan — 2026-06-12

## Target Iteration: 1 — The Thinnest Loop
## Based on PO Review: 2026-06-12

## Summary
Build the core product loop: 8 behavioral Discovery Scenario cards → server-side cognitive profile → dumb-agent challenges (3-card sets targeting weakest dimension) → profile updates from outcomes → loop repeats. Backend-first: new DB tables, 4 new API endpoints, then Discovery.jsx and Learn.jsx frontend pages.

---

## Backend Changes

### Database Changes

Append to `infra/lambda/migrate/handler.py` SCHEMA string (before the trigger function):

```sql
-- ═══════════════════════════════════════════
-- Iteration 1: Cognitive profiles + card interactions
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cognitive_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  dimensions JSONB NOT NULL DEFAULT '{}',
  explore_exploit_ratio JSONB DEFAULT '{"explore": 0.5, "exploit": 0.5}',
  synergy_score FLOAT DEFAULT 0.0,
  journey_stage VARCHAR NOT NULL DEFAULT 'discovery',
  total_interactions INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS card_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID,
  agent_prompt_id VARCHAR,
  card_id VARCHAR NOT NULL,
  card_type VARCHAR NOT NULL,
  option_selected INT,
  option_path VARCHAR,
  time_spent_ms INT,
  prompt_lab_score INT,
  revision_count INT DEFAULT 0,
  cognitive_signal JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_interactions_user_time
  ON card_interactions(user_id, completed_at);
```

**Key design decisions:**
- `agent_prompt_id` is `VARCHAR` not `UUID FK` — Iteration 1 has no `agent_prompts` table yet (comes Iteration 3). The journey/next endpoint generates a UUID string and stores it as a correlation key.
- `dimensions` is JSONB keyed by master spec dimension keys: `creative`, `strategic`, `analytical`, `operational`, `communication`, `detail`, `empathetic`, `technical`.
- Each dimension value is `{score: 0.0-1.0, confidence: 0.0-1.0, samples: int, trend: "stable"}`.
- `CREATE TABLE IF NOT EXISTS` ensures idempotent migration (AC 3).

### API Endpoints

| Method | Path | Purpose | Request Body | Response |
|--------|------|---------|-------------|----------|
| `POST` | `/api/cognitive/init` | Create cognitive profile from 8 discovery responses | `{responses: [{dimension, option_selected, option_path}]}` (8 items) | `{profile: {dimensions, journey_stage, ...}}` |
| `GET` | `/api/cognitive/profile` | Get user's cognitive profile | — | `{dimensions: {...}, journey_stage, total_interactions, ...}` |
| `POST` | `/api/journey/next` | Get next 3-card challenge set | `{}` (optionally `{dimension: "..."}` to force) | `{session_id, agent_prompt_id, challenge_title, cards: [...]}` |
| `POST` | `/api/journey/outcomes` | Submit card outcomes, update profile | `{agent_prompt_id, interactions: [{card_id, card_type, option_selected, option_path, time_spent_ms}]}` | `{profile: {...}, reflection: {owned: [], ai_helped: [], law3_flags: [], message: "..."}}` |

**Error semantics:**
- `401` — missing/invalid JWT (all 4 endpoints)
- `409` — `/api/cognitive/init` when profile already exists; `/api/journey/outcomes` duplicate `agent_prompt_id`
- `404` — `/api/cognitive/profile` when no profile initialized yet

### New Files

#### `infra/lambda/cognitive/__init__.py` — empty package marker

#### `infra/lambda/cognitive/handler.py` — Cognitive profile CRUD
- `handler(event, context)` — routes to:
  - `POST /api/cognitive/init` — creates `cognitive_profiles` row from 8 discovery responses
  - `GET /api/cognitive/profile` — returns user's profile or 404

Key functions:
- `_compute_initial_dimensions(responses)` — applies option signal semantics per master spec Part D Stage 2:
  - Option 1 (`without_ai`): `+0.10` to target dimension
  - Option 2 (`human_leads`): `+0.05` to target + `+0.05` to `strategic`
  - Option 3 (`full_outsource`): `-0.10` to target IF current score > 0.6 (Law 3); else neutral (no change)
  - Option 4 (`ai_heavy`): `+0.05` to `operational` + `+0.05` to `technical`
  - All dimensions start at `{score: 0.5, confidence: 0.15, samples: 1, trend: "stable"}` before applying signals (per E.8 cold start)
  - Scores clamped to `[0.0, 1.0]`
  - Confidence bumps `+0.08` per sample (per E.4)
- `_empty_dimensions()` — returns all 8 dims with default values `{score: 0.5, confidence: 0.15, samples: 0, trend: "stable"}`

**Dimension keys used** (master spec canonical, NOT journeyEngine.js):
`creative`, `strategic`, `analytical`, `operational`, `communication`, `detail`, `empathetic`, `technical`

#### `infra/lambda/cognitive/agent.py` — Simple agent logic
- `DIMENSION_CONFIG` — dict mapping 8 dimension keys to `{label, icon, card_templates}`
- `find_weakest_dimension(dimensions)` — returns the key with lowest `score`
- `generate_card_set(target_dimension, dimension_config)` — returns 3 cards:
  1. `{id, type: "concept", title, body}` — teaches the dimension concept
  2. `{id, type: "question", title, body, options: [...], correct_answer}` — tests understanding
  3. `{id, type: "summary", title, body}` — reflects on what was learned
- `update_dimensions_from_outcomes(dimensions, interactions)` — applies E.4 rules:
  - Scenario option: `±0.02-0.03` per path mapping + `+0.08` confidence per sample
  - Question correct: `+0.02` score + `+0.05` confidence; incorrect: `-0.01` score + `+0.05` confidence
  - Law 3 check: if `option_path == "full_outsource"` AND target dim `score > 0.6`, flag it
- `build_reflection(dimensions_before, dimensions_after, law3_flags)` — returns `{owned: [...], ai_helped: [...], law3_flags: [...], message: "..."}`

#### `infra/lambda/cognitive/card_banks.py` — Hardcoded template data
Ported from `journeyEngine.js` `SCENARIO_TEMPLATES` (normalized keys):
- `DISCOVERY_SCENARIOS` — dict keyed by dimension, each with `{scenario_text, options: [4 items]}` for 8 discovery cards
- `CONCEPT_TEMPLATES` — dict keyed by dimension, each with `{title, body}` for concept cards
- `QUESTION_TEMPLATES` — dict keyed by dimension, each with `{question, options: [4 items], correct_index, explanation}`
- `SUMMARY_TEMPLATES` — dict keyed by dimension, each with `{title, body_template}`

**Key normalization** from journeyEngine.js keys:
- `detail_accuracy` → `detail`
- `technical_fluency` → `technical`

#### `infra/lambda/journey/__init__.py` — empty package marker

#### `infra/lambda/journey/handler.py` — Journey loop endpoints
- `handler(event, context)` — routes to:
  - `POST /api/journey/next` — returns next 3-card set
  - `POST /api/journey/outcomes` — submits outcomes, updates profile, returns reflection

Key functions:
- `_handle_next(user_id, event)` —
  1. Fetch `cognitive_profiles` row
  2. If no profile, return 404-like response suggesting `/discover` first
  3. Find weakest dimension via `agent.find_weakest_dimension()`
  4. Generate 3-card set via `agent.generate_card_set()`
  5. Generate `agent_prompt_id` (UUID string)
  6. Return `{session_id: uuid, agent_prompt_id, challenge_title, cards}`
- `_handle_outcomes(user_id, event)` —
  1. Check idempotency: look for existing `card_interactions` with this `agent_prompt_id`
  2. If duplicate, return 409
  3. Fetch current profile
  4. Insert `card_interactions` rows (one per interaction)
  5. Compute updated dimensions via `agent.update_dimensions_from_outcomes()`
  6. Build reflection via `agent.build_reflection()`
  7. Update `cognitive_profiles` row: `dimensions`, `total_interactions += N`, `updated_at = NOW()`
  8. Return `{profile: {...}, reflection: {...}}`

### Modified Files

#### `infra/lambda/migrate/handler.py` — append `cognitive_profiles` and `card_interactions` DDL to SCHEMA string

#### `server-python/main.py` — add 4 new route groups:
```python
# ── Cognitive routes ──────────────────────────────
from cognitive.handler import handler as cognitive_handler

@app.post("/api/cognitive/init")
async def cognitive_init(request: Request):
    body = await request.json()
    return _to_response(cognitive_handler(_make_event(request, body), None))

@app.get("/api/cognitive/profile")
async def cognitive_profile(request: Request):
    return _to_response(cognitive_handler(_make_event(request), None))


# ── Journey routes ─────────────────────────────────
from journey.handler import handler as journey_handler

@app.post("/api/journey/next")
async def journey_next(request: Request):
    body = await request.json()
    return _to_response(journey_handler(_make_event(request, body), None))

@app.post("/api/journey/outcomes")
async def journey_outcomes(request: Request):
    body = await request.json()
    return _to_response(journey_handler(_make_event(request, body), None))
```

---

## Frontend Changes

### New Components

#### `src/pages/Discovery.jsx` — 8 behavioral scenario cards
- **Props:** none (uses `useUser` context)
- **State:**
  - `currentIndex` (int, 0–7) — which card we're on
  - `responses` (array) — collected responses `[{dimension, option_selected, option_path}]`
  - `profile` (object|null) — initialized profile after submission
  - `loading` (bool) — API call in flight
  - `error` (string|null) — error message
- **Events:**
  - `handleOptionSelect(optionIndex)` — records response, advances to next card
  - `handleFinish()` — after card 8, calls `POST /api/cognitive/init`
  - `handleStartLearning()` — navigates to `/learn`
- **Behavior:**
  - Renders one scenario card at a time with 4 options
  - Progress indicator: "Card N of 8"
  - Each option has descriptive text matching master spec semantics:
    - Option 1: "Do it yourself — lean on your own expertise" (without_ai)
    - Option 2: "You lead, AI assists" (human_leads)
    - Option 3: "Let AI handle it end-to-end" (full_outsource)
    - Option 4: "AI does the heavy lifting, you review" (ai_heavy)
  - After card 8: submit → show CognitiveRadar with animated reveal → "Start Learning" button
  - Discovery scenario content is **hardcoded** on the frontend (8 scenarios, one per dimension). Ported from `journeyEngine.js` `SCENARIO_TEMPLATES` with normalized keys.

#### `src/pages/Discovery.css` — styling for Discovery page

#### `src/pages/Learn.jsx` — Challenge player (concept → question → summary)
- **Props:** none (uses `useUser` context)
- **State:**
  - `challenge` (object|null) — current card set from API
  - `currentCardIndex` (int, 0–2) — which card in set
  - `answers` (array) — collected answers per card
  - `timeStarted` (int) — timestamp when current card rendered
  - `reflection` (object|null) — outcome reflection data
  - `loading` (bool) — API call in flight
  - `error` (string|null) — error message
  - `showRadar` (bool) — whether to show sidebar radar
- **Events:**
  - `handleNextCard(answer)` — records answer + time_spent_ms, advances
  - `handleCompleteCards()` — after card 3, calls `POST /api/journey/outcomes`
  - `handleNextChallenge()` — calls `POST /api/journey/next` again
- **Behavior:**
  - On mount: calls `POST /api/journey/next`
  - Renders cards in sequence: concept (read) → question (interactive) → summary (read)
  - Tracks `time_spent_ms` per card (start timer on render, stop on advance)
  - After all 3 cards: submit outcomes → show reflection message + updated CognitiveRadar
  - "Next Challenge" button to continue the loop
  - If no profile exists (never did discovery), show prompt to go to `/discover`

#### `src/pages/Learn.css` — styling for Learn page

### Modified Components

#### `src/api.js` — add 4 new API functions
```javascript
// ── Cognitive Profile ─────────────────────────
export async function cognitiveInit(responses) {
  return request('/api/cognitive/init', {
    method: 'POST',
    body: JSON.stringify({ responses }),
  })
}

export async function cognitiveProfile() {
  return request('/api/cognitive/profile')
}

// ── Journey ────────────────────────────────────
export async function journeyNext() {
  return request('/api/journey/next', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function journeyOutcomes(agentPromptId, interactions) {
  return request('/api/journey/outcomes', {
    method: 'POST',
    body: JSON.stringify({
      agent_prompt_id: agentPromptId,
      interactions,
    }),
  })
}
```

#### `src/App.jsx` — add 2 new routes (DO NOT remove any existing routes)
```jsx
import Discovery from './pages/Discovery'
import Learn from './pages/Learn'

// Add to Routes block:
<Route path="/discover" element={<RequireAuth><Discovery /></RequireAuth>} />
<Route path="/learn" element={<RequireAuth><Learn /></RequireAuth>} />
```
Add `'/discover'` and `'/learn'` to `FULLSCREEN_PATHS` array.

#### `src/context/UserContext.jsx` — update cognitive profile loading
- Replace localStorage-only cognitive profile with server-first:
  - On login (after `getMe()`): call `api.cognitiveProfile()`. If 200, set `cognitiveProfile` state from server data. If 404, profile not yet initialized (new user).
  - Keep `saveCognitive()` / `loadCognitive()` as cache layer — write to localStorage after successful API responses, read as fallback.
  - Add `discoverProfile(responses)` function — calls `api.cognitiveInit(responses)`, sets `cognitiveProfile` state, caches to localStorage.
  - Add `getNextChallenge()` — calls `api.journeyNext()`, returns challenge data.
  - Add `submitOutcomes(agentPromptId, interactions)` — calls `api.journeyOutcomes()`, updates `cognitiveProfile` state from response.
- Error handling: API failures show error state (no silent `.catch(() => {})` per B.3 rule 1).

#### `src/components/CognitiveRadar.jsx` — update dimension key mapping
- `CHAPTER_DIMENSION_MAP` still maps old `technical_fluency` and `detail_accuracy` keys. These remain for backward compat with curriculum pages.
- The `getProfileSummary()` from `journeyEngine.js` already handles arbitrary dimension keys from the profile object. The server will use canonical keys (`detail`, `technical`).
- No changes needed to CognitiveRadar itself — it reads `cognitiveProfile.dimensions` which are now server-provided.

#### `src/data/journeyEngine.js` — NO changes. This file continues to work for existing curriculum features. The new endpoints are a parallel system.

---

## Implementation Order

### Phase 1: Backend — Database (Chunk A)
1. Append `cognitive_profiles` and `card_interactions` DDL to `infra/lambda/migrate/handler.py`
2. Call `POST /api/migrate` to create tables (or verify locally)
3. Verify existing tables unaffected (AC 4)

### Phase 2: Backend — Card Banks (data layer)
4. Create `infra/lambda/cognitive/__init__.py`
5. Create `infra/lambda/cognitive/card_banks.py` — port scenario data from `journeyEngine.js` with normalized keys
6. Create `infra/lambda/journey/__init__.py`

### Phase 3: Backend — Agent Logic (Chunk C)
7. Create `infra/lambda/cognitive/agent.py` — `find_weakest_dimension()`, `generate_card_set()`, `update_dimensions_from_outcomes()`, `build_reflection()`
8. Unit-test the agent math functions in isolation (deterministic, no DB)

### Phase 4: Backend — Cognitive API (Chunk B)
9. Create `infra/lambda/cognitive/handler.py` — `POST /api/cognitive/init`, `GET /api/cognitive/profile`
10. Add cognitive routes to `server-python/main.py`
11. Test `/api/cognitive/init` — 8 responses → profile created, 409 on re-init, 401 without auth

### Phase 5: Backend — Journey API (Chunk C)
12. Create `infra/lambda/journey/handler.py` — `POST /api/journey/next`, `POST /api/journey/outcomes`
13. Add journey routes to `server-python/main.py`
14. Test full backend loop: init → next → outcomes → next (targets new weakest)

### Phase 6: Backend Tests (Chunk G backend)
15. Create `server-python/tests/test_cognitive.py` — 8+ tests:
    - `test_init_profile_success` — 8 responses → profile with 8 dims
    - `test_init_profile_already_exists` → 409
    - `test_init_profile_unauthenticated` → 401
    - `test_get_profile_success` → returns profile
    - `test_get_profile_not_found` → 404
    - `test_init_dimensions_correct_keys` — all 8 keys present
    - `test_init_option_signals` — verify exact score adjustments per master spec
    - `test_init_law3_penalty` — option 3 on high score → penalty applied
16. Create `server-python/tests/test_journey.py` — 8+ tests:
    - `test_next_returns_3_cards` — basic
    - `test_next_targets_weakest` — verify targeting logic
    - `test_next_no_profile` → appropriate error/suggestion
    - `test_outcomes_updates_profile` — scores change after submission
    - `test_outcomes_inserts_interactions` — card_interactions rows created
    - `test_outcomes_idempotent` → 409 on duplicate agent_prompt_id
    - `test_outcomes_law3_flag` — full_outsource on strong dim → law3_flags
    - `test_loop_targets_new_weakest` — after outcomes, next targets different dim

### Phase 7: Frontend — API + Context (Chunk F)
17. Add 4 API functions to `src/api.js`
18. Update `src/context/UserContext.jsx` — server-first cognitive profile loading + new action functions

### Phase 8: Frontend — Discovery Page (Chunk D)
19. Create `src/pages/Discovery.jsx` — 8 scenario cards with 4 options each
20. Create `src/pages/Discovery.css`
21. Add `/discover` route to `src/App.jsx`

### Phase 9: Frontend — Learn Page (Chunk E)
22. Create `src/pages/Learn.jsx` — challenge player (concept → question → summary)
23. Create `src/pages/Learn.css`
24. Add `/learn` route to `src/App.jsx`

### Phase 10: Frontend Tests (Chunk G frontend)
25. Add `src/tests/test_discovery.test.jsx` — renders, card navigation, API calls
26. Add `src/tests/test_learn.test.jsx` — renders, card sequence, outcome submission

### Phase 11: E2E Test (Chunk G E2E)
27. Extend `scripts/e2e_test.sh` with Iteration 1 flow (after existing Iteration 0 steps):
    - Step 11: `POST /api/cognitive/init` with 8 responses → profile created
    - Step 12: `GET /api/cognitive/profile` → 8 dimensions returned
    - Step 13: `POST /api/journey/next` → 3 cards returned
    - Step 14: `POST /api/journey/outcomes` → profile updated + reflection
    - Step 15: `POST /api/journey/next` (2nd) → different target dimension

### Phase 12: Regression + Law Compliance (Chunks G + Law)
28. Run full test suite: `pytest` (28 existing + 16 new = 44+), `vitest` (6 existing + 2 new = 8+), `e2e_test.sh` (10 existing + 5 new = 15 steps)
29. Law 1 check: verify no concept card suggests delegating a strong dimension to AI
30. Law 3 check: verify `full_outsource` on high-score dim → `law3_flags` populated in reflection
31. Law 2 check: verify challenges target weakest dimension (automatic from agent logic)

---

## Testing Notes for Tester

### Backend Tests to Verify
- **`POST /api/cognitive/init`**: Send 8 responses with known option selections. Verify exact dimension scores match master spec option semantics (AC 5, 8, 9).
- **`POST /api/cognitive/init` 409**: Call twice for same user → second returns 409 (AC 7).
- **`GET /api/cognitive/profile` 404**: New user with no discovery → 404 (AC 6).
- **Dimension keys**: Response must use exactly `creative`, `strategic`, `analytical`, `operational`, `communication`, `detail`, `empathetic`, `technical` — NOT `detail_accuracy` or `technical_fluency` (AC 8).
- **`POST /api/journey/next`**: Returns `{session_id, agent_prompt_id, challenge_title, cards: [3 items]}`. Cards are `concept`, `question`, `summary` types. Targets weakest dimension (AC 10).
- **`POST /api/journey/outcomes`**: After submitting outcomes, profile scores update. `card_interactions` rows exist in DB. `law3_flags` populated when `full_outsource` selected on dim with score > 0.6 (AC 11, 12, 13, 14).
- **Idempotency**: Same `agent_prompt_id` submitted twice → 409 on second (AC 14).

### Frontend Tests to Verify
- `/discover` route renders with RequireAuth guard
- 8 scenario cards shown one at a time with "Card N of 8" progress
- Each card has 4 options with correct semantics text
- After card 8: CognitiveRadar appears with profile data
- "Start Learning" navigates to `/learn`
- `/learn` route renders challenge player
- 3 cards shown in sequence (concept → question → summary)
- After completing: reflection message + updated radar visible
- "Next Challenge" generates a new card set

### E2E Full Loop
- Signup → discovery (8 cards) → radar reveal → first challenge (3 cards) → outcomes → profile update → second challenge → targets different dimension
- Old routes still work: `/onboarding`, `/curriculum`, `/dashboard` (AC 24 — backward compat)

### Law Compliance (P0)
- **Law 1 (AC 40)**: Given `creative` score 0.85, no generated card text suggests delegating creative work to AI. Test by seeding a profile with high `creative`, calling `/api/journey/next`, inspecting all card content.
- **Law 3 (AC 41)**: Submit outcomes with `option_path: "full_outsource"` on a dimension where `score > 0.6`. Verify `reflection.law3_flags` includes that dimension.
- **Law 2 (AC 42)**: Challenge always targets the user's weakest dimension (automatic from `find_weakest_dimension` logic).

### Edge Cases
- User navigates to `/learn` before completing discovery → prompt to go to `/discover`
- User refreshes mid-discovery → progress lost (acceptable for Iteration 1; resumable discovery is Iteration 7)
- All 8 discovery responses select same option → profile still has 8 valid dimensions
- Outcomes submission with empty interactions array → 400
- Concurrent `/api/journey/next` calls → each returns independent session_id

### Existing Tests — Must Not Regress
- 28 pytest tests from Iteration 0 → all still pass
- 6 vitest route smoke tests → all still pass
- 10 E2E steps → all still pass
