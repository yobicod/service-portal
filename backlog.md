# Maintenance System Backlog

## Project context

- Product: Service Portal, a customer-configurable, role-based web service for reporting, managing, completing, and verifying maintenance issues.
- Visual direction: a restrained orange/white/charcoal service portal with Thai-first language support, compact tables, status badges, and service-dashboard layouts.
- Initial user journey: User submits issue → Admin reviews → approve/reject → Admin assigns staff → Staff repairs and reports completion → Admin verifies/returns for revision → Admin closes → user is notified.

## Roles and permissions

- User: creates reports, views only their reports, reads timelines, and can comment.
- Admin: reviews, approves/rejects, assigns tasks, monitors work, requests revisions, and closes verified work.
- Staff: sees only assigned tasks, starts work, updates progress, and submits completion.

## Status model

### Report statuses

`SUBMITTED`, `UNDER_REVIEW`, `REJECTED`, `APPROVED`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED_BY_STAFF`, `NEEDS_REVISION`, `CLOSED`.

`REJECTED` is terminal. The intended successful path is `SUBMITTED → APPROVED → ASSIGNED → IN_PROGRESS → COMPLETED_BY_STAFF → CLOSED`; revision returns work to staff.

### Task statuses

`ASSIGNED`, `IN_PROGRESS`, `COMPLETED_BY_STAFF`, `NEEDS_REVISION`, `CLOSED`.

Every status change must generate a `StatusLog` audit record.

## Implemented

- Next.js 16.2.12 TypeScript/Tailwind application with a generic requester dashboard, report list, and report form.
- Customer-facing branding is centralized in `src/lib/app-config.ts` and can be overridden with `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_NAME_TH`, and `NEXT_PUBLIC_APP_SHORT_NAME`.
- PostgreSQL/Prisma 7 data model: `User`, `MaintenanceReport`, `MaintenanceTask`, `Attachment`, `Comment`, and `StatusLog`.
- Docker PostgreSQL 16 in `docker-compose.yml`, persistent named volume, health check, and `.env.example` connection string.
- Docker MinIO with private S3-compatible report, task-evidence, and comment attachments; server-side upload validation; session-authorized downloads; and attachment links in the requester and staff workspaces.
- Initial Prisma migration in `prisma/migrations/` and an idempotent `prisma/seed.ts` script. The seed includes 14 demo requests, giving the public “View all” queue two pages for pagination testing.
- Seed identities: `demo-requester` (USER), `demo-admin` (ADMIN), and `demo-staff` (STAFF). These IDs are development-only and are safe to reference in local UI code.
- Auth.js Credentials authentication with signed JWT sessions, login page, role-aware Next.js proxy, password hashes stored in PostgreSQL, and server-side API authorization. Development headers have been removed.
- A shared Auth.js sign-out control is available in requester and admin workspaces.
- Sidebar navigation reads the signed-in role and shows only the matching admin or staff workspace link; requester accounts do not see staff/admin navigation.
- The root dashboard is public. The My reports menu is shown only to signed-in users; visitor request-submission actions redirect to login, while protected pages and APIs remain server-authorized.
- The public dashboard reads a sanitized, read-only feed of every system request (no reporter identity, description, comments, attachments, or detail access).
- Thai is the default UI language with a Thai/English selector shared across the application.
- Thai UI uses IBM Plex Sans Thai (weights 400–700) for a clearer, more polished service-dashboard appearance; English continues using Geist.
- Language preferences are validated and saved in browser storage, then restored after hydration so Thai/English selection persists across navigation, reload, and authentication without a hydration mismatch.
- Sign-in redirects accept only same-origin absolute-path callback destinations; invalid or external destinations safely fall back to the dashboard.
- The expanded workload chart behaves as a keyboard dialog: it receives initial focus, traps Tab navigation, closes with Escape, and restores focus to its trigger.
- Thai/English switching covers the requester portal, sign-in, admin and staff workspaces, request details, workload chart, shared sign-out control, workflow statuses, priorities, and form controls; Thai is shown by default.
- Public-dashboard sign-in, guest, and service labels follow the selected Thai/English language as well.
- User API: create/list/report detail/comments.
- Admin API: list reports and staff, approve/reject with a recorded reason, assign tasks, and verify/close or request revision.
- Staff API: list assigned tasks and start/progress/complete actions.
- Functional `/admin` and `/staff` workspaces connected to the PostgreSQL API. Requester portal links to both as temporary demo navigation.
- Admin assignment panel with selectable staff, due date, priority, instructions, and estimated cost. The task API validates and persists these values.
- Admin Reports queue uses workflow-matched color chips for every report status.
- Requester report-detail route at `/reports/:id` with live task state, audit timeline, and persisted comments. The report list links to detail records loaded from the API.
- Requester dashboard includes a live maintenance-workload status chart that can be expanded into a full-screen modal.
- Dashboard “View all” replaces the dashboard content with a server-paginated, summary-only system request queue (10 requests per page). The public API returns just the requested page, total pagination metadata, and aggregate status counts for accurate dashboard metrics and charts.
- My reports is server-paginated (10 requests per page) and always scoped to the signed-in reporter. Its status filter is part of the backend query, preserving correct results and totals across every page.
- A public “How it works” menu explains the request lifecycle with an automatically advancing, pulsing five-stage animation, selectable steps, role labels, and clear rejected/revision paths in Thai and English.
- New-request location uses a required place description plus an OpenStreetMap preview and optional browser-geolocation coordinates, stored on the maintenance report. Every request-detail page shows a map: an OpenStreetMap pinpoint for saved coordinates or a place-description map search for older requests without coordinates.
- Shared workflow-rule module used by report review, assignment, staff updates, and verification APIs; Node-based tests cover valid and invalid status transitions.
- A full Chromium interaction audit now covers public, requester, admin, and staff flows at desktop, tablet, and mobile widths. Confirmed fixes include safe credential errors/callback continuation, truthful dashboard controls, responsive navigation and report cards, attachment selection/removal, accessible workflow confirmations, explicit load/error/retry states, map coordinate/fallback handling, and rapid-click protection.
- Workflow mutation routes atomically claim the expected task/report status before writing tasks or status logs. Concurrent repeated review, assignment, staff-transition, and verification requests receive a controlled conflict instead of creating duplicate records.
- Checks last passed: `npx prisma validate`, `npm run lint`, `npm test`, and `npm run build`. The test pre-step generates Prisma Client so clean CI checkouts can run tests without committed generated code; CI also supplies non-secret build-only service configuration because Next.js evaluates API modules during the production build.

## Local development

```bash
npm install
docker compose up -d
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

- The Docker database is already running locally when this backlog was last updated.
- Do not use Homebrew PostgreSQL for this project; Docker owns local port 5432.
- `.env` is ignored. Do not add its credentials to Git or this file.
- `account-test.md` is an ignored local-only reference for seeded test-account credentials. Do not add credentials to this backlog.

## Current technical constraints

- The independent interaction audit is tracked in `improve.md`. Its P0/P1 interaction work and the dashboard/drill-down/attachment P2 items are implemented and independently verified in local Chromium. Browser artifacts are stored under `output/playwright/`. CI-runnable browser tests, other browser engines, and screen-reader coverage remain follow-up work.
- Do not run `npm test` or another Prisma generation command while `next dev` is serving an active browser QA session. The generated-client rewrite can trigger invalid Fast Refresh chunks. For a clean local QA runtime, stop the server, regenerate first, then start it. Next.js 16.2.12 Turbopack also panicked on `/staff` during this audit; `next dev --webpack` was the stable local QA fallback.

- Email/password authentication is implemented for the first release. It does not yet include registration, invitations, password reset, email verification, lockout/rate limiting, or future organization SSO/OIDC support.
- Local MinIO is the chosen S3-compatible attachment provider. It runs through Docker Compose with a private bucket created by the application on first upload; production credentials must be replaced before deployment.
- Attachments support JPG, PNG, WEBP, and PDF files up to 10MB. Report, task, and comment uploads plus downloads are session-authorized. JPG, PNG, and WEBP attachments render as secure inline thumbnails; PDFs remain filename links.
- Email/in-app notification delivery, advanced filtering, and endpoint/integration coverage are not implemented. Dashboard search and server pagination are implemented.
- Prisma 7 uses `@prisma/adapter-pg` with `pg`; regenerate the client after schema edits.
- `predev` and `prebuild` regenerate the Prisma client. After migrations or schema changes, restart the development server; a running process can retain the previous generated client and cause credential sign-in to fail.

## Next prioritized work

1. Add registration/invitation, password reset, email verification, lockout/rate limiting, and a migration path to organization SSO/OIDC.
2. Add user-facing email/in-app notification delivery.
3. Add endpoint/integration tests for session authorization and database transaction behavior.
4. Add CI browser regression coverage, cross-browser/screen-reader checks, and production deployment configuration.
5. Add endpoint/integration tests for language-sensitive client messages, session authorization, and concurrent transaction behavior.

## Agent instructions

- Read this file before work and update it in the same change whenever project state changes.
- Respect `AGENTS.md`: read applicable Next.js 16 documentation from `node_modules/next/dist/docs/` before changing Next.js code.
- Preserve existing user data and unrelated changes. Never store secrets in this file.
