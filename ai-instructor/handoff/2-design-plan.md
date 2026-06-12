# Design Plan — 2026-06-12

## Based on PO Review: 2026-06-12
## Summary

**Two chunks:**

**Chunk 1 (P0) — Deploy Iteration 1 code to production.** The merged code at `3f69f75` has 44 pytest passing, 6 vitest passing, and all 42 acceptance criteria verified at code level. It must be deployed and the DB migration run before any new features are built. This is an ops task — no new code files, just build + push + migrate.

**Chunk 2 (P1) — Route restructure + JourneyDashboard + quality bar.** If deployment is blocked, build the next most impactful set: unify navigation to 5 items per spec H.1, make `/` the JourneyDashboard for auth'd users, redirect old routes, add global Toast and ErrorBoundary components, and add global 401 → `/login` redirect per B.3.

---

## Chunk 1: Deployment (P0 — AC 1–9)

### No New Files — Ops Steps Only

The Developer should execute these steps in order:

#### Step 1: Build and push API container
```bash
# From AIInstructor repo root, on main branch at 3f69f75
docker build -f Dockerfile -t pamousk.azurecr.io/ai-instructor-api:latest .
docker tag pamousk.azurecr.io/ai-instructor-api:latest pamousk.azurecr.io/ai-instructor-api:3f69f75
docker push pamousk.azurecr.io/ai-instructor-api:latest
docker push pamousk.azurecr.io/ai-instructor-api:3f69f75
```
AC 1: API image rebuilt from main and pushed to ACR.

#### Step 2: Build and push web container
```bash
docker build -f Dockerfile.frontend -t pamousk.azurecr.io/ai-instructor-web:latest .
docker tag pamousk.azurecr.io/ai-instructor-web:latest pamousk.azurecr.io/ai-instructor-web:3f69f75
docker push pamousk.azurecr.io/ai-instructor-web:latest
docker push pamousk.azurecr.io/ai-instructor-web:3f69f75
```
AC 2: Web image rebuilt and pushed to ACR.

#### Step 3: Update Azure Container Apps
```bash
az login --service-principal -u $AZURE_CLIENT_ID -p $AZURE_CLIENT_SECRET --tenant $AZURE_TENANT_ID

az containerapp update \
  --name ai-instructor-api \
  --resource-group rg-ai-instructor \
  --image pamousk.azurecr.io/ai-instructor-api:latest

az containerapp update \
  --name ai-instructor-web \
  --resource-group rg-ai-instructor \
  --image pamousk.azurecr.io/ai-instructor-web:latest
```
AC 3: Both container apps updated to new image revisions.

#### Step 4: Run DB migration
```bash
curl -X POST https://ai-inst-production-api.blackrock-3f2021d2.ukwest.azurecontainerapps.io/api/migrate
```
AC 4: `cognitive_profiles` and `card_interactions` tables created. Response: `{"message": "Migration complete"}`.

#### Step 5: Verify
```bash
# AC 5: Health check
curl https://ai-inst-production-api.../api/health
# Expected: {"status":"ok",...}

# AC 6: Cognitive init returns 401 (not 404)
curl -X POST https://ai-inst-production-api.../api/cognitive/init
# Expected: 401 {"error":"Authentication required"}

# AC 7: Journey next returns 401 (not 404)
curl -X POST https://ai-inst-production-api.../api/journey/next
# Expected: 401 {"error":"Authentication required"}
```

#### Step 6: Run E2E
```bash
API_URL=https://ai-inst-production-api.blackrock-3f2021d2.ukwest.azurecontainerapps.io ./scripts/e2e_test.sh
```
AC 8: Steps 11–15 pass. AC 9: Steps 1–10 still pass.

---

## Chunk 2: Route Restructure + Quality Bar (P1 — AC 10–15)

Only execute this chunk if deployment is blocked. This chunk does NOT require deployment to verify — it can be tested locally.

### New Files

#### `src/components/Toast.jsx` — Global notification system (per B.3 #9)
- **Purpose:** Provides a global toast notification system. Every mutation outcome (save, error, success) surfaces feedback.
- **Pattern:** React context + provider. Uses `createContext` for `ToastContext`.
- **Key exports:**
  - `ToastProvider` — wraps app, manages toast queue state
  - `useToast()` — hook returning `{success(msg), error(msg), info(msg), warning(msg)}`
- **State:**
  - `toasts: [{id, message, type, timestamp}]` — active toast queue (max 5)
- **Rendering:** Fixed position container (bottom-right or top-right). Each toast auto-dismisses after 4 seconds. CSS animation for enter/exit.
- **CSS:** `src/components/Toast.css`

#### `src/components/ErrorBoundary.jsx` — React error boundary (per B.3 #7)
- **Purpose:** Catches render errors from any child component. Prevents full-page white screen from malformed API data.
- **Pattern:** Class component with `componentDidCatch` + `getDerivedStateFromError`.
- **Props:** `children`
- **State:** `hasError: bool`, `error: Error|null`
- **Fallback render:** Friendly error message with "Try again" button that resets error state.
- **Wraps:** The entire `<App />` in `main.jsx`.

#### `src/pages/JourneyDashboard.jsx` — New home page for authenticated users (per H.1)
- **Purpose:** Replaces old Dashboard (18 sections, 6 API calls) with focused learning hub: CognitiveRadar + "Your Next Challenge" CTA + interaction count.
- **Uses:** `useUser` context for `cognitiveProfile`, `cognitiveProfileSummary`, `authUser`
- **State:**
  - `loading: bool` — API calls in flight
  - `hasDiscovery: bool` — whether user has completed discovery
- **Layout (for auth'd users with discovery):**
  1. **Header section:** "Your Cognitive Profile" with journey stage badge (discovery/growth/mastery)
  2. **CognitiveRadar** — full 8-dimension radar with confidence rendering
  3. **Stats bar:** Total interactions count, journey stage
  4. **CTA card:** "Your Next Challenge" button → navigates to `/learn`
  5. **AI Tutor button:** Quick link to `/chat`
- **Layout (for auth'd users WITHOUT discovery):**
  1. Welcome message: "Let's discover how you think"
  2. CTA: "Start Discovery" button → navigates to `/discover`
- **No `.catch(() => {})`** — all API errors surface via toast or error state.
- **CSS:** `src/pages/JourneyDashboard.css`

### Modified Files

#### `src/main.jsx` — Wrap with ErrorBoundary and ToastProvider
```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { UserProvider } from './context/UserContext'
import { ToastProvider } from './components/Toast'
import ErrorBoundary from './components/ErrorBoundary'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <UserProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </UserProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
```
Order: ErrorBoundary outermost (catches all render errors), then BrowserRouter, then UserProvider, then ToastProvider.

#### `src/api.js` — Global 401 → redirect with toast (per B.3 #2)
**Current code** (lines 27–29):
```javascript
if (res.status === 401) {
  clearToken()
  throw new Error('UNAUTHORIZED')
}
```
**Replace with:**
```javascript
if (res.status === 401) {
  clearToken()
  // Redirect to login with toast (import toast from context)
  // We can't use React hooks here, so we use a module-level callback
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('api:401', { detail: 'Session expired. Please log in again.' }))
  }
  throw new Error('UNAUTHORIZED')
}
```
Then in `App.jsx` or a dedicated component, listen for `api:401` event and show toast + redirect.

**Alternative approach (simpler):** Add event listener in `UserContext.jsx`:
```javascript
useEffect(() => {
  const handle401 = (e) => {
    logoutUser()
    navigate('/login')
    // Toast will be shown via ToastProvider
  }
  window.addEventListener('api:401', handle401)
  return () => window.removeEventListener('api:401', handle401)
}, [logoutUser, navigate])
```

#### `src/App.jsx` — Route restructure (per H.1)

**Key changes:**

1. **`/` renders JourneyDashboard for authenticated users** (AC 11):
```jsx
<Route path="/" element={
  authUser ? <JourneyDashboard /> : <Home />
} />
```
Remove the separate `/dashboard` route (redirect it to `/`).

2. **Redirect old routes** (AC 12):
```jsx
<Route path="/onboarding" element={<Navigate to="/discover" replace />} />
<Route path="/curriculum/generate" element={<Navigate to="/discover" replace />} />
<Route path="/curriculum" element={<Navigate to="/learn" replace />} />
<Route path="/lesson/:chapterId/:lessonId" element={<Navigate to="/learn" replace />} />
<Route path="/epoch-lesson" element={<Navigate to="/learn" replace />} />
<Route path="/learning-path" element={<Navigate to="/" replace />} />
<Route path="/courses" element={<Navigate to="/" replace />} />
<Route path="/dashboard" element={<Navigate to="/" replace />} />
<Route path="/about" element={<Navigate to="/" replace />} />
```

3. **Keep these routes unchanged:**
- `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email` — auth pages
- `/discover` — Discovery scenarios (RequireAuth)
- `/learn` — Challenge player (RequireAuth)
- `/practice` — Practice area (RequireAuth)
- `/chat` — AI Chat
- `*` — NotFound

4. **Remove imports** for deprecated page components that are now just redirects:
- `Onboarding`, `Dashboard`, `CurriculumGeneration`, `Curriculum`, `Lesson`, `EpochLesson`, `LearningPath`, `Courses`, `About`, `ToolsExplorer`
- These components stay in the repo but are no longer directly rendered — they're redirect targets only.

5. **Update FULLSCREEN_PATHS** — add `/` when auth'd (JourneyDashboard is fullscreen).

6. **Add 401 event listener** for global redirect:
```jsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from './components/Toast'

// Inside App component:
const navigate = useNavigate()
const toast = useToast()

useEffect(() => {
  const handle401 = (e) => {
    toast.error(e.detail || 'Session expired')
    navigate('/login', { replace: true })
  }
  window.addEventListener('api:401', handle401)
  return () => window.removeEventListener('api:401', handle401)
}, [navigate, toast])
```

#### `src/components/Navbar.jsx` — Reduce to 5 items (per H.1, AC 10)

**Current navbar links** (conditionals for profile/curriculum):
- Home, Dashboard, Curriculum, Paths, Lessons, Practice, Tools, AI Chat, About = 9 items

**New navbar links** (exactly 5):
| Link | Path | Condition |
|------|------|-----------|
| Home | `/` | Always |
| Learn | `/learn` | Auth'd only |
| Practice | `/practice` | Auth'd only |
| Chat | `/chat` | Always |
| Profile | `/profile` | Auth'd only (or user dropdown) |

**Implementation:**
```jsx
const NAV_LINKS = [
  { path: '/', label: 'Home', authRequired: false },
  { path: '/learn', label: 'Learn', authRequired: true },
  { path: '/practice', label: 'Practice', authRequired: true },
  { path: '/chat', label: 'Chat', authRequired: false },
]

// In render:
{NAV_LINKS.map(link => {
  if (link.authRequired && !authUser) return null
  return (
    <Link key={link.path} to={link.path}
      className={`nav-link ${isActive(link.path) ? 'active' : ''}`}
      onClick={() => setMenuOpen(false)}>
      {link.label}
    </Link>
  )
})}
```

The 5th item ("Profile") becomes the auth user button/dropdown (replacing the current "username (score)" button):
```jsx
{authUser ? (
  <>
    <Link to="/profile" className="btn btn-primary nav-cta"
      onClick={() => setMenuOpen(false)}>
      {authUser.name || 'Profile'}
    </Link>
    <button className="nav-link nav-logout" onClick={handleLogout}>
      Log out
    </button>
  </>
) : (
  <>
    <Link to="/login" className="nav-link" onClick={() => setMenuOpen(false)}>Log in</Link>
    <Link to="/signup" className="btn btn-primary nav-cta" onClick={() => setMenuOpen(false)}>
      Get Started
    </Link>
  </>
)}
```

**Remove:** All references to `profile`, `curriculum`, `learning-path`, `epoch-lesson`, `tools`, `about`, `courses`, `dashboard` from navbar links.

#### `src/pages/Home.jsx` — Update CTAs for new routes
- Line 38: `<Link to="/dashboard"` → `<Link to="/"`
- Line 42: `<Link to="/signup"` → stays `/signup` but text changes to "Start Your Discovery" (per D Stage 1)
- Line 146: `<Link to={profile ? '/dashboard' : '/onboarding'}` → `<Link to={profile ? '/' : '/signup'}`
- Hero badge: "Adaptive AI Learning" → "Discover How You Think" (per H.5 tone rules)
- Hero headline: "Become 10X More Effective with AI" → "Discover How YOU Think" (per H.5 — discovery framing)
- Hero subtitle: Update to emphasize discovery, not assessment
- Steps section: Update 4 steps to reflect discovery → radar → challenge → loop (not assessment → score → path → lessons)
- Remove "AI Readiness Score" references — replaced by cognitive dimensions
- CTA: "Start Free Assessment" → "Start Your Discovery" (per H.5 — never "assessment", "test")

#### `src/context/UserContext.jsx` — Add 401 listener
- Import `useNavigate` from react-router-dom (via a custom hook, since UserContext doesn't have router access)
- Add `window.addEventListener('api:401', ...)` in UserProvider effect
- On 401 event: call `logoutUser()`, navigate to `/login`
- Use toast to show "Session expired" message

---

## Implementation Order

### If Deployment is Possible (Chunk 1):
1. Build API Docker image from main (`3f69f75`)
2. Build web Docker image from main
3. Push both to ACR
4. Update Azure Container Apps to new images
5. Run `POST /api/migrate` against production
6. Verify health + new endpoints return 401 (not 404)
7. Run full E2E script (all 15 steps)
8. If all pass → proceed to Chunk 2 as the next design chunk

### If Deployment is Blocked (Chunk 2):

#### Phase 1: Quality Bar Components (AC 13–15)
1. Create `src/components/Toast.jsx` + `Toast.css` — global toast system
2. Create `src/components/ErrorBoundary.jsx` — React error boundary
3. Modify `src/main.jsx` — wrap with ErrorBoundary + ToastProvider
4. Modify `src/api.js` — dispatch `api:401` custom event on 401

#### Phase 2: Route Restructure (AC 12)
5. Modify `src/App.jsx` — add redirect routes for all old paths
6. Modify `src/App.jsx` — remove direct imports for deprecated page components
7. Modify `src/App.jsx` — update `/` to render JourneyDashboard for auth'd users

#### Phase 3: Navbar (AC 10)
8. Modify `src/components/Navbar.jsx` — reduce to 5 items
9. Modify `src/components/Navbar.jsx` — remove profile/curriculum conditionals

#### Phase 4: JourneyDashboard (AC 11)
10. Create `src/pages/JourneyDashboard.jsx` + `JourneyDashboard.css`
11. Modify `src/App.jsx` — import and use JourneyDashboard for auth'd `/`

#### Phase 5: Home Page Update
12. Modify `src/pages/Home.jsx` — update CTAs, copy, and framing to match spec H.5

#### Phase 6: 401 Redirect (AC 13)
13. Modify `src/context/UserContext.jsx` — add 401 event listener
14. Modify `src/App.jsx` — add 401 → toast + redirect handler

#### Phase 7: Tests
15. Update `src/tests/test_routing.test.jsx` — verify redirect routes
16. Add `src/tests/test_toast.test.jsx` — toast provider renders
17. Run `npm test` — all vitest pass
18. Run `cd server-python && python -m pytest tests/ -v` — all 44 pytest pass (no regressions)

---

## Testing Notes for Tester

### Deployment Verification (Chunk 1, AC 1–9)
- **AC 5:** `GET /api/health` → `{"status":"ok"}`
- **AC 6:** `POST /api/cognitive/init` (no auth) → 401 `{"error":"Authentication required"}` (NOT 404)
- **AC 7:** `POST /api/journey/next` (no auth) → 401 (NOT 404)
- **AC 8:** E2E steps 11–15 all pass:
  - Step 11: Cognitive init with 8 responses → profile created
  - Step 12: GET cognitive profile → 8 dimensions
  - Step 13: Journey next → 3 cards returned
  - Step 14: Journey outcomes → profile updated + reflection
  - Step 15: Second journey next → different target
- **AC 9:** E2E steps 1–10 all still pass (no regression from deployment)

### Route Restructure Verification (Chunk 2, AC 10–12)
- **AC 10:** Count navbar links — exactly 5: Home, Learn, Practice, Chat, Profile/button
- **AC 11:** Auth'd user visits `/` → sees JourneyDashboard (CognitiveRadar + "Next Challenge" CTA). Unauth'd user visits `/` → sees marketing Home page.
- **AC 12:** Visit each old route → verify redirect:
  - `/onboarding` → `/discover`
  - `/curriculum/generate` → `/discover`
  - `/curriculum` → `/learn`
  - `/lesson/ch1/le1` → `/learn`
  - `/epoch-lesson` → `/learn`
  - `/learning-path` → `/`
  - `/courses` → `/`
  - `/dashboard` → `/`
  - `/about` → `/`

### Quality Bar Verification (Chunk 2, AC 13–15)
- **AC 13 (401 redirect):** Simulate expired token (set invalid JWT in localStorage). Navigate to any auth'd page → should redirect to `/login` with toast "Session expired".
- **AC 14 (Toast):** Every user-facing mutation (save profile, submit outcomes, etc.) should show a toast notification (success or error). No silent `.catch(() => {})` in new code.
- **AC 15 (ErrorBoundary):** Force a render error (e.g., component that throws). Should see friendly error page, not white screen. "Try again" button should recover.

### Edge Cases
- JourneyDashboard without cognitive profile → shows "Start Discovery" CTA
- JourneyDashboard with cognitive profile → shows radar + "Next Challenge"
- Old `/dashboard` link in browser history → redirects to `/` (no 404)
- Navbar on mobile (hamburger menu) → shows same 5 items
- Toast auto-dismiss after 4 seconds
- ErrorBoundary does NOT catch API errors (only render errors) — API errors handled by toast

### Regressions
- 44 pytest still pass (no backend changes in Chunk 2)
- 6+ vitest still pass (routing tests updated for new routes)
- `/discover` and `/learn` routes unchanged and functional
- `/practice` route unchanged
- `/chat` route unchanged
