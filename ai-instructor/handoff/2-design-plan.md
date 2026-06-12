# Design Plan — 2026-06-12T13:10

## Based on PO Review: 2026-06-12T12:48
## Summary
Fix the P0 production bug: `POST /api/journey/next` returns 500, breaking the core learning loop. The agent intelligence code is logically correct (88 tests green locally) but fails at runtime. Root cause analysis points to psycopg2 parameter handling for JSONB/UUID columns in the `agent_prompts` INSERT, and potentially a missing `preserve_target` column in `reward_function_state`. Also apply the same fixes to all DB write operations for consistency.

---

## Root Cause Analysis

### Evidence Trail

| Working endpoint | DB writes | Proves |
|---|---|---|
| `POST /api/cognitive/init` | INSERT `cognitive_profiles` (1 UUID + 1 JSONB) | psycopg2 handles UUID `user_id` and `json.dumps()` → JSONB ✅ |
| `POST /api/journey/discovery` | INSERT `cognitive_profiles` + INSERT `reward_function_state` (1 UUID + 2 JSONB + 1 literal `'[]'`) | Multi-JSONB INSERT works ✅ |
| `GET /api/cognitive/profile` | SELECT only | Read path works ✅ |
| `GET /api/cognitive/summary` | SELECT only | Read path works ✅ |
| `GET /api/journey/stage` | SELECT only | Read path works ✅ |

| Failing endpoint | DB writes | Unique stress |
|---|---|---|
| `POST /api/journey/next` | INSERT `agent_prompts` (3 UUID cols + 4 JSONB cols + 1 BOOLEAN) | **3 UUID params** — first endpoint with more than 1 UUID column |

### Most Likely Causes (ranked)

**#1 — psycopg2 JSONB string casting with `query()` helper (HIGH probability)**

The `agent_prompts` INSERT passes 4 JSONB values as `json.dumps()` Python strings via `%s` params. While `cognitive/init` and `journey/discovery` also pass JSONB strings, they only have 1–2 JSONB params. The `agent_prompts` INSERT has **4 JSONB params in a single statement**. psycopg2 sends all `%s` as string literals; PostgreSQL must implicitly cast all 4 to JSONB. A single casting failure crashes the whole statement.

**Fix**: Use explicit `::jsonb` casts in the SQL template for all JSONB parameters.

**#2 — Missing `preserve_target` column in production `reward_function_state` (MEDIUM probability)**

The migration DDL uses `CREATE TABLE IF NOT EXISTS`. If the table was created in an earlier migration run (before `preserve_target` was added to the DDL), the column would be missing. This wouldn't cause the `next` 500 directly (the `_handle_next` code uses `.get("preserve_target")` which returns None for missing keys), BUT `_update_reward_state()` — called from `_handle_outcomes()` — does `SET preserve_target = %s`, which would fail if the column doesn't exist. This must be fixed regardless.

**Fix**: Add `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` migration step.

**#3 — UUID string casting for `agent_prompt_id` and `session_id` (LOW-MEDIUM probability)**

The `agent_prompts` INSERT is the **only** place in the codebase where a Python-generated UUID string (from `str(uuid.uuid4())`) is passed to a UUID column. Other INSERTs only use `user_id` (from JWT, also a string, but proven working). The `id` column has `DEFAULT gen_random_uuid()` — passing an explicit string UUID via `%s` should auto-cast, but this is the first time the codebase does it.

**Fix**: Use explicit `::uuid` casts in the SQL template for UUID parameters.

---

## Backend Changes

### API Endpoints
No new endpoints. Fixing existing:
| Method | Path | Change |
|--------|------|--------|
| POST | `/api/journey/next` | Fix 500 → return 200 with valid challenge set |
| POST | `/api/journey/outcomes` | Fix potential 500 from missing column |

### Database Changes

Append to end of `SCHEMA` string in `infra/lambda/migrate/handler.py`:

```sql
-- Ensure preserve_target column exists (idempotent, safe for existing deployments)
ALTER TABLE reward_function_state
  ADD COLUMN IF NOT EXISTS preserve_target VARCHAR;
```

### Modified Files

#### 1. `infra/lambda/journey/handler.py` — Fix INSERT/UPDATE statements + add diagnostic logging

**Change A: Add step-by-step logging to `_handle_next()`**

Before every major step, add a `print()` statement so the error can be pinpointed in production logs:

```python
def _handle_next(user_id, event):
    body = parse_body(event) or {}
    force_dim = body.get("dimension")

    print(f"[journey/next] Step 1: Fetching cognitive profile for user {user_id}")
    rows = query(
        "SELECT dimensions FROM cognitive_profiles WHERE user_id = %s",
        [user_id],
    )
    if not rows:
        return {
            "statusCode": 404,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "No cognitive profile found. Complete discovery first at /discover."}),
        }

    dimensions = rows[0]["dimensions"]
    if isinstance(dimensions, str):
        dimensions = json.loads(dimensions)

    print(f"[journey/next] Step 2: Getting reward state")
    reward_state = _get_or_create_reward_state(user_id, dimensions)

    if force_dim:
        target = force_dim
        mode = "exploit"
        depth = select_depth(target, dimensions)
        preserve = compute_preserve_dimensions(dimensions)
        reasoning = f"Forced dimension: {target}"
    else:
        print(f"[journey/next] Step 3: Deciding mode (total_interactions={reward_state.get('total_interactions', 0)})")
        mode_decision = decide_mode(dimensions, reward_state)
        mode = mode_decision["mode"]

        print(f"[journey/next] Step 4: Selecting target dimension (mode={mode})")
        target_decision = select_target_dimension(mode, dimensions, reward_state)
        target = target_decision["target"]
        preserve_list = target_decision["preserve"]
        reasoning = target_decision["reasoning"]

        depth = select_depth(target, dimensions)
        preserve = compute_preserve_dimensions(dimensions)

    print(f"[journey/next] Step 5: Generating card set (target={target}, depth={depth})")
    card_set = generate_card_set(target, depth)

    print(f"[journey/next] Step 6: Inserting agent_prompts row (id={card_set['agent_prompt_id']})")
    agent_prompt_id = card_set["agent_prompt_id"]
    session_id = card_set["session_id"]
    query(
        """INSERT INTO agent_prompts
           (id, user_id, session_id, mode, target_dimensions, preserve_dimensions,
            depth, scenario_context, cards_requested, with_ai_paths)
           VALUES (%s::uuid, %s::uuid, %s::uuid, %s, %s::jsonb, %s::jsonb,
                   %s, %s::jsonb, %s::jsonb, %s)""",
        [
            agent_prompt_id,
            user_id,
            session_id,
            mode,
            json.dumps({target: dimensions[target]}),
            json.dumps(preserve),
            depth,
            json.dumps({"reasoning": reasoning}),
            json.dumps([c["id"] for c in card_set["cards"]]),
            True,
        ],
    )

    print(f"[journey/next] Step 7: Building response")
    card_set["mode"] = mode
    card_set["depth"] = depth
    card_set["target_dimensions"] = {target: dimensions[target]}
    card_set["preserve_dimensions"] = preserve

    return ok(card_set)
```

**Change B: Fix `_get_or_create_reward_state` INSERT with explicit casts**

Replace the INSERT (around line 74):
```python
query(
    """INSERT INTO reward_function_state (user_id, weights, confidence_vector, total_interactions, exploration_queue)
       VALUES (%s::uuid, %s::jsonb, %s::jsonb, 0, '[]'::jsonb)""",
    [user_id, json.dumps(weights), json.dumps(confidence_vector)],
)
```

**Change C: Fix `_update_reward_state` with explicit casts**

Replace the UPDATE (around line 285):
```python
query(
    """UPDATE reward_function_state
       SET weights = %s::jsonb, confidence_vector = %s::jsonb, total_interactions = %s,
           exploration_queue = %s::jsonb, preserve_target = %s, computed_at = NOW()
       WHERE user_id = %s::uuid""",
    [
        json.dumps(weights),
        json.dumps(confidence_vector),
        new_total,
        json.dumps(exploration_queue),
        preserve_target,
        user_id,
    ],
)
```

**Change D: Fix `_handle_outcomes` card_interactions INSERT with explicit casts**

Replace the INSERT (around line 224):
```python
query(
    """INSERT INTO card_interactions
       (user_id, session_id, agent_prompt_id, card_id, card_type,
        option_selected, option_path, time_spent_ms, cognitive_signal)
       VALUES (%s::uuid, %s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s::jsonb)""",
    [
        user_id,
        session_id,
        agent_prompt_id,
        interaction.get("card_id", ""),
        interaction.get("card_type", ""),
        interaction.get("option_selected"),
        interaction.get("option_path"),
        interaction.get("time_spent_ms"),
        json.dumps(cognitive_signal),
    ],
)
```

**Change E: Fix `_handle_discovery` cognitive_profiles INSERT with explicit casts**

Replace the INSERT (around line 373):
```python
query(
    """INSERT INTO cognitive_profiles (user_id, dimensions, journey_stage, total_interactions)
       VALUES (%s::uuid, %s::jsonb, 'discovery', 0)""",
    [user_id, json.dumps(dimensions)],
)
```

#### 2. `infra/lambda/migrate/handler.py` — Add ALTER TABLE for missing column

Append to the end of the `SCHEMA` string (before the closing `"""`):

```sql

-- Ensure preserve_target column exists (idempotent, safe for existing deployments)
ALTER TABLE reward_function_state
  ADD COLUMN IF NOT EXISTS preserve_target VARCHAR;
```

This ensures that even if the table was created in a previous migration without this column, it gets added. `IF NOT EXISTS` makes it idempotent.

#### 3. `infra/lambda/cognitive/handler.py` — Apply explicit casts for consistency

Fix the `cognitive_profiles` INSERT (around line 51):
```python
query(
    """INSERT INTO cognitive_profiles (user_id, dimensions, journey_stage, total_interactions)
       VALUES (%s::uuid, %s::jsonb, 'discovery', 0)""",
    [user_id, json.dumps(dimensions)],
)
```

#### 4. `server-python/tests/test_journey.py` — Add targeted integration tests

Add two new tests that exercise the critical path:

```python
def test_journey_next_with_initialized_profile(client, mock_query, auth_token):
    """AC1-6: /api/journey/next returns 200 with valid challenge set after discovery."""
    from cognitive.agent import _empty_dimensions

    profile_dims = _empty_dimensions()

    # Mock: SELECT dimensions → reward state SELECT → agent_prompts INSERT
    mock_query.side_effect = [
        [{"dimensions": profile_dims}],
        [{"user_id": "test-uuid", "weights": {}, "confidence_vector": {},
          "total_interactions": 0, "exploration_queue": []}],
        [],
    ]

    resp = client.post("/api/journey/next",
        json={},
        headers={"Authorization": f"Bearer {auth_token}"})

    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "mode" in data
    assert data["mode"] in ("explore", "exploit")  # AC2
    assert "depth" in data
    assert data["depth"] in ("anchor", "adapt", "author")  # AC3
    assert "agent_prompt_id" in data  # AC4
    assert "cards" in data
    assert len(data["cards"]) == 3  # 3-card set


def test_journey_outcomes_with_law3(client, mock_query, auth_token):
    """AC10-12: Law 3 enforcement chain when user outsources a strength."""
    from cognitive.agent import _empty_dimensions

    dims_before = _empty_dimensions()
    dims_before["creative"]["score"] = 0.75  # Strong dimension

    mock_query.side_effect = [
        [],  # idempotency check
        [{"dimensions": dims_before}],  # fetch profile
        [],  # INSERT card_interactions (1)
        [],  # INSERT card_interactions (2)
        [],  # UPDATE cognitive_profiles
        [{"dimensions": dims_before, "journey_stage": "growth",
          "total_interactions": 2, "synergy_score": None}],  # fetch updated profile
        [{"total_interactions": 0}],  # fetch reward state
        [],  # UPDATE reward_function_state
    ]

    resp = client.post("/api/journey/outcomes",
        json={
            "agent_prompt_id": "test-ap-id",
            "session_id": "test-session",
            "interactions": [
                {"card_id": "c1", "card_type": "scenario", "dimension": "creative",
                 "option_selected": 3, "option_path": "full_outsource",
                 "time_spent_ms": 5000},
                {"card_id": "c2", "card_type": "concept", "dimension": "creative"},
            ],
        },
        headers={"Authorization": f"Bearer {auth_token}"})

    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert "reflection" in data
    assert "creative" in data["reflection"]["law3_flags"]  # AC11
    assert len(data["reflection"]["preserve_messages"]) > 0  # AC12
    # The preserve message should mention "creative" or "Creative Thinking"
    assert any("superpower" in m for m in data["reflection"]["preserve_messages"])
```

---

## Frontend Changes

None required. The frontend already calls `/api/journey/next` and `/api/journey/outcomes` correctly. Once the backend returns 200, the existing Learn.jsx will render the challenge cards.

---

## Implementation Order

1. **Add ALTER TABLE migration** — `migrate/handler.py`: append `preserve_target` column migration to SCHEMA string
2. **Fix all INSERT/UPDATE type casts** — `journey/handler.py`: apply `::uuid` and `::jsonb` casts to all 5 DB write operations (agent_prompts INSERT, reward_function_state INSERT, reward_function_state UPDATE, card_interactions INSERT, cognitive_profiles INSERT)
3. **Fix cognitive handler consistency** — `cognitive/handler.py`: same `::uuid` and `::jsonb` casts for cognitive_profiles INSERT
4. **Add diagnostic logging** — `journey/handler.py`: `print()` at each step of `_handle_next()`
5. **Add targeted tests** — `tests/test_journey.py`: add `test_journey_next_with_initialized_profile` and `test_journey_outcomes_with_law3`
6. **Run full test suite** — `python -m pytest server-python/tests/ -v` — verify 88+ pytest still green
7. **Push to `routine-team-ai` branch** — trigger deployment
8. **Run migration in production** — `POST https://ai-inst-production-api...ukwest.azurecontainerapps.io/api/migrate`
9. **Verify production** — full E2E: signup → init → next → outcomes → next (second challenge)

---

## Testing Notes for Tester

### P0 Verification (must pass before marking done)

1. **`POST /api/journey/next` returns 200** — signup → verify → cognitive/init (8 responses) → journey/next → 200 with `{mode, depth, agent_prompt_id, cards}`
2. **Response schema** — `mode` (explore|exploit), `depth` (anchor|adapt|author), `agent_prompt_id` (UUID), `cards` (3 items)
3. **`agent_prompts` row** — After `/api/journey/next`, query DB for agent_prompts → row exists with correct fields
4. **`preserve_target` column exists** — `SELECT preserve_target FROM reward_function_state LIMIT 1` → no error
5. **`POST /api/journey/outcomes` returns 200** — Submit outcomes → 200 with `{profile, reflection}`
6. **Full E2E loop** — signup → init → next → outcomes → next (second challenge differs) — no 500
7. **All 88+ pytest pass** — No regressions

### Law 3 (AC 10–12)
8. Seed `creative.score = 0.75` → submit `full_outsource` → assert score drops 0.02
9. Assert reflection `law3_flags: ["creative"]`
10. Assert `preserve_messages` includes "don't outsource your superpower"

### Agent Intelligence (AC 13–17)
11. Fresh user → mode="explore"
12. After 10+ interactions → mode shifts toward "exploit"
13. Depth: score < 0.3 → anchor, 0.3–0.6 → adapt, ≥ 0.6 → author
14. Stage: 0 interactions → "discovery", after outcomes → "growth"

### Edge Cases
15. Duplicate outcome → 409
16. No profile → 404
17. No auth → 401

---

## Rollback Plan

If fixes don't resolve the 500:
1. Check Azure logs: `az containerapp logs show --name agent-default --resource-group rg-ai-instructor --tail 100`
2. Look for `[journey/next] Step N:` — last step printed is the failure point
3. If missing table: `POST /api/migrate` to re-run DDL
4. If persistent: revert to pre-agent-intelligence commit and redeploy
