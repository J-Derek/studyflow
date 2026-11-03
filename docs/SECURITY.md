# StudyFlow — Threat Model & Security Specification

**Document Version**: 2.1.0 (Hardened & Verified)  
**Status**: Architecture Baseline Approved — Verification Grade  
**Last Updated**: November 2026  

---

## 1. Security Architecture Principles

StudyFlow enforces a **Zero Trust Client Model**:
- All client-side inputs (web browser, mobile browser) are treated as untrusted and potentially hostile.
- Business rules, authorization policies, and entity relationships are enforced strictly at the database engine level (PostgreSQL RLS, composite foreign keys, and triggers).
- Client-side validation (Zod) is utilized strictly for responsive UX feedback and payload normalization, never as an authorization or sanitization guarantee.

---

## 2. Comprehensive Threat Model Matrix

| Threat ID | Threat Description | Attack Path | Impact | Mitigation Architecture | Verification Test |
|---|---|---|---|---|---|
| **THR-01** | **Cross-User FK Spoofing** | Attacker calls PostgREST `INSERT INTO assignments (course_id, ...)` using a known UUID of Victim B's course. | Attacker associates coursework with victim's syllabus or probes existence of private course IDs (enumeration oracle). | Composite Foreign Key `FOREIGN KEY (user_id, course_id) REFERENCES courses (user_id, id) ON DELETE SET NULL (course_id)`. | SQL test: User A attempts insertion referencing User B's `course_id`; database throws `foreign_key_violation`. |
| **THR-02** | **Ownership Reassignment** | Attacker issues an `UPDATE assignments SET user_id = victim_id WHERE id = my_id`. | Cross-tenant data transfer or unauthorized record reassignment. | PostgreSQL `BEFORE UPDATE` trigger `fn_prevent_user_id_change` raises exception on any change to `user_id`. Also blocked by RLS `WITH CHECK`. | SQL test: Attacker updates row with altered `user_id`; trigger aborts transaction with error. |
| **THR-03** | **Shared Machine Cache Leakage** | Student signs in at library computer after previous student signed out. | Next student views prior student's private assignments and calendar via browser cache or memory. | 5-Point Cache Purge on sign-out: `queryClient.cancelQueries()`, `queryClient.clear()`, Zustand reset, LocalStorage clear, and Realtime unsubscribe (`removeAllChannels`). | E2E Playwright test: Sign in as A, populate data, sign out, sign in as B, assert DOM/Storage has zero User A traces. |
| **THR-04** | **Timer Stats Fabrication** | Attacker calls `complete_timer` RPC 5 seconds after starting a 25-minute Pomodoro. | Falsified study streaks and manipulated academic focus statistics. | Server-side clock check in `complete_timer`: asserts strict `now() >= ends_at` (zero early tolerance). | Automated RPC test: Call `complete_timer` before expiration; RPC raises `Timer has not expired yet`. |
| **THR-05** | **Multi-Tab Race Condition** | User opens timer in 5 tabs; all tabs trigger completion simultaneously at zero. | 5 duplicate focus sessions logged for 1 real focus round. | Table constraint `UNIQUE (user_id, session_id)` with `INSERT ... ON CONFLICT DO NOTHING`. | Concurrency test: 5 concurrent calls with identical `session_id`; exactly 1 row exists in `focus_sessions`. |
| **THR-06** | **Administrative Key Leakage** | Developer accidentally references `SUPABASE_SERVICE_ROLE_KEY` in Vite frontend source. | Total bypass of RLS; attacker gains full administrative access to entire database. | CI bundle linting: scan `dist/` for `service_role` tokens. Frontend code strictly references `VITE_SUPABASE_ANON_KEY`. | Static analysis script: grep build artifacts for secret patterns; fail CI if detected. |
| **THR-07** | **OAuth Redirect Interception** | Attacker sets up malicious redirect URI to capture student's auth token. | Account hijacking via token interception. | Supabase GoTrue redirect URL whitelist locked strictly to exact production and development origins (`https://app-beta-lilac-23.vercel.app/auth/callback`, `http://localhost:5173/auth/callback`). Wildcard domains prohibited. | Supabase configuration check: verify no wildcard `*` exists in redirect whitelist. |
| **THR-08** | **Unbounded Storage Exhaustion** | Authenticated user writes 100,000 assignments or 10MB text fields to exhaust database tier. | Denial of Service for database storage and performance degradation. | Text length CHECK constraints on all columns (e.g. `title <= 200`, `description <= 2000`). Row limits enforced per user. | SQL test: Attempt insertion of 50KB title; database rejects with check constraint violation. |
| **THR-09** | **PostgREST Row-Cap Silent Loss** | Student completes >1,000 focus rounds over a semester; API truncates response at 1,000 rows. | Analytical charts and streak calculations silently under-count student workload. | Compute analytical metrics in database views (`v_user_focus_stats`) with `security_invoker = true` using `SUM()` and `COUNT()` in SQL; paginate all raw item lists. | Unit test: Insert 1,050 focus sessions; verify `v_user_focus_stats` calculates 1,050 total sessions. |
| **THR-10** | **Profile Trigger Auth Lockout** | Unhandled database error in `handle_new_user()` trigger on `auth.users` insert. | User cannot authenticate or sign up due to a database exception in trigger. | `handle_new_user()` wraps insertion in `BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE WARNING ... END;` ensuring user authentication completes; profile is lazily provisioned on first client query. | SQL test: Trigger handles intentional constraint error without blocking `auth.users` row creation. |
| **THR-11** | **In-Flight Mutation Cache Re-Pollution** | User initiates a mutation and immediately clicks "Sign Out" before the HTTP response arrives. | Mutation response arrives after logout and populates cache with stale previous user data. | Sign-out invokes `queryClient.cancelQueries()`, immediately aborting active XMLHttpRequests/fetch promises before `clear()`. | Unit test: Trigger slow mutation, invoke logout, verify resolved promise does not write into QueryClient cache. |

---

## 3. Data Privacy & Statutory Compliance

StudyFlow aligns with international and local data protection frameworks (including the **Kenya Data Protection Act, 2019** and **GDPR**):
1. **Right to Erasure (Account Deletion)**:
   - When a student requests account deletion, executing `DELETE FROM auth.users WHERE id = $user_id` cascades cleanly across `profiles`, `courses`, `assignments`, `focus_sessions`, `timers`, `calendar_blocks`, and `local_storage_import_runs`.
   - Zero orphaned records or telemetry trails remain in the database.
2. **Right to Data Portability (Export)**:
   - Students can export their complete academic record (courses, assignments, study logs) via a single sanitized JSON payload at any time.
