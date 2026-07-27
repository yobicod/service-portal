# Service Portal

[![CI](https://github.com/yobicod/service-portal/actions/workflows/ci.yml/badge.svg)](https://github.com/yobicod/service-portal/actions/workflows/ci.yml)

An open-source, role-based service portal for reporting, assigning, and resolving maintenance requests. It is Thai-first, configurable for different customers, and built with Next.js, PostgreSQL, Prisma, and MinIO.

> This project is intended as a configurable starting point. Set the public application-name environment variables before deployment.

Change customer-facing branding in `.env` with `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_NAME_TH`, and `NEXT_PUBLIC_APP_SHORT_NAME`.

## Local setup

1. Install packages with `npm install`.
2. Start PostgreSQL with Docker Compose:

   ```bash
   docker compose up -d
   ```

3. Copy `.env.example` to `.env` if needed. The default value connects to the Docker database.
4. Generate and apply the schema:

   ```bash
   npm run db:generate
   npm run db:migrate -- --name init
   ```

5. Start the application with `npm run dev`.

After applying a Prisma migration or changing the schema, run `npm run db:generate`, rerun `npm run db:seed` when working with the demo accounts, and restart `npm run dev`. This reloads the generated Prisma client used by credential sign-in.

The seed script creates local demonstration accounts for requester, administrator, and staff roles. They use development-only credentials defined in `prisma/seed.ts`; record any local test credentials in the ignored `account-test.md` file. Change `AUTH_SECRET` and replace all demonstration accounts before deploying.

## Backend workflow

The API enforces these valid workflow stages:

```text
Submitted → Approved → Assigned → In Progress → Completed by Staff → Closed
                         ↑                              ↓
                         └──────── Needs Revision ───────┘
```

Rejected reports are terminal. Each transition creates a `StatusLog` entry for the audit trail.

## Authentication

Email/password sessions are provided by Auth.js Credentials. API authorization reads the signed session and validates each user role server-side. The local seed accounts are for development only.

## Attachment storage

MinIO provides private local S3-compatible storage at `http://localhost:9000`; its console is available at `http://localhost:9001`. The application creates the `maintenance-attachments` bucket when the first attachment is uploaded. Store production S3-compatible credentials only in environment variables.

## Core routes

| Route                                 | Access                  | Purpose                                      |
| ------------------------------------- | ----------------------- | -------------------------------------------- |
| `POST /api/reports`                   | User                    | Submit a maintenance report                  |
| `GET /api/reports`                    | Signed-in user          | Paginated list of the current user’s reports |
| `GET /api/reports/:id`                | Authorized viewer       | Report detail, timeline, tasks, comments     |
| `POST /api/reports/:id/comments`      | Authorized viewer       | Add a comment                                |
| `POST /api/reports/:id/attachments`   | Authorized viewer       | Upload report evidence                       |
| `POST /api/comments/:id/attachments`  | Authorized viewer       | Upload a comment attachment                  |
| `POST /api/tasks/:id/attachments`     | Assigned staff or Admin | Upload task evidence                         |
| `GET /api/attachments/:id`            | Authorized viewer       | Securely view or download an attachment      |
| `PATCH /api/admin/reports/:id/review` | Admin                   | Approve or reject a new report               |
| `POST /api/admin/tasks`               | Admin                   | Assign an approved report to staff           |
| `GET /api/staff/tasks`                | Staff                   | List the current staff member's tasks        |
| `PATCH /api/staff/tasks/:id`          | Assigned staff          | Start, update, or complete a task            |
| `PATCH /api/admin/tasks/:id/verify`   | Admin                   | Close work or request revision               |

## Verification

```bash
npm run lint
npm run build
npm test
```

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request. Security vulnerabilities should be reported privately as described in [SECURITY.md](SECURITY.md).

## License

This project is released under the [MIT License](LICENSE).
