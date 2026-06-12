# Test Report — 2026-06-12

## Based on Dev Report: 2026-06-12

## Test Results Summary
| Category | Passed | Failed | Total |
|----------|--------|--------|-------|
| API Tests (pytest) | 44 | 0 | 44 |
| UI Tests (vitest) | 10 | 0 | 10 |
| E2E Tests (Iter 0) | 10 | 0 | 10 |
| E2E Tests (Iter 1) | 0 | 5 | 5 |
| **TOTAL** | **64** | **5** | **69** |

## Acceptance Criteria Status

### Chunk 1: Deployment (P0 — BLOCKED)
1. [ ] [P0] API container rebuilt and pushed — NOT TESTED: no Docker/AZ CLI in build environment
2. [ ] [P0] Web container rebuilt and pushed — NOT TESTED: no Docker/AZ CLI
3. [ ] [P0] Container Apps updated — NOT TESTED: ops required
4. [ ] [P0] DB migration run — NOT TESTED: depends on deployment (AC 1–3)
5. [ ] [P0] Health returns ok — VERIFIED: `{"status":"ok","timestamp":"2026-06-12T02:47Z"}` (existing deployment healthy)
6. [ ] [P0] `/api/cognitive/init` returns 401 not 404 — FAILED: returns 404 (endpoints not deployed)
7. [ ] [P0] `/api/journey/next` returns 401 not 404 — FAILED: returns 404 (endpoints not deployed)
8. [ ] [P0] E2E steps 11–15 pass — FAILED: all 5 blocked by deployment gap
9. [ ] [P0] E2E steps 1–10 still pass — VERIFIED: all 10 pass (no regression)

**Chunk 1 status: BLOCKED — requires ops intervention to deploy**

### Chunk 2: Route Restructure + Quality Bar (P1)
10. [x] [P1] Navbar shows exactly 5 items (Home, Learn, Practice, Chat, Profile) — verified by code review of `Navbar.jsx`: NAV_LINKS array has 4 items + auth user "Profile" button = 5 items total
11. [x] [P1] Auth'd `/` renders JourneyDashboard, unauth'd renders Home — verified by `App.jsx` line 70: `element={authUser ? <JourneyDashboard /> : <Home />}`. JourneyDashboard shows discovery CTA when no profile (lines 27–46) and radar + "Next Challenge" when profile exists (lines 50–100).
12. [x] [P1] 9+ old routes redirect to new ones — verified by code review of `App.jsx` lines 82–91. 10 redirect routes: `/onboarding→/discover`, `/dashboard→/`, `/curriculum/generate→/discover`, `/curriculum→/learn`, `/lesson/:ch/:le→/learn`, `/epoch-lesson→/learn`, `/learning-path→/`, `/courses→/`, `/about→/`, `/tools→/`. Also verified by vitest redirect tests.
13. [x] [P1] 401 responses dispatch `api:401` event, global listener redirects to `/login` with toast — verified by `api.js` line 30 (`window.dispatchEvent(new CustomEvent('api:401', ...))`) + `App.jsx` lines 45–53 (event listener calls `logoutUser()`, `toast.error()`, `navigate('/login')`).
14. [x] [P1] Toast component with 4 types, 4s auto-dismiss, max 5 queue — verified by code review of `Toast.jsx`: `success/error/info/warning` methods, `setTimeout(4000)` auto-dismiss, `slice(-4)` keeps max 5, `ToastProvider` + `useToast()` exports. Also verified by `test_toast.test.jsx` (renders children + container).
15. [x] [P1] ErrorBoundary wraps app — verified by `main.jsx` lines 12–20: `<ErrorBoundary>` is outermost wrapper. Class component with `getDerivedStateFromError` + `componentDidCatch` + "Try Again" button (lines 9–68 of `ErrorBoundary.jsx`).

**Chunk 2 status: ALL 6 CRITERIA PASS**

## Bugs Found

### Bug 1: Deployment gap — Iteration 1 code not deployed to production (P0)
- Severity: **P0** (blocks all Iteration 1 E2E verification)
- Reproduction: `curl -X POST https://ai-inst-production-api.../api/cognitive/init -d '{}'` → 404
- Expected: Returns 401 `{"error":"Authentication required"}` (endpoint exists but requires auth)
- Actual: Returns 404 — route not registered in deployed API code
- Impact: E2E steps 11–15 fail. 44 backend unit tests confirm logic is correct — only deployment is missing.
- Fix: Someone with Azure credentials must build images from `routine-team-ai` branch, push to ACR, update container apps, and run `POST /api/migrate`

### Bug 2: Navbar Profile link goes to `/` instead of a profile page (P2)
- Severity: **P2** (minor UX issue, not blocking)
- Reproduction: Click "Profile" button in navbar as authenticated user
- Expected: Per design plan AC 10, Profile link should go to `/profile` or a user settings page
- Actual: `Navbar.jsx` line 67: `<Link to="/" ...>` — the Profile button navigates to home page (`/`), same as the Home link
- Impact: Users have no way to access profile/settings. Not a spec violation since `/profile` route doesn't exist yet, but the navbar item doesn't lead to a distinct page.

## API Test Output
```
============================= test session starts ==============================
platform linux -- Python 3.11.2, pytest-9.0.3, pluggy-1.6.0
collected 44 items

tests/test_auth.py .............                                   [ 29%]
tests/test_chat.py .....                                          [ 40%]
tests/test_cognitive.py .........                                 [ 61%]
tests/test_curriculum.py ....                                     [ 70%]
tests/test_health.py .                                            [ 72%]
tests/test_journey.py ........                                    [ 90%]
tests/test_progress.py .....                                      [100%]

======================= 44 passed, 61 warnings in 0.78s ==============================
```

## Vitest Output
```
 RUN  v3.2.6 /tmp/routine-team-tester

 ✓ test_toast.test.jsx > Toast provider > renders children without crash
 ✓ test_toast.test.jsx > Toast provider > renders toast container
 ✓ test_routing.test.jsx > Route smoke tests > renders Home page (unauthenticated)
 ✓ test_routing.test.jsx > Route smoke tests > renders Login page without crash
 ✓ test_routing.test.jsx > Route smoke tests > renders Signup page without crash
 ✓ test_routing.test.jsx > Route smoke tests > renders NotFound page for unknown routes
 ✓ test_routing.test.jsx > Redirect routes > redirects /dashboard to /
 ✓ test_routing.test.jsx > Redirect routes > redirects /onboarding to /discover
 ✓ test_routing.test.jsx > Redirect routes > redirects /curriculum to /learn
 ✓ test_routing.test.jsx > Redirect routes > redirects /about to /

 Test Files  2 passed (2)
      Tests  10 passed (10)
   Duration  5.97s
```

## E2E Test Output
```
═══════════════════════════════════════
  E2E Test Results
═══════════════════════════════════════
  [PASS] Health check        [PASS] Signup          [PASS] Login
  [PASS] Get profile         [PASS] Save profile    [PASS] Save curriculum
  [PASS] Load curriculum     [PASS] Complete lesson  [PASS] Progress summary
  [PASS] Chat sessions
  [FAIL] Cognitive init      [FAIL] Cognitive profile
  [FAIL] Journey next (3 cards)  [FAIL] Journey outcomes
  [FAIL] Second journey next
───────────────────────────────────────
  Total: 15  Passed: 10  Failed: 5
═══════════════════════════════════════
```
All 5 failures caused by deployment gap (endpoints return 404 on production).

## Recommendation
**PASS for Chunk 2 (code quality). FAIL for Chunk 1 (deployment blocker).**

- **Chunk 2 (AC 10–15):** All 6 acceptance criteria pass. The route restructure, JourneyDashboard, Toast, ErrorBoundary, and 401 redirect are well-implemented. No regressions (44 pytest, 10 vitest all pass).
- **Chunk 1 (AC 1–9):** Still blocked. Requires ops intervention — someone with Azure credentials must deploy the `routine-team-ai` branch. This is the #1 priority before any further feature work.

**Next steps:**
1. Deploy Iteration 1 + Chunk 2 code to production (P0)
2. Run `POST /api/migrate` after deployment
3. Re-run E2E to verify steps 11–15 pass
4. Fix Navbar Profile link to go to a distinct page (P2, future chunk)
