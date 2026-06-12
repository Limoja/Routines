# PO Review — 2026-06-12

## Gap Analysis Summary

Gap analysis against `docs/AIInstructor-MASTER-SPECIFICATION.md` (699 lines, v3.0). Compared every section to live production state + merged codebase.

### What's Working (matches spec):

- **Auth system** (G.2): All 10 auth endpoints deployed and passing — signup, login, me, profile, verify, reset, resend, notification-preferences
- **Chat service** (C.2): message, sessions, history, recommendations — deployed and working
- **Practice service** (C.2): submit, history — working
- **Testing infrastructure** (I.1): 44 pytest, 10 vitest, 15-step E2E script, CI workflow — all active
- **Deployment** (B.1.3): ✅ RESOLVED — 39 endpoints now live in production (was 35)
- **Cognitive profile API** (G.1): `POST /api/cognitive/init` and `GET /api/cognitive/profile` — deployed, verified working live
- **Journey API** (G.1): `POST /api/journey/next` and `POST /api/journey/outcomes` — deployed, verified working live
- **Discovery flow** (D Stage 2): 8 behavioral scenario cards → profile initialization → CognitiveRadar — code complete, deployed
- **Learning loop** (D Stage 3): 3-card challenges (concept→question→summary) targeting weakest dimension, profile updates, reflections — live in production
- **Route restructure** (H.1): 5-item navbar (Home, Learn, Practice, Chat, Profile), 10 old routes redirect to new equivalents
- **JourneyDashboard** (H.1): Home page shows radar + next challenge CTA for auth'd users, discovery CTA when no profile
- **Engineering quality** (B.3): Toast component (4 types, auto-dismiss), ErrorBoundary, global 401 → login redirect
- **8 dimension keys** (A.4): Correct canonical names (`creative`, `strategic`, `analytical`, `operational`, `communication`, `detail`, `empathetic`, `technical`)
- **Option semantics** (D Stage 2): 4 options map correctly to score signals per spec
- **Cold start** (E.8): Universal 8-card discovery, role priors don't seed scores
- **Law 1** (A.2): Concept templates emphasize human ownership
- **Law 2** (A.2): Challenges target weakest dimension (complement weaknesses)
- **Law 3 partial** (E.5): Flags `law3_violation` in reflection when full_outsource on dim > 0.6

**✅ Full E2E loop verified in production**: signup → 8 discovery cards → cognitive profile → first challenge (3 cards targeting weakest) → outcomes → profile update → reflection → second challenge — all working live.

### What's Partial (exists but doesn't fully match spec):

- **Agent logic** (E.1–E.2): Simplest agent only — always exploits (targets weakest), no explore/exploit ratio, no exploration queue. Spec E.2 requires dynamic ratio based on confidence.
- **Outcome ingestion** (E.4): Basic score updates work. Missing: per-card-type update rules (scenario ±0.02–0.03, question +0.02/−0.01, prompt_lab weighted average α=min(0.3,1/(n+1))), trend computation (compare last 5 samples to prior 5).
- **Law 3 enforcement** (E.5): Flags violation but doesn't (a) decrease score by 0.02, (b) force next challenge to target that dimension in preserve mode, (c) include explicit preserve message in reflection naming the dimension.
- **Challenge cards** (H.3): Only 3 types (concept, question, summary). Spec requires 9 types (intro, concept, scenario, question, true_false, insight, prompt_lab, practice, summary/reflection) in 5–8 card challenges.
- **CognitiveRadar** (H.4): Renders SVG but no confidence-as-opacity rendering, no trend ticks, no "Still discovering…" empty state.
- **Reflection** (D Stage 3): Basic message returned from outcomes API, but no dedicated ReflectionCard component with owned/AI-helped/Law3 sections.
- **Card engine** (E.7): No structured agent prompt JSON contract. Agent directly returns cards; spec requires agent→card engine separation via `agent_prompts` table.
- **UserContext** (F.4): Server-first loading exists but `journeyEngine.js` client mock still imported; full migration not complete.

### What's Missing (spec requires, nothing exists):

- **Explore/exploit policy** (E.2): No `reward_function_state` table, no ratio logic (`explore_ratio = clamp(low_conf/total, 0.2, 0.5)`), no exploration queue, no dynamic shifts by journey stage.
- **Depth selection / 3A** (E.3): No anchor/adapt/author logic. Score < 0.3 should produce Anchor content, 0.3–0.6 Adapt, ≥ 0.6 Author. Currently all challenges use the same depth.
- **Anti-pigeon-holing** (E.6): No confidence ceiling (0.95), no decay (−0.01 per 14 days), no forced re-exploration every 25 interactions, no re-asking protocol.
- **`reward_function_state` table** (F.1): Required for explore/exploit — stores weights, confidence_vector, exploration_queue.
- **`agent_prompts` table** (F.1): Required for agent→card engine contract — stores mode, target_dimensions, preserve_dimensions, depth, cards_requested.
- **3 API endpoints** (G.1): `GET /api/cognitive/summary` (strengths/weaknesses/uncertain summary), `POST /api/journey/discovery` (submit discovery answers), `GET /api/journey/stage` (current stage + mastery eligibility).
- **ReflectionCard component** (H.2): Post-challenge behavioral insight card — "You owned X. AI helped with Y." + Law 3 callouts.
- **ChallengePlayer** (H.3): Full player with 9 card types, keyboard navigation (←/→/1–4/Enter), exit-with-confirmation (partial outcomes saved), mobile-first.
- **Landing page demo** (D Stage 1): No interactive cognitive demo on home page for visitors.
- **Profile/settings page** (H.1): No `/profile` route — navbar "Profile" button goes to `/` (bug reported by tester).
- **Playwright E2E** (I.1): Spec says Playwright replaces curl as primary E2E. Currently curl-based.
- **Stage transitions** (D Stage 4): No mastery stage (avg confidence > 0.7 AND avg score > 0.5), no 3A paths.

### What's Broken:

- **Navbar Profile link** (P2): Goes to `/` instead of `/profile` — no profile/settings page exists yet.

## Priority: Next Chunk

**Build the Agent Intelligence layer: explore/exploit policy, depth selection (3A), anti-pigeon-holing, and full outcome ingestion rules.**

Why this chunk: The agent is the product's core IP. Currently it's "always target weakest dimension with 3 identical cards" — a trivial agent. The spec (Part E) defines a sophisticated adaptive system with explore/exploit dynamics, per-dimension depth selection, confidence tracking, and anti-pigeon-holing safeguards. Building this transforms the product from a demo into a real adaptive learning platform. It also creates the `reward_function_state` and `agent_prompts` tables needed by all subsequent features. Backend-first: tables → agent math → endpoints → then frontend ChallengePlayer can use richer card sets.

This chunk covers: Parts E.2 (explore/exploit), E.3 (depth/3A), E.4 (full outcome ingestion), E.5 (complete Law 3), E.6 (anti-pigeon-holing), E.7 (agent prompt interface), F.1 (2 missing tables), G.1 (3 missing endpoints).

## Acceptance Criteria

### Database: New Tables (Part F.1)
1. [ ] [P1] `POST /api/migrate` creates `reward_function_state` table with columns: `user_id UUID PK`, `version INT DEFAULT 1`, `weights JSONB NOT NULL`, `confidence_vector JSONB NOT NULL`, `total_interactions INT DEFAULT 0`, `last_exploration TIMESTAMP`, `exploration_queue JSONB`, `computed_at TIMESTAMP DEFAULT now()`
2. [ ] [P1] `POST /api/migrate` creates `agent_prompts` table with columns: `id UUID PK`, `user_id UUID FK`, `session_id UUID`, `mode VARCHAR`, `target_dimensions JSONB`, `preserve_dimensions JSONB`, `depth VARCHAR`, `epoch_skill VARCHAR`, `scenario_context JSONB`, `cards_requested JSONB`, `with_ai_paths BOOLEAN`, `generated_at TIMESTAMP DEFAULT now()`, `outcome_data JSONB`
3. [ ] [P1] Migration is idempotent — existing `cognitive_profiles` and `card_interactions` tables unaffected

### Agent Core: Explore/Exploit (Part E.2)
4. [ ] [P0] `find_weakest_dimension()` replaced by agent decision logic that computes `explore_ratio = clamp(low_confidence_dims / total_dims, 0.2, 0.5)` per E.2
5. [ ] [P0] A dimension is "low confidence" when `confidence < 0.5 OR samples < 5` per E.2
6. [ ] [P1] `reward_function_state` row created for each user on first interaction, with initial weights = dimension scores from cognitive profile
7. [ ] [P1] Exploration queue maintained in `reward_function_state.exploration_queue`, ordered by lowest confidence first
8. [ ] [P1] Mode selection per challenge: EXPLORE → generate scenario probes for low-confidence dims; EXPLOIT → target known weak dims
9. [ ] [P1] Dynamic shift: early journey (total_interactions < 10) → more EXPLORE; mid → balanced; late → more EXPLOIT

### Agent Core: Depth Selection / 3A (Part E.3)
10. [ ] [P0] For the primary target dimension, depth is selected: `score < 0.3 → anchor`, `score < 0.6 → adapt`, `score ≥ 0.6 → author`
11. [ ] [P1] `depth` field included in the `/api/journey/next` response and each card's content object
12. [ ] [P1] Content templates vary by depth level: anchor = introduce concepts, adapt = guided practice, author = create & innovate

### Agent Core: Outcome Ingestion (Part E.4)
13. [ ] [P0] Scenario card signals: option selected → score update ±0.02–0.03 per path mapping (D Stage 2), confidence +0.08 per sample
14. [ ] [P0] Question card signals: correct → +0.02, incorrect → −0.01, confidence +0.05 per sample
15. [ ] [P1] Prompt Lab card signals: weighted moving average, α = min(0.3, 1/(samples+1)), confidence +0.06 per sample
16. [ ] [P1] Trend computation: compare mean of last 5 samples to prior 5; ±0.05 threshold → `improving`/`declining`, else `stable` per E.4

### Agent Core: Law 3 Full Enforcement (Part E.5)
17. [ ] [P0] When `option_path == "full_outsource"` AND target dimension `score > 0.6`: score for that dimension decreases by 0.02 (not just flag)
18. [ ] [P0] The **next** generated challenge targets that dimension in preserve mode (reinforcement content)
19. [ ] [P0] Reflection contains explicit preserve message naming the dimension: "You're great at {dim} — don't outsource your superpower"
20. [ ] [P0] Event logged in `card_interactions.cognitive_signal` with `law3_violation: true`

### Anti-Pigeon-Holing (Part E.6)
21. [ ] [P1] Confidence ceiling: confidence caps at 0.95 — agent never becomes certain
22. [ ] [P1] Forced re-exploration: every 25 interactions, at least one explore-mode challenge regardless of ratio
23. [ ] [P1] Declining trends on strong dimensions raise that dimension in the exploration queue (Law 1 watch)

### New API Endpoints (Part G.1)
24. [ ] [P1] `GET /api/cognitive/summary` — authenticated. Returns readable strengths (top 3), weaknesses (bottom 2), uncertain dims (confidence < 0.5) summary
25. [ ] [P1] `GET /api/journey/stage` — authenticated. Returns current `journey_stage` and mastery eligibility (`avg(confidence) > 0.7 AND avg(score) > 0.5`)
26. [ ] [P2] `POST /api/journey/discovery` — authenticated. Alternative entry point that accepts discovery card answers and initializes profile (replacing the cognitive/init flow for discovery specifically)

### Agent Prompt Interface (Part E.7)
27. [ ] [P1] Each `/api/journey/next` call creates an `agent_prompts` row with the full decision context: mode, target_dimensions, preserve_dimensions, depth, cards_requested, scenario_context
28. [ ] [P1] `agent_prompt_id` in the response maps to the `agent_prompts.id` row — enables traceability from outcomes back to agent decisions

### Testing
29. [ ] [P0] New pytest tests for explore/exploit logic: test that low-confidence dims get explore-mode challenges; high-confidence weak dims get exploit-mode (per I.2 journey #4)
30. [ ] [P0] New pytest tests for depth selection: profiles at 0.2/0.45/0.7 produce anchor/adapt/author challenges (per I.2 journey #5)
31. [ ] [P0] New pytest tests for Law 3 full enforcement: seed strong dim → select full_outsource → assert score drop, preserve reflection, next challenge targets that dim (per I.2 journey #3)
32. [ ] [P1] New pytest tests for anti-pigeon-holing: confidence ceiling, forced re-exploration at 25 interactions
33. [ ] [P1] New pytest tests for outcome ingestion: verify exact score updates per card type match E.4 rules
34. [ ] [P1] All existing tests (44 pytest, 10 vitest, 15 E2E) still pass — no regressions

### Spec compliance verification
35. [ ] [P1] `reward_function_state.exploration_queue` correctly ordered by lowest confidence
36. [ ] [P1] After outcome submission, `reward_function_state.weights` updated to match current profile scores
37. [ ] [P1] `/api/journey/next` response includes `mode` field (either "explore" or "exploit")

## Bugs to Fix
- **Navbar Profile link** (P2): Goes to `/` instead of `/profile`. No profile page exists yet. Will be resolved when `/profile` route is built in a future chunk.
- **`__pycache__` in git** (P2): Should add to `.gitignore` and `git rm --cached`.
