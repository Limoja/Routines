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

## Current State (Iteration 1 — Starting, PO review done 2026-06-12)
- Iteration 0 **COMPLETE** — merged 2026-06-12, commit `6153092`
- Backend pytest: **28 tests passing** (auth: 13, curriculum: 4, progress: 5, chat: 5, health: 1)
- E2E tests: **10 steps passing** (`scripts/e2e_test.sh` against production)
- Frontend vitest: **6 route smoke tests passing**
- CI pipeline: **active** — `.github/workflows/test.yml` (parallel pytest + vitest jobs)
- Features present: auth, onboarding, curriculum, lessons, chat, practice (all tested)
- 35 API endpoints live (auth, chat, curriculum, lesson, progress, practice, tools, path, jobs)
- **No `/api/cognitive/*` or `/api/journey/*` endpoints yet** — Iteration 1 scope
- **No `Discovery.jsx` or `Learn.jsx` yet** — Iteration 1 scope
- `journeyEngine.js` (636 lines) exists as client-side mock — scenario data to be ported server-side
- `CognitiveRadar.jsx` component exists and renders — ready to wire to real data
- API health: confirmed UP at 2026-06-12T00:37Z
- Web health: confirmed UP at 2026-06-12T00:37Z
