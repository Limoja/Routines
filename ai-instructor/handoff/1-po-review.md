# PO Review — 2026-06-12

## Gap Analysis Summary

Gap analysis performed against `docs/AIInstructor-MASTER-SPECIFICATION.md` (v3.0, 699 lines). I compared every section of the spec against the live production site and the merged code.

### What's Working (matches spec):

- **Auth system** (Part G.2): signup, login, me, profile, verify-email, forgot/reset-password, resend-verification, notification-preferences — all 35 endpoints deployed and passing
- **Chat service** (Part C.2): message, sessions, history, recommendations — working
- **Practice service** (Part C.2): submit, history — working
- **Testing infrastructure** (Part I.1): pytest (44 tests), vitest (6 tests), E2E script, CI workflow — all green
- **Data model basics** (Part F.2): users, user_profiles, lesson_progress, chat_sessions — all exist
- **CognitiveRadar component** (Part H.4): built, renders SVG — exists in codebase
- **Law 1 compliance** (A.2): concept templates emphasize human ownership for all dimensions (verified in code)

### What's Partial (exists but doesn't fully match spec):

- **Cognitive profile API** (Part G.1): `POST /api/cognitive/init` and `GET /api/cognitive/profile` exist in code (merged, 44 pytest pass) but **NOT deployed to production** — returns 404 on live API
- **Journey API** (Part G.1): `POST /api/journey/next` and `POST /api/journey/outcomes` exist in code but **NOT deployed** — returns 404 on live API
- **Discovery page** (Part D Stage 2): `Discovery.jsx` exists in code with 8 scenario cards, 4 options, progress indicator — but **NOT deployed** and missing resumable discovery, archetype reveal, animated radar build
- **Learn page** (Part D Stage 3): `Learn.jsx` exists in code with 3-card challenge player — but **NOT deployed** and renders only concept→question→summary (spec calls for 5–8 card types)
- **Cognitive profiles table** (Part F.1): DDL exists in migration code but **NOT run against production DB**
- **card_interactions table** (Part F.1): DDL exists but **NOT run against production DB**
- **Agent logic** (Part E): Simplest agent only — always exploits (targets weakest), no explore/exploit policy (E.2), no depth selection (E.3), simplified outcome rules (not full E.4)
- **Law 3 enforcement** (E.5): Partial — flags `law3_violation` in reflection but doesn't force next challenge to target that dimension in preserve mode (E.5 step 2)
- **UserContext** (Part H.2): Server-first profile loading exists but journeyEngine.js client mock still primary; full migration to server-side source of truth not done (target for Part E.9)

### What's Missing (spec requires, nothing exists):

- **DEPLOYMENT**: Iteration 1 code merged to main (`3f69f75`) but production containers not updated — **this is the #1 blocker**
- **3 more API endpoints** (Part G.1): `GET /api/cognitive/summary`, `POST /api/journey/discovery`, `GET /api/journey/stage`
- **`agent_prompts` table** (Part F.1): Required for full agent→card engine contract (E.7)
- **`reward_function_state` table** (Part F.1): Required for explore/exploit policy
- **Explore/exploit policy** (Part E.2): No ratio logic, no exploration queue, no confidence-based decisions
- **Depth selection / 3A Framework** (Part E.3): No anchor/adapt/author logic tied to score thresholds
- **Full outcome ingestion** (Part E.4): Score updates simplified; missing confidence ceiling (E.6), variance floor, periodic re-exploration, re-asking protocol
- **Anti-pigeon-holing** (Part E.6): No confidence cap (0.95), no decay, no forced re-exploration every 25 interactions
- **JourneyDashboard** (Part D Stage 3, Part H.1): Home page should be dashboard for auth users — currently old Dashboard with 18 sections
- **ReflectionCard component** (Part H.2): Post-challenge reflection not a separate card type
- **ChallengePlayer** (Part H.2): Learn.jsx is minimal; spec calls for full player with 9 card types, keyboard nav, exit-with-confirmation
- **Toast system** (Part B.3 #9): No global toast/notification system
- **ErrorBoundary** (Part B.3): No React error boundary component
- **Route restructure** (Part H.1): Old routes still primary — `/onboarding`, `/curriculum`, `/courses`, `/epoch-lesson`, `/learning-path`, `/tools`, `/about`, `/dashboard` all still exist with no redirects
- **Navbar: 5 items** (Part H.1): Current navbar has 8+ items
- **Landing page discovery demo** (Part D Stage 1): Home page should have interactive cognitive demo — currently static
- **Playwright E2E** (Part I.1): Spec says Playwright replaces curl as primary E2E — currently curl-based
- **401 redirect** (Part B.3 #2): No global 401 → `/login` with toast redirect

### What's Broken:

- **Nothing functionally broken** in production — all 35 deployed endpoints work correctly
- **Deployment gap**: production is 1 merge behind main (code at `3f69f75` not deployed)

## Priority: Next Chunk

**Deploy Iteration 1 code to production and run DB migration.**

Why this chunk: Per spec B.1 Rule 3 — "Every iteration is deployable and **deployed** before being marked done." The Thinnest Loop code is merged (`3f69f75`) with 42/42 acceptance criteria passing at code level, 44 pytest green, but production still runs old code. The 5 E2E failures are ALL caused by this deployment gap. Nothing else should be built until the current code is live and verified.

If deployment is not possible in this cycle (ops constraint), the fallback chunk is to build the most impactful missing feature that doesn't require deployment: the **Route restructure + JourneyDashboard** (Part H.1), which unifies the home page as the learning hub and cleans up the navigation to match the spec.

## Acceptance Criteria

### Deployment Chunk (P0 — blocks everything else)
1. [ ] [P0] Production API container image rebuilt from main branch (`3f69f75`) and pushed to ACR (`pamousk.azurecr.io/ai-instructor-api:latest`)
2. [ ] [P0] Production web container image rebuilt from main branch and pushed to ACR (`pamousk.azurecr.io/ai-instructor-web:latest`)
3. [ ] [P0] Azure Container Apps updated to new image revisions (both API and web)
4. [ ] [P0] `POST /api/migrate` called against production — creates `cognitive_profiles` and `card_interactions` tables
5. [ ] [P0] `GET /api/health` returns `"ok"` on new deployment
6. [ ] [P0] `POST /api/cognitive/init` returns 401 (not 404) on production — endpoint exists
7. [ ] [P0] `POST /api/journey/next` returns 401 (not 404) on production — endpoint exists
8. [ ] [P0] E2E steps 11–15 (cognitive init, profile, journey next, outcomes, second next) pass against production
9. [ ] [P0] All existing E2E steps 1–10 still pass — no regression

### Fallback: Route Restructure + Navbar (if deployment blocked)
10. [ ] [P1] Navbar shows exactly 5 items: Home · Learn · Practice · Chat · Profile (per H.1)
11. [ ] [P1] `/` renders JourneyDashboard for authenticated users (radar + next challenge CTA + stats), old marketing for visitors
12. [ ] [P1] Old routes redirect: `/onboarding` → `/discover`, `/curriculum*` → `/learn`, `/lesson/:ch/:le` → `/learn`, `/epoch-lesson` → `/learn`, `/learning-path` → `/`, `/courses` → `/`, `/dashboard` → `/`
13. [ ] [P1] 401 responses clear token and redirect to `/login` with toast message (per B.3 #2)
14. [ ] [P1] Global Toast component created — every mutation outcome shows feedback (per B.3 #9)
15. [ ] [P1] React ErrorBoundary wraps main app — no render crashes from malformed API data (per B.3 #7)

## Bugs to Fix
- **E2E steps 11–15 failing** — caused by deployment gap, not code bugs. Will resolve once deployed.
- **`__pycache__` in git** — carried from Iteration 0. Low priority but should clean up (`.gitignore` + `git rm --cached`).

## Spec Compliance Assessment

| Spec Section | Status | Coverage |
|---|---|---|
| A.1–A.5 Purpose & Philosophy | ✅ Aligned | Product direction correct |
| A.2 Three Laws | ⚠️ Partial | Law 1 ✅, Law 2 ✅, Law 3 partial (flags but doesn't force preserve challenge) |
| A.4 8 Dimensions | ✅ Working | Keys match spec, 4 fields per dim |
| B.3 Engineering Quality Bar | ❌ Missing | No toast system, no error boundary, no global 401 redirect |
| C.1 Core Loop | ⚠️ Partial | Loop works in code (not deployed), but no explore/exploit, minimal agent |
| C.2 Component Topology | ❌ Missing | 6+ components from spec not built (JourneyDashboard, ReflectionCard, etc.) |
| C.3 Remove/Keep/Build | ❌ Missing | Old pages not removed/redirected, new components not built |
| D Stage 1 Landing | ❌ Missing | No discovery demo on home page |
| D Stage 2 Discovery | ⚠️ Partial | 8 cards exist (not deployed), missing resumable, archetype, animated reveal |
| D Stage 3 Learning Loop | ⚠️ Partial | 3-card challenge exists (not deployed), missing 5–8 card types, reflection |
| D Stage 4 Mastery | ❌ Missing | Not started |
| E.1 Reward Function | ❌ Missing | No reward function state tracking |
| E.2 Explore/Exploit | ❌ Missing | Always exploits, no ratio logic |
| E.3 Depth/3A | ❌ Missing | No anchor/adapt/author selection |
| E.4 Outcome Ingestion | ⚠️ Partial | Basic updates work, missing full E.4 rules |
| E.5 Law 3 Enforcement | ⚠️ Partial | Flags violation but doesn't force preserve challenge |
| E.6 Anti-Pigeon-Holing | ❌ Missing | No confidence cap, decay, or forced re-exploration |
| E.7 Prompt Interface | ❌ Missing | No structured agent prompt JSON |
| E.8 Cold Start | ✅ Working | Universal 8-card discovery, role priors don't seed scores |
| F.1 New Tables | ⚠️ Partial | 2 of 4 tables exist (missing `agent_prompts`, `reward_function_state`) |
| F.4 State Ownership | ⚠️ Partial | Server exists but journeyEngine.js still primary on client |
| G.1 New Endpoints | ⚠️ Partial | 4 of 7 built (not deployed); missing summary, discovery, stage |
| H.1 Routes | ❌ Missing | No restructure, old routes still primary |
| H.2 Components | ❌ Missing | 5+ new components needed |
| H.3 Card Types | ⚠️ Partial | Only concept, question, summary exist |
| H.4 Radar Rendering | ⚠️ Partial | Radar built but no confidence rendering, no trend ticks |
| I.1 Test Stack | ⚠️ Partial | pytest+vitest OK; Playwright not primary E2E |
| I.2 E2E Journeys | ❌ Missing | Only journey #1 partial; #2–#8 not implemented |
