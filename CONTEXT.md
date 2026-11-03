# StudyFlow — Project Context & Shared Terminology (CONTEXT.md)

**Document Version**: 2.0.0  
**Status**: Authoritative Context & Terminology Reference  
**Last Updated**: November 2026  

---

## 1. Project Overview & Tri-Agent Roles

StudyFlow is a student productivity and academic task tracking web application. The development follows a structured tri-agent collaboration framework:
- **21 (Product Owner / Human Leader)**: Sets vision, approves architecture, authorizes production deployments and migrations.
- **ChatGPT (Supervisor / Lead Architect / QA Lead)**: Defines task specifications, reviews architecture and code deliverables, conducts QA audits.
- **Antigravity / Agy (Lead Full-Stack Engineer / Builder)**: Executes task specifications, develops code, enforces database integrity, verifies builds, and coordinates deployment.
- **Claude Sonnet (Adversarial Critic / Security Specialist)**: Conducts hostile architectural roasts, identifies database RLS bypasses, race conditions, edge-case traps, and clock drift vulnerabilities.

---

## 2. Core Project Terminology & Definitions

| Term | Exact Definition | Anti-Definition (What it is NOT) |
|---|---|---|
| **Course** | An academic subject or module (e.g. CS 101) owned by a user, possessing a unique code, title, and color. | NOT a generic tag; courses are primary relational parents of assignments. |
| **Assignment** | A discrete academic obligation with a mandatory title, course linkage, due timestamp, priority flag, and progress percentage. | NOT a calendar event; an assignment represents work to be completed by a deadline. |
| **Focus Session** | A completed Pomodoro study interval recorded in `focus_sessions` containing duration, mode, and start/end timestamps. | NOT an active timer; focus sessions represent immutable completed historical records. |
| **Timer (`timers` table)** | A single, mutable row per user representing the active timer state (`idle`, `running`, or `paused`). | NOT a client-side `setInterval`; the timer is server-authoritative and driven by `ends_at`. |
| **Calendar Block** | A recurring weekly study time slot anchored to local wall-clock time (`start_time`, `duration_minutes`, `day_of_week 1..7`). | NOT an absolute instant; calendar blocks repeat weekly regardless of daylight saving shifts. |
| **Import Ledger** | The database table `local_storage_import_runs` tracking client migration execution via SHA-256 payload hashing. | NOT a database migration tracking table; it tracks client LocalStorage onboarding runs. |
| **Derived Status** | Assignment status evaluated dynamically: `progress = 100` -> `'completed'`, `0 < progress < 100` -> `'in_progress'`, `progress = 0` -> `'not_started'`. | NOT an independently mutable database column that can contradict `progress`. |
| **5-Point Cache Purge** | Mandatory sign-out sequence clearing: (1) query cancel, (2) query clear, (3) store reset, (4) localStorage clear, (5) realtime channel teardown. | NOT a simple redirect to `/login`; guaranteed multi-tenant data isolation on shared library PCs. |

---

## 3. Hard Architectural Invariants

1. **Composite Foreign Key Invariant**: Every foreign key pointing to a user-owned entity MUST include `user_id` in the key definition (e.g., `(user_id, course_id) REFERENCES courses (user_id, id)`). No table shall ever reference another table by `id` alone without enforcing matching tenant ownership.
2. **User ID Immutability Invariant**: The `user_id` column of any row in PostgreSQL is strictly immutable. Any `UPDATE` query attempting to modify `user_id` is aborted by trigger `fn_prevent_user_id_change`.
3. **Timer Exclusivity Invariant**: A user may have at most ONE active timer row. The primary key of `public.timers` is `user_id`.
4. **Zero-Drift Timer Invariant**: While running, timers are defined by `ends_at TIMESTAMPTZ`. Ticking is purely client display math; zero database updates occur during normal countdown.
5. **Progress Preservation Invariant**: Unchecking a completed assignment sets `completed_at = NULL` and restores `previous_progress`. It NEVER destructive-resets student work down to 0%.
6. **Online-First Offline Invariant**: Offline state allows read-only viewing of previously cached queries with a persistent banner. Destructive mutations are disabled while disconnected.
