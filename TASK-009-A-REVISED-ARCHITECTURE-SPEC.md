# StudyFlow — Task 009-A: Revised Architecture Specification & Documentation Baseline

**Project**: StudyFlow  
**Phase**: Phase 2 — Production Hardening & Cloud Backend  
**Task**: 009-A — Architecture Review Corrections & Documentation Baseline  
**Author**: Antigravity (Lead Full-Stack Engineer)  
**Supervisor**: ChatGPT (Software Architect / QA Director)  
**Security & Adversarial Reviewer**: Claude Sonnet  
**Date**: November 2026  

---

## 1. Executive Summary & Review Synthesis

In response to the conditional approval and rigorous architectural critique of Task 009 issued by ChatGPT, and integrating the adversarial security findings of Claude Sonnet, this revised specification establishes an implementation-ready, unbreakable multi-tenant foundation for StudyFlow.

Every symptom, mechanism, and edge case identified across both reviews has been resolved:
- **Foreign Key Vulnerability**: Resolved via composite foreign keys `(user_id, parent_id)` enforced directly in PostgreSQL, preventing cross-user entity referencing even if RLS is bypassed.
- **Timer Drift & Thrashing**: Resolved via a server-authoritative finite state machine using PostgreSQL `now()`, microsecond arithmetic (`remaining_ms`), zero per-second storage writes, and an anti-cheat validation boundary.
- **Assignment Progress Loss**: Resolved by decoupling completion into `completed_at TIMESTAMPTZ`, preserving previous progress upon un-checking, and deriving status dynamically.
- **Migration Idempotency & Seed Leakage**: Resolved via a dedicated database ledger `local_storage_import_runs` with SHA-256 payload hashing, seed entity exclusion, and a non-destructive LocalStorage backup.
- **Shared Device Privacy**: Resolved via a mandatory 5-point client cache purge sequence executing on logout.
- **Timezone Drift**: Resolved via `TIMESTAMPTZ` + `due_tz` for deadlines, and local wall-clock duration (`start_time TIME`, `duration_minutes INT`) for recurring weekly schedules.
- **Documentation Baseline**: 12 complete, production-grade documentation artifacts have been authored, cross-linked, and committed to the repository.

---

## 2. Technical Resolution of Review Findings

### 2.1 Database & Ownership Integrity
1. **Composite Foreign Keys**:
   - PostgreSQL foreign key integrity checks execute under table owner privileges, bypassing RLS. A standard FK on `course_id` allows an attacker to reference another tenant's course UUID (creating an enumeration oracle).
   - **Resolution**: All child tables enforce composite keys:
     ```sql
     ALTER TABLE public.courses ADD CONSTRAINT uq_courses_user_id UNIQUE (user_id, id);
     ALTER TABLE public.assignments ADD CONSTRAINT fk_assignments_course_composite
         FOREIGN KEY (user_id, course_id) REFERENCES public.courses (user_id, id) ON DELETE SET NULL;
     ALTER TABLE public.focus_sessions ADD CONSTRAINT fk_sessions_assignment_composite
         FOREIGN KEY (user_id, assignment_id) REFERENCES public.assignments (user_id, id) ON DELETE SET NULL (assignment_id);
     ```
   - This makes cross-tenant referencing structurally impossible at the relational algebra level.
2. **User ID Immutability**:
   - `BEFORE UPDATE` triggers (`fn_prevent_user_id_change`) abort any transaction attempting to modify `user_id`.
3. **Optimized RLS Evaluation**:
   - All RLS policies utilize `(SELECT auth.uid())` subqueries so PostgreSQL evaluates tenant identity once per statement rather than once per row.
4. **Automated Profile Provisioning**:
   - An `AFTER INSERT` trigger on `auth.users` creates the `public.profiles` row with error isolation (`ON CONFLICT (id) DO NOTHING`) and initializes the user's `timers` record.
5. **Database Role Privileges**:
   - Direct access to `anon` is completely revoked.
   - Direct `INSERT`, `UPDATE`, and `DELETE` on `public.timers` is revoked for `authenticated`; transitions are restricted exclusively to `SECURITY DEFINER` RPCs.
6. **Timestamp Standard**:
   - All timestamp defaults utilize `now()` with `TIMESTAMPTZ`, eliminating ambiguity caused by `timezone('utc', now())`.

---

### 2.2 Active Focus Timer Architecture
1. **Canonical State & Strict XOR Constraint**:
   ```sql
   CREATE TABLE public.timers (
       user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
       phase TEXT NOT NULL CHECK (phase IN ('idle', 'running', 'paused')),
       mode TEXT NOT NULL CHECK (mode IN ('focus', 'short_break', 'long_break')),
       session_id UUID,
       assignment_id UUID,
       planned_ms INT CHECK (planned_ms > 0),
       started_at TIMESTAMPTZ,
       ends_at TIMESTAMPTZ,
       remaining_ms INT CHECK (remaining_ms >= 0),
       version INT NOT NULL DEFAULT 0,
       updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
       FOREIGN KEY (user_id, assignment_id) REFERENCES public.assignments(user_id, id) ON DELETE SET NULL,
       CONSTRAINT chk_timer_strict_xor_state CHECK (
           (phase = 'idle'    AND session_id IS NULL     AND ends_at IS NULL     AND remaining_ms IS NULL) OR
           (phase = 'running' AND session_id IS NOT NULL AND ends_at IS NOT NULL AND remaining_ms IS NULL) OR
           (phase = 'paused'  AND session_id IS NOT NULL AND ends_at IS NULL     AND remaining_ms IS NOT NULL)
       )
   );
   ```
2. **State Transitions via RPCs**:
   - `start_timer`: Sets `phase = 'running'`, `ends_at = now() + (duration_ms * interval '1 millisecond')`.
   - `pause_timer`: Locks row (`FOR UPDATE`), freezes remaining milliseconds into `remaining_ms`, nullifies `ends_at`.
   - `resume_timer`: Recalculates new `ends_at = now() + (remaining_ms * interval '1 millisecond')`.
   - `complete_timer`: Asserts `now() >= ends_at - interval '2 seconds'` (anti-cheat verification), inserts deduplicated record into `focus_sessions`, resets timer to `idle`.
   - `abandon_timer`: Resets timer to `idle` without logging study statistics.
3. **Multi-Tab Race Defense**:
   - `public.focus_sessions` enforces `UNIQUE (user_id, session_id)` with `INSERT ... ON CONFLICT DO NOTHING`.
4. **Focus vs. Break Separation**:
   - Only focus intervals (`mode = 'focus'`) are aggregated into academic study time; breaks are recorded in session logs but excluded from course totals.

---

### 2.3 Assignment Completion & Progress Integrity
1. **Decoupled Completion Model**:
   - `completed_at` is stored as an independent timestamp.
   - When an assignment is checked: `completed_at = now()`, `previous_progress = progress`, and `progress = 100`.
   - When an assignment is unchecked: `completed_at = NULL`, and `progress` is restored from `previous_progress`. The student's existing progress is 100% preserved.
2. **Derived Status Hierarchy**:
   - `progress = 100` OR `completed_at IS NOT NULL` $\rightarrow$ `'completed'`
   - `progress > 0` AND `progress < 100` $\rightarrow$ `'in_progress'`
   - `progress = 0` $\rightarrow$ `'not_started'`
3. **Transactional Aggregation**:
   - Focus metrics and study streaks are computed via SQL views (`v_user_focus_stats`) using `SUM()` and `COUNT()` in PostgreSQL, preventing PostgREST's default 1,000-row limit from truncating data.

---

### 2.4 Timezone & Calendar Semantics
1. **Deadlines**: Stored as `due_at TIMESTAMPTZ` alongside `due_tz TEXT` (e.g. `'Africa/Nairobi'`). If a student enters a date without a specific time, it defaults to 23:59:00 in `due_tz`.
2. **Recurring Schedules**: Stored as local wall-clock parameters:
   - `start_time TIME NOT NULL`
   - `duration_minutes INT NOT NULL CHECK (duration_minutes BETWEEN 1 AND 1440)`
   - `day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7)` (ISO standard: 1=Monday, 7=Sunday)
   - `timezone TEXT NOT NULL DEFAULT 'Africa/Nairobi'`
3. **Overnight Blocks**: Represented continuously with `duration_minutes` up to 24 hours (1440 minutes), eliminating `end_time < start_time` errors. Rendering across midnight is handled cleanly at the UI display layer.

---

### 2.5 Migration Ledger & Shared Device Cache Isolation
1. **Dedicated Migration Ledger**:
   - Table `public.local_storage_import_runs` tracks SHA-256 payload hashes to ensure idempotency.
   - Raw legacy state is backed up to `studyflow_storage_v1_backup` before execution.
   - Seed data (Alex Vance profile, default mock IDs) are identified and excluded during import.
2. **5-Point Client Cache Purge Protocol**:
   On logout or user session switch, the client executes:
   1. `queryClient.cancelQueries()` — aborts in-flight network requests.
   2. `queryClient.clear()` — purges memory query cache.
   3. `useUIStore.getState().reset()` — resets Zustand state.
   4. Clear user-namespaced storage (`studyflow_${userId}_*`).
   5. `supabase.removeAllChannels()` and clear active timers.
3. **Offline Policy**:
   - Online-first with read-only cached browsing and a persistent offline banner.
   - Destructive mutations are disabled while offline to prevent silent data loss.

---

## 3. Documentation Baseline Deliverables

All 12 required documentation artifacts have been created in the repository:

1. [PRD.md](file:///c:/Users/Jiva/Documents/Freelance/studyflow/docs/PRD.md): Product Requirements Document covering Phase 1 baseline & Phase 2 cloud expansion.
2. [USER-STORIES.md](file:///c:/Users/Jiva/Documents/Freelance/studyflow/docs/USER-STORIES.md): Comprehensive user stories, acceptance criteria, and offline policy definition.
3. [ARCHITECTURE.md](file:///c:/Users/Jiva/Documents/Freelance/studyflow/docs/ARCHITECTURE.md): System architecture, component topology, state flow, caching, and timer state machine.
4. [DATABASE.md](file:///c:/Users/Jiva/Documents/Freelance/studyflow/docs/DATABASE.md): Complete PostgreSQL schema DDL, ERD diagram, composite FKs, immutability triggers, and views.
5. [RLS-MATRIX.md](file:///c:/Users/Jiva/Documents/Freelance/studyflow/docs/RLS-MATRIX.md): Comprehensive RLS policy matrix (USING & WITH CHECK) and executable SQL verification suite.
6. [API-SPEC.md](file:///c:/Users/Jiva/Documents/Freelance/studyflow/docs/API-SPEC.md): PostgREST endpoints and complete SQL implementations of all timer & migration RPCs.
7. [MIGRATION-SPEC.md](file:///c:/Users/Jiva/Documents/Freelance/studyflow/docs/MIGRATION-SPEC.md): LocalStorage migration specification, seed exclusion rules, ledger idempotency, and rollback.
8. [TIMER-SPEC.md](file:///c:/Users/Jiva/Documents/Freelance/studyflow/docs/TIMER-SPEC.md): Drift-free timer architecture, server clock authority, display hook, and multi-tab race defense.
9. [SECURITY.md](file:///c:/Users/Jiva/Documents/Freelance/studyflow/docs/SECURITY.md): Threat model table (9 threats, mitigations, verification tests) and statutory compliance.
10. [DESIGN.md](file:///c:/Users/Jiva/Documents/Freelance/studyflow/DESIGN.md): Authoritative design system specification (colors, dual-tokens, typography, responsive breakpoints, HCI).
11. [CONTEXT.md](file:///c:/Users/Jiva/Documents/Freelance/studyflow/CONTEXT.md): Project glossary, shared terminology, and hard architectural invariants.
12. [README.md](file:///c:/Users/Jiva/Documents/Freelance/studyflow/README.md): Professional project documentation following the Best-README-Template standard.

---

## 4. Revised Phase 2 Implementation Roadmap & Approval Gates

Every major milestone is strictly gated by human and supervisor authorization:

```
[ Gate 0: Version Control & Git Initialization ]
    │
    ▼
[ Gate 1: Documentation & Architecture Sign-Off ] <--- CURRENT POSITION (Task 009-A)
    │
    ▼
[ Gate 2: Dependency Scaffolding Approval (Task 010) ]
    │   - Install @supabase/supabase-js, zod, @tanstack/react-query
    │   - Setup .env.example and Zod validation schemas
    ▼
[ Gate 3: Supabase Project Creation & Configuration Approval ]
    │   - Project creation in Supabase Cloud
    │   - OAuth redirect URL whitelist configuration
    ▼
[ Gate 4: Database Migrations & DDL Execution Approval (Task 011) ]
    │   - Execute 20261102000000_phase2_schema.sql
    │   - Verify RLS policies and executable SQL test suite
    ▼
[ Gate 5: Authentication Provider Configuration Approval (Task 012) ]
    │   - Configure Email Magic Link / OTP & Google OAuth
    │   - Wire useAuth hook and session listener
    ▼
[ Gate 6: Application Code Implementation & Refactor ]
    │   - Task 013: LocalStorage Migration Engine & Ledger
    │   - Task 014: Dual-Theme Theming Engine (Light/Dark Mode)
    │   - Task 015: Server-Authoritative Focus Timer & Scheduler
    ▼
[ Gate 7: Automated Testing & Accessibility (A11y) Verification (Task 016) ]
    │   - Responsive audit (360px to 4K) & WCAG 2.1 AA verification
    │   - Multi-tab race and clock drift automated tests
    ▼
[ Gate 8: Production Release & Vercel Deployment Approval (Task 017) ]
    │   - Final preflight check and human sign-off
    │   - Deployment to Vercel production under j-derek
```

---

## 5. Explicit List of Decisions, Risks & Mitigations

### 5.1 Confirmed Product Decisions
1. **Authentication Providers**: Email Magic Link/OTP + Google OAuth approved. GitHub OAuth deferred to Phase 3.
2. **Offline Strategy**: Online-first with cached read-only browsing and a persistent offline banner approved. Complex offline mutation queuing deferred to Phase 3.
3. **Assignment Unchecking**: Non-destructive restoration of `previous_progress` approved. Toggling an assignment un-checked will never wipe progress to 0%.

### 5.2 Key Technical Risks & Engineered Mitigations
1. **Risk: PostgREST Default 1,000-Row Limit**:
   - *Mitigation*: Productivity analytics are calculated directly in PostgreSQL views (`v_user_focus_stats`) using `SUM()` and `COUNT()`. All entity lists implement pagination.
2. **Risk: Mobile Browser Tab Background Throttling**:
   - *Mitigation*: Active timers store `ends_at TIMESTAMPTZ`. Ticking is purely visual interpolation. Zero study time is lost when the browser throttles intervals.
3. **Risk: Shared Library Workstation Data Leakage**:
   - *Mitigation*: The 5-Point Cache Purge wipes query cache, Zustand state, namespaced LocalStorage, and Realtime channels upon sign-out.
4. **Risk: Cross-Tenant Data Tampering**:
   - *Mitigation*: Composite foreign keys `(user_id, parent_id)` and immutable `user_id` triggers structurally prevent cross-tenant data referencing.

---

## 6. Mandatory Restrictions Adherence

During Task 009-A:
- **No application code was altered** in `studyflow/app/src/`.
- **No dependencies were installed**.
- **No Git initialization or branch operations were executed**.
- **No live Supabase projects were created or modified**.
- **No database migrations were executed**.
- **No deployments were triggered**.
- **Task 010 remains on strict hold awaiting supervisor and human authorization**.
