# StudyFlow Database Architecture (`db/`)

This directory houses the authoritative database schema for StudyFlow, engineered to PostgreSQL 15+ and Supabase standards.

---

## 📁 Files
- **[`schema.sql`](file:///home/kagz03/VS%20Code/studyflow/db/schema.sql)**: Complete DDL script including extensions, enums, tables, composite foreign keys, triggers, Row Level Security (RLS) policies, and performance indexes.

---

## 🔒 Hard Architectural Invariants Enforced in DDL

| Invariant | How it is Enforced |
|---|---|
| **Composite Foreign Keys** | Every foreign key references `(user_id, parent_id)`. Cross-tenant data leaks are mathematically impossible at the database engine level. |
| **User ID Immutability** | Trigger `fn_prevent_user_id_change` runs `BEFORE UPDATE` on every table, strictly aborting any mutation of `user_id`. |
| **Timer Exclusivity** | The primary key of `public.timers` is `user_id`, guaranteeing at most 1 active timer per student. |
| **Zero-Drift Timer** | Running timers record `ends_at TIMESTAMPTZ`. Countdown ticks are computed purely on the client with zero database polling writes. |
| **Derived Status** | Assignment status is a PostgreSQL `STORED GENERATED ALWAYS AS` column derived directly from `progress` (100 = completed, >0 = in_progress, 0 = pending). |
| **Immutable Focus Ledger** | `focus_sessions` has an explicit RLS rule denying all `UPDATE` queries. Completed sessions are immutable historical logs. |
| **Import Deduping** | `local_storage_import_runs` enforces `UNIQUE (user_id, payload_hash)` with SHA-256 validation to prevent repeat migration runs. |

---

## 🚀 Applying the Schema

### Local PostgreSQL or Supabase CLI
```bash
# Using Supabase CLI
supabase db reset
# Or directly with psql
psql -h localhost -U postgres -d studyflow -f db/schema.sql
```

