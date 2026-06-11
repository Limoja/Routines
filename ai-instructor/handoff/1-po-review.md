# PO Review — 2026-06-11

## Current Iteration: 0 — Testing Foundation
## Pipeline Status: starting

## Product Status
- API Health: **UP** — `/api/health` returns `{"status":"ok"}` at 2026-06-11T23:25Z
- Web: **UP** — returns 200 OK
- 35 API endpoints live (auth, chat, curriculum, lesson, progress, practice, tools, path, jobs)
- No `/api/cognitive/*` or `/api/journey/*` endpoints yet (expected — Iteration 1)
- All existing features reportedly working (auth, onboarding, curriculum, lessons, chat, practice)

## Critical Finding: Shared Context Is Inaccurate
The `shared-context.md` claims **48 backend pytest tests** and **21 E2E tests passing** — these **do not exist**. The reviewer report (first run, 2026-06-11T23:02) confirmed:

| Claim in shared-context | Reality |
|---|---|
| Backend pytest: 48 tests passing | ❌ Zero test files in `server-python/`. Only `main.py` exists |
| E2E tests: 21 tests passing | ❌ Only `screenshot-test.mjs` (screenshot capture, no assertions) |
| Frontend vitest: not set up | ✅ Correct — not in `package.json` |
| CI pipeline: not set up | ⚠️ Two CI workflows exist but only build+deploy, no test steps |

**Action:** Updated `shared-context.md` to reflect actual state.

## Previous Work Review
### From Tester Report:
- No test report exists — this is the first PO run, pipeline is cold
### From Reviewer Report:
- Pipeline has never been kicked off — no handoff files existed before this one
- Repo state audited: `routine-team-ai` branch is identical to `main` (0 commits ahead)
- No test infrastructure of any kind present

## Gaps Found (Iteration 0 vs Spec)
1. **No pytest suite** — `server-python/tests/` does not exist. Implementation plan calls for 5 test files: `conftest.py`, `test_auth.py`, `test_curriculum.py`, `test_progress.py`, `test_health.py`, `test_chat.py`
2. **No vitest** — not in `package.json` devDependencies. Plan calls for `setup.js`, `test_routing.test.jsx`, `test_auth_flow.test.jsx`
3. **No E2E test script** — `scripts/e2e_test.sh` does not exist. Plan calls for curl-based signup→login→onboard→curriculum→lesson→progress flow
4. **No test CI workflow** — `.github/workflows/test.yml` does not exist. Plan calls for pytest + vitest + e2e on every push

## Acceptance Criteria for Iteration 0 (Next Chunk)
These are ordered by priority — backend tests first, then frontend, then E2E, then CI.

### Chunk A: Backend pytest suite
1. [ ] `server-python/tests/conftest.py` exists with shared fixtures (test DB, authenticated test client)
2. [ ] `server-python/tests/test_health.py` — tests `GET /api/health` returns 200 with `{"status":"ok"}`
3. [ ] `server-python/tests/test_auth.py` — tests signup, login, `/api/auth/me`, profile update, email verification, password reset (minimum 10 test functions)
4. [ ] `server-python/tests/test_curriculum.py` — tests `GET /api/curriculum` and `PUT /api/curriculum` (authenticated)
5. [ ] `server-python/tests/test_progress.py` — tests lesson completion, questions, and summary endpoints
6. [ ] `server-python/tests/test_chat.py` — tests message sending, session listing, and history retrieval
7. [ ] `pytest` runs cleanly from `server-python/` with all tests passing (target: 30+ tests)
8. [ ] `pytest` is added to `server-python/requirements.txt`

### Chunk B: Frontend vitest harness
9. [ ] `vitest` added to `package.json` devDependencies
10. [ ] `src/tests/setup.js` exists with jsdom environment config
11. [ ] `vitest.config.js` or `vite.config.js` updated with test configuration
12. [ ] `src/tests/test_routing.test.jsx` — smoke test: all routes render correct components (minimum 5 route tests)
13. [ ] `npm test` runs from repo root with all vitest tests passing

### Chunk C: E2E test script
14. [ ] `scripts/e2e_test.sh` exists and is executable
15. [ ] Script tests full flow: signup → login → onboarding → curriculum → lesson → progress against live API
16. [ ] Script exits 0 on all-pass, non-zero on any failure
17. [ ] Script output shows pass/fail per step with clear labels

### Chunk D: CI pipeline
18. [ ] `.github/workflows/test.yml` exists
19. [ ] Workflow triggers on push to `main` and `routine-team-ai` branches, and on PRs
20. [ ] Workflow runs `pytest` in backend step
21. [ ] Workflow runs `vitest` in frontend step
22. [ ] Workflow runs E2E test against staging or uses service containers

## Bugs to Fix
- No bugs to report — existing features are functional. The gap is entirely missing test infrastructure.

## Iteration Status
- Current iteration: **in-progress** (0% — none of the 4 checkboxes are actually complete)
- Iteration 0 cannot advance until all 4 items are done
- **Correction applied:** iteration.md progress checkboxes were erroneously marked as done for pytest and E2E — these are now correctly marked as incomplete

## Priority Order for Developer
1. **Backend pytest** (Chunks A) — highest value, covers the API layer that all future iterations depend on
2. **Frontend vitest** (Chunk B) — second priority, needed before we add new pages in Iteration 1
3. **E2E script** (Chunk C) — validates the full user journey end to end
4. **CI pipeline** (Chunk D) — last, wraps everything into automated gate

## Risks
- `server-python/main.py` is a monolith (300 lines) — test fixtures may need careful setup for DB mocking
- No separate database for testing — tests hitting production DB would be dangerous; developer should use a test DB or mocking
- E2E script needs real credentials; should use test accounts, not modify production data
