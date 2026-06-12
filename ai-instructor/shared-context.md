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

## Current State (2026-06-12 — deployed, core loop working)
- **DEPLOYED**: 39 API endpoints live in production (35 legacy + 4 new cognitive/journey)
- **Full E2E loop verified in production**: signup → 8 discovery cards → cognitive profile → challenge (3 cards) → outcomes → profile update → reflection → next challenge
- Completed chunks: Testing Foundation, Thinnest Loop, Route Restructure + Quality Bar
- Backend pytest: **44 tests passing** (auth: 13, cognitive: 9, journey: 8, curriculum: 4, progress: 5, chat: 5, health: 1)
- Frontend vitest: **10 tests passing** (6 route smokes + 4 toast/redirect)
- E2E (Iter 0): **10/10 passing** against production
- E2E (Iter 1): **0/5 — needs re-test** (endpoints NOW deployed, but E2E script not re-run since deployment)
- CI pipeline: **active** — `.github/workflows/test.yml`
- **Agent is minimal**: always exploits (targets weakest), no explore/exploit, no depth selection, simplified outcome rules
- **Missing tables**: `agent_prompts`, `reward_function_state` (needed for agent intelligence)
- **Missing endpoints**: `/api/cognitive/summary`, `/api/journey/discovery`, `/api/journey/stage`
- **Missing components**: ReflectionCard, full ChallengePlayer (9 card types), profile page, landing demo
- API health: confirmed UP at 2026-06-12T09:25Z
- Web health: confirmed UP at 2026-06-12T09:25Z

## Biggest Gaps vs Master Spec
- **Agent intelligence** (Part E): No explore/exploit, no depth/3A, no anti-pigeon-holing, simplified outcomes — the core IP is missing
- **Missing tables** (Part F.1): `agent_prompts`, `reward_function_state`
- **Missing endpoints** (Part G.1): cognitive/summary, journey/discovery, journey/stage
- **ChallengePlayer** (Part H.3): Only 3 card types, spec requires 9
- **Profile page** (Part H.1): Navbar Profile goes to `/` — no settings/profile page
