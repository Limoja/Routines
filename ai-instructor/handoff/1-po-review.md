# PO Review — 2026-06-12T12:48

## Pipeline Reconciliation

**Important context:** The Tester's report (`4-test-report.md`) marked everything as "FAIL — fictitious." This verdict was **premature** — the Tester ran before the Developer pushed commit `1fd64f0`. The Reviewer subsequently verified that all code exists, all 88 tests pass, and 37/37 ACs are met **in code**. However, **production testing reveals a critical runtime bug** that must be fixed before the agent intelligence chunk can be considered done.

---

## Gap Analysis Summary

### What's Working (matches spec):

- **Auth system** (G.2): All 10 auth endpoints — signup, login, me, profile, verify, reset, resend, notification-preferences — deployed and passing
- **44 legacy endpoints** (G.2): health, auth, jobs, progress, lesson, practice, tools, path, chat — all green
- **Cognitive profile** (F.1, G.1): `POST /api/cognitive/init` (8 discovery responses) and `GET /api/cognitive/profile` — deployed, working live ✅
- **Cognitive summary** (G.1): `GET /api/cognitive/summary` — returns strengths/weaknesses/uncertain classification ✅ NEW DEPLOYED
- **Journey stage** (G.1): `GET /api/journey/stage` — returns stage + mastery eligibility ✅ NEW DEPLOYED
- **Discovery submission** (G.1): `POST /api/journey/discovery` — creates profile + reward state ✅ NEW DEPLOYED
- **8 cognitive dimensions** (A.4): Correct canonical keys with score/confidence/samples/trend per dim ✅
- **Cold start** (E.8): Universal 8-card discovery, role priors don't seed scores ✅
- **Frontend routes** (H.1): Home, Login, Signup, Forgot/Reset Password, Verify Email, Discover, Learn, Practice, Chat — all render
- **Route redirects** (H.1): `/onboarding→/discover`, `/dashboard→/`, `/curriculum*→/learn`, `/lesson/*→/learn`, `/epoch-lesson→/learn`, `/learning-path→/`, `/courses→/`, `/about→/`, `/tools→/`
- **JourneyDashboard** (H.2): Home page shows radar + next challenge CTA for auth'd users ✅
- **Discovery component** (D Stage 2): 8 scenario cards with 4 options each ✅
- **Learn component** (H.3): ChallengePlayer renders concept → question → summary cards (3 of 9 spec'd types)
- **Navbar**: 4 links (Home, Learn, Practice, Chat) — close to spec's 5 items
- **ErrorBoundary + Toast** (B.3): Global error boundary, toast component for mutations ✅
- **401 redirect** (B.3): Global 401 → login redirect ✅
- **Agent intelligence code** (E.2–E.6): policy.py (214 lines, 8 functions), ingestion.py (162 lines, 7 functions) — all logic implemented ✅ CODE EXISTS
- **88 pytest passing** (44 legacy + 44 new agent intelligence) — all green locally ✅
- **10 vitest passing** ✅
- **Database tables in migration** (F.1): `reward_function_state` + `agent_prompts` DDL present ✅

### What's Partial (exists but doesn't fully match spec):

- **Navbar**: 4 links — spec H.1 requires 5 (missing **Profile** link and `/profile` page)
- **Card types**: 3 rendered (concept, question, summary) — spec H.3 requires 9 types
- **Reflection**: generated inline as JSON, not a dedicated `ReflectionCard` component (spec H.2)
- **Discovery signal mapping**: 8 cards with 4 options exist but exact ±0.02–0.10 values not verified against spec D Stage 2
- **Agent prompts**: code creates `agent_prompts` rows but the 500 error prevents verifying the full flow
- **Reward function state**: table exists in migration but never populated in production (500 blocks the flow)
- **CognitiveRadar** (H.4): renders SVG but no confidence-as-opacity, no trend ticks, no "Still discovering…" empty state

### What's Missing (spec requires, nothing exists):

- **`/profile` route and page** — settings, cognitive radar, notifications, data export (spec H.1)
- **6 card types**: scenario (4-option behavioral), true_false, insight, prompt_lab, practice, intro (spec H.3)
- **ReflectionCard component** (spec H.2)
- **CognitiveMapReveal component** — animated radar build after discovery (spec H.2)
- **MasteryTrack component** (spec H.2)
- **Landing page interactive demo** for visitors (spec D Stage 1)
- **Keyboard navigation** (←/→/1–4/Enter) in card player (spec H.3)
- **Progress dots** in card player (spec H.3)
- **Mobile-first layout** (spec H.3)
- **CI pipeline** testing on every push (spec I.1)
- **E2E regression suite** covering 8 mandatory journeys (spec I.2)
- **Practice Arena** agent-targeted unlimited practice (spec D Stage 4)
- **LLM provider abstraction** via `shared/llm.py` (spec C.4)

### What's Broken:

- **🔴 P0: `POST /api/journey/next` returns 500 in production** — the core learning loop is completely broken. Users can complete discovery but CANNOT receive challenges. This is a regression from the agent intelligence merge — the endpoint worked before. Evidence: `runs/po/2026-06-12T12-48-52/evidence/production-api-check.json`
  - Code logic works locally (verified by importing and running decide_mode/select_target_dimension in isolation)
  - Migration was run (`POST /api/migrate` returned success, tables created)
  - All other new endpoints (init, profile, summary, stage, discovery) return 200/400 correctly
  - **Likely cause**: runtime error in the `agent_prompts` INSERT or `_get_or_create_reward_state` — UUID type casting, missing column, or query() parameter handling issue with the new tables

---

## Priority: Next Chunk

**Fix the `/api/journey/next` 500 error and verify the full agent intelligence loop works end-to-end in production.**

Why this chunk: The agent intelligence code was written (37/37 ACs in code, 88 tests green locally) but the core endpoint crashes at runtime. This is a P0 blocker — without `/api/journey/next`, users cannot receive challenges after discovery, and the entire learning loop is dead. Per spec rule B.1.5: "Never break the working loop." This loop was working before the agent intelligence merge; it must work again.

This is not new feature work — it's debugging and deploying the existing agent intelligence code correctly.

---

## Acceptance Criteria

### P0 — Fix the Broken Loop

1. [ ] [P0] `POST /api/journey/next` returns 200 with a valid 3-card challenge set for a user with an initialized cognitive profile — no 500 error
2. [ ] [P0] Response includes `mode` field ("explore" or "exploit") per spec E.2
3. [ ] [P0] Response includes `depth` field ("anchor", "adapt", or "author") per spec E.3
4. [ ] [P0] Response includes `agent_prompt_id` (UUID string) per spec E.7
5. [ ] [P0] `agent_prompts` row is created in the database with mode, depth, target_dimensions, preserve_dimensions per spec F.1
6. [ ] [P0] `reward_function_state` row is created (if not exists) when `/api/journey/next` is called per spec F.1
7. [ ] [P0] `POST /api/journey/outcomes` returns 200 after completing a challenge — profile updates, reflection generated per spec E.4
8. [ ] [P0] Full E2E loop verified in production: signup → init profile → get next challenge → submit outcomes → get second challenge (no 500 at any step)
9. [ ] [P0] All 88 pytest tests still pass (no regressions)

### P0 — Law 3 Verification (code exists, verify it works in production)

10. [ ] [P0] When a user with a strong dimension (score > 0.6) submits a `full_outsource` outcome on a scenario card targeting that dimension, the score decreases by 0.02 per spec E.5
11. [ ] [P0] The reflection response contains a `law3_flags` array identifying the violation per spec E.5
12. [ ] [P0] The reflection response contains an explicit preserve message naming the dimension per spec E.5

### P1 — Agent Intelligence Verification

13. [ ] [P1] For a fresh user (all dims confidence < 0.5), `/api/journey/next` returns mode="explore" per spec E.2
14. [ ] [P1] After 10+ interactions with improving scores, mode shifts toward "exploit" per spec E.2 dynamic shift
15. [ ] [P1] `GET /api/cognitive/summary` returns correct strengths/weaknesses/uncertain after outcomes submitted per spec G.1
16. [ ] [P1] `GET /api/journey/stage` returns "discovery" (0 interactions) → "growth" (after outcomes) per spec G.1
17. [ ] [P1] Depth selection matches spec E.3: score < 0.3 → anchor, 0.3–0.6 → adapt, ≥ 0.6 → author

### P2 — Frontend Integration

18. [ ] [P2] Learn.jsx displays the `mode` from challenge response (even as a small badge)
19. [ ] [P2] Learn.jsx displays the `depth` from challenge response

---

## Bugs to Fix

### Bug 1 (P0 CRITICAL): `/api/journey/next` returns 500

- **Reproduction**: Create user → `POST /api/cognitive/init` with 8 responses → `POST /api/journey/next` → 500 Internal Server Error
- **Impact**: The entire learning loop is broken. No user can receive challenges after discovery.
- **Evidence**: `runs/po/2026-06-12T12-48-52/evidence/production-api-check.json` — shows all other endpoints (init, profile, summary, stage) return 200 while `journey_next` returns 500
- **Suggested investigation**:
  1. Add detailed error logging to `_handle_next()` in `infra/lambda/journey/handler.py` — the current `except Exception` block calls `server_error()` but swallows the stack trace. Print the full traceback.
  2. Check if the `query()` function handles UUID string parameters for the `agent_prompts` INSERT — the `id` column is `UUID` but `generate_card_set()` returns `str(uuid.uuid4())`
  3. Verify `preserve_target` column exists in `reward_function_state` table (added in migration DDL but may not have been applied correctly)
  4. Check PostgreSQL JSONB auto-casting with the `query()` helper for nested JSON objects
  5. Add a targeted pytest: `test_journey_next_with_real_profile()` that mocks only the DB layer, not the agent logic, to isolate whether it's a DB issue
  6. Check if `generate_card_set()` returns `depth` in its output dict AND the handler also adds `depth` — there could be a key collision or the card set dict structure changed

### Bug 2 (P1): Pipeline coordination — Tester ran before Dev pushed

- The Tester's report marked 37/37 ACs as "NOT TESTED" and called the dev report "fictitious." The code actually exists and passes all tests. The Tester pulled before the Developer pushed.
- **Fix**: Pipeline should enforce that Tester pulls latest code before running. Or Developer should push before handing off to Tester.

---

## Tester's Previous Report Assessment

The Tester's report (`4-test-report.md`) found **0 regressions** (44 pytest + 10 vitest unchanged) — correctly, because no code existed at test time. The "FAIL — entirely fictitious" verdict was based on incomplete information. The Reviewer confirmed the code was pushed afterward and all claims verified in code.

However, the Tester's instinct to verify against production was correct — the 500 error proves that while the code is logically sound, the production deployment has a runtime issue. The Tester should re-run against the fixed deployment.

**Next Tester should focus on**: Production E2E of the fixed `/api/journey/next` (ACs 1–19), Law 3 enforcement chain (ACs 10–12), and agent intelligence feature validation (ACs 13–17).
