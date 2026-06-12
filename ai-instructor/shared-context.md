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
- docs/AIInstructor-IMPLEMENTATION-PLAN.md — 12 iterations with architecture diagrams
- docs/AIInstructor-SPECIFICATION.md — Full target-state spec
- docs/AIInstructor-Revised-Architecture.md — IRL agent architecture
- docs/AIInstructor-Target-User-Journey.md — UX target
- docs/AIInstructor-UX-Review.md — 34 UX issues

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

## Current State (Iteration 0 — Starting, PO review done 2026-06-11)
- Backend pytest: **not set up** — `server-python/` has only `main.py` (300 lines, monolith), zero test files
- E2E tests: **not set up** — only `screenshot-test.mjs` (screenshot capture, no assertions)
- Frontend vitest: **not set up** — not in `package.json` devDependencies
- CI pipeline: **deploy only** — `build-api.yml` and `deploy-azure.yml` exist but run no tests
- Features present: auth, onboarding, curriculum, lessons, chat, practice (untested)
- 35 API endpoints live (auth, chat, curriculum, lesson, progress, practice, tools, path, jobs)
- No `/api/cognitive/*` or `/api/journey/*` endpoints yet (planned for Iteration 1)
- API health: confirmed UP at 2026-06-11T23:25Z
- Web health: confirmed UP at 2026-06-11T23:25Z
