# Design Plan — 2026-06-11

## Target Iteration: 0 — Testing Foundation
## Based on PO Review: 2026-06-11 (Run 2)

## Summary
Create the complete test infrastructure layer for AI Instructor: backend pytest suite (30+ tests with mocked DB), frontend vitest harness with route smoke tests, a curl-based E2E script, and a CI workflow. No application code changes — only test files and CI config.

## Architecture Context

The backend is a **monolith FastAPI app** (`server-python/main.py`, ~300 lines) that delegates to **Lambda handlers** (`infra/lambda/{module}/handler.py`). Each handler is a plain function `handler(event, context)` that:
- Receives a synthetic "API Gateway event" dict (built by `_make_event()`)
- Calls `shared.db.query()` for DB access
- Returns `{statusCode, headers, body}` dicts via `shared.response` helpers

**Mocking strategy**: Patch `shared.db.query` to return controlled data. No real DB needed. The `shared.db` module uses a global `_pool` connection — we bypass it entirely.

**JWT strategy**: Set `JWT_SECRET` env var in test fixtures. Use `shared.jwt_auth.sign_token()` to create valid tokens for authenticated endpoints.

---

## Chunk A: Backend pytest suite (CRITERIA 1–9)

### New Files

#### `server-python/requirements.txt` — MODIFIED
Add to existing:
```
pytest==8.3.4
httpx==0.28.1
```

#### `server-python/tests/__init__.py` — NEW
Empty file to make `tests/` a Python package.

#### `server-python/tests/conftest.py` — NEW
Shared fixtures for all test files:
```python
import os, sys, pytest, json
from unittest.mock import patch, MagicMock

# Ensure infra/lambda is on sys.path so `from shared.db import query` works
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'infra', 'lambda'))

# Set required env vars before importing app modules
os.environ.setdefault('JWT_SECRET', 'test-secret-key-for-pytest')
os.environ.setdefault('DB_HOST', 'localhost')
os.environ.setdefault('DB_NAME', 'test_db')
os.environ.setdefault('DB_USER', 'test')
os.environ.setdefault('DB_PASSWORD', 'test')
os.environ.setdefault('CORS_ORIGIN', 'http://localhost:5173')

from fastapi.testclient import TestClient
from main import app

@pytest.fixture
def client():
    """FastAPI TestClient — does NOT go through real DB."""
    return TestClient(app)

@pytest.fixture
def mock_query():
    """Patch shared.db.query globally. Returns (mock, cleanup_fn).
    Usage: mock_query.return_value = [{'id': 1, ...}]
    """
    with patch('shared.db.query') as m:
        yield m

@pytest.fixture
def auth_token():
    """Create a valid JWT for user_id='test-user-123'."""
    from shared.jwt_auth import sign_token
    return sign_token('test-user-123')

@pytest.fixture
def auth_headers(auth_token):
    """Authorization header dict with a valid Bearer token."""
    return {'Authorization': f'Bearer {auth_token}'}

@pytest.fixture
def mock_email(monkeypatch):
    """Suppress all email sending during tests."""
    with patch('shared.email_service.send_verification_email', return_value={'MessageId': 'test'}):
        with patch('shared.email_service.send_welcome_email', return_value={'MessageId': 'test'}):
            with patch('shared.email_service.send_password_reset_email', return_value={'MessageId': 'test'}):
                with patch('shared.email_service.log_email', return_value=None):
                    yield
```

**Key design decisions:**
- `sys.path` manipulation lets test files import from `infra/lambda/` (where `shared/` lives)
- `mock_query` patches `shared.db.query` — every handler calls this, so one patch covers all DB access
- `mock_email` prevents SES calls during signup/forgot-password tests
- `auth_token` uses the real `sign_token()` with the test secret — tests verify JWT validation works correctly

---

#### `server-python/tests/test_health.py` — NEW
Tests: 1 function

| Test Function | What It Verifies |
|---|---|
| `test_health_returns_ok` | `GET /api/health` → 200, body `{"status":"ok"}` |

No mocking needed — health endpoint is pure logic (no DB, no auth).

---

#### `server-python/tests/test_auth.py` — NEW
Tests: 10+ functions

| Test Function | Endpoint | Mock Setup | Expected Result |
|---|---|---|---|
| `test_signup_success` | `POST /api/auth/signup` | `mock_query` returns empty for user lookup, then returns `[{id, email, name}]` for insert | 200, body has `token` + `user` |
| `test_signup_missing_email` | `POST /api/auth/signup` | body `{password: "x"}` | 400 |
| `test_signup_missing_password` | `POST /api/auth/signup` | body `{email: "x@y.com"}` | 400 |
| `test_signup_short_password` | `POST /api/auth/signup` | body `{email: "x@y.com", password: "short"}` | 400, "at least 8 characters" |
| `test_signup_duplicate_email` | `POST /api/auth/signup` | `mock_query` returns existing user on first call | 400, "already registered" |
| `test_login_success` | `POST /api/auth/login` | `mock_query` returns user with bcrypt hash; mock `bcrypt.checkpw` → True | 200, body has `token` + `user` |
| `test_login_wrong_password` | `POST /api/auth/login` | `mock_query` returns user; mock `bcrypt.checkpw` → False | 401 |
| `test_login_nonexistent_user` | `POST /api/auth/login` | `mock_query` returns `[]` | 401 |
| `test_me_with_valid_token` | `GET /api/auth/me` | `mock_query` returns user row + profile row | 200, body has `user` + `profile` |
| `test_me_without_token` | `GET /api/auth/me` | no auth header | 401 |
| `test_profile_update` | `PUT /api/auth/profile` | `mock_query` returns updated profile | 200, body has `profile` |
| `test_verify_email_valid_token` | `GET /api/auth/verify-email?token=abc` | `mock_query` returns valid token row | 200 |
| `test_verify_email_invalid_token` | `GET /api/auth/verify-email?token=bad` | `mock_query` returns `[]` | 400 |

**Mocking strategy for auth tests:**
- `bcrypt.hashpw` / `bcrypt.checkpw` — mock to avoid expensive hashing in tests
- `shared.db.query` — return appropriate rows per test case
- Email functions — suppressed via `mock_email` fixture
- The `_make_event()` in `main.py` converts FastAPI requests to Lambda events, but tests go through the FastAPI routes directly (via `TestClient`), so auth header handling is tested end-to-end

---

#### `server-python/tests/test_curriculum.py` — NEW
Tests: 3+ functions

| Test Function | Endpoint | Mock Setup | Expected |
|---|---|---|---|
| `test_save_curriculum` | `PUT /api/curriculum` | `mock_query` returns `[{id: 1}]` | 200, `{id: "1"}` |
| `test_save_curriculum_empty_data` | `PUT /api/curriculum` | body `{}` | 400 |
| `test_load_curriculum` | `GET /api/curriculum` | `mock_query` returns curriculum data with chapters/lessons | 200, body has `curriculum` with progress merged |
| `test_load_curriculum_none` | `GET /api/curriculum` | `mock_query` returns `[]` | 200, `{curriculum: null}` |

---

#### `server-python/tests/test_progress.py` — NEW
Tests: 4+ functions

| Test Function | Endpoint | Mock Setup | Expected |
|---|---|---|---|
| `test_complete_lesson` | `POST /api/progress/lesson` | `mock_query` returns progress row | 200, body has `progress` |
| `test_complete_lesson_missing_fields` | `POST /api/progress/lesson` | body `{}` | 400 |
| `test_save_questions` | `POST /api/progress/questions` | `mock_query` returns attempt data | 200, `{saved: N}` |
| `test_save_questions_empty` | `POST /api/progress/questions` | body `{chapter_id: "c", lesson_id: "l", answers: []}` | 400 |
| `test_progress_summary` | `GET /api/progress/summary` | `mock_query` returns lessons, weak areas, stats | 200, body has `lessons`, `weak_areas`, `stats` |

---

#### `server-python/tests/test_chat.py` — NEW
Tests: 4+ functions

| Test Function | Endpoint | Mock Setup | Expected |
|---|---|---|---|
| `test_list_sessions` | `GET /api/chat/sessions` | `mock_query` returns session list | 200, `{sessions: [...]}` |
| `test_get_history` | `GET /api/chat/history?session_id=abc` | `mock_query` returns messages | 200, `{messages: [...]}` |
| `test_get_history_missing_session` | `GET /api/chat/history` | no query param | 400 |
| `test_send_message` | `POST /api/chat/message` | mock `_get_clients` + `traced_completion` + `mock_query` | 200, body has `message` + `session_id` |
| `test_send_message_empty` | `POST /api/chat/message` | body `{}` | 400 |

**Special mock for chat tests:**
- Chat handler calls `_get_clients()` which initializes OpenAI, Langfuse, FalkorDB — all must be mocked
- Patch `chat.handler._get_clients` to return mock objects
- Patch `chat.handler.traced_completion` to return a fake LLM response
- Patch `falkor.get_relevant_context` and `falkor.store_conversation_topic` (non-fatal, but suppress errors)

---

## Chunk B: Frontend vitest harness (CRITERIA 10–14)

### Modified Files

#### `package.json` — MODIFIED
Add to `devDependencies`:
```json
"vitest": "^3.2.1",
"@testing-library/react": "^16.2.0",
"jsdom": "^26.1.0"
```
Add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

#### `vite.config.js` — MODIFIED
Add test configuration:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/tests/setup.js',
    globals: true,
  },
})
```

### New Files

#### `src/tests/setup.js` — NEW
```js
// Mock localStorage for jsdom
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.localStorage = localStorageMock

// Mock fetch for API calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
  })
)
```

#### `src/tests/test_routing.test.jsx` — NEW
Tests: 6+ functions (at least 5 routes rendering without crash as per AC)

Routes to test (public ones don't need auth context):
| Test Function | Route | Component | Notes |
|---|---|---|---|
| `test_home_page_renders` | `/` | Home | Public route |
| `test_login_page_renders` | `/login` | Login | Wrapped in RedirectIfAuth |
| `test_signup_page_renders` | `/signup` | Signup | Wrapped in RedirectIfAuth |
| `test_about_page_renders` | `/about` | About | Public route |
| `test_not_found_renders` | `/nonexistent` | NotFound | Catch-all route |
| `test_courses_page_renders` | `/courses` | Courses | Public route |

**Test approach:** Use `@testing-library/react`'s `render()` with a `MemoryRouter` wrapping. Mock `UserContext` to provide `authLoading: false, authUser: null` (or a test user for protected routes). Assert the component doesn't throw and contains expected text/elements.

```jsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import Home from '../pages/Home'
// ... other imports

// Mock UserContext
const mockContext = {
  authUser: null,
  authLoading: false,
  signupUser: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  // ... other context values
}

function renderWithRouter(route, { authUser = null } = {}) {
  const ctx = { ...mockContext, authUser }
  return render(
    <MemoryRouter initialEntries={[route]}>
      <UserContext.Provider value={ctx}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          {/* ... other routes */}
        </Routes>
      </UserContext.Provider>
    </MemoryRouter>
  )
}

describe('Route smoke tests', () => {
  it('renders Home page', () => { renderWithRouter('/'); expect(document.body).toBeDefined() })
  // ...
})
```

---

## Chunk C: E2E test script (CRITERIA 15–18)

### New Files

#### `scripts/e2e_test.sh` — NEW (executable)

```bash
#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-https://ai-inst-production-api.blackrock-3f2021d2.ukwest.azurecontainerapps.io}"
TIMESTAMP=$(date +%s)
TEST_EMAIL="e2e-test-${TIMESTAMP}@test.com"
TEST_PASSWORD="TestPass123!"
TEST_NAME="E2E Test User"

PASS=0
FAIL=0
STEPS=()

step() {
  local label="$1"
  local result="$2"  # PASS or FAIL
  STEPS+=("[$result] $label")
  if [ "$result" = "PASS" ]; then ((PASS++)); else ((FAIL++)); fi
}

# ── Step 1: Health Check ────────────────────
echo "Step 1: Health check..."
STATUS=$(curl -sf "$API_URL/api/health" | jq -r '.status')
if [ "$STATUS" = "ok" ]; then step "Health check" "PASS"; else step "Health check" "FAIL"; fi

# ── Step 2: Signup ──────────────────────────
echo "Step 2: Signup..."
SIGNUP_RESP=$(curl -sf -X POST "$API_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"name\":\"$TEST_NAME\"}")
TOKEN=$(echo "$SIGNUP_RESP" | jq -r '.token')
if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then step "Signup" "PASS"; else step "Signup" "FAIL"; fi

# ── Step 3: Login ───────────────────────────
echo "Step 3: Login..."
LOGIN_RESP=$(curl -sf -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")
LOGIN_TOKEN=$(echo "$LOGIN_RESP" | jq -r '.token')
if [ "$LOGIN_TOKEN" != "null" ] && [ -n "$LOGIN_TOKEN" ]; then step "Login" "PASS"; else step "Login" "FAIL"; fi
# Use login token for subsequent requests
TOKEN="$LOGIN_TOKEN"

# ── Step 4: Get Profile (auth/me) ───────────
echo "Step 4: Get profile..."
ME_RESP=$(curl -sf "$API_URL/api/auth/me" -H "Authorization: Bearer $TOKEN")
ME_EMAIL=$(echo "$ME_RESP" | jq -r '.user.email')
if [ "$ME_EMAIL" = "$TEST_EMAIL" ]; then step "Get profile" "PASS"; else step "Get profile" "FAIL"; fi

# ── Step 5: Save Profile (onboarding) ───────
echo "Step 5: Save profile..."
PROFILE_RESP=$(curl -sf -X PUT "$API_URL/api/auth/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"role":"developer","ai_level":"beginner","job_title":"E2E Tester"}')
if echo "$PROFILE_RESP" | jq -e '.profile' > /dev/null 2>&1; then step "Save profile" "PASS"; else step "Save profile" "FAIL"; fi

# ── Step 6: Save Curriculum ─────────────────
echo "Step 6: Save curriculum..."
CUR_RESP=$(curl -sf -X PUT "$API_URL/api/curriculum" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"curriculum":{"title":"E2E Test Curriculum","chapters":[{"id":"ch1","title":"Chapter 1","lessons":[{"id":"l1","title":"Lesson 1"}]}]}}')
if echo "$CUR_RESP" | jq -e '.id' > /dev/null 2>&1; then step "Save curriculum" "PASS"; else step "Save curriculum" "FAIL"; fi

# ── Step 7: Load Curriculum ─────────────────
echo "Step 7: Load curriculum..."
LOAD_CUR=$(curl -sf "$API_URL/api/curriculum" -H "Authorization: Bearer $TOKEN")
if echo "$LOAD_CUR" | jq -e '.curriculum.title' > /dev/null 2>&1; then step "Load curriculum" "PASS"; else step "Load curriculum" "FAIL"; fi

# ── Step 8: Complete Lesson ─────────────────
echo "Step 8: Complete lesson..."
LESSON_RESP=$(curl -sf -X POST "$API_URL/api/progress/lesson" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"chapter_id":"ch1","lesson_id":"l1","score":85,"total_questions":5,"correct_answers":4}')
if echo "$LESSON_RESP" | jq -e '.progress' > /dev/null 2>&1; then step "Complete lesson" "PASS"; else step "Complete lesson" "FAIL"; fi

# ── Step 9: Progress Summary ────────────────
echo "Step 9: Progress summary..."
SUMMARY_RESP=$(curl -sf "$API_URL/api/progress/summary" -H "Authorization: Bearer $TOKEN")
if echo "$SUMMARY_RESP" | jq -e '.stats' > /dev/null 2>&1; then step "Progress summary" "PASS"; else step "Progress summary" "FAIL"; fi

# ── Step 10: Chat Sessions ──────────────────
echo "Step 10: Chat sessions..."
SESSIONS_RESP=$(curl -sf "$API_URL/api/chat/sessions" -H "Authorization: Bearer $TOKEN")
if echo "$SESSIONS_RESP" | jq -e '.sessions' > /dev/null 2>&1; then step "Chat sessions" "PASS"; else step "Chat sessions" "FAIL"; fi

# ── Results ─────────────────────────────────
echo ""
echo "═══════════════════════════════════════"
echo "  E2E Test Results"
echo "═══════════════════════════════════════"
for s in "${STEPS[@]}"; do echo "  $s"; done
echo "───────────────────────────────────────"
echo "  Total: $((PASS + FAIL))  Passed: $PASS  Failed: $FAIL"
echo "═══════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then exit 1; else exit 0; fi
```

**Design decisions:**
- Uses `curl` + `jq` — no dependencies beyond standard Linux tools
- `API_URL` configurable via env var (default: production)
- Unique test email per run using timestamp
- 10 steps covering the full flow: health → signup → login → me → profile → curriculum save/load → lesson → progress → chat
- Each step labeled PASS/FAIL
- Exit 0 on all pass, exit 1 on any failure

---

## Chunk D: CI pipeline (CRITERIA 19–22)

### New Files

#### `.github/workflows/test.yml` — NEW

```yaml
name: Run Tests

on:
  push:
    branches: [main, routine-team-ai]
  pull_request:
    branches: [main]

jobs:
  backend-tests:
    name: Backend (pytest)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: server-python
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python 3.12
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: pip
          cache-dependency-path: server-python/requirements.txt

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Run pytest
        env:
          JWT_SECRET: ci-test-secret
        run: python -m pytest tests/ -v --tb=short

  frontend-tests:
    name: Frontend (vitest)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run vitest
        run: npm test
```

**Design decisions:**
- Two parallel jobs — backend and frontend run independently for speed
- Backend sets `JWT_SECRET` env var (required by `jwt_auth.py`)
- Frontend uses `npm ci` for deterministic installs
- Triggers on push to `main` and `routine-team-ai` (the work branch), plus PRs
- Does NOT include E2E in CI (E2E hits live API — run manually or in separate scheduled job)

---

## Implementation Order

1. **`server-python/requirements.txt`** — add pytest + httpx
2. **`server-python/tests/__init__.py`** — create package marker
3. **`server-python/tests/conftest.py`** — shared fixtures (mock_query, auth_token, mock_email)
4. **`server-python/tests/test_health.py`** — 1 test, no mocking (quickest win)
5. **`server-python/tests/test_auth.py`** — 10+ tests, heavy mocking
6. **`server-python/tests/test_curriculum.py`** — 3+ tests, moderate mocking
7. **`server-python/tests/test_progress.py`** — 4+ tests, moderate mocking
8. **`server-python/tests/test_chat.py`** — 4+ tests, complex mocking (LLM, FalkorDB)
9. **Run `pytest` from `server-python/`** — verify 30+ tests pass
10. **`package.json`** — add vitest, @testing-library/react, jsdom, test scripts
11. **`vite.config.js`** — add test config with jsdom
12. **`src/tests/setup.js`** — mock localStorage + fetch
13. **`src/tests/test_routing.test.jsx`** — 6 route smoke tests
14. **Run `npm test`** — verify all vitest tests pass
15. **`scripts/e2e_test.sh`** — create and chmod +x
16. **Run e2e_test.sh** — verify against production API
17. **`.github/workflows/test.yml`** — create CI workflow
18. **Commit all files, push to `routine-team-ai`**

---

## Mocking Reference

### `shared.db.query` mock patterns

Every Lambda handler calls `query(sql, params)` and gets back a list of `RealDictCursor` rows (plain dicts). Mock return values:

```python
# For SELECT that returns rows
mock_query.return_value = [{'id': 1, 'email': 'test@test.com', 'name': 'Test'}]

# For SELECT that returns nothing
mock_query.return_value = []

# For INSERT ... RETURNING
mock_query.return_value = [{'id': 1}]

# For queries called multiple times with different SQL
mock_query.side_effect = [
    [],                          # 1st call: SELECT user lookup
    [{'id': 1, 'email': 'x'}],  # 2nd call: INSERT user
    [],                          # 3rd call: INSERT profile
    [],                          # 4th call: INSERT notification prefs
    [{'id': 1}],                 # 5th call: INSERT email token
]
```

### `bcrypt` mock pattern
```python
with patch('bcrypt.hashpw', return_value=b'hashed'):
    with patch('bcrypt.checkpw', return_value=True):
        # run test
```

### Chat handler mock pattern
```python
with patch('chat.handler._get_clients') as mock_clients:
    mock_openai = MagicMock()
    mock_langfuse = MagicMock()
    mock_falkor = MagicMock()
    mock_falkor.get_relevant_context.return_value = []
    mock_falkor.store_conversation_topic.return_value = None
    mock_clients.return_value = (mock_openai, mock_langfuse, mock_falkor)

    with patch('chat.handler.traced_completion') as mock_llm:
        mock_llm.return_value = {
            'choices': [{'message': {'content': 'Test response'}}],
            'model': 'test', 'usage': {'total_tokens': 10}
        }
        # run test
```

---

## Testing Notes for Tester

### Backend Tests
- Run from `server-python/` directory: `python -m pytest tests/ -v`
- All 30+ tests should pass without any database connection
- If `ModuleNotFoundError: No module named 'shared'`, check `conftest.py` sys.path setup
- If `JWT_SECRET` errors, check env var is set in conftest

### Frontend Tests
- Run from repo root: `npm test`
- If `jsdom` errors, verify `@testing-library/react` and `jsdom` are in devDependencies
- Route smoke tests should render 6 pages without crash
- Tests mock `UserContext` — no real API calls

### E2E Tests
- Run: `API_URL=https://... ./scripts/e2e_test.sh`
- Default target is production API
- Requires `curl` and `jq` on PATH
- Creates a real user account each run (uses timestamp-based email)
- All 10 steps should pass

### CI Pipeline
- Triggers on push to `main` or `routine-team-ai`
- Backend job: sets up Python 3.12, installs deps, runs pytest
- Frontend job: sets up Node 20, installs deps, runs vitest
- Both jobs run in parallel

### Edge Cases to Verify
- Signup with duplicate email returns 400 (not 500)
- Login with wrong password returns 401 (not 500)
- Auth endpoints without token return 401
- Curriculum load with no data returns `{curriculum: null}` (not 404)
- Progress summary with no data returns empty arrays (not 404)
