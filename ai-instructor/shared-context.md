# AI Instructor — Shared Context

## Project
AI-powered adaptive learning platform. IRL agent discovers each user's cognitive profile and generates adaptive content.

## Authoritative Specification
`docs/AIInstructor-MASTER-SPECIFICATION.md` (in the AIInstructor repo) — 699-line unified spec covering purpose, architecture, data model, API, frontend, testing, and iteration roadmap. ALL work must conform to this document.

## Tech Stack
- Frontend: React 19 + Vite
- Backend: Python FastAPI
- Database: PostgreSQL
- Knowledge Graph: FalkorDB
- LLM: MiniMax (provider-abstracted by Iteration 8)
- Testing: pytest, vitest, Playwright

## Repos
- Source: https://github.com/Limoja/AIInstructor.git
- Work branch: routine-team-ai

## Deployment
- Resource Group: rg-ai-instructor
- API: https://ai-inst-production-api.blackrock-3f2021d2.ukwest.azurecontainerapps.io
- Web: https://ai-inst-production-web.blackrock-3f2021d2.ukwest.azurecontainerapps.io
- ACR: pamousk.azurecr.io/ai-instructor-api, ai-instructor-web

## Key Docs (in AIInstructor repo)
- **docs/AIInstructor-MASTER-SPECIFICATION.md — AUTHORITATIVE SPEC** (699 lines, the single source of truth)
- docs/AIInstructor-SPECIFICATION.md — Superseded by master spec
- docs/AIInstructor-IMPLEMENTATION-PLAN.md — Reference only (architecture diagrams), NOT a fixed roadmap
- docs/AIInstructor-Revised-Architecture.md — IRL agent architecture (consolidated into master spec)
- docs/AIInstructor-UX-Review.md — Quality bar (consolidated into master spec Part B.3)

## 8 Cognitive Dimensions
Creative Thinking, Strategic Planning, Analytical Reasoning, Operational Execution, Communication, Detail Accuracy, Empathetic Intelligence, Technical Fluency

## Three Laws
1. PRESERVE human cognitive strengths — never teach outsourcing
2. COMPLEMENT weaknesses — guide AI use where abilities are weaker
3. DETECT & CORRECT — if user outsources a strength, reinforce human ownership

## 3A Framework
- Anchor (score < 0.3): introduce concepts
- Adapt (score 0.3-0.6): guided practice
- Author (score >= 0.6): create and innovate

## Current State (2026-06-12T12:48 — P0 BLOCKER: learning loop broken)

### Critical Issue
- **🔴 `POST /api/journey/next` returns 500 in production** — the core learning loop is broken. Users can complete discovery but CANNOT receive challenges. This is a regression from the agent intelligence merge. All other endpoints work.

### What's Deployed
- **42 API endpoints** in production (35 legacy + 3 new cognitive/journey + 4 previously deployed)
- New endpoints confirmed working: `GET /api/cognitive/summary`, `GET /api/journey/stage`, `POST /api/journey/discovery`
- Broken endpoint: `POST /api/journey/next` (500), `POST /api/journey/outcomes` (likely broken too, depends on next)
- Completed chunks: Testing Foundation, Thinnest Loop, Route Restructure + Quality Bar
- Agent intelligence code merged (commit `1fd64f0`) but has runtime bug

### Test Status
- Backend pytest: **88 tests passing** (44 legacy + 44 new agent intelligence) — all green locally
- Frontend vitest: **10 tests passing** (6 route smokes + 4 toast/redirect)
- E2E (Iter 0): **10/10 passing** against production
- CI pipeline: **active** — `.github/workflows/test.yml`

### Agent Intelligence (code exists, production broken)
- **Explore/exploit policy** (E.2): Implemented in `policy.py` — dynamic ratio, mode decision, forced re-exploration ✅ CODE
- **Depth selection / 3A** (E.3): anchor/adapt/author with depth-variant templates ✅ CODE
- **Outcome ingestion** (E.4): per-card-type rules with correct score deltas ✅ CODE
- **Law 3 full enforcement** (E.5): score -0.02, preserve target, preserve message ✅ CODE
- **Anti-pigeon-holing** (E.6): confidence ceiling 0.95, forced re-exploration at 25 ✅ CODE
- **New tables** (F.1): `reward_function_state`, `agent_prompts` — in migration DDL, migration run ✅
- **BUT**: None of this works in production because `/api/journey/next` crashes

### Still Missing
- **`/profile` page** (spec H.1) — no route, no component
- **6 card types** (spec H.3): scenario, true_false, insight, prompt_lab, practice, intro
- **ReflectionCard component** (spec H.2)
- **CognitiveMapReveal** (spec H.2)
- **MasteryTrack** (spec H.2)
- **Profile page** (spec H.1)
- **LLM abstraction** `shared/llm.py` (spec C.4)

- API health: confirmed UP at 2026-06-12T12:49Z
- Web health: confirmed UP at 2026-06-12T12:49Z

## Biggest Gaps vs Master Spec
1. **🔴 P0: `/api/journey/next` returns 500** — learning loop broken in production
2. **ChallengePlayer** (Part H.3): Only 3 card types, spec requires 9
3. **Profile page** (Part H.1): No `/profile` route or component
4. **ReflectionCard** (Part H.2): No dedicated component
5. **CI E2E regression** (Part I.2): No Playwright E2E suite covering 8 mandatory journeys
