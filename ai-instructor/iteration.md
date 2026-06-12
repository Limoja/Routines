# AI Instructor — Iteration Tracker

## Current Iteration: 1
## Status: pending
## Title: The Thinnest Loop

## Iteration History

| # | Title | Status | Completed |
|---|-------|--------|-----------|
| 0 | Testing Foundation | **complete** | 2026-06-12 |
| 1 | The Thinnest Loop | pending | - |
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

## Notes
- Iteration 0 completed 2026-06-12 — merged to main at commit `6153092`
- 22/22 acceptance criteria met
- Reviewer fixes: vitest config (exclude e2e/), __pycache__ cleanup, .gitignore update
- Playwright UI smoke tests written but not runnable in minimal containers (work in CI ubuntu-latest)
- Next iteration: 1 — The Thinnest Loop (new tables, /api/cognitive/*, /api/journey/*, DiscoveryScenarios, minimal ChallengePlayer)

## Dev API URL
https://ai-inst-production-api.blackrock-3f2021d2.ukwest.azurecontainerapps.io

## Dev Web URL
https://ai-inst-production-web.blackrock-3f2021d2.ukwest.azurecontainerapps.io
