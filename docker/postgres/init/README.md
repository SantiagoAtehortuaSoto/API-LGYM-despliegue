# PostgreSQL init scripts

Put `.sql` files in this folder if you want automatic initialization.

- Files run only when the `pg_data` volume is empty.
- Execution order is alphabetical.
- Example: `01-schema.sql`, `02-seed.sql`.
- Current setup:
  - `00-extensions.sql`
  - `01-db-settings.sql`
- App catalog/data seeds are in `scripts/sql` and should run after `npm run db:sync`.
