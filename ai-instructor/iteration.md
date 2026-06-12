# AI Instructor — Iteration Tracker

## Current Iteration: 1
## Status: in-progress
## Title: The Thinnest Loop

## Iteration History

| # | Title | Status | Completed |
|---|-------|--------|-----------|
| 0 | Testing Foundation | **complete** | 2026-06-12 |
| 1 | The Thinnest Loop | **in-progress** | - |
| 2 | Scenario Cards + AI Paths | pending | - |
| 3 | Explore/Exploit Policy | pending | - |
| 4 | Prompt Lab + Depth Selection | pending | - |
| 5 | Reflection Cards + Law 3 | pending | - |
| 6 | Navigation Overhaul | pending | - |
| 7 | Discovery Polish | pending | - |
| 8 | Server-Side Agent | pending | - |
| 9 | Mastery Track + 3A | pending | - |
| 10 | Practice Arena | pending | - |
| 11 | Polish + Accessibility | pending | - |
| 12 | Analytics + Final QA | pending | - |

## Iteration 0 Progress (COMPLETE — merged 2026-06-12)
- [x] Backend pytest suite — 28 tests passing (conftest + 5 test files)
- [x] E2E test script — `scripts/e2e_test.sh` (10 steps, all passing against production)
- [x] Frontend vitest — 6 route smoke tests passing
- [x] CI pipeline — `.github/workflows/test.yml` (parallel pytest + vitest jobs)

## Iteration 1 Progress (in-progress)
- [ ] DB migration: `cognitive_profiles` and `card_interactions` tables
- [ ] `POST /api/cognitive/init` — create profile from 8 discovery responses
- [ ] `GET /api/cognitive/profile` — return user's cognitive profile
- [ ] `POST /api/journey/next` — return 3-card set targeting weakest dimension
- [ ] `POST /api/journey/outcomes` — submit outcomes, update profile, return reflection
- [ ] `src/pages/Discovery.jsx` — 8 behavioral scenario cards
- [ ] `src/pages/Learn.jsx` — challenge player (concept → question → summary)
- [ ] Routes: `/discover` and `/learn` added to App.jsx
- [ ] UserContext + api.js updated for cognitive/journey APIs
- [ ] Law compliance verified (Law 1, 2, 3)
- [ ] Tests: 15+ new pytest + E2E covering full discovery→challenge→outcome loop
- [ ] Existing tests (28 pytest, 6 vitest, 10 E2E) still pass — no regressions

## Notes
- Iteration 0 completed 2026-06-12 — merged to main at commit `6153092`
- PO review for Iteration 1 written 2026-06-12T00:37Z — 42 acceptance criteria across 7 chunks
- Backend-first: tables and endpoints must land before frontend wiring
- Dimension keys: use `creative`, `strategic`, `analytical`, `operational`, `communication`, `detail`, `empathetic`, `technical` (master spec keys, NOT journeyEngine.js keys)
- `journeyEngine.js` has scenario data to port but uses different key names (`detail_accuracy`, `technical_fluency`) — normalize
- Old `/onboarding` route MUST still work — backward compatibility
- Card generation is deliberately dumb in Iteration 1: always targets weakest, no explore/exploit, no LLM
- `CognitiveRadar.jsx` already built and renders — wire to real server data

## Dev API URL
https://ai-inst-production-api.blackrock-3f2021d2.ukwest.azurecontainerapps.io

## Dev Web URL
https://ai-inst-production-web.blackrock-3f2021d2.ukwest.azurecontainerapps.io
