# StudyFlow — High-Precision Focus Timer Architecture Specification

**Document Version**: 2.6.0 (Hardened & Formally Reconciled)  
**Status**: Specification Complete — Pending Supervisor Sign-Off  
**Last Updated**: November 2026  

---

## 1. Revision History & Change Log

| Version | Date | Status | Key Architectural Changes |
| :--- | :--- | :--- | :--- |
| **2.1.0** | Nov 2026 | Initial Architecture | Basic table schema and XOR state constraint |
| **2.2.0** | Nov 2026 | Revision | Exact-session completion lookup and 4 concurrency scenarios |
| **2.3.0** | Nov 2026 | Revision | Valid `auth.uid()` default, UPSERT lock, duration flooring |
| **2.4.0** | Nov 2026 | Revision | `clock_timestamp()` post-lock, Cristian's bootstrap filter |
| **2.5.0** | Nov 2026 | Revision | Reconciled response envelope, neutral `already_idle`, monotonic RTT |
| **2.6.0** | Nov 2026 | Reconciled Final | Added `snapshot_tz` lifecycle, deadlock-free single lock order, completion conflict integrity verification, coherent `sync_timer` instant, 3-tier auth status mapping (401 vs 403), and complete 13-code structured error table |

---

## 2. Architectural Overview & Hardened Principles

1. **Authoritative Wall-Clock Instant (`clock_timestamp()`)**: Unlike `now()` (which freezes at transaction start), all timer transitions evaluate expiration, calculate deadlines, and record timestamps using `clock_timestamp()` **immediately after acquiring the per-user row lock (`FOR UPDATE`)**. Lock wait time can never distort expiration checks or deadline math.
2. **Deterministic UPSERT Lock Provisioning under `READ COMMITTED`**: Supported under standard PostgreSQL `READ COMMITTED` transaction isolation. First-time rows are guaranteed via atomic `INSERT ... ON CONFLICT (user_id) DO NOTHING` followed by `SELECT ... FOR UPDATE`.
3. **SNTP Latency-Compensated Clock Synchronization**: Client display interpolates against estimated server time using Cristian's algorithm with monotonic `performance.now()` RTT measurement. High-RTT samples ($> 2000$ ms) are rejected unconditionally, including during initial bootstrap.
4. **Authoritative Expiration & Offline Policy**: The server is strictly authoritative. **Offline completion is strictly prohibited.** If a timer reaches zero offline, the UI freezes at `00:00` with canonical message `"Session complete. Connect to internet to record study session."` until network connectivity and server validation succeed.
5. **Pre-Execution IANA Timezone Validation**: A timer cannot be started unless the profile possesses an authoritative IANA timezone verified against `pg_timezone_names`. Profile timezone mutations are prohibited while a timer is active.
6. **Strict Ownership Invariants**: `start_timer` validates that any supplied `assignment_id` belongs strictly to `auth.uid()`.
7. **Monotonic Version Invariant**: The timer row `version` (INT) strictly tracks committed timer state machine transitions. It increments by +1 upon start, pause, resume, complete, or abandon. Idempotent requests (`already_completed`, `already_idle`), non-mutating synchronization reads (`sync_timer`), and profile timezone updates (`update_profile_timezone`) do NOT increment timer `version`. First-time provisioning initializes `version = 0`. Rejected transitions roll back with zero version changes.

---

## 3. Canonical Table DDL & State Truth Table

```sql
CREATE TABLE public.timers (
    user_id UUID PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    phase TEXT NOT NULL CHECK (phase IN ('idle', 'running', 'paused')),
    mode TEXT NOT NULL DEFAULT 'focus' CHECK (mode IN ('focus', 'short_break', 'long_break')),
    session_id UUID,
    assignment_id UUID,
    snapshot_tz TEXT,
    planned_ms INT CHECK (planned_ms BETWEEN 60000 AND 86400000), -- 1 min to 24 hrs
    started_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    remaining_ms INT CHECK (remaining_ms > 0 AND remaining_ms <= planned_ms),
    version INT NOT NULL DEFAULT 0 CHECK (version >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Note: assignment_id is an ephemeral in-flight reference validated via EXISTS in start_timer.
    -- Strict relational FK is intentionally decoupled from timers to eliminate implicit RI_FKey lock
    -- inversion cycles with concurrent DELETE FROM assignments. Authoritative FK is enforced on focus_sessions.
    CONSTRAINT chk_timer_strict_xor_state CHECK (
        (phase = 'idle'    AND session_id IS NULL     AND ends_at IS NULL     AND remaining_ms IS NULL     AND started_at IS NULL     AND planned_ms IS NULL     AND assignment_id IS NULL AND snapshot_tz IS NULL) OR
        (phase = 'running' AND session_id IS NOT NULL AND ends_at IS NOT NULL AND remaining_ms IS NULL     AND started_at IS NOT NULL AND planned_ms IS NOT NULL AND snapshot_tz IS NOT NULL) OR
        (phase = 'paused'  AND session_id IS NOT NULL AND ends_at IS NULL     AND remaining_ms IS NOT NULL AND started_at IS NOT NULL AND planned_ms IS NOT NULL AND snapshot_tz IS NOT NULL)
    )
);

-- RLS: Authenticated users can only read their own timer row. Mutations are revoked.
ALTER TABLE public.timers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timers FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own timer row"
ON public.timers FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);
```

### Complete State Truth Table

| Field | `idle` Phase | `running` Phase | `paused` Phase |
| :--- | :--- | :--- | :--- |
| `phase` | `'idle'` | `'running'` | `'paused'` |
| `mode` | Retained preference (`'focus'`, `'short_break'`, `'long_break'`) | Active mode | Active mode |
| `session_id` | `NULL` | Valid `UUID` | Valid `UUID` (preserved from running) |
| `ends_at` | `NULL` | Valid `TIMESTAMPTZ` (structural non-null; future deadline projected on transition) | `NULL` |
| `remaining_ms` | `NULL` | `NULL` | Valid `INT` ($> 0$ and $\le \text{planned\_ms}$) |
| `started_at` | `NULL` | Valid `TIMESTAMPTZ` (origin start) | Valid `TIMESTAMPTZ` (preserved origin start) |
| `planned_ms` | `NULL` | Valid `INT` ($60,000 \dots 86,400,000$) | Valid `INT` ($60,000 \dots 86,400,000$) |
| `assignment_id` | `NULL` | Nullable `UUID` (composite FK) | Nullable `UUID` (composite FK) |
| `version` | Monotonic `INT` ($\ge 0$) | Monotonic `INT` ($\ge 0$) | Monotonic `INT` ($\ge 0$) |
| `updated_at` | Mutation instant (`v_now`) | Mutation instant (`v_now`) | Mutation instant (`v_now`) |

### Invariant Classification
1. **Structural Invariant**: Enforced strictly by table CHECK constraint `chk_timer_strict_xor_state`. Requires non-null `ends_at`, `started_at`, `planned_ms`, and `session_id` when `phase = 'running'`. Static DDL allows `ends_at <= clock_timestamp()` so an expired timer persists until completion.
2. **Transition Invariant**: Enforced within `start_timer` and `resume_timer` which project `ends_at := v_now + duration` where `v_now := clock_timestamp()`, guaranteeing a future deadline at the instant of transition.
3. **Completion Invariant**: Enforced within `complete_timer` asserting `IF v_now < v_timer.ends_at THEN RAISE EXCEPTION ... DETAIL = 'CLOCK_TAMPERING'`, rejecting completion until authoritative server time reaches or passes the deadline.

---

## 4. Response Contracts & Full Executable RPC Specifications

### 4.1 Two-Channel Response Contract Specification
1. **Success & Idempotent Responses (HTTP 200)**: All six RPCs return a guaranteed JSONB object matching `TimerRpcSuccessResponse`:
   ```typescript
   export type TimerStatus = 
     | 'running' 
     | 'paused' 
     | 'completed' 
     | 'already_completed' 
     | 'abandoned' 
     | 'already_idle' 
     | 'sync_snapshot';

   export interface TimerRpcSuccessResponse {
     success: true;
     status: TimerStatus;
     timer: TimerRow;
     session?: FocusSessionRow | null;
     server_now: string;      // ISO 8601 string from clock_timestamp()
     server_now_ms: number;   // Epoch milliseconds from clock_timestamp()
   }
   ```
2. **Error Contract & Structured PostgREST Exceptions**:
   - Invariant violations in PL/pgSQL raise exceptions utilizing PostgreSQL `DETAIL` and `HINT` fields:
     ```sql
     RAISE EXCEPTION '%', 'CLOCK_TAMPERING: Timer has not expired yet.'
         USING ERRCODE = 'P0001',
               DETAIL = 'CLOCK_TAMPERING',
               HINT = 'Wait until ends_at before requesting completion.';
     ```
   - PostgREST intercepts the exception, rolls back the transaction, and returns HTTP 400 Bad Request with body:
     ```json
     {
       "code": "P0001",
       "details": "CLOCK_TAMPERING",
       "hint": "Wait until ends_at before requesting completion.",
       "message": "CLOCK_TAMPERING: Timer has not expired yet."
     }
     ```
   - **Client Error Extraction**: The client gateway extracts application error codes directly from the `details` field (e.g. `error.details === 'CLOCK_TAMPERING'`), eliminating string regex parsing.
   - Standard error codes in `details`: `UNAUTHENTICATED`, `TIMEZONE_INVALID`, `INVALID_DURATION`, `INVALID_MODE`, `ASSIGNMENT_NOT_FOUND`, `TIMER_ALREADY_ACTIVE`, `TIMER_NOT_RUNNING`, `TIMER_EXPIRED`, `TIMER_NOT_PAUSED`, `CLOCK_TAMPERING`, `INVALID_SESSION`, `SESSION_NOT_ACTIVE`, `COMPLETION_INSERT_FAILED`.

3. **Multi-Tiered Authentication Defense**:
   - **Tier 1 (Gateway Enforcement)**: Missing or malformed JWTs are rejected immediately by PostgREST at the API gateway with HTTP 401 Unauthorized before any RPC execution occurs.
   - **Tier 2 (Database Grants)**: Function `EXECUTE` privileges are revoked from `anon` and `PUBLIC` and granted strictly to `authenticated`. Any unauthenticated request attempting to bypass the gateway is rejected by PostgreSQL with HTTP 403 Forbidden (`permission denied for function`).
   - **Tier 3 (In-Function Assertion)**: `IF auth.uid() IS NULL THEN RAISE EXCEPTION ... USING ERRCODE = '42501', DETAIL = 'UNAUTHENTICATED'` executes as defense-in-depth if an internal routine executes without an authenticated user context. PostgREST maps SQLSTATE `42501` to HTTP 403 Forbidden.

### 4.1.3 Comprehensive Error Code Mapping Table (All 6 RPCs)

| Error Code (`details`) | SQLSTATE (`code`) | PostgREST HTTP Status | Originating Layer | Originating RPCs | Transaction Outcome | Client Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GATEWAY_UNAUTHENTICATED` | — | 401 Unauthorized | PostgREST Gateway | All 6 RPCs | Rejected before DB | Redirect to Sign-In / Refresh JWT |
| `UNAUTHENTICATED` | `42501` | 403 Forbidden | In-Function Defense | All 6 RPCs | Transaction Rolls Back | Re-authenticate Session |
| `PERMISSION_DENIED` | `42501` | 403 Forbidden | PostgreSQL Grant Gate | All 6 RPCs (anon role) | Rejected at Function Gate | Acquire Authenticated Role |
| `INVALID_MODE` | `P0001` | 400 Bad Request | PL/pgSQL Parameter Check | `start_timer` | Transaction Rolls Back | Present valid mode options |
| `INVALID_DURATION` | `P0001` | 400 Bad Request | PL/pgSQL Parameter Check | `start_timer` | Transaction Rolls Back | Clamp duration to 1m–24h |
| `TIMEZONE_INVALID` | `P0001` | 400 Bad Request | Pre-execution Check | `start_timer`, `complete_timer` | Transaction Rolls Back | Prompt Timezone Selection Modal |
| `ASSIGNMENT_NOT_FOUND` | `P0001` | 400 Bad Request | Pre-execution Check | `start_timer` | Transaction Rolls Back | Deselect assignment / refresh list |
| `TIMER_ALREADY_ACTIVE` | `P0001` | 400 Bad Request | State Machine Constraint | `start_timer` | Transaction Rolls Back | Refresh timer / prompt abandon |
| `TIMER_NOT_RUNNING` | `P0001` | 400 Bad Request | State Machine Constraint | `pause_timer` | Transaction Rolls Back | Sync timer UI to current phase |
| `TIMER_EXPIRED` | `P0001` | 400 Bad Request | State Machine Constraint | `pause_timer` | Transaction Rolls Back | Trigger `complete_timer` flow |
| `TIMER_NOT_PAUSED` | `P0001` | 400 Bad Request | State Machine Constraint | `resume_timer` | Transaction Rolls Back | Sync timer UI to current phase |
| `CLOCK_TAMPERING` | `P0001` | 400 Bad Request | Anti-Cheat Invariant | `complete_timer` | Transaction Rolls Back | Re-align countdown with server clock |
| `INVALID_SESSION` | `P0001` | 400 Bad Request | Session Invariant | `complete_timer`, `abandon_timer` | Transaction Rolls Back | Clear stale session / refresh timer |
| `SESSION_NOT_ACTIVE` | `P0001` | 400 Bad Request | Target Invariant | `abandon_timer` | Transaction Rolls Back | Preserve active timer / sync UI |
| `ACTIVE_TIMER_EXISTS` | `P0001` | 400 Bad Request | Serialization Invariant | `update_profile_timezone` | Transaction Rolls Back | Complete or abandon active timer first |
| `PROFILE_NOT_FOUND` | `P0001` | 400 Bad Request | Profile Invariant | `update_profile_timezone` | Transaction Rolls Back | Initialize user profile before updating timezone |
| `COMPLETION_INSERT_FAILED` | `P0001` | 400 Bad Request | Data Integrity Check | `complete_timer` | Transaction Rolls Back | Retain active timer; log diagnostic alert |

### 4.1.4 Client Retry Policy & Concurrency Protocol
1. **Total Request Bounds**: Exactly 3 total attempts maximum (1 initial execution + up to 2 retry attempts).
2. **Eligible Retry Errors**: Strictly confirmed transaction rollback SQLSTATE codes:
   - `40001` (`serialization_failure`)
   - `40P01` (`deadlock_detected`)
3. **Ineligible / Ambiguous Errors**:
   - Application invariant errors (`P0001` with any detail code, e.g. `TIMER_ALREADY_ACTIVE`, `TIMER_NOT_RUNNING`, `CLOCK_TAMPERING`, `COMPLETION_INSERT_FAILED`): Zero retries. Immediately dispatch error to client UI state machine.
   - Authentication errors (`42501` / HTTP 401 / 403): Zero retries.
   - Ambiguous failures (network drops, HTTP 502/503/504 gateway timeouts): Zero automatic retries. The client MUST call `sync_timer()` first to inspect authoritative server state and monotonic version before determining whether to retry or reconcile.
4. **Exponential Backoff Formula**:
   $$\text{delay\_ms} = \min\left(100 \times 2^{\text{attempt} - 1} + \text{jitter}, 1000\right)$$
   where $\text{attempt} \in \{1, 2\}$, and $\text{jitter} = \text{random}(0, 50)\text{ ms}$.
   - Attempt 1: $100\text{ ms} + \text{jitter}$ (100–150 ms)
   - Attempt 2: $200\text{ ms} + \text{jitter}$ (200–250 ms)
   - Max 3 total attempts exhausted -> Dispatch fatal concurrency alert to user.

### 4.1.5 Timezone Serialization & Defensive Trigger Elimination
The former defensive trigger on `public.profiles` (`trg_profiles_tz_lock`) is completely eliminated from the architecture. Because PostgreSQL acquires row locks on `profiles` before running `BEFORE UPDATE` triggers, any trigger that attempts to lock `public.timers` would execute under the reverse lock order (`profiles` -> `timers`), creating a deadlock hazard with `start_timer` (`timers` -> `profiles`).
Instead, deadlock elimination is architecturally guaranteed via PostgreSQL's column-level privilege model:
1. `REVOKE UPDATE ON public.profiles FROM authenticated;` strips table-level update privileges.
2. `GRANT UPDATE (display_name, avatar_url, theme_preference, updated_at) ON public.profiles TO authenticated;` explicitly grants update on non-timezone columns only.
3. Direct `UPDATE (timezone)` is impossible; any direct attempt by `authenticated` fails with SQLSTATE `42501` (`permission denied for column timezone`).
4. `public.update_profile_timezone(TEXT)` is the exclusive mutation entrypoint, strictly enforcing Step 1 (`public.timers` locked `FOR UPDATE`) then Step 2 (`public.profiles` updated). If no profile row exists, it raises `PROFILE_NOT_FOUND`.

---

### 4.2 Executable RPC Implementations (PL/pgSQL)

#### 1. `start_timer`
```sql
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

---

## 5. Clock Synchronization & Client Offline Policy

### 5.1 Monotonic Cristian's Algorithm & Jitter Filtering Specification
```typescript
interface ClockSyncState {
  offsetMs: number;
  lastSyncMonotonicMs: number;
  isReliable: boolean;
}

let syncState: ClockSyncState = {
  offsetMs: 0,
  lastSyncMonotonicMs: 0,
  isReliable: false
};

const MAX_RTT_MS = 2000;
const MAX_OFFSET_AGE_MS = 600000; // 10 minutes

/**
 * Updates clock offset using Cristian's algorithm with monotonic performance.now()
 * for both RTT measurement and sample age/expiry evaluation, eliminating distortion
 * from local system wall-clock adjustments.
 */
export function processClockSyncSample(
  tReqMonotonicMs: number, 
  tResMonotonicMs: number, 
  serverNowMs: number
): boolean {
  const roundTripTime = tResMonotonicMs - tReqMonotonicMs;

  // Strict bootstrap and runtime filter: Reject high-latency samples unconditionally
  if (roundTripTime > MAX_RTT_MS || roundTripTime < 0) {
    checkClockSyncExpiry();
    return false; // High-latency sample discarded
  }

  // Symmetric one-way network latency estimate
  const estimatedLatency = roundTripTime / 2;
  const estimatedServerInstant = serverNowMs + estimatedLatency;

  // offsetMs = server_time - client_wall_clock at sync instant
  syncState = {
    offsetMs: estimatedServerInstant - Date.now(),
    lastSyncMonotonicMs: performance.now(),
    isReliable: true
  };
  return true;
}

/**
 * Expiry check executed on every 250ms timer display tick,
 * visibility restoration, and network reconnection using monotonic performance.now().
 */
export function checkClockSyncExpiry(): void {
  if (syncState.isReliable && (performance.now() - syncState.lastSyncMonotonicMs > MAX_OFFSET_AGE_MS)) {
    syncState.isReliable = false;
  }
}
```

### 5.2 Client Display vs. Offline Completion Rules
1. **Unsynchronized Display**: If `syncState.isReliable === false`, the UI displays a subtle indicator (`"Clock unverified"`). The countdown interpolates against local time as best-effort.
2. **Offline Timer Reaching Zero**:
   - **Offline completion is strictly prohibited.**
   - When the display reaches `00:00` while offline, the timer freezes at `00:00` with the canonical message: `"Session complete. Connect to internet to record study session."`
   - Audio bell alerts play locally, but no RPC is executed and zero focus minutes are added to local storage.
3. **Conditional Connectivity Restoration Recovery**:
   - The client listens to `window.addEventListener('online', ...)`.
   - Upon reconnecting, the client calls `sync_timer()` to refresh `syncState` and retrieve the authoritative `server_timer` and `server_now`.
   - **Conditional Expiration Check**:
     - **If `server_timer.phase === 'running'` AND `server_now >= server_timer.ends_at`**: The client immediately issues `complete_timer(server_timer.session_id)`.
     - **If `server_timer.phase === 'running'` AND `server_now < server_timer.ends_at`**: The timer is not yet expired on the server. The client does NOT call `complete_timer()`; it recalculates the remaining display milliseconds against `server_timer.ends_at` and continues countdown until real server expiration.
     - **If `server_timer.phase === 'idle'`**: The session was already completed or reset by another tab. Client updates UI to idle.

---

## 6. Comprehensive 17-Scenario Verification Matrix

| Scenario # | Description | Preconditions | Actor(s) & Actions | Expected Server & Database Outcome | Version Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | First-time provisioning race under READ COMMITTED | Zero rows in `public.timers` | Tab A & Tab B call `start_timer(1500000)` simultaneously | Atomic UPSERT creates idle row. Tab A locks row, starts timer. Tab B blocks, then reads `phase='running'`, returns `TIMER_ALREADY_ACTIVE`. Exactly 1 timer started. | `version = 1` |
| **2** | High-RTT initial clock-sync sample | Clean client boot, `isReliable = false` | Client calls `start_timer`, response arrives with RTT = 3500ms | Sample rejected by `processClockSyncSample`. `isReliable` remains `false`. Client UI shows unverified clock indicator. Server completes start cleanly. | `version = 1` |
| **3** | Stale clock offset while offline | Client offline for 15 minutes | `performance.now() - syncState.lastSyncMonotonicMs > 10m` | Checked on 250ms tick. Age exceeds `MAX_OFFSET_AGE_MS` (10m). `isReliable` transitions to `false`. Display interpolates locally. Monotonic time protects against system wall-clock adjustments. | Unchanged |
| **4** | Offline timer reaching zero | Tab offline, running timer hits 00:00 | Client timer ticks to 0ms | Display freezes at 00:00 with canonical message: `"Session complete. Connect to internet to record study session."`. Zero RPCs sent. | Unchanged until online commit |
| **5** | Contention Test Verification Fixture (Crossing expiration) | Timer expires at $T$; Test runner begins transaction holding row lock via `SELECT ... FOR UPDATE` at $T-100\text{ms}$ and commits at $T+200\text{ms}$ without mutating the row | Tab B (client) calls `complete_timer(session_A)` at $T-50\text{ms}$ | Tab B blocks on row lock until test runner commits. Tab B acquires lock at $T+200\text{ms}$. Tab B evaluates `v_now := clock_timestamp() > T`. `complete_timer` completes running session successfully. | `version` increments on commit |
| **6** | Start/Resume deadline calculated post-lock | High server load; lock wait is 400ms | Client calls `start_timer(1500000)` | Lock acquired. `v_now := clock_timestamp()`. `ends_at := v_now + 1500000ms`. Full 25 minutes granted; lock wait delay is not deducted. | `version` increments to `v+1` |
| **7** | Missing timezone before start | User profile has `timezone = NULL` | Client calls `start_timer` | Server rejects with `TIMEZONE_INVALID`. Timer remains idle. Client opens Timezone Selection Modal. | `version` unchanged (rolls back) |
| **8** | Invalid non-IANA timezone value | Profile has `timezone = 'EST'` (non-IANA) | Client calls `start_timer` | `NOT EXISTS in pg_timezone_names` triggers exception `TIMEZONE_INVALID`. Timer remains idle. | `version` unchanged (rolls back) |
| **9** | Abandon while running | Timer is running with `session_A` | Client calls `abandon_timer(session_A)` | Timer resets to `phase='idle'`. Operational fields nullified. Session NOT logged to `focus_sessions`. Status = `'abandoned'`. | `version` increments to `v+1` |
| **10** | Abandon while paused | Timer is paused with `session_B` | Client calls `abandon_timer(session_B)` | Timer resets to `phase='idle'`. Operational fields nullified. Session NOT logged. Status = `'abandoned'`. | `version` increments to `v+1` |
| **11** | Repeated abandon | Timer is already idle | Client calls `abandon_timer(session_B)` again | Server detects `phase='idle'`, returns neutral `{ status: 'already_idle' }`. Idempotent success without false historical claim. No database write. | `version` unchanged |
| **12** | Repeated completion after new timer started | `session_A` completed. `session_B` currently running | Delayed tab calls `complete_timer(session_A)` | Server detects `session_id != session_A`. Queries `focus_sessions`, finds `session_A`. Returns `{ status: 'already_completed', session: v_session, timer: v_timer }`. Client contract: `session` reflects requested completed session; `timer` reflects current independent active state. Running `session_B` untouched! | `version` unchanged |
| **13** | Multi-tiered authentication failure paths | Anonymous or unauthenticated request | Anonymous client calls `start_timer` | Tier 1: PostgREST gateway rejects missing/invalid JWT with HTTP 401 Unauthorized before DB. Tier 2: If anon role reaches DB, PostgreSQL rejects with HTTP 403 Forbidden via missing `EXECUTE` grant. Tier 3: In-function assertion `auth.uid() IS NULL` raises SQLSTATE `42501` (mapped by PostgREST to HTTP 403 Forbidden). | `version` unchanged |
| **14** | Cross-user assignment ID | User 1 owns `asg_1`. User 2 attempts start | User 2 calls `start_timer(..., p_assignment_id: asg_1)` | Ownership check fails `NOT EXISTS (WHERE id = asg_1 AND user_id = user_2)`. Raises `ASSIGNMENT_NOT_FOUND`. | `version` unchanged |
| **15** | Transient lock contention retry under READ COMMITTED | Concurrent transactions collide | Transient deadlock (`40P01`) occurs | Confirmed SQL rollback. Client timer gateway catches code, delays with backoff, retries successfully on attempt 2. Exactly one logical commit. | `version` increments once |
| **16** | Consistent RPC response envelopes | Any of the six RPCs (start, pause, resume, complete, abandon, sync) | Client invokes RPC | Success returns `{ success: true, status, timer, session, server_now, server_now_ms }`. Failures raise structured PostgREST exceptions with `code` and `details`. | Monotonic |
| **17** | Assignment Deletion Concurrency (Decoupled Ephemeral FK) | Timer idle or starting with `asg_1` | Tab A calls `start_timer(..., asg_1)` while concurrent transaction calls `DELETE FROM assignments WHERE id = asg_1` | Ephemeral `public.timers.assignment_id` is decoupled from database-level FK constraint (retained strictly on persistent `focus_sessions`). PostgreSQL acquires ZERO implicit `RI_FKey_check_ins` or `RI_FKey_setnull_del` locks between `timers` and `assignments`. `start_timer` verifies assignment via non-locking `EXISTS`. If deletion commits prior to start -> `ASSIGNMENT_NOT_FOUND`. If deletion commits after start -> `complete_timer` resolves missing assignment to `NULL` for `focus_sessions`. Zero lock cycle, zero deadlock. | `version` increments to `v+1` on start |

---

## 7. Shared Architectural Invariants & Cross-Document Alignment

1. **`DATABASE.md` Alignment**:
   - `public.timers.user_id` has `DEFAULT auth.uid()`.
   - `public.assignments` enforces `UNIQUE (user_id, id)` to support composite foreign key `(user_id, assignment_id)`.
   - `public.focus_sessions` enforces `UNIQUE (user_id, session_id)` for completion deduplication.
2. **`API-SPEC.md` Alignment**:
   - All six RPC endpoints return the exact `TimerRpcSuccessResponse` JSON envelope across all phases and idempotent retries.
3. **`RLS-MATRIX.md` Alignment**:
   - Direct mutations on `public.timers` are revoked from `anon` and `authenticated`.
   - Only `SELECT` is permitted via policy `USING (user_id = auth.uid())`.
   - Privileges on timer RPCs are granted explicitly to `authenticated` and revoked from `anon, PUBLIC`.
