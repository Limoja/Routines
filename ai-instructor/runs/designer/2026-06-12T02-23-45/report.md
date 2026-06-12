# Designer Run Report — 2026-06-12T02:23:45

## What I Did

### Context Gathered
Read all mandatory documents:
- `docs/AIInstructor-MASTER-SPECIFICATION.md` (699 lines) — Parts A.2 (Three Laws), B.3 (Quality Bar), D (User Journey), E.8 (Cold Start), F.1 (Data Model), G.1 (API Endpoints), H.1 (Routes), H.2 (Components), H.4 (Radar), H.5 (Tone)
- `shared-context.md` — updated project state (Iteration 1 code merged but NOT deployed)
- `handoff/1-po-review.md` — comprehensive gap analysis, 15 acceptance criteria in 2 chunks
- `handoff/4-test-report.md` — 69/74 tests pass (5 E2E failures all deployment-related, 42/42 AC code-level pass)

Read source files for design precision:
- `src/App.jsx` — 22 routes, FULLSCREEN_PATHS, RequireAuth/RedirectIfAuth
- `src/components/Navbar.jsx` — 9 nav links, conditional on profile/curriculum
- `src/pages/Home.jsx` — marketing hero with "10X" framing, AI Readiness Score references
- `src/pages/Dashboard.jsx` — 572 lines, 18 sections, 9 `.catch(() => {})` violations of B.3
- `src/api.js` — `request()` function with 401 handling (clears token but no redirect/toast)
- `src/main.jsx` — app entry point (no ErrorBoundary, no ToastProvider)
- `src/context/UserContext.jsx` — already read in previous run, server-first profile loading
- Found 20+ `.catch(() => {})` violations across: Dashboard, PracticeArea, LearningPath, ToolsExplorer, EpochLesson

### Design Decisions

1. **Two-chunk plan:** Deployment first (P0, AC 1–9). Route restructure + quality bar second (P1, AC 10–15). The P1 chunk is the fallback if deployment is blocked.

2. **JourneyDashboard replaces `/` for auth'd users:** Per H.1, home IS the dashboard. The old Dashboard.jsx (572 lines, 18 sections) is replaced by a focused JourneyDashboard with just radar + next challenge CTA + stats.

3. **Old pages NOT deleted — just redirected.** Per B.1 Rule 5, old features are deprecated behind the new, not deleted. Old component files remain in repo, but routes redirect to new equivalents.

4. **Toast via React context, not third-party lib.** Simple create/provider pattern. No new npm dependency. Auto-dismiss after 4 seconds.

5. **401 handling via CustomEvent.** The `api.js` module can't use React hooks, so it dispatches a `window` CustomEvent (`api:401`). UserContext listens for it and triggers logout + navigate + toast. This avoids circular dependencies.

6. **Home page copy updated** to discovery framing per H.5 tone rules: "Discover How YOU Think" instead of "Become 10X More Effective", "Start Your Discovery" instead of "Start Free Assessment". Never use "assessment", "test", "course".

7. **Navbar exactly 5 items:** Home, Learn, Practice, Chat, Profile (as auth button). Removed: Dashboard, Curriculum, Paths, Lessons, Tools, About.

### Output Produced
- **`handoff/2-design-plan.md`** — complete design plan with:
  - Chunk 1: 8 deployment steps with exact commands
  - Chunk 2: 18 implementation steps across 7 phases
  - 3 new components: Toast, ErrorBoundary, JourneyDashboard
  - 6 modified files: main.jsx, App.jsx, Navbar.jsx, Home.jsx, api.js, UserContext.jsx
  - 15 acceptance criteria mapped to specific tests
  - Edge cases and regression checklist

## Test Results
No tests run — design/planning task.

## Screenshot Evidence
N/A — design/planning task.

## What the NEXT Run Should Do (Developer)

### If deployment is possible (PRIORITY):
1. Build and push Docker images from main (`3f69f75`)
2. Update Azure Container Apps
3. Run `POST /api/migrate` against production
4. Verify health + new endpoints (401 not 404)
5. Run full E2E (15 steps)

### If deployment blocked, or after deployment (Chunk 2):

**Phase 1 — Quality Bar (AC 13–15):**
1. Create `src/components/Toast.jsx` + `Toast.css` — ToastProvider + useToast hook
2. Create `src/components/ErrorBoundary.jsx` — class component error boundary
3. Modify `src/main.jsx` — wrap app with ErrorBoundary + ToastProvider
4. Modify `src/api.js` — dispatch `window` CustomEvent `api:401` on 401 status

**Phase 2 — Routes (AC 12):**
5. Modify `src/App.jsx` — add `<Navigate>` redirects for 9 old routes
6. Remove direct rendering of deprecated page components

**Phase 3 — Navbar (AC 10):**
7. Modify `src/components/Navbar.jsx` — reduce to exactly 5 items

**Phase 4 — JourneyDashboard (AC 11):**
8. Create `src/pages/JourneyDashboard.jsx` — radar + CTA for auth'd home
9. Modify `src/App.jsx` — `/` renders JourneyDashboard for auth'd users

**Phase 5 — Home + 401:**
10. Modify `src/pages/Home.jsx` — discovery framing per H.5
11. Modify `src/context/UserContext.jsx` — listen for `api:401` event

**Phase 6 — Tests:**
12. Update `src/tests/test_routing.test.jsx` — verify redirect routes
13. Run `npm test` + `pytest` — no regressions

## Blockers / Decisions Needed
- **Deployment access:** Can the Developer push to ACR and update Azure Container Apps? If not, Chunk 2 should proceed independently.
- **`/profile` page:** AC 10 mentions "Profile" as 5th nav item. No `/profile` route exists yet. Decision: Link the Profile nav item to `/` for now (auth'd home shows profile info via JourneyDashboard), or create a minimal profile/settings page. Recommend: link to `/` for now, full profile page in a later chunk.
