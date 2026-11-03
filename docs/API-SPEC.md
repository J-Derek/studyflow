# StudyFlow — Data Access & RPC API Specification

**Document Version**: 2.6.0 (Hardened & Reconciled)  
**Status**: Specification Complete — Synchronized with TIMER-SPEC.md v2.6.0  
**Last Updated**: November 2026  

---

## 1. Overview & Protocol Architecture

StudyFlow interacts with Supabase using two primary interfaces:
1. **PostgREST RESTful Data Access**: Type-safe querying, filtering, and standard CRUD on `courses`, `assignments`, and `calendar_blocks` governed by PostgreSQL Row Level Security.
2. **PostgreSQL RPCs (Remote Procedure Calls)**: Transactional state-machine mutations executed via `SECURITY DEFINER` functions with `search_path = ''`. Guaranteed two-channel response contract:
   - Success / Idempotent outcomes return HTTP 200 with `TimerRpcSuccessResponse`.
   - Failure / Invariant violations raise structured PostgreSQL exceptions caught by PostgREST and returned as error responses with standardized error codes.

---

## 2. Server RPC Procedures

### 2.1 Timer & Profile State Machine RPCs (7 Functions)

| RPC Function | Signature | Return Type | Description |
| :--- | :--- | :--- | :--- |
| `start_timer` | `(p_planned_ms INT, p_mode TEXT, p_assignment_id UUID)` | `JSONB` | Provisions row, asserts IANA timezone, starts countdown |
| `pause_timer` | `()` | `JSONB` | Freezes active timer before expiration, stores floored remaining ms |
| `resume_timer` | `()` | `JSONB` | Resumes paused timer, projects new `ends_at` from `clock_timestamp()` |
| `complete_timer` | `(p_session_id UUID)` | `JSONB` | Anti-cheat expiration verification (`v_now >= ends_at`), logs study session, resets timer |
| `abandon_timer` | `(p_session_id UUID)` | `JSONB` | Resets matching active timer without logging; neutral `already_idle` on repeated calls |
| `sync_timer` | `()` | `JSONB` | Single-statement atomic snapshot with `clock_timestamp()` for Cristian's sync |
| `update_profile_timezone` | `(p_timezone TEXT)` | `JSONB` | Controlled timezone mutation enforcing timer-first lock order under READ COMMITTED |

---

### 2.2 Complete Executable SQL DDL for Timer RPCs

```sql
-- =============================================================================
-- StudyFlow Phase 2 Timer RPC Specifications (PL/pgSQL)
-- Version 2.5.0 — Hardened Post-Lock clock_timestamp() & Reconciled Envelopes
-- =============================================================================

-- 1. start_timer
CREATE OR REPLACE FUNCTION public.start_timer(
    p_planned_ms INT,
    p_mode TEXT DEFAULT 'focus',
    p_assignment_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid UUID;
    v_timer public.timers%ROWTYPE;
    v_now TIMESTAMPTZ;
    v_session_id UUID;
    v_profile_tz TEXT;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION '%', 'UNAUTHENTICATED: User session required.'
            USING ERRCODE = '42501',
                  DETAIL = 'UNAUTHENTICATED',
                  HINT = 'Provide a valid Supabase JWT bearer token.';
    END IF;

    -- Validate Mode (explicit null check)
    IF p_mode IS NULL OR p_mode NOT IN ('focus', 'short_break', 'long_break') THEN
        RAISE EXCEPTION '%', 'INVALID_MODE: Mode must be focus, short_break, or long_break.'
            USING ERRCODE = 'P0001',
                  DETAIL = 'INVALID_MODE',
                  HINT = 'Allowed modes are focus, short_break, long_break.';
    END IF;

    -- Validate Duration (1 min to 24 hours)
    IF p_planned_ms IS NULL OR p_planned_ms < 60000 OR p_planned_ms > 86400000 THEN
        RAISE EXCEPTION '%', 'INVALID_DURATION: Planned duration must be between 1 minute and 24 hours.'
            USING ERRCODE = 'P0001',
                  DETAIL = 'INVALID_DURATION',
                  HINT = 'Specify planned_ms between 60,000 and 86,400,000 ms.';
    END IF;

    -- 1. Atomic Provision & Row Lock under READ COMMITTED
    INSERT INTO public.timers (user_id, phase, mode, version, updated_at)
    VALUES (v_uid, 'idle', p_mode, 0, clock_timestamp())
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_timer FROM public.timers WHERE user_id = v_uid FOR UPDATE;
    v_now := clock_timestamp(); -- Authoritative instant captured AFTER lock

    IF v_timer.phase != 'idle' THEN
        RAISE EXCEPTION '%', 'TIMER_ALREADY_ACTIVE: Cannot start a new timer while a session is active.'
            USING ERRCODE = 'P0001',
                  DETAIL = 'TIMER_ALREADY_ACTIVE',
                  HINT = 'Complete or abandon the currently active session first.';
    END IF;

    -- 2. Read and serialize profile timezone (distinguishing missing profile vs invalid timezone)
    SELECT timezone INTO v_profile_tz FROM public.profiles WHERE id = v_uid;
    IF NOT FOUND THEN
        RAISE EXCEPTION '%', 'PROFILE_NOT_FOUND: User profile does not exist.'
            USING ERRCODE = 'P0001',
                  DETAIL = 'PROFILE_NOT_FOUND',
                  HINT = 'Initialize profile before starting a timer.';
    END IF;

    IF v_profile_tz IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_profile_tz) THEN
        RAISE EXCEPTION '%', 'TIMEZONE_INVALID: A valid IANA timezone must be configured in your profile before starting a timer.'
            USING ERRCODE = 'P0001',
                  DETAIL = 'TIMEZONE_INVALID',
                  HINT = 'Configure an authoritative IANA timezone in your profile.';
    END IF;

    -- 3. Validate Assignment Ownership without row locking (prevents reverse-order deadlock with FK ON DELETE SET NULL)
    IF p_assignment_id IS NOT NULL THEN
        PERFORM 1 FROM public.assignments WHERE id = p_assignment_id AND user_id = v_uid;
        IF NOT FOUND THEN
            RAISE EXCEPTION '%', 'ASSIGNMENT_NOT_FOUND: Assignment does not exist or belongs to another user.'
                USING ERRCODE = 'P0001',
                      DETAIL = 'ASSIGNMENT_NOT_FOUND',
                      HINT = 'Select an assignment belonging to your account.';
        END IF;
    END IF;

    v_session_id := gen_random_uuid();

    UPDATE public.timers
    SET phase = 'running',
        mode = p_mode,
        session_id = v_session_id,
        assignment_id = p_assignment_id,
        snapshot_tz = v_profile_tz,
        planned_ms = p_planned_ms,
        started_at = v_now,
        ends_at = v_now + (p_planned_ms * interval '1 millisecond'),
        remaining_ms = NULL,
        version = v_timer.version + 1,
        updated_at = v_now
    WHERE user_id = v_uid
    RETURNING * INTO v_timer;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'running',
        'timer', to_jsonb(v_timer),
        'session', NULL,
        'server_now', v_now,
        'server_now_ms', (EXTRACT(EPOCH FROM v_now) * 1000)::bigint
    );
END;
$$;

ALTER FUNCTION public.start_timer(INT, TEXT, UUID) OWNER TO postgres;
```

#### 2. `pause_timer`
```sql
CREATE OR REPLACE FUNCTION public.pause_timer()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid UUID;
    v_timer public.timers%ROWTYPE;
    v_now TIMESTAMPTZ;
    v_remaining_ms INT;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION '%', 'UNAUTHENTICATED: User session required.'
            USING ERRCODE = '42501',
                  DETAIL = 'UNAUTHENTICATED',
                  HINT = 'Provide a valid Supabase JWT bearer token.';
    END IF;

    INSERT INTO public.timers (user_id, phase, mode, version, updated_at)
    VALUES (v_uid, 'idle', 'focus', 0, clock_timestamp())
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_timer FROM public.timers WHERE user_id = v_uid FOR UPDATE;
    v_now := clock_timestamp();

    IF v_timer.phase != 'running' THEN
        RAISE EXCEPTION '%', 'TIMER_NOT_RUNNING: Only running timers can be paused.'
            USING ERRCODE = 'P0001',
                  DETAIL = 'TIMER_NOT_RUNNING',
                  HINT = 'Resume or start a timer before pausing.';
    END IF;

    IF v_now >= v_timer.ends_at THEN
        RAISE EXCEPTION '%', 'TIMER_EXPIRED: Cannot pause an expired timer. Complete or abandon the session.'
            USING ERRCODE = 'P0001',
                  DETAIL = 'TIMER_EXPIRED',
                  HINT = 'Complete the expired timer via complete_timer.';
    END IF;

    -- Deterministic flooring for remaining milliseconds
    v_remaining_ms := GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (v_timer.ends_at - v_now)) * 1000.0))::int;

    UPDATE public.timers
    SET phase = 'paused',
        ends_at = NULL,
        remaining_ms = v_remaining_ms,
        version = v_timer.version + 1,
        updated_at = v_now
    WHERE user_id = v_uid
    RETURNING * INTO v_timer;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'paused',
        'timer', to_jsonb(v_timer),
        'session', NULL,
        'server_now', v_now,
        'server_now_ms', (EXTRACT(EPOCH FROM v_now) * 1000)::bigint
    );
END;
$$;

ALTER FUNCTION public.pause_timer() OWNER TO postgres;
```

#### 3. `resume_timer`
```sql
CREATE OR REPLACE FUNCTION public.resume_timer()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid UUID;
    v_timer public.timers%ROWTYPE;
    v_now TIMESTAMPTZ;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION '%', 'UNAUTHENTICATED: User session required.'
            USING ERRCODE = '42501',
                  DETAIL = 'UNAUTHENTICATED',
                  HINT = 'Provide a valid Supabase JWT bearer token.';
    END IF;

    INSERT INTO public.timers (user_id, phase, mode, version, updated_at)
    VALUES (v_uid, 'idle', 'focus', 0, clock_timestamp())
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_timer FROM public.timers WHERE user_id = v_uid FOR UPDATE;
    v_now := clock_timestamp();

    IF v_timer.phase != 'paused' THEN
        RAISE EXCEPTION '%', 'TIMER_NOT_PAUSED: Only paused timers can be resumed.'
            USING ERRCODE = 'P0001',
                  DETAIL = 'TIMER_NOT_PAUSED',
                  HINT = 'Pause a running timer before resuming.';
    END IF;

    UPDATE public.timers
    SET phase = 'running',
        ends_at = v_now + (v_timer.remaining_ms * interval '1 millisecond'),
        remaining_ms = NULL,
        version = v_timer.version + 1,
        updated_at = v_now
    WHERE user_id = v_uid
    RETURNING * INTO v_timer;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'running',
        'timer', to_jsonb(v_timer),
        'session', NULL,
        'server_now', v_now,
        'server_now_ms', (EXTRACT(EPOCH FROM v_now) * 1000)::bigint
    );
END;
$$;

ALTER FUNCTION public.resume_timer() OWNER TO postgres;
```

#### 4. `complete_timer`
```sql
CREATE OR REPLACE FUNCTION public.complete_timer(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid UUID;
    v_timer public.timers%ROWTYPE;
    v_session public.focus_sessions%ROWTYPE;
    v_now TIMESTAMPTZ;
    v_profile_tz TEXT;
    v_local_date DATE;
    v_assignment_id UUID;
    v_constraint_name TEXT;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION '%', 'UNAUTHENTICATED: User session required.'
            USING ERRCODE = '42501',
                  DETAIL = 'UNAUTHENTICATED',
                  HINT = 'Provide a valid Supabase JWT bearer token.';
    END IF;
    IF p_session_id IS NULL THEN
        RAISE EXCEPTION '%', 'INVALID_SESSION: Session ID cannot be null.'
            USING ERRCODE = 'P0001',
                  DETAIL = 'INVALID_SESSION',
                  HINT = 'Pass a valid session UUID to complete_timer.';
    END IF;

    INSERT INTO public.timers (user_id, phase, mode, version, updated_at)
    VALUES (v_uid, 'idle', 'focus', 0, clock_timestamp())
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_timer FROM public.timers WHERE user_id = v_uid FOR UPDATE;
    v_now := clock_timestamp();

    -- CASE A: Active Session Match
    IF v_timer.phase = 'running' AND v_timer.session_id = p_session_id THEN
        IF v_now < v_timer.ends_at THEN
            RAISE EXCEPTION '%', 'CLOCK_TAMPERING: Timer has not expired yet.'
                USING ERRCODE = 'P0001',
                      DETAIL = 'CLOCK_TAMPERING',
                      HINT = 'Wait until ends_at before requesting completion.';
        END IF;

        -- Validate and use immutable snapshot timezone captured under lock at start_timer
        IF v_timer.snapshot_tz IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_timer.snapshot_tz) THEN
            RAISE EXCEPTION '%', 'TIMEZONE_INVALID: Timer session timezone snapshot is invalid or unverified.'
                USING ERRCODE = 'P0001',
                      DETAIL = 'TIMEZONE_INVALID',
                      HINT = 'Authoritative session timezone snapshot required.';
        END IF;

        v_local_date := CAST((v_now AT TIME ZONE v_timer.snapshot_tz) AS DATE);

        -- Resolve assignment: if assignment was deleted while timer was running, set to NULL for focus_sessions
        IF v_timer.assignment_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.assignments WHERE id = v_timer.assignment_id AND user_id = v_uid
        ) THEN
            v_assignment_id := NULL;
        ELSE
            v_assignment_id := v_timer.assignment_id;
        END IF;

        -- Race-Safe Focus Session Insertion:
        -- If assignment was deleted concurrently during completion execution, catch foreign_key_violation
        -- and re-insert with assignment_id = NULL so the student's study session is never dropped or failed.
        BEGIN
            INSERT INTO public.focus_sessions (
                user_id, session_id, assignment_id, mode,
                duration_seconds, duration_ms, local_date, started_at, completed_at
            ) VALUES (
                v_uid, p_session_id, v_assignment_id, v_timer.mode,
                FLOOR(v_timer.planned_ms / 1000.0)::int, v_timer.planned_ms,
                v_local_date, v_timer.started_at, v_now
            )
            ON CONFLICT (user_id, session_id) DO NOTHING
            RETURNING * INTO v_session;
        EXCEPTION WHEN foreign_key_violation THEN
            GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
            -- Strictly catch foreign key violation on assignment; re-raise any other FK violation
            IF v_constraint_name = 'fk_focus_sessions_assignment' THEN
                v_assignment_id := NULL;
                INSERT INTO public.focus_sessions (
                    user_id, session_id, assignment_id, mode,
                    duration_seconds, duration_ms, local_date, started_at, completed_at
                ) VALUES (
                    v_uid, p_session_id, NULL, v_timer.mode,
                    FLOOR(v_timer.planned_ms / 1000.0)::int, v_timer.planned_ms,
                    v_local_date, v_timer.started_at, v_now
                )
                ON CONFLICT (user_id, session_id) DO NOTHING
                RETURNING * INTO v_session;
            ELSE
                RAISE;
            END IF;
        END;

        -- If conflict occurred, verify existing record matches all immutable session identity invariants
        IF v_session.id IS NULL THEN
            SELECT * INTO v_session FROM public.focus_sessions WHERE user_id = v_uid AND session_id = p_session_id;
            IF v_session.id IS NULL OR
               v_session.duration_ms != v_timer.planned_ms OR
               v_session.duration_seconds != FLOOR(v_timer.planned_ms / 1000.0)::int OR
               v_session.mode != v_timer.mode OR
               v_session.started_at != v_timer.started_at OR
               v_session.local_date != v_local_date OR
               (v_session.assignment_id IS DISTINCT FROM v_assignment_id AND v_session.assignment_id IS NOT NULL) OR
               v_session.completed_at < v_session.started_at OR
               v_session.completed_at > v_now + interval '5 seconds' THEN
                RAISE EXCEPTION '%', 'COMPLETION_INSERT_FAILED: Existing focus session record contradicts active timer parameters.'
                    USING ERRCODE = 'P0001',
                          DETAIL = 'COMPLETION_INSERT_FAILED',
                          HINT = 'Focus session conflict failed integrity verification; timer remains active.';
            END IF;
        END IF;

        UPDATE public.timers
        SET phase = 'idle',
            session_id = NULL,
            assignment_id = NULL,
            snapshot_tz = NULL,
            planned_ms = NULL,
            started_at = NULL,
            ends_at = NULL,
            remaining_ms = NULL,
            version = v_timer.version + 1,
            updated_at = v_now
        WHERE user_id = v_uid
        RETURNING * INTO v_timer;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'completed',
            'timer', to_jsonb(v_timer),
            'session', to_jsonb(v_session),
            'server_now', v_now,
            'server_now_ms', (EXTRACT(EPOCH FROM v_now) * 1000)::bigint
        );
    END IF;

    -- CASE B: Idempotent Completion Retry
    SELECT * INTO v_session FROM public.focus_sessions WHERE user_id = v_uid AND session_id = p_session_id;
    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'status', 'already_completed',
            'timer', to_jsonb(v_timer), -- Unmodified active or idle timer
            'session', to_jsonb(v_session),
            'server_now', v_now,
            'server_now_ms', (EXTRACT(EPOCH FROM v_now) * 1000)::bigint
        );
    END IF;

    -- CASE C: Stale, Abandoned, or Unknown Session
    RAISE EXCEPTION '%', format('INVALID_SESSION: Session %s is not active and has no completed record.', p_session_id)
        USING ERRCODE = 'P0001',
              DETAIL = 'INVALID_SESSION',
              HINT = 'Provide an active session UUID or an existing completed session.';
END;
$$;

ALTER FUNCTION public.complete_timer(UUID) OWNER TO postgres;
```

#### 5. `abandon_timer`
```sql
CREATE OR REPLACE FUNCTION public.abandon_timer(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid UUID;
    v_timer public.timers%ROWTYPE;
    v_now TIMESTAMPTZ;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION '%', 'UNAUTHENTICATED: User session required.'
            USING ERRCODE = '42501',
                  DETAIL = 'UNAUTHENTICATED',
                  HINT = 'Provide a valid Supabase JWT bearer token.';
    END IF;
    IF p_session_id IS NULL THEN
        RAISE EXCEPTION '%', 'INVALID_SESSION: Session ID cannot be null.'
            USING ERRCODE = 'P0001',
                  DETAIL = 'INVALID_SESSION',
                  HINT = 'Pass a valid session UUID to abandon_timer.';
    END IF;

    INSERT INTO public.timers (user_id, phase, mode, version, updated_at)
    VALUES (v_uid, 'idle', 'focus', 0, clock_timestamp())
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_timer FROM public.timers WHERE user_id = v_uid FOR UPDATE;
    v_now := clock_timestamp();

    -- CASE A: Active Running or Paused Match
    IF v_timer.session_id = p_session_id AND v_timer.phase IN ('running', 'paused') THEN
        UPDATE public.timers
        SET phase = 'idle',
            session_id = NULL,
            assignment_id = NULL,
            snapshot_tz = NULL,
            planned_ms = NULL,
            started_at = NULL,
            ends_at = NULL,
            remaining_ms = NULL,
            version = v_timer.version + 1,
            updated_at = v_now
        WHERE user_id = v_uid
        RETURNING * INTO v_timer;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'abandoned',
            'timer', to_jsonb(v_timer),
            'session', NULL,
            'server_now', v_now,
            'server_now_ms', (EXTRACT(EPOCH FROM v_now) * 1000)::bigint
        );
    END IF;

    -- CASE B: Neutral Already Idle (Timer is already idle; makes no false claims)
    IF v_timer.phase = 'idle' THEN
        RETURN jsonb_build_object(
            'success', true,
            'status', 'already_idle',
            'timer', to_jsonb(v_timer), -- Version is unchanged
            'session', NULL,
            'server_now', v_now,
            'server_now_ms', (EXTRACT(EPOCH FROM v_now) * 1000)::bigint
        );
    END IF;

    -- CASE C: Mismatched Session ID While Another Timer Is Active
    RAISE EXCEPTION '%', format('SESSION_NOT_ACTIVE: Session %s is not active. Current timer preserved.', p_session_id)
        USING ERRCODE = 'P0001',
              DETAIL = 'SESSION_NOT_ACTIVE',
              HINT = 'Pass the session UUID currently active on the timer.';
END;
$$;

ALTER FUNCTION public.abandon_timer(UUID) OWNER TO postgres;
```

#### 6. `sync_timer` (Lightweight Clock Synchronization)
```sql
CREATE OR REPLACE FUNCTION public.sync_timer()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid UUID;
    v_timer public.timers%ROWTYPE;
    v_now TIMESTAMPTZ;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION '%', 'UNAUTHENTICATED: User session required.'
            USING ERRCODE = '42501',
                  DETAIL = 'UNAUTHENTICATED',
                  HINT = 'Provide a valid Supabase JWT bearer token.';
    END IF;

    INSERT INTO public.timers (user_id, phase, mode, version, updated_at)
    VALUES (v_uid, 'idle', 'focus', 0, clock_timestamp())
    ON CONFLICT (user_id) DO NOTHING;

    -- Single-statement atomic snapshot under same statement read snapshot
    SELECT t, clock_timestamp() INTO v_timer, v_now 
    FROM public.timers t 
    WHERE t.user_id = v_uid;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'sync_snapshot',
        'timer', to_jsonb(v_timer),
        'session', NULL,
        'server_now', v_now,
        'server_now_ms', (EXTRACT(EPOCH FROM v_now) * 1000)::bigint
    );
END;
$$;

ALTER FUNCTION public.sync_timer() OWNER TO postgres;
```

#### 7. `update_profile_timezone` (Controlled Timezone Serialization RPC)
```sql
CREATE OR REPLACE FUNCTION public.update_profile_timezone(p_timezone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid UUID;
    v_timer public.timers%ROWTYPE;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RAISE EXCEPTION '%', 'UNAUTHENTICATED: User session required.'
            USING ERRCODE = '42501',
                  DETAIL = 'UNAUTHENTICATED',
                  HINT = 'Provide a valid Supabase JWT bearer token.';
    END IF;

    IF p_timezone IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_timezone) THEN
        RAISE EXCEPTION '%', 'TIMEZONE_INVALID: Invalid IANA timezone specified.'
            USING ERRCODE = 'P0001',
                  DETAIL = 'TIMEZONE_INVALID',
                  HINT = 'Provide an authoritative IANA timezone name (e.g. Africa/Nairobi).';
    END IF;

    -- Strict Shared Lock Order Step 1: Provision and lock timer row FOR UPDATE first!
    INSERT INTO public.timers (user_id, phase, mode, version, updated_at)
    VALUES (v_uid, 'idle', 'focus', 0, clock_timestamp())
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_timer FROM public.timers WHERE user_id = v_uid FOR UPDATE;

    IF v_timer.phase != 'idle' THEN
        RAISE EXCEPTION '%', 'ACTIVE_TIMER_EXISTS: Cannot change profile timezone while a timer is active.'
            USING ERRCODE = 'P0001',
                  DETAIL = 'ACTIVE_TIMER_EXISTS',
                  HINT = 'Complete or abandon active session before modifying timezone.';
    END IF;

    -- Strict Shared Lock Order Step 2: Update profile row after timer lock is held
    UPDATE public.profiles
    SET timezone = p_timezone,
        updated_at = clock_timestamp()
    WHERE id = v_uid;

    IF NOT FOUND THEN
        RAISE EXCEPTION '%', 'PROFILE_NOT_FOUND: User profile does not exist.'
            USING ERRCODE = 'P0001',
                  DETAIL = 'PROFILE_NOT_FOUND',
                  HINT = 'Initialize user profile before modifying timezone.';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'timezone', p_timezone
    );
END;
$$;

ALTER FUNCTION public.update_profile_timezone(TEXT) OWNER TO postgres;

-- Specific Named Function Grants (Zero schema-wide revocations)
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

-- Effective Profile Privileges: Absolute Exclusion of Direct Timezone Mutation
-- Table-level UPDATE is revoked; UPDATE is granted strictly on non-timezone columns.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, avatar_url, theme_preference, updated_at) ON public.profiles TO authenticated;
```
