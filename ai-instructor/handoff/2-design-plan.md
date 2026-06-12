# Design Plan — 2026-06-12

## Based on PO Review: 2026-06-12
## Summary
Build the Agent Intelligence layer: explore/exploit policy with dynamic ratio, 3A depth selection (anchor/adapt/author), full outcome ingestion per card type, complete Law 3 enforcement chain, anti-pigeon-holing safeguards, two new database tables (`agent_prompts`, `reward_function_state`), and three new API endpoints. This transforms the agent from "always target weakest with 3 identical cards" into a real adaptive learning system.

---

## Backend Changes

### Database Changes

Append to `infra/lambda/migrate/handler.py` SCHEMA string (after existing `cognitive_profiles` and `card_interactions` blocks):

```sql
-- ═══════════════════════════════════════════
-- Agent Intelligence: reward function state + agent prompts
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS reward_function_state (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  version INT DEFAULT 1,
  weights JSONB NOT NULL DEFAULT '{}',
  confidence_vector JSONB NOT NULL DEFAULT '{}',
  total_interactions INT DEFAULT 0,
  last_exploration TIMESTAMPTZ,
  exploration_queue JSONB DEFAULT '[]',
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID,
  mode VARCHAR NOT NULL DEFAULT 'exploit',
  target_dimensions JSONB DEFAULT '{}',
  preserve_dimensions JSONB DEFAULT '{}',
  depth VARCHAR DEFAULT 'adapt',
  epoch_skill VARCHAR,
  scenario_context JSONB DEFAULT '{}',
  cards_requested JSONB DEFAULT '[]',
  with_ai_paths BOOLEAN DEFAULT TRUE,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  outcome_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_agent_prompts_user ON agent_prompts(user_id, generated_at);
CREATE INDEX IF NOT EXISTS idx_reward_state_user ON reward_function_state(user_id);
```

### API Endpoints

| Method | Path | Purpose | Request Body | Response |
|--------|------|---------|-------------|----------|
| `GET` | `/api/cognitive/summary` | Readable strengths/weaknesses/uncertain summary | — | `{strengths: [...], weaknesses: [...], uncertain: [...]}` |
| `GET` | `/api/journey/stage` | Current journey stage + mastery eligibility | — | `{stage, mastery_eligible, avg_confidence, avg_score}` |
| `POST` | `/api/journey/discovery` | Alternative discovery submission (creates profile) | `{responses: [{dimension, option_selected, option_path}]}` | `{profile: {...}}` |

**Modified existing endpoints:**

| Method | Path | What Changes |
|--------|------|-------------|
| `POST` | `/api/journey/next` | Now uses explore/exploit policy, creates `agent_prompts` row, returns `mode` and `depth` fields |
| `POST` | `/api/journey/outcomes` | Full E.4 per-card-type ingestion, Law 3 score -0.02 + forced preserve target, updates `reward_function_state` |

### New Files

#### `infra/lambda/cognitive/policy.py` — Explore/Exploit + Depth Selection + Anti-Pigeon-Holing
The core agent intelligence module. This is where the IRL math lives.

Key functions:

- **`compute_explore_ratio(dimensions)`** (per E.2)
  - Count dimensions where `confidence < 0.5 OR samples < 5` → `low_conf_count`
  - `explore_ratio = clamp(low_conf_count / 8, 0.2, 0.5)`
  - Returns `{explore_ratio, exploit_ratio, low_confidence_dims: [...], high_confidence_dims: [...]}`

- **`decide_mode(dimensions, reward_state)`** (per E.2)
  - Compute explore_ratio
  - Dynamic shift: if `total_interactions < 10` → bias toward explore (add +0.15 to ratio); if `total_interactions > 50` → bias toward exploit (subtract 0.10)
  - Check forced re-exploration: if `reward_state.total_interactions > 0` and `reward_state.total_interactions % 25 == 0` → force explore (per E.6)
  - Deterministic for testability: if `explore_ratio > 0.5` → explore; else → exploit (NOT random in Iteration 1 — make it deterministic for tests)
  - Returns `{mode: "explore"|"exploit", explore_ratio, reasoning: "..."}`

- **`select_target_dimension(mode, dimensions, reward_state)`** (per E.2 + E.6)
  - If explore: pick the dimension with lowest confidence from `reward_state.exploration_queue` (or lowest confidence from `dimensions` if queue empty)
  - If exploit: pick the dimension with lowest score among dims with `confidence >= 0.4` (fall back to all if none qualify)
  - Law 3 preserve check: if `reward_state` has a pending preserve dimension, override to target that dimension instead (per E.5 step 2)
  - Returns `{target, preserve: [...], reasoning: "..."}`

- **`select_depth(target_dim_key, dimensions)`** (per E.3)
  - `score < 0.3 → "anchor"`, `score < 0.6 → "adapt"`, `score >= 0.6 → "author"`
  - Returns `"anchor" | "adapt" | "author"`

- **`compute_preserve_dimensions(dimensions)`** (per Law 1)
  - All dims with `score > 0.7` are preserve dimensions
  - Returns `{dim_key: "strong", ...}`

- **`apply_confidence_ceiling(dimensions)`** (per E.6)
  - Clamp all `confidence` values to max 0.95
  - Returns updated dimensions

- **`update_exploration_queue(dimensions, reward_state)`** (per E.6)
  - Rebuild queue: sort dims by `(confidence ASC, samples ASC)`
  - If any dim has `trend == "declining"` and `score > 0.6`, move to front of queue (Law 1 watch per E.6)
  - Returns `["dim_key", ...]` ordered list

- **`compute_trend(dim_key, card_interactions)`** (per E.4)
  - If < 10 total samples for this dim → `"stable"`
  - Compare mean score of last 5 interactions to mean of prior 5
  - If delta > +0.05 → `"improving"`, if delta < -0.05 → `"declining"`, else `"stable"`
  - Returns `"improving" | "stable" | "declining"`

#### `infra/lambda/cognitive/ingestion.py` — Full Outcome Ingestion Rules (per E.4)

Key functions:

- **`ingest_scenario_outcome(dim, interaction)`**
  - Option 1 (`without_ai`): `score += 0.03`, `confidence += 0.08`, `samples += 1`
  - Option 2 (`human_leads`): `score += 0.02`, `confidence += 0.08`, `samples += 1`
  - Option 3 (`full_outsource`): if `score > 0.6` → Law 3 (see below); else `score += 0.01` (neutral-to-small positive on technical), `confidence += 0.08`, `samples += 1`
  - Option 4 (`ai_heavy`): `operational.score += 0.02`, `technical.score += 0.02`, `confidence += 0.08`, `samples += 1`
  - Returns `(updated_dim, law3_violation: bool)`

- **`ingest_question_outcome(dim, correct)`**
  - Correct: `score += 0.02`, `confidence += 0.05`, `samples += 1`
  - Incorrect: `score -= 0.01`, `confidence += 0.05`, `samples += 1`
  - Returns `updated_dim`

- **`ingest_prompt_lab_outcome(dim, score_0_100, current_samples)`**
  - `alpha = min(0.3, 1.0 / (current_samples + 1))`
  - `score = score * (1 - alpha) + (score_0_100 / 100) * alpha`
  - `confidence += 0.06`, `samples += 1`
  - Returns `updated_dim`

- **`ingest_practice_outcome(dim, score_0_100, current_samples)`**
  - Same formula as prompt_lab per E.4
  - Returns `updated_dim`

- **`ingest_concept_outcome(dim)`**
  - `confidence += 0.03`, no score change (reading only)
  - Returns `updated_dim`

- **`ingest_summary_outcome(dim)`**
  - `confidence += 0.02`, no score change (reflection only)
  - Returns `updated_dim`

- **`apply_law3(dim_key, dim, interaction)`** (per E.5)
  - Trigger: `option_path == "full_outsource"` AND `dim.score > 0.6`
  - Action 1: `dim.score -= 0.02` (reward signal drop per E.5)
  - Action 2: Set `law3_violation = True` in `cognitive_signal`
  - Action 3: Return `preserve_target = dim_key` (caller uses this to force next challenge)
  - Returns `(updated_dim, law3_violation, preserve_target: str|null)`

### Modified Files

#### `infra/lambda/cognitive/agent.py` — Major refactor
**Replace** the current simple functions with calls to the new modules:

- `find_weakest_dimension()` → **deprecated**. Replaced by `select_target_dimension()` from `policy.py`.
- `generate_card_set(target_dimension)` → **enhanced** to accept `depth` parameter:
  - `depth="anchor"` → concept + question + summary cards with introductory content
  - `depth="adapt"` → concept + question + summary cards with practice-oriented content (current templates)
  - `depth="author"` → concept + question + summary cards with advanced/create-oriented content
  - Card templates need depth variants added to `card_banks.py`
  - Returns same structure PLUS `mode`, `depth`, `target_dimensions`, `preserve_dimensions` fields
- `update_dimensions_from_outcomes()` → **replaced** by calling functions from `ingestion.py`:
  - Route to the correct ingest function based on `card_type`
  - Collect Law 3 violations and preserve targets
  - Apply confidence ceiling from `policy.py`
  - Returns `(updated_dims, law3_flags, preserve_targets)`
- `build_reflection()` → **enhanced** with explicit preserve messages per E.5:
  - If `preserve_targets` non-empty, include: `"You're great at {dim_label} — don't outsource your superpower"` for each

#### `infra/lambda/cognitive/card_banks.py` — Add depth variants
Add `CONCEPT_TEMPLATES_ANCHOR`, `CONCEPT_TEMPLATES_AUTHOR`, and similarly for questions and summaries. Each dimension gets 3 depth levels of content:

- **Anchor**: "Here's what {dim} means..." — introduces concepts, explains why it matters
- **Adapt**: (current templates) — guided practice, "How would you apply this?"
- **Author**: "Create something using your {dim} strength..." — open-ended, synthesis level

Add a helper function:
```python
def get_concept_template(dim_key, depth="adapt"):
    """Return concept template for the given dimension and depth level."""
```

#### `infra/lambda/journey/handler.py` — Major refactor

**`_handle_next()`** refactored:
1. Fetch `cognitive_profiles.dimensions` for user
2. Fetch or create `reward_function_state` row for user (initial weights = current dimension scores)
3. Call `decide_mode(dimensions, reward_state)` → get mode
4. Call `select_target_dimension(mode, dimensions, reward_state)` → get target + preserve dims
5. Call `select_depth(target, dimensions)` → get depth
6. Call `compute_preserve_dimensions(dimensions)` → get preserve map
7. Generate card set with `depth` parameter
8. **Insert `agent_prompts` row** with full decision context: `mode`, `target_dimensions`, `preserve_dimensions`, `depth`, `cards_requested`, `scenario_context`
9. Return response including `mode`, `depth`, `agent_prompt_id` (from the new row's UUID)

**`_handle_outcomes()`** refactored:
1. Check idempotency (unchanged)
2. Fetch current profile dimensions
3. Route each interaction to the correct `ingest_*` function from `ingestion.py`
4. Collect Law 3 violations and `preserve_targets`
5. Apply `apply_confidence_ceiling()` from `policy.py`
6. Compute trends (simple: if enough samples, compute delta; else stable)
7. Insert `card_interactions` rows with `cognitive_signal` including `law3_violation: true` when applicable
8. Update `cognitive_profiles` dimensions + total_interactions
9. **Update `reward_function_state`**: sync weights to current scores, update exploration queue, set `preserve_target` if Law 3 triggered
10. Build enhanced reflection with Law 3 preserve messages
11. Return `{profile, reflection}`

#### `infra/lambda/cognitive/handler.py` — Add 2 new endpoints

- `GET /api/cognitive/summary`:
  1. Fetch `cognitive_profiles.dimensions` for user
  2. Sort dims by score descending
  3. `strengths` = top 3 dims with score > 0.6
  4. `weaknesses` = bottom 2 dims with score < 0.4
  5. `uncertain` = dims with confidence < 0.5
  6. Return `{strengths: [{key, label, score}], weaknesses: [...], uncertain: [...]}`

- `POST /api/journey/discovery`:
  1. Same as `POST /api/cognitive/init` but also creates `reward_function_state` row
  2. Accepts `{responses: [...]}` with 8 discovery responses
  3. Creates `cognitive_profiles` row (409 if exists)
  4. Creates `reward_function_state` row with initial weights = dimension scores, empty exploration queue
  5. Returns `{profile: {...}, reward_state: {...}}`

#### `server-python/main.py` — Add 3 new routes

```python
# ── Cognitive summary route ────────────────────────
@app.get("/api/cognitive/summary")
async def cognitive_summary(request: Request):
    return _to_response(cognitive_handler(_make_event(request), None))

# ── Journey discovery + stage routes ───────────────
@app.post("/api/journey/discovery")
async def journey_discovery(request: Request):
    body = await request.json()
    return _to_response(journey_handler(_make_event(request, body), None))

@app.get("/api/journey/stage")
async def journey_stage(request: Request):
    return _to_response(journey_handler(_make_event(request), None))
```

#### `server-python/tests/conftest.py` — Update mock_query fixture
Add patching for the new handler modules:
```python
import cognitive.handler as cog_mod
import journey.handler as jour_mod
# Add to mock_query fixture:
cog_mod.query = mock
jour_mod.query = mock
```

---

## Frontend Changes

### No frontend changes in this chunk
This chunk is entirely backend agent intelligence. The frontend (Discovery.jsx, Learn.jsx, JourneyDashboard.jsx) already consumes the journey API. The enhanced `/api/journey/next` response includes `mode` and `depth` fields, which the frontend can display in future chunks.

The only frontend-visible change: the `/api/journey/next` response now includes `mode` ("explore"|"exploit") and `depth` ("anchor"|"adapt"|"author") fields. Learn.jsx should display these as badges on the challenge view, but this is optional for this chunk — the API will work regardless.

---

## Implementation Order

### Phase 1: Database (AC 1–3)
1. Append `reward_function_state` and `agent_prompts` DDL to `infra/lambda/migrate/handler.py`
2. Test migration is idempotent (run against test schema)

### Phase 2: Agent Intelligence Core (AC 4–12, 17–23)
3. Create `infra/lambda/cognitive/policy.py`:
   - `compute_explore_ratio()`
   - `decide_mode()`
   - `select_target_dimension()`
   - `select_depth()`
   - `compute_preserve_dimensions()`
   - `apply_confidence_ceiling()`
   - `update_exploration_queue()`
4. Create `infra/lambda/cognitive/ingestion.py`:
   - `ingest_scenario_outcome()`
   - `ingest_question_outcome()`
   - `ingest_prompt_lab_outcome()`
   - `ingest_practice_outcome()`
   - `ingest_concept_outcome()`
   - `ingest_summary_outcome()`
   - `apply_law3()`
5. Update `infra/lambda/cognitive/card_banks.py`:
   - Add depth variants (anchor, adapt, author) for concept/question/summary templates
   - Add `get_concept_template()`, `get_question_template()`, `get_summary_template()` helper functions

### Phase 3: Refactor Existing Agent (AC 4–5, 10–12, 17–20)
6. Refactor `infra/lambda/cognitive/agent.py`:
   - Replace `find_weakest_dimension()` calls with `select_target_dimension()`
   - Enhance `generate_card_set()` to accept and use `depth` parameter
   - Replace `update_dimensions_from_outcomes()` with calls to `ingestion.py` functions
   - Enhance `build_reflection()` with Law 3 preserve messages
7. Refactor `infra/lambda/journey/handler.py`:
   - `_handle_next()`: add explore/exploit decision, agent_prompts row creation, depth selection
   - `_handle_outcomes()`: route to per-type ingestion, apply Law 3 fully, update reward_function_state

### Phase 4: New Endpoints (AC 24–26)
8. Add `GET /api/cognitive/summary` to `infra/lambda/cognitive/handler.py`
9. Add `POST /api/journey/discovery` and `GET /api/journey/stage` to `infra/lambda/journey/handler.py`
10. Add 3 new routes to `server-python/main.py`
11. Update `server-python/tests/conftest.py` mock fixtures

### Phase 5: Tests (AC 29–37)
12. Create `server-python/tests/test_agent_policy.py` — explore/exploit + depth tests:
    - `test_explore_ratio_low_confidence` — 5/8 dims below 0.5 confidence → ratio = 0.5
    - `test_explore_ratio_all_confident` — all dims confident → ratio = 0.2
    - `test_explore_mode_targets_lowest_confidence` — explore picks dim with lowest confidence
    - `test_exploit_mode_targets_weakest_score` — exploit picks dim with lowest score
    - `test_depth_anchor` — dim score 0.2 → "anchor"
    - `test_depth_adapt` — dim score 0.45 → "adapt"
    - `test_depth_author` — dim score 0.7 → "author"
    - `test_early_journey_biased_explore` — total_interactions < 10 → higher explore ratio
13. Create `server-python/tests/test_ingestion.py` — outcome rule tests:
    - `test_scenario_option1_score_update` — without_ai → +0.03, confidence +0.08
    - `test_scenario_option2_score_update` — human_leads → +0.02, confidence +0.08
    - `test_question_correct` — +0.02 score, +0.05 confidence
    - `test_question_incorrect` — -0.01 score, +0.05 confidence
    - `test_prompt_lab_weighted_average` — verify α formula
    - `test_concept_reading` — confidence +0.03 only
    - `test_summary_reflection` — confidence +0.02 only
14. Update `server-python/tests/test_journey.py` — new tests for enhanced endpoints:
    - `test_next_returns_mode_field` — response includes `mode: "explore"|"exploit"`
    - `test_next_returns_depth_field` — response includes `depth: "anchor"|"adapt"|"author"`
    - `test_next_creates_agent_prompt_row` — agent_prompts table gets a row
    - `test_outcomes_law3_score_drop` — full_outsource on strong dim → score decreases by 0.02
    - `test_outcomes_law3_forces_next_target` — subsequent next targets the violated dimension
    - `test_outcomes_law3_preserve_message` — reflection includes "don't outsource your superpower"
15. Create `server-python/tests/test_new_endpoints.py`:
    - `test_cognitive_summary` — returns strengths/weaknesses/uncertain
    - `test_journey_stage` — returns stage + mastery eligibility
    - `test_journey_discovery` — creates profile + reward state
    - `test_journey_discovery_duplicate` — 409 if profile exists
16. Add anti-pigeon-holing tests:
    - `test_confidence_ceiling_095` — confidence never exceeds 0.95
    - `test_forced_re_exploration_at_25` — 25th interaction forces explore mode
17. Run full suite: `python -m pytest tests/ -v` — target 70+ tests, all pass, no regressions

---

## Testing Notes for Tester

### Explore/Exploit Verification (AC 4–9, per I.2 journey #4)
- **Low-confidence explore:** Seed a profile with `empathetic.confidence = 0.2` and 8 other dims at confidence 0.8. Call `/api/journey/next`. Verify response `mode == "explore"` and targets `empathetic`.
- **High-confidence exploit:** Seed all dims with confidence > 0.5, `operational.score = 0.2` (weakest). Call `/api/journey/next`. Verify `mode == "exploit"` and targets `operational`.
- **Dynamic shift:** Seed profile with `total_interactions = 5` (< 10). Verify explore ratio is higher than at `total_interactions = 60`.

### Depth Selection Verification (AC 10–12, per I.2 journey #5)
- Create profile with `analytical.score = 0.2`. Call `/api/journey/next`. Verify `depth == "anchor"`.
- Create profile with `analytical.score = 0.45`. Verify `depth == "adapt"`.
- Create profile with `analytical.score = 0.7`. Verify `depth == "author"`.

### Law 3 Full Enforcement Verification (AC 17–20, per I.2 journey #3)
- Seed `creative.score = 0.85`. Submit outcome with `option_path = "full_outsource"` for creative.
  - AC 17: Verify `creative.score` decreased by 0.02 (0.85 → 0.83)
  - AC 18: Call `/api/journey/next` again. Verify it targets `creative` (preserve mode)
  - AC 19: Verify reflection contains `"don't outsource your superpower"` or similar preserve message
  - AC 20: Verify `card_interactions.cognitive_signal` includes `law3_violation: true`

### Anti-Pigeon-Holing Verification (AC 21–23)
- AC 21: Submit 100 interactions all boosting `analytical.confidence`. Verify it caps at 0.95.
- AC 22: Submit 25 interactions. On the 26th, verify `mode == "explore"` (forced re-exploration).
- AC 23: Create declining trend on a strong dimension. Verify it appears in exploration queue.

### Outcome Ingestion Precision (AC 13–16, 33)
- Scenario option 1: verify score += 0.03, confidence += 0.08
- Scenario option 2: verify score += 0.02, confidence += 0.08
- Question correct: verify score += 0.02, confidence += 0.05
- Question incorrect: verify score -= 0.01, confidence += 0.05
- All scores clamped to [0.0, 1.0]

### New Endpoints (AC 24–26)
- `GET /api/cognitive/summary` → returns `{strengths: [{key, label, score}], weaknesses: [...], uncertain: [...]}`
- `GET /api/journey/stage` → returns `{stage: "discovery"|"growth"|"mastery", mastery_eligible: bool, avg_confidence: float, avg_score: float}`
- `POST /api/journey/discovery` → same as cognitive/init but also creates reward_function_state

### Regression (AC 34)
- All 44 existing pytest tests must still pass (agent.py changes are backward-compatible — existing tests use the old function signatures which are preserved)
- All 10 vitest tests pass (no frontend changes)
- All 15 E2E steps pass (existing endpoints unchanged)

### Edge Cases
- User with no `reward_function_state` row calls `/api/journey/next` → auto-creates one
- All 8 dimensions at identical scores → `select_target_dimension` picks lowest confidence, then alphabetical
- `total_interactions = 0` → always explore mode (can't exploit with no data)
- Trend computation with < 10 samples → always "stable"
- `agent_prompts` row created even if no outcomes submitted (challenge generated but abandoned)

### Key Files to Review
- `infra/lambda/cognitive/policy.py` — all explore/exploit + depth logic
- `infra/lambda/cognitive/ingestion.py` — all per-type outcome rules
- `infra/lambda/cognitive/agent.py` — refactored to use policy + ingestion
- `infra/lambda/journey/handler.py` — enhanced with reward state + agent prompts
- `server-python/tests/test_agent_policy.py` — explore/exploit + depth tests
- `server-python/tests/test_ingestion.py` — outcome rule precision tests
