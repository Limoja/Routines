# AI Instructor — Iteration Tracker

## Current Iteration: 0
## Status: in-progress
## Title: Testing Foundation

## Iteration History

| # | Title | Status | Completed |
|---|-------|--------|-----------|
| 0 | Testing Foundation | in-progress | - |
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

## Iteration 0 Progress
- [ ] Backend pytest suite — create `server-python/tests/` with conftest + 5 test files (target: 30+ tests)
- [ ] E2E test script — create `scripts/e2e_test.sh` (curl-based full flow: signup→login→onboard→curriculum→lesson→progress)
- [ ] Frontend vitest — add to `package.json`, create `src/tests/` with routing smoke tests
- [ ] CI pipeline — create `.github/workflows/test.yml` (runs pytest + vitest on push)

## Notes
- Shared context corrected on 2026-06-11: previous claims of 48 pytest / 21 E2E tests were false
- PO review completed 2026-06-11T23:25Z — acceptance criteria written (22 criteria in 4 chunks)
- Pipeline starting — `handoff/1-po-review.md` created, first cycle
- Dev environment not yet set up (dev container apps pending)
- `server-python/main.py` is a 300-line monolith — tests will need DB mocking or test DB

## Dev API URL
https://ai-inst-production-api.blackrock-3f2021d2.ukwest.azurecontainerapps.io

## Dev Web URL
https://ai-inst-production-web.blackrock-3f2021d2.ukwest.azurecontainerapps.io
