# CMS PostgreSQL baseline

This directory contains the self-hosted CMS schema. Django uses its own database and migrations; do not apply these files to the identity database.

## Applying

1. Create an **empty UTF-8 PostgreSQL database** with a dedicated owner/migration role.
2. In one transaction, apply `001-cms-schema.sql`, then `002-cms-guards.sql` and the runtime compatibility functions from `lib/postgres-compat.mjs` (installer owns that step).
3. Record successful migration in the installer's migration ledger. These SQL files deliberately do not hide a partially installed schema with `IF NOT EXISTS`.
4. Use a restricted runtime role with table/sequence/function access, no schema creation or trigger-disabling permission. Configure the runtime search path to its dedicated schema. Only the migration owner should create/replace functions.

`data` and date fields stay text to preserve existing application envelopes and ISO dates. SQLite INTEGER columns map to PostgreSQL bigint, retaining 64-bit range. The JavaScript adapter must preserve safe integer checks when decoding bigint.

## Guards and concurrency

There are 26 CMS tables and **33 active source trigger names**, preserved one-for-one. Source migrations have 36 CREATE TRIGGER statements because category insert/update and order-item validation were replaced later. The source-coverage test derives the active set in migration order, so adding a future source guard fails the parity check until PostgreSQL is updated.

Guard groups cover categories, content/footer/brand/payment assets, order channel, price/stock checks, points quota and per-member limit, immutable snapshots, order amounts/state/payment transitions, shared/SKU stock decrement and refund, protected SKU identity, stock revision and system order numbers.

The initial UAT retains SQLite's single-writer behavior using a transaction-scoped advisory lock on every CMS mutation statement. Order-item validation also locks the product row before reservation queries. This intentionally limits write concurrency for correctness; replacing it with granular locks is a separate performance change that needs concurrency tests. PostgreSQL transactions must use READ COMMITTED for the current fresh-snapshot guard behavior. Connection-pool transactions must retain the same connection. Reads remain concurrent.

Stock business logic remains in triggers; do not perform a second application-side deduction. Application multi-statement order creation must remain atomic. Identity-side credits/points still require the existing cross-service idempotency/recovery mechanism; CMS PostgreSQL does not turn that into a distributed transaction.

## Tests

`npm test` always performs source-schema/trigger parity. Real PostgreSQL checks are opt-in, so a skipped check is **not** a PostgreSQL acceptance pass:

```sh
PGSCHEMA_TEST_URL=postgresql://user@127.0.0.1:55439/cms_schema_test npm test
```

Use only a disposable test database whose name includes `test` or `corpus`. The test creates a random isolated schema, uses synthetic records, and drops that schema on completion. It verifies category/asset errors, cash order transitions/deduction/refund, snapshot immutability, stock revision, locked and paid SKU protection, points limit/quota, channels, UTC+8 numbering, and two concurrent buyers competing for the final unit.

## Import boundary

The approved UAT import includes reviewed content/configuration/assets only. Exclude orders, cart rows, addresses, payments, submissions, visits, sessions, audit histories and other private visitor records. Do not disable triggers to force excluded transaction history into UAT. Import assets before settings or content references; parent categories before children. Copy the approved media bytes through the filesystem bucket API, not into its internal object-container format directly.

Database integration checks do not establish browser, real-device, external payment, email or production acceptance.
