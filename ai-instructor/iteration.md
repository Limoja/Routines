# AI Instructor — Work Tracker

## Approach
This project uses a **spec-driven, adaptive approach**. There is no fixed iteration roadmap. Each cycle:
1. PO reads `docs/AIInstructor-MASTER-SPECIFICATION.md` and compares against current state
2. PO identifies the biggest gap and writes acceptance criteria for the most impactful chunk
3. Designer → Developer → Tester → Reviewer execute the chunk
4. Repeat

The master spec IS the roadmap. Everything in it must eventually be built.

## Completed Work
| Date | What Was Delivered | Key Changes |
|------|-------------------|-------------|
| 2026-06-12 | Testing Foundation | pytest (28 tests), vitest (6 tests), E2E script (10 steps), CI workflow |
| 2026-06-12 | Thinnest Loop | Cognitive profile tables, /api/cognitive/*, /api/journey/*, Discovery.jsx, Learn.jsx |
| 2026-06-12 | Route Restructure + Quality Bar | JourneyDashboard, Toast, ErrorBoundary, 401 redirect, 5-item navbar, route redirects |

## Current State
- See `shared-context.md` for detailed current state
- See `docs/AIInstructor-MASTER-SPECIFICATION.md` for the target state

## Dev API URL
https://ai-inst-production-api.blackrock-3f2021d2.ukwest.azurecontainerapps.io

## Dev Web URL
https://ai-inst-production-web.blackrock-3f2021d2.ukwest.azurecontainerapps.io
