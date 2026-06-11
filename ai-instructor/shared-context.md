# AI Instructor — Shared Context

## Project
AI-powered adaptive learning platform. IRL agent discovers each user's cognitive profile and generates adaptive content.

## Tech Stack
- Frontend: React 19 + Vite
- Backend: Python FastAPI
- Database: PostgreSQL
- Knowledge Graph: FalkorDB
- LLM: MiniMax
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

## Current State (Iteration 0 in progress)
- Backend pytest: 48 tests passing
- E2E tests: 21 tests passing
- Frontend vitest: not set up
- CI pipeline: not set up
- All existing features working (auth, onboarding, curriculum, lessons, chat, practice)
