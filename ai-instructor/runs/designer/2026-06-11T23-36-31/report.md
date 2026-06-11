# Designer Run Report — 2026-06-11T23:36:31

## What I Did

### Context Gathered
Read and analyzed all relevant source files to produce a detailed implementation plan:
- `server-python/main.py` (300-line FastAPI monolith — all 35 endpoints)
- `infra/lambda/` handlers: auth, curriculum, progress, chat (core test targets)
- `infra/lambda/shared/` modules: db.py, jwt_auth.py, response.py (mocking targets)
- `src/App.jsx` (20 routes, RequireAuth/RedirectIfAuth wrappers)
- `src/context/UserContext.jsx` (auth state, onboarding, curriculum)
- `src/api.js` (all API client functions)
- `vite.config.js`, `package.json` (frontend build config)
- `.github/workflows/` (existing CI — deploy-only, no tests)
- `docs/AIInstructor-IMPLEMENTATION-PLAN.md` (Iteration 0 spec)
- `handoff/1-po-review.md` (PO acceptance criteria — 22 criteria in 4 chunks)
- `iteration.md` (Iteration 0, in-progress)

### Output Produced
- **`handoff/2-design-plan.md`** — Complete design plan for Iteration 0 with:
  - 6 new backend test files with 30+ test functions fully specified
  - Mocking strategy: patch `shared.db.query` globally (no real DB needed)
  - 3 new frontend test files with 6 route smoke tests
  - 1 E2E shell script with 10 test steps
  - 1 CI workflow (parallel backend + frontend jobs)
  - Implementation order (18 steps)
  - Testing notes for the Tester

### Files Specified for Creation/Modification

| File | Action | Purpose |
|------|--------|---------|
| `server-python/requirements.txt` | MODIFY | Add pytest + httpx |
| `server-python/tests/__init__.py` | CREATE | Package marker |
| `server-python/tests/conftest.py` | CREATE | Shared fixtures (mock_query, auth_token, mock_email) |
| `server-python/tests/test_health.py` | CREATE | 1 test — health endpoint |
| `server-python/tests/test_auth.py` | CREATE | 10+ tests — signup/login/me/profile/verify |
| `server-python/tests/test_curriculum.py` | CREATE | 3+ tests — save/load curriculum |
| `server-python/tests/test_progress.py` | CREATE | 4+ tests — lesson/questions/summary |
| `server-python/tests/test_chat.py` | CREATE | 4+ tests — sessions/history/message |
| `package.json` | MODIFY | Add vitest, @testing-library/react, jsdom |
| `vite.config.js` | MODIFY | Add test config with jsdom |
| `src/tests/setup.js` | CREATE | Mock localStorage + fetch |
| `src/tests/test_routing.test.jsx` | CREATE | 6 route smoke tests |
| `scripts/e2e_test.sh` | CREATE | 10-step curl-based E2E |
| `.github/workflows/test.yml` | CREATE | CI: pytest + vitest in parallel |

## Test Results
No tests were run during this design phase. Tests will be implemented by the Developer.

## Screenshot Evidence
N/A — this was a design/planning task with no code changes.

## What the NEXT Run Should Do (Developer)

### Priority 1: Backend pytest (Chunk A)
1. Add `pytest` and `httpx` to `server-python/requirements.txt`
2. Create `server-python/tests/__init__.py` (empty)
3. Create `server-python/tests/conftest.py` — follow the exact fixture specs in the design plan:
   - `sys.path` manipulation for `infra/lambda` imports
   - `client` fixture (FastAPI TestClient)
   - `mock_query` fixture (patches `shared.db.query`)
   - `auth_token` + `auth_headers` fixtures
   - `mock_email` fixture
4. Create `server-python/tests/test_health.py` — 1 test (quick win)
5. Create `server-python/tests/test_auth.py` — 10+ tests (see table in design plan)
6. Create `server-python/tests/test_curriculum.py` — 3+ tests
7. Create `server-python/tests/test_progress.py` — 4+ tests
8. Create `server-python/tests/test_chat.py` — 4+ tests (complex — mock LLM/FalkorDB)
9. Run `cd server-python && python -m pytest tests/ -v` — verify 30+ pass

### Priority 2: Frontend vitest (Chunk B)
10. Update `package.json` — add vitest, @testing-library/react, jsdom + test scripts
11. Update `vite.config.js` — add `test` block
12. Create `src/tests/setup.js`
13. Create `src/tests/test_routing.test.jsx` — 6 route smoke tests
14. Run `npm test` — verify all pass

### Priority 3: E2E + CI (Chunks C & D)
15. Create `scripts/e2e_test.sh` — chmod +x, run against production
16. Create `.github/workflows/test.yml`
17. Commit all files, push to `routine-team-ai`

## Blockers / Decisions Needed
- **None identified.** The design plan provides complete specifications for all files. The Developer can execute without ambiguity.
- The PO already decided: mock DB (no test PostgreSQL), configurable E2E URL, timestamp-based test accounts.
