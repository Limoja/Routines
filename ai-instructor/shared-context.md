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

## Current State (2026-06-12 — post Thinnest Loop build, pre-deploy)
- **DEPLOYMENT BLOCKER**: Iteration 1 code merged to main (`3f69f75`) but NOT deployed to production. Production API still runs old code (35 endpoints only). New `/api/cognitive/*` and `/api/journey/*` return 404.
- Iteration 0 **COMPLETE** — merged 2026-06-12, commit `6153092`
- Iteration 1 **code complete** — merged 2026-06-12, commit `3f69f75` (42/42 AC pass at code level)
- Backend pytest: **44 tests passing** (auth: 13, cognitive: 9, journey: 8, curriculum: 4, progress: 5, chat: 5, health: 1)
- Frontend vitest: **6 route smoke tests passing**
- E2E (Iter 0): **10/10 passing** against production
- E2E (Iter 1): **0/5 passing** — all blocked by deployment gap (endpoints return 404 on production)
- CI pipeline: **active** — `.github/workflows/test.yml` (parallel pytest + vitest jobs)
- **In code (not deployed)**: Discovery.jsx, Learn.jsx, cognitive + journey API endpoints, cognitive_profiles + card_interactions tables
- **Still in codebase (old)**: Onboarding.jsx, CurriculumGeneration.jsx, Courses.jsx, EpochLesson.jsx, LearningPath.jsx, legacy Dashboard.jsx, journeyEngine.js client mock
- `CognitiveRadar.jsx` component exists — ready to wire to live server data
- API health: confirmed UP at 2026-06-12T02:19Z
- Web health: confirmed UP at 2026-06-12T02:19Z

## Biggest Gaps vs Master Spec
- No deployment of Iteration 1 code (P0 blocker)
- No JourneyDashboard (home should be radar + next challenge for auth users)
- No route restructure (old routes still primary, no redirects, navbar has 8+ items)
- No Toast/ErrorBoundary/401 redirect (engineering quality bar B.3)
- No explore/exploit, no depth selection, no anti-pigeon-holing (Part E)
- Missing 3 of 7 spec API endpoints (summary, discovery, stage)
- Missing 2 of 4 spec tables (agent_prompts, reward_function_state)
