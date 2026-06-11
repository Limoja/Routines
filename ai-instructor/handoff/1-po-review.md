# PO Review — 2026-06-11 (Run 2)

## Current Iteration: 0 — Testing Foundation
## Pipeline Status: blocked

## Product Status
- API Health: **UP** — `/api/health` returns `{"status":"ok"}` at 2026-06-11T23:33Z
- Web: **UP** — returns 200 OK
- Auth endpoint verified: `POST /api/auth/signup` works end-to-end (returns JWT + user object)
- 35 API endpoints live (auth, chat, curriculum, lesson, progress, practice, tools, path, jobs)
- No `/api/cognitive/*` or `/api/journey/*` endpoints yet (expected — Iteration 1)
- All existing features reportedly working (auth, onboarding, curriculum, lessons, chat, practice)

## Pipeline Status: No Progress Since Run 1
This is the second PO run. The first PO review was written at 23:25Z. Since then:
- **No Developer report** — `handoff/3-dev-report.md` does not exist
- **No Tester report** — `handoff/4-test-report.md` does not exist
- **No code changes** — project repo (`routine-team-ai` branch) has 0 new commits since `d3fa0c0`
- **No test infrastructure created** — `server-python/tests/` still absent, no `scripts/e2e_test.sh`, no `vitest`, no `test.yml`

**The pipeline is stalled.** Developer and Tester have not run. This review reaffirms the acceptance criteria from Run 1 to unblock the next cycle.

## Previous Work Review
### From Tester Report:
- No test report exists — Tester has not run.
### From Reviewer Report (23:02Z):
- Confirmed repo state: zero test files, zero CI test steps
- `routine-team-ai` identical to `main` (0 commits ahead)
- Shared-context inaccuracies documented (now corrected)
### Gaps Found (unchanged):
1. No pytest suite — `server-python/tests/` does not exist
2. No vitest — not in `package.json` devDependencies
3. No E2E test script — `scripts/e2e_test.sh` does not exist
4. No test CI workflow — `.github/workflows/test.yml` does not exist

## Acceptance Criteria for Iteration 0 (Reaffirmed from Run 1)
**Priority order: backend tests first, then frontend, then E2E, then CI.**

### Chunk A: Backend pytest suite (HIGHEST PRIORITY — do this first)
1. [ ] `server-python/requirements.txt` includes `pytest` and `httpx`
2. [ ] `server-python/tests/conftest.py` exists with shared fixtures (FastAPI `TestClient`, mock DB or test DB)
3. [ ] `server-python/tests/test_health.py` — `GET /api/health` returns 200 with `{"status":"ok"}`
4. [ ] `server-python/tests/test_auth.py` — signup returns token+user, login returns token, `/api/auth/me` with valid token returns user, profile update works, invalid credentials rejected (minimum 10 test functions)
5. [ ] `server-python/tests/test_curriculum.py` — `GET /api/curriculum` returns data (authenticated), `PUT /api/curriculum` saves data (authenticated)
6. [ ] `server-python/tests/test_progress.py` — lesson completion, questions, and summary endpoints work (authenticated)
7. [ ] `server-python/tests/test_chat.py` — message sending, session listing, and history retrieval work (authenticated)
8. [ ] `pytest` runs from `server-python/` with all tests passing (target: 30+ tests)
9. [ ] Tests do NOT require live database — use mocking or test fixtures

### Chunk B: Frontend vitest harness
10. [ ] `vitest` + `@testing-library/react` + `jsdom` added to `package.json` devDependencies
11. [ ] `vitest.config.js` or `vite.config.js` includes test config with jsdom environment
12. [ ] `src/tests/setup.js` exists
13. [ ] `src/tests/test_routing.test.jsx` — smoke test: at least 5 routes render without crashing
14. [ ] `npm test` runs from repo root with all vitest tests passing

### Chunk C: E2E test script
15. [ ] `scripts/e2e_test.sh` exists and is executable (`chmod +x`)
16. [ ] Script tests full flow: signup → login → onboarding → curriculum → lesson → progress against live API URL (configurable via env var `API_URL`)
17. [ ] Script exits 0 on all-pass, non-zero on any failure
18. [ ] Script output shows pass/fail per step with clear labels

### Chunk D: CI pipeline
19. [ ] `.github/workflows/test.yml` exists
20. [ ] Workflow triggers on push to `main` and `routine-team-ai` branches, and on PRs
21. [ ] Workflow runs `pytest` in backend step
22. [ ] Workflow runs `vitest` in frontend step

## Bugs to Fix
- No bugs found in existing features — API and web are functioning correctly.
- The gap is **entirely missing test infrastructure**, not broken functionality.

## Iteration Status
- Current iteration: **in-progress** (0% — nothing built yet)
- Cannot advance to Iteration 1 until all 4 Iteration 0 items are complete
- **URGENT:** Pipeline must reach Developer this cycle. Developer should start with Chunk A immediately.

## Decisions Needed
1. **Test DB strategy** — Developer must decide: mock DB calls in tests, or spin up test PostgreSQL? Recommendation: **mock for speed and simplicity**. `server-python/main.py` is 300 lines — manageable to mock.
2. **E2E target** — Should `e2e_test.sh` hit production API or local? Recommendation: **configurable via `API_URL` env var, default to production**.
3. **Test accounts** — E2E tests need real credentials. Create test-specific accounts (e.g., `e2e-test-<timestamp>@test.com`).
