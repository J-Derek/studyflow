# StudyFlow — Row Level Security (RLS) Policy Matrix & Specifications

**Document Version**: 2.1.0 (Hardened & Verified)  
**Target Engine**: PostgreSQL 15+  
**Status**: Architecture Baseline Approved — Verification Grade  
**Last Updated**: November 2026  

---

## 1. Security Architecture & RLS Principles

1. **Mandatory RLS Enforcement**: Every user-facing table in the `public` schema has both `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` enabled. This guarantees that table owners and background triggers cannot accidentally leak records across tenants.
2. **Optimized Auth Evaluation**: All policies wrap the tenant lookup in `(SELECT auth.uid())`. In PostgreSQL, a bare `auth.uid()` function is evaluated row-by-row on large table scans; wrapping in a subquery instructs the query planner to evaluate the UID once per query execution as an init-plan constant.
3. **Comprehensive USING & WITH CHECK Parity**:
   - `USING` clauses filter existing rows visible for `SELECT`, `UPDATE`, and `DELETE`.
   - `WITH CHECK` clauses validate newly inserted or mutated rows for `INSERT` and `UPDATE`, guaranteeing that a tenant can never insert a row with another user's ID or update their own `user_id` to another account.
4. **Anon Lockdown**: Direct access to `anon` is completely revoked. Unauthenticated users cannot read or write to any study table.
5. **Analytical Views Security**: All views enforce `WITH (security_invoker = true)`. This guarantees that PostgreSQL executes view queries under the calling user's identity, evaluating `focus_sessions` RLS policies rather than the view owner's bypass privileges.
6. **Hardened RPC Execution**: Direct writes on `timers` are completely revoked for `authenticated`. Transitions are executed exclusively through `SECURITY DEFINER` RPCs with `search_path = ''` and explicit `REVOKE EXECUTE FROM anon, PUBLIC`.

---

## 2. Complete RLS Policy Matrix

| Table | Operation | Role | Policy Name | USING Clause | WITH CHECK Clause |
|---|---|---|---|---|---|
| `profiles` | `SELECT` | `authenticated` | `profiles_select_own` | `id = (SELECT auth.uid())` | — |
| `profiles` | `UPDATE` | `authenticated` | `profiles_update_own` | `id = (SELECT auth.uid())` | `id = (SELECT auth.uid())` |
| `profiles` | `INSERT` | `authenticated` | `profiles_insert_trigger` | — | `id = (SELECT auth.uid())` |
| `profiles` | `DELETE` | `authenticated` | Prohibited (Managed via auth.users cascade) | `false` | — |
| `courses` | `SELECT` | `authenticated` | `courses_select_own` | `user_id = (SELECT auth.uid())` | — |
| `courses` | `INSERT` | `authenticated` | `courses_insert_own` | — | `user_id = (SELECT auth.uid())` |
| `courses` | `UPDATE` | `authenticated` | `courses_update_own` | `user_id = (SELECT auth.uid())` | `user_id = (SELECT auth.uid())` |
| `courses` | `DELETE` | `authenticated` | `courses_delete_own` | `user_id = (SELECT auth.uid())` | — |
| `assignments` | `SELECT` | `authenticated` | `assignments_select_own` | `user_id = (SELECT auth.uid())` | — |
| `assignments` | `INSERT` | `authenticated` | `assignments_insert_own` | — | `user_id = (SELECT auth.uid())` |
| `assignments` | `UPDATE` | `authenticated` | `assignments_update_own` | `user_id = (SELECT auth.uid())` | `user_id = (SELECT auth.uid())` |
| `assignments` | `DELETE` | `authenticated` | `assignments_delete_own` | `user_id = (SELECT auth.uid())` | — |
| `focus_sessions`| `SELECT` | `authenticated` | `focus_sessions_select_own`| `user_id = (SELECT auth.uid())` | — |
| `focus_sessions`| `INSERT` | `authenticated` | `focus_sessions_insert_own`| — | `user_id = (SELECT auth.uid())` |
| `focus_sessions`| `UPDATE` | `authenticated` | Prohibited (Logged history is immutable) | `false` | `false` |
| `focus_sessions`| `DELETE` | `authenticated` | `focus_sessions_delete_own`| `user_id = (SELECT auth.uid())` | — |
| `timers` | `SELECT` | `authenticated` | `timers_select_own` | `user_id = (SELECT auth.uid())` | — |
| `timers` | `INSERT` | `authenticated` | Prohibited directly (Managed via RPC) | `false` | `false` |
| `timers` | `UPDATE` | `authenticated` | Prohibited directly (Managed via RPC) | `false` | `false` |
| `timers` | `DELETE` | `authenticated` | Prohibited directly (Managed via cascade) | `false` | — |
| `calendar_blocks`| `SELECT` | `authenticated` | `calendar_select_own` | `user_id = (SELECT auth.uid())` | — |
| `calendar_blocks`| `INSERT` | `authenticated` | `calendar_insert_own` | — | `user_id = (SELECT auth.uid())` |
| `calendar_blocks`| `UPDATE` | `authenticated` | `calendar_update_own` | `user_id = (SELECT auth.uid())` | `user_id = (SELECT auth.uid())` |
| `calendar_blocks`| `DELETE` | `authenticated` | `calendar_delete_own` | `user_id = (SELECT auth.uid())` | — |
| `import_runs` | `SELECT` | `authenticated` | `import_runs_select_own` | `user_id = (SELECT auth.uid())` | — |
| `import_runs` | `INSERT` | `authenticated` | `import_runs_insert_own` | — | `user_id = (SELECT auth.uid())` |
| `import_runs` | `UPDATE` | `authenticated` | `import_runs_update_own` | `user_id = (SELECT auth.uid())` | `user_id = (SELECT auth.uid())` |

---

## 3. SQL Policy Definitions & Role Grants

```sql
-- Revoke all public/anon privileges on data tables
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Grant standard CRUD access to authenticated role (subject to RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Direct write access to timers is revoked: operations run via SECURITY DEFINER RPCs
REVOKE INSERT, UPDATE, DELETE ON public.timers FROM authenticated;
GRANT SELECT ON public.timers TO authenticated;

-- Specific Named Function Revocations & Grants (Zero broad schema-wide revocations)
REVOKE ALL ON FUNCTION public.start_timer(INT, TEXT, UUID) FROM anon, PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.pause_timer() FROM anon, PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.resume_timer() FROM anon, PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.complete_timer(UUID) FROM anon, PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.abandon_timer(UUID) FROM anon, PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.sync_timer() FROM anon, PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.update_profile_timezone(TEXT) FROM anon, PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.repair_profile() FROM anon, PUBLIC, authenticated;

GRANT EXECUTE ON FUNCTION public.start_timer(INT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pause_timer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resume_timer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_timer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.abandon_timer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_timer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_timezone(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_profile() TO authenticated;

-- Direct mutation of profiles.timezone is strictly prevented:
-- Table-level UPDATE is revoked; UPDATE is granted on non-timezone columns only.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, avatar_url, theme_preference, updated_at) ON public.profiles TO authenticated;

-- -----------------------------------------------------------------------------
-- PROFILES POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "profiles_select_own"
    ON public.profiles FOR SELECT TO authenticated
    USING (id = (SELECT auth.uid()));

CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE TO authenticated
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));

-- -----------------------------------------------------------------------------
-- COURSES POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "courses_select_own"
    ON public.courses FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "courses_insert_own"
    ON public.courses FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "courses_update_own"
    ON public.courses FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "courses_delete_own"
    ON public.courses FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- -----------------------------------------------------------------------------
-- ASSIGNMENTS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "assignments_select_own"
    ON public.assignments FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "assignments_insert_own"
    ON public.assignments FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "assignments_update_own"
    ON public.assignments FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "assignments_delete_own"
    ON public.assignments FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- -----------------------------------------------------------------------------
-- FOCUS SESSIONS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "focus_sessions_select_own"
    ON public.focus_sessions FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "focus_sessions_insert_own"
    ON public.focus_sessions FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "focus_sessions_delete_own"
    ON public.focus_sessions FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- -----------------------------------------------------------------------------
-- TIMERS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "timers_select_own"
    ON public.timers FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- -----------------------------------------------------------------------------
-- CALENDAR BLOCKS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "calendar_select_own"
    ON public.calendar_blocks FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "calendar_insert_own"
    ON public.calendar_blocks FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "calendar_update_own"
    ON public.calendar_blocks FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "calendar_delete_own"
    ON public.calendar_blocks FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- -----------------------------------------------------------------------------
-- IMPORT RUNS POLICIES
-- -----------------------------------------------------------------------------
CREATE POLICY "import_runs_select_own"
    ON public.local_storage_import_runs FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "import_runs_insert_own"
    ON public.local_storage_import_runs FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "import_runs_update_own"
    ON public.local_storage_import_runs FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));
```

---

## 4. Verification Test Suite (Executable SQL Security Test)

```sql
DO $$
DECLARE
    v_user_a UUID := '11111111-1111-1111-1111-111111111111';
    v_user_b UUID := '22222222-2222-2222-2222-222222222222';
    v_course_b UUID;
    v_row_count INT;
BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_user_a, 'user_a@test.edu'), (v_user_b, 'user_b@test.edu');
    
    -- Simulate User B context
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b::text)::text, true);
    INSERT INTO public.courses (user_id, code, title, color)
    VALUES (v_user_b, 'CS102', 'Algorithms', '#3B82F6') RETURNING id INTO v_course_b;

    -- Simulate User A context
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a::text)::text, true);

    -- Test 1: User A cannot see User B's course
    SELECT count(*) INTO v_row_count FROM public.courses WHERE id = v_course_b;
    IF v_row_count != 0 THEN
        RAISE EXCEPTION 'TEST 1 FAILED: User A can see User B course!';
    END IF;

    -- Test 2: User A cannot spoof assignment pointing to User B's course (Composite FK check)
    BEGIN
        INSERT INTO public.assignments (user_id, course_id, title, due_at)
        VALUES (v_user_a, v_course_b, 'Stolen Course Assignment', now() + interval '1 day');
        RAISE EXCEPTION 'TEST 2 FAILED: Composite FK did not reject cross-user course_id!';
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 2 PASSED: Cross-user foreign key properly rejected with foreign_key_violation';
    END;

    -- Test 3: User A cannot update User B's course
    UPDATE public.courses SET title = 'Hacked Title' WHERE id = v_course_b;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count != 0 THEN
        RAISE EXCEPTION 'TEST 3 FAILED: User A updated User B course!';
    END IF;

    RAISE NOTICE 'ALL RLS SECURITY TESTS PASSED SUCCESSFULLY.';
END $$;
```
