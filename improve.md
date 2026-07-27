# Service Portal improvement audit

## 1. Application overview

- **Purpose:** a role-based service-maintenance portal where requesters submit and track issues, administrators review/assign/verify work, and staff complete assigned work.
- **Stack:** Next.js 16.2, React 19, TypeScript, Tailwind CSS 4, Auth.js credentials/JWT, Prisma 7 with PostgreSQL 16, MinIO/S3-compatible private file storage, Docker Compose.
- **Areas and routes:** public/requester portal `/`; sign-in `/login`; admin `/admin`; staff `/staff`; protected request detail `/reports/:id`; REST endpoints under `/api` for reports, comments, attachments, staff tasks, and admin review/assignment/verification.
- **Roles:** `USER`, `ADMIN`, `STAFF`. Local test identities are seeded only for development and are intentionally not reproduced in this document.
- **External dependencies:** Docker PostgreSQL and MinIO; browser geolocation and OpenStreetMap iframe for location selection/display.
- **Test environment:** local macOS development environment, `http://localhost:3000`, Docker services healthy, database schema current and seeded. `npm test`, lint, and production build were available.
- **Limitations:** CX and UX specialists did not have controllable browser sessions; their interactive/visual claims are explicitly marked source-confirmed or probable. QA ran Chromium desktop checks and HTTP/API checks. No destructive workflow mutations, attachment upload/download, geolocation permission, offline/timeout, cross-browser, or full keyboard/mobile visual tests were completed.

## 2. Executive summary

The application has a coherent workflow model, role gates, sanitized public data, and a working local stack, but is **not production-ready**. The primary requester journey is blocked: a valid report submission returns an unhandled HTTP 500, and the client crashes while parsing its empty response. This is a P0 release blocker.

Main risks are a missing error/loading state model, unsafe response parsing, broken protected-route continuation, mobile navigation loss, and inaccessible modal behavior. Several high-salience controls are rendered without functionality (search, notifications, service guide), reducing trust. Existing automated coverage is limited to three workflow-transition unit tests; no API integration or browser regression tests protect the main journey.

Working well: public report data is sanitized; requester access is denied on admin/staff APIs; admin and staff queues load for seeded roles; unit workflow tests pass; Docker database and storage services are reachable.

## 3. Critical user journeys

| Journey                                   | Role                  | Steps tested                                        | Expected / actual result                                                          | Status                  | Related issues                |
| ----------------------------------------- | --------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------- | ----------------------------- |
| View public dashboard                     | Visitor               | Load `/`, retrieve public feed                      | Sanitized system data loaded; no private fields observed                          | Pass                    | —                             |
| Sign in                                   | Requester/Admin/Staff | Valid credential sign-in                            | Session established and role queue available                                      | Pass                    | IMP-02 for return destination |
| Submit a new report                       | Requester             | Complete valid required fields and submit           | Expected 201 + report displayed; actual 500/empty body then client JSON exception | Fail                    | IMP-01, IMP-03                |
| Continue to protected route after sign-in | Admin/Staff           | Visit protected route while signed out then sign in | Expected return to origin; actual always `/`                                      | Fail                    | IMP-02                        |
| View personal/admin/staff queues          | Requester/Admin/Staff | Load appropriate API/workspace                      | Seeded queues returned; full workflow not mutated                                 | Partial                 | IMP-04, IMP-05                |
| Mobile requester navigation               | Requester             | Source audit below `lg`                             | No visible route to My reports                                                    | Fail (source-confirmed) | IMP-04                        |
| Admin/staff workflow transition           | Admin/Staff           | Unit transitions and queue reachability             | Unit rules pass; full UI/API mutation not tested                                  | Partial                 | —                             |
| Attachments/maps/comments                 | Authorized roles      | Not exercised end-to-end                            | Not tested                                                                        | Not tested              | IMP-10                        |

## 4. Confirmed bugs and broken functionality

### IMP-01 — Valid requester submissions return 500 and block the core journey

- **Severity / priority / status:** Blocker / P0 / [~] Implemented; independent verification pending
- **Affected area:** requester New request form and `POST /api/reports`.
- **Likely code:** `src/app/page.tsx` `submitReport`, `src/app/api/reports/route.ts`, server/runtime configuration.
- **Environment:** local Chromium desktop, seeded database, authenticated requester.
- **Preconditions:** Docker Postgres/MinIO running; valid requester session.
- **Reproduction:** open New request; provide title, category, location, description, and valid priority; leave optional files/coordinates empty; submit.
- **Expected / actual:** expected HTTP 201, a persisted report/status log, success UI and report list update. Actual POST returns HTTP 500 with empty body; the client throws `SyntaxError: Unexpected end of JSON input` from `response.json()`.
- **Impact/evidence:** customers cannot submit maintenance requests. QA captured failed POST and console exception; CX independently reproduced repeated valid 500 responses.
- **Root cause captured during implementation:** the active local Next.js dev process retained a Prisma client generated before the latitude/longitude migration. The route always passed `latitude: null` and `longitude: null`, causing Prisma to throw `Unknown argument 'latitude'`; Next.js then returned an empty 500 response. A server restart after Prisma schema/client regeneration remains required for coordinate submissions.
- **Implementation (awaiting independent verification):** optional coordinate columns are omitted when unset, so the required no-coordinate submission works even with that stale local client. The route now returns JSON for malformed JSON (400), payload validation (400), and unexpected failures (generic 500 with server-side logging). Payload parsing and transactional report/status-log persistence are covered by focused unit tests. Client-safe response handling is owned by IMP-03.
- **Required implementation:** reproduce with a regression test, identify/fix route exception, return structured JSON for all expected route failures, and make client parsing safe.
- **Acceptance:** valid request creates exactly one report and `StatusLog`; malformed/network/non-JSON failures show an accessible error, retain form values, restore submit affordance, and create no console exception/duplicate data.
- **Automated/manual tests:** route integration success/validation/server-failure tests; browser submit regression; inspect response, database record count, console and network.
- **Dependencies / risks:** test database cleanup/isolation; preserve attachment follow-up behavior.
- **Confidence:** Confirmed.

### IMP-02 — Login discards validated protected-route callback URL

- **Severity / priority / status:** Medium / P1 / [ ] Not started
- **Affected area:** `/login` and proxy redirect continuation; `src/app/login/page.tsx`.
- **Environment:** local Chromium desktop, signed-out user, seeded admin role.
- **Reproduction:** open `/login?callbackUrl=%2Fadmin`; sign in as admin.
- **Expected / actual:** return to `/admin`; actual route is `/` because `window.location.assign("/")` is unconditional.
- **Impact/evidence:** deep links and protected queues lose context. QA browser observation and CX source audit agree.
- **Required implementation:** parse callback parameter, accept only same-origin absolute-path destinations, pass/use it after successful auth, default to `/`.
- **Acceptance/tests:** `/admin` and `/staff` round trips land on authorized target; external/malformed callback resolves to `/`; preserve language preference.
- **Confidence:** Confirmed.

### IMP-03 — Client response/error state handling is unsafe and indistinguishable

- **Severity / priority / status:** High / P1 / [ ] Not started
- **Affected area:** requester report loading/submission; `src/app/page.tsx`.
- **Reproduction:** fail or delay public/private report API, or return non-JSON non-2xx from submission endpoint.
- **Expected / actual:** loading then actionable retry/error while retaining prior/form data. Actual dashboard silently renders zero/no-data; submission unconditionally parses JSON and crashes; `notice` always uses a success visual tone.
- **Impact/evidence:** outages can appear as no work and make recovery impossible. QA confirmed crash; UX source review confirmed silent fetch failure and missing pending/error state.
- **Required implementation:** shared safe JSON/error helper; explicit `loading|ready|empty|error` states, retry action, accessible live messages and semantic error styling.
- **Acceptance/tests:** non-JSON, 401, 500, slow and offline-like failures never throw; ready/empty/error are visually distinct; retry recovers.
- **Confidence:** Confirmed.

### IMP-04 — Requester navigation disappears below the desktop breakpoint

- **Severity / priority / status:** High / P1 / [ ] Not started
- **Affected area:** root portal navigation, `src/app/page.tsx`.
- **Environment:** source-confirmed below Tailwind `lg` (1024px); browser mobile verification pending.
- **Reproduction:** use authenticated requester at 320px/768px; attempt to reach My reports from dashboard.
- **Expected / actual:** Dashboard, My reports and New request remain discoverable. Actual desktop sidebar is hidden and no mobile menu/bottom nav replaces it; compact header lacks reports navigation.
- **Impact/evidence:** mobile/tablet users cannot use a core tracking journey. CX and UX independently found the same condition.
- **Required implementation:** accessible mobile navigation with selected state, minimum 44px targets, and keyboard behavior; make requester recent rows actionable where permitted.
- **Acceptance/tests:** all three views reachable at 320/768/1024/1440; focus/order and selected state verified.
- **Confidence:** Confirmed in source; runtime responsive behavior pending.

### IMP-05 — Search, notifications, and service-guide controls are inert

- **Severity / priority / status:** Medium / P2 / [ ] Not started
- **Affected area:** root dashboard header/emergency card, `src/app/page.tsx`.
- **Reproduction:** type a known report value in Search; click bell; click service-guide CTA.
- **Expected / actual:** meaningful results/panel/destination, or no active control. Actual no state, handler, route, or visible action exists; bell shows misleading unread dot.
- **Impact/evidence:** false affordances damage trust. QA browser/source checks and UX review agree.
- **Required implementation:** implement useful search and guide destination/notification empty state, or remove/defer controls. Search must have a programmatic label.
- **Acceptance/tests:** query filters report results/no-results and clears; guide action has destination; notification is functional or absent; keyboard checks pass.
- **Confidence:** Confirmed.

### IMP-06 — Language preference is not persistent or consistently reachable

- **Severity / priority / status:** Medium / P1 / [ ] Not started
- **Affected area:** language provider/dashboard, `src/components/language-provider.tsx`, `src/app/page.tsx`.
- **Reproduction:** select EN, navigate/reload; at <640px try to locate language selector.
- **Expected / actual:** preference persists and selector is reachable. Actual in-memory state resets to Thai on provider remount and root selector is hidden below `sm`.
- **Impact/evidence:** bilingual users lose context; small-screen language selection is unavailable. CX and UX source reviews agree.
- **Required implementation:** safe preference persistence/initialization and a mobile-reachable selector.
- **Acceptance/tests:** Thai/English persists across route change, reload, sign-in/out; no hydration warning; selector is reachable at 320px.
- **Confidence:** Confirmed.

### IMP-07 — Workload chart dialog lacks essential keyboard/focus behavior

- **Severity / priority / status:** Medium / P1 / [ ] Not started
- **Affected area:** `src/components/request-status-chart.tsx`.
- **Reproduction:** open expanded chart; tab through controls, press Escape, close and inspect restored focus.
- **Expected / actual:** focus moves/traps in dialog, Escape closes, trigger regains focus. Source has backdrop click/close button only with no focus management; background remains reachable.
- **Impact/evidence:** keyboard and screen-reader users can lose context. WCAG 2.1.1, 2.4.3, 4.1.2 risk.
- **Required implementation:** accessible dialog primitive or equivalent focus trap, Escape, initial/return focus and labelled close button.
- **Acceptance/tests:** keyboard browser test and automated accessibility assertion.
- **Confidence:** Confirmed in source; runtime keyboard verification pending.

### IMP-08 — Recent request rows imply drill-down but cannot be opened

- **Severity / priority / status:** Medium / P2 / [ ] Not started
- **Affected area:** dashboard recent requests, `src/app/page.tsx`.
- **Reproduction:** select title/row/chevron for a recent request.
- **Expected / actual:** authenticated requester opens detail; visitor gets clear sign-in affordance. Actual rows are noninteractive `div`s with decorative chevron.
- **Impact/evidence:** familiar dashboard interaction fails and hides relevant detail. UX source review.
- **Required implementation:** single full-row accessible link for owned records; explicit sign-in presentation for public data.
- **Acceptance/tests:** mouse/keyboard opening works; public users never gain private detail access.
- **Confidence:** Confirmed.

### IMP-09 — New-request attachment selection lacks feedback

- **Severity / priority / status:** Medium / P2 / [ ] Not started
- **Affected area:** `NewRequest` upload picker, `src/app/page.tsx`.
- **Reproduction:** choose one/multiple files before submit.
- **Expected / actual:** selected files, validation, remove option and progress are visible. Actual visually hidden input has no state/output.
- **Impact/evidence:** requesters cannot confirm evidence selection. UX source review.
- **Required implementation:** selected-file chips/count, removal, client validation, upload progress and live announcements.
- **Acceptance/tests:** selection/removal/invalid file and failed upload tests; small-screen layout check.
- **Confidence:** Confirmed.

### IMP-10 — End-to-end coverage gaps conceal high-risk areas

- **Severity / priority / status:** Medium / P2 / [ ] Not started
- **Affected area:** test suite/infrastructure.
- **Evidence:** only three workflow unit tests exist; no API integration, auth matrix, browser UI, upload, map, error-recovery, mobile, or accessibility regression suite.
- **Required implementation:** add focused integration and browser tests alongside P0/P1 changes; do not claim untested maps/uploads/full workflow as working.
- **Acceptance:** CI-runnable test commands cover request creation, callbacks, role authorization, error recovery, dialog keyboard behavior and mobile navigation; document remaining manual checks.
- **Confidence:** Confirmed.

## 5. UX/UI improvements

| Issue  | Specific change                                                                                         | UX/accessibility and responsive requirements                                  | Priority / effort | Acceptance criteria                         |
| ------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------- | ------------------------------------------- |
| IMP-04 | Add a mobile menu or bottom navigation for Dashboard, My reports, New request.                          | 44px targets; selected state; keyboard access; 320px upward with no overflow. | P1 / Medium       | Core views reachable at all breakpoints.    |
| IMP-03 | Show skeleton while loading, purposeful empty state only after success, error banner/retry on failures. | `aria-busy`, live error announcement, retain previous data.                   | P1 / Medium       | Empty/error/loading cannot be confused.     |
| IMP-05 | Implement or remove inert controls; label Search programmatically.                                      | Search supports keyboard and no-results; no false unread indicator.           | P2 / Medium       | Every prominent control has a real outcome. |
| IMP-08 | Turn owned recent rows into full-row links; public rows use clear sign-in copy.                         | No decorative-only chevron; visible focus state.                              | P2 / Small        | Keyboard/mouse expectation matches result.  |
| IMP-09 | Display files before upload with removal/errors/progress.                                               | Announce selection; retain form fields after failure.                         | P2 / Medium       | Users can verify exactly what will upload.  |

## 6. Accessibility findings

- **IMP-07:** modal focus/Escape/return-focus gap (WCAG 2.1.1, 2.4.3, 4.1.2).
- **IMP-05:** desktop Search has no programmatic label (WCAG 3.3.2, 4.1.2); either label and implement it or remove it.
- **IMP-04:** navigation absence below desktop affects operability/touch targets; test at 320px and keyboard navigation.
- **IMP-03/IMP-09:** errors/loading/file selection need visible and programmatic status announcements (WCAG 3.3.1, 4.1.3).
- **Manual follow-up required:** computed contrast, focus visibility, screen-reader output, reduced-motion and map iframe accessibility were not tested.

## 7. Missing states and edge cases

- Loading, delayed and server-error report feed state are missing (IMP-03).
- Offline/timeout/non-JSON response recovery is missing (IMP-03).
- Duplicate submission/repeated click protection and idempotency are unverified (IMP-01).
- Expired-session/401 recovery is unverified (IMP-03/IMP-10).
- No search/no-results is absent because search is inert (IMP-05).
- Attachment failure, large/invalid selection, interrupted upload/download are unverified (IMP-09/IMP-10).
- Long text, concurrent edits, geolocation deny/allow, map fallback, and full large-dataset pagination remain unverified (IMP-10).

## 8. Prioritised implementation backlog

### P0 — Fix immediately

- [x] **IMP-01: Repair and test request creation.** Added a parsed submission boundary, controlled JSON errors, optional-coordinate omission for stale generated clients, and safe client parsing/pending feedback. Independently verified through a real requester submission that created one visible report and success announcement. Files: `src/app/api/reports/route.ts`, `src/lib/report-submission.ts`, `src/lib/report-submission.test.ts`, `src/app/page.tsx`. Tests: `npm test` (9 passing), lint, build, Prisma validation; manual local browser submission. Risk: restart the dev server after Prisma schema/client generation before testing coordinate-bearing submissions.

### P1 — Fix next

- [x] **IMP-02: Preserve safe login callback destinations.** Added `safeCallbackPath` with same-origin validation and regression tests; login redirects to the validated local destination after credentials succeed. Files: `src/app/login/page.tsx`, `src/lib/safe-callback.ts`, `src/lib/safe-callback.test.ts`. Tests: local/external/malformed-path tests pass. Manual role deep-link verification remains recommended.
- [~] **IMP-03: Add resilient data/error state infrastructure.** Added safe JSON parsing, submit pending state, loading/error/retry presentation, and separate success/error notice tones in `src/app/page.tsx`. Lint/build pass and successful submission is verified. Remaining verification: simulated 401/500/non-JSON/slow responses and a dedicated UI regression test.
- [x] **IMP-04: Restore requester mobile navigation.** Added fixed accessible Dashboard/My reports/New request navigation below `lg`; independently observed all actions in the 320px browser accessibility tree. Files: `src/app/page.tsx`. Manual 768/1024/1440 and keyboard traversal remains recommended. Drill-down work remains IMP-08.
- [x] **IMP-06: Persist language preference and expose it on mobile.** Persisted validated local preference and exposed the selector at small widths. Files: `src/components/language-provider.tsx`, `src/app/page.tsx`. Tests: storage safeguards plus manual 320px English selection/reload verification.
- [x] **IMP-07: Make workload chart dialog accessible.** Added initial focus, Tab trap, Escape close, focus restoration and labelled close action. Files: `src/components/request-status-chart.tsx`. Manual browser check confirmed initial close control focus and Escape close; lint/build pass.
- [~] **IMP-13: Keep sign out reachable on mobile.** Added the shared sign-out control to the 320px bottom navigation. Files: `src/app/page.tsx`. The control is visible in the accessibility tree; independent sign-out completion could not be conclusively automated because browser-control clicks were intercepted by the dev-tools overlay. Recheck manually before release.

### P2 — Improve soon

- [ ] **IMP-05: Make or remove false dashboard controls.** Implement accessible request search with no-results/clear and make guide/notification controls truthful. Files: `src/app/page.tsx`, tests. Dependencies: report state from IMP-03. Verify keyboard behavior and public/private copy.
- [ ] **IMP-08: Make recent-request rows actionable.** Link requester-owned dashboard rows to their protected detail page and use a clear sign-in action for public summaries rather than a decorative chevron. Files: `src/app/page.tsx`, UI tests. Dependencies: IMP-02 callback behavior. Verify mouse/keyboard opening and no public private-data access.
- [ ] **IMP-09: Add attachment selection feedback.** Render files, removal, client validation, progress/error states. Files: `src/app/page.tsx`, upload tests. Dependencies: IMP-03 messaging. Verify valid/invalid/failed selection.
- [ ] **IMP-10: Build regression coverage.** Add integration/E2E/a11y coverage for implemented P0/P1 work and document remaining manual test matrix. Files: tests/tooling. Dependencies: implementation tasks. Verify CI commands.

### P3 — Polish later

- [ ] **IMP-11: Clarify public dashboard ownership language.** Use system-wide wording for visitors and personal wording only for signed-in users. Files: `src/app/page.tsx`. Verify Thai/English copy.
- [ ] **IMP-12: Translate remaining role-workspace sidebar labels.** Route role navigation labels through the existing language layer. Files: `src/app/page.tsx`. Verify Thai/English at all widths.

## 9. Suggested implementation order

1. Reproduce/capture IMP-01 and establish controlled API/client response contracts.
2. Complete IMP-02 and IMP-03 so auth and failures recover correctly.
3. Implement IMP-04 and IMP-06 to restore mobile/core navigation and persistent language.
4. Implement IMP-07 accessibility before adding richer chart interactions.
5. Implement IMP-05 and IMP-09 after shared state/messaging patterns exist.
6. Add/expand IMP-10 regression coverage and run full manual matrix.
7. Complete P3 copy polish.

## 10. Final audit verdict

**Broken:** several promised controls remain inert; error-recovery and mobile sign-out completion still need final verification.

**Confusing:** public possessive wording, decorative chevrons, invisible attachment selection, inactive bell/search/guide controls.

**Missing:** API/browser regression coverage, simulated failure coverage, search/notification/guide behavior, request drill-down, attachment selection feedback, and final manual responsive checks.

**Works well:** local app/services start, role API boundaries reject requester admin/staff access, public data is sanitized, seeded queues load, workflow unit tests pass.

**Five highest-priority improvements:** IMP-03 failure-path verification; IMP-13 mobile sign-out verification; IMP-05 truthful dashboard controls; IMP-09 attachment feedback; IMP-10 regression coverage.

**Production readiness:** No. The P0 flow is repaired and verified, but P1 verification and P2 reliability/quality work remain.

## Implementation and regression record

- Issues discovered: 13 (one P0, six P1, four P2, two P3).
- Fixed and verified: 5 (IMP-01, IMP-02, IMP-04, IMP-06, IMP-07).
- Implemented awaiting independent verification: 2 (IMP-03, IMP-13).
- Remaining: 8.
- Blocked: none; browser/mobile/manual coverage remains a known test limitation.
- Tests executed during audit/remediation: `npm test` (9 passing), local HTTP/API checks, QA Chromium desktop checks, manual browser requester submission, 320px navigation/language/dialog checks, `npm run lint`, `npm run build`, `npx prisma validate`, and whitespace checks.
- Final release recommendation: **do not release** pending IMP-03/IMP-13 verification and P2 regression coverage.
