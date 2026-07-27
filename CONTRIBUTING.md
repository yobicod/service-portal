# Contributing to Service Portal

Thanks for contributing.

## Before you begin

- Read the README and run the application locally with Docker PostgreSQL and MinIO.
- Discuss substantial product or architectural changes in an issue before implementing them.
- Never commit credentials, local `.env` files, seeded-account passwords, or production data.

## Pull requests

1. Create a focused branch from `main`.
2. Keep the change scoped and update documentation when behavior or configuration changes.
3. Run `npm run lint`, `npm test`, and `npm run build` before opening a pull request.
4. Describe the user-facing outcome and any database migration or configuration impact.

## Code style

- Use TypeScript and the project formatter/linter.
- Preserve authorization boundaries: users can access only their own reports; staff access assigned work; admins use dedicated administration APIs.
- Include tests for workflow, validation, authorization, or pagination changes where practical.

By contributing, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
