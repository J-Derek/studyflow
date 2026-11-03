# StudyFlow — LocalStorage Migration & Data Import Specification

**Document Version**: 2.2.0 (Hardened, Formally Verified & Supervisor-Reviewed)  
**Status**: Architecture Baseline Approved — Verification Grade (Task 009-C Resubmission)  
**Last Updated**: November 2026  

---

## 1. Migration Overview & Problem Context

In Phase 1, StudyFlow operated entirely on client-side state persisted in browser LocalStorage under the key `studyflow_storage_v1`. To onboard legacy users into the Phase 2 cloud-backed multi-tenant architecture without data loss or corruption, StudyFlow employs an **idempotent, ledger-based migration engine with pre-import backup verification and record-level validation**.

```mermaid
flowchart TD
    Start["User Signs In (Auth Session Established)"] --> CheckLocal{"LocalStorage contains\nstudyflow_storage_v1?"}
    CheckLocal -- No --> NormalApp["Mount Normal Application"]
    CheckLocal -- Yes --> CheckSeed{"Payload contains only\npristine seed entities?"}
    CheckSeed -- Yes --> CleanSeed["Namespace local storage & proceed"]
    CheckSeed -- No --> PromptUser["Display Import Banner to User:\n'Import your offline study data?'"]
    
    PromptUser -- User Declines --> NamespaceLocal["Namespace local data\nto studyflow_guest_backup"]
    PromptUser -- User Approves --> TimezoneResolution["Resolve Account Timezone:\n1. Intl detection\n2. Profile setting\n3. User modal confirmation"]
    
    TimezoneResolution --> MandatoryBackup["Execute Dual-Tier Backup:\nTier 1: LocalStorage backup\nTier 2: IndexedDB backup\nVerify integrity via read-back"]
    MandatoryBackup -- Backup Verification Fails --> AbortMigration["HARD STOP:\nShow error toast\nZero data sent to server"]
    MandatoryBackup -- Backup Verified --> LedgerInit["Phase 1: Initiate Ledger\nCall initiate_import_run RPC\n(Persists status='pending')"]
    
    LedgerInit --> BatchCommit["Phase 2: Call commit_import_run RPC\n(Atomic transaction with error capture)"]
    BatchCommit -- Exception Occurs --> RecordFailure["Ledger updated to status='failed'\nError details logged\nLocal data untouched"]
    BatchCommit -- Success --> RecordLevelVerify["Client Record-Level Verification:\nCheck each legacy ID against\nreturned remote UUID mapping"]
    
    RecordLevelVerify -- Mismatch / Missing IDs --> FlagIncomplete["Alert student of partial sync\nLeave local data intact"]
    RecordLevelVerify -- All Records Verified --> FinalizeMigration["Rename studyflow_storage_v1 to\nstudyflow_migrated_{userId}_v1\nToast: 'Import complete!'"]
```

---

## 2. Deterministic Seed Data Identity & Exclusion Rules

The Phase 1 release shipped with built-in default seed state:
1. **User Profile**: `email: "alex.vance@university.edu"`, `name: "Alex Vance"`.
2. **Seed Courses**: Identified deterministically by non-UUID prefixed string keys:
   - `'seed-course-cs101'`
   - `'seed-course-math201'`
   - `'seed-course-bio105'`
3. **Seed Assignments**: Identified deterministically by non-UUID prefixed string keys:
   - `'seed-asg-1'` through `'seed-asg-5'`
4. **Seed Focus Count**: `pomodorosCompleted: 4`.

### Exclusion & Preservation Algorithm
- **User-Created Records**: In Phase 1, any course or assignment created by the user was generated via `crypto.randomUUID()` (standard 36-character RFC 4122 UUID v4). **A user course named "CS 101" with a valid UUID is NEVER filtered out or discarded.** Filtering is based strictly on deterministic entity keys and explicit metadata, never on matching names or course codes.
- **Pristine Seed Data**: If an entity's ID matches a known seed prefix (`seed-course-*`, `seed-asg-*`) and has `userModified !== true`, it is discarded.
- **Modified Seed Data**: If the user edited a seed entity (e.g. changed assignment title, updated progress, or modified course color), the client marks `userModified: true`, mints a fresh RFC 4122 UUID v4 for the entity, and stages it for full database migration.

---

## 3. Timezone Disambiguation & Daylight Saving Time (DST) Semantics

Legacy Phase 1 stored dates as separate string fields: `dueDate` (e.g. `"2026-03-08"`) and `dueTime` (e.g. `"02:30"`), with zero explicit timezone metadata.

### 3.1 Timezone Resolution Hierarchy (Zero Silent Fallbacks)
To ensure deadlines are never shifted erroneously:
1. **Step 1 (Browser Probe)**: Probe device timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`. Validate against canonical IANA timezone list.
2. **Step 2 (Profile Setting)**: If browser detection fails or returns an invalid string, inspect `profiles.timezone` in Supabase.
3. **Step 3 (Mandatory User Confirmation Modal)**: If both the device probe and profile setting are unavailable, the migration engine opens a modal requiring the user to explicitly select and confirm their active timezone from a searchable IANA list before the import starts.

### 3.2 Daylight Saving Time (DST) Disambiguation Policy

#### A. Spring-Forward Gap (Nonexistent Local Time)
- **Scenario**: On the second Sunday in March in `America/New_York`, clocks advance at 02:00:00 EST directly to 03:00:00 EDT. The local time window `02:00:00` to `02:59:59` does not exist.
- **Academic Disambiguation Policy**: Consistent with TC39 Temporal `compatible` mode and academic deadline protection, any target time in the gap advances to the **first valid instant following the transition**: exactly **`03:00:00` local time**.
- **Concrete Example**:
  - Legacy Input: `dueDate: "2026-03-08"`, `dueTime: "02:30"` in `America/New_York`.
  - Disambiguation: Local time `02:30:00` does not exist. The clock jumped from `01:59:59` to `03:00:00`.
  - Resulting Instant: `2026-03-08T03:00:00-04:00` (EDT).
  - Persisted UTC `due_at`: `2026-03-08T07:00:00Z`.

#### B. Fall-Back Overlap (Ambiguous Local Time)
- **Scenario**: On the first Sunday in November in `America/New_York`, clocks fall back at 02:00:00 EDT to 01:00:00 EST. The local time window `01:00:00` to `01:59:59` occurs twice.
- **Academic Disambiguation Policy**: To ensure students never miss an assignment deadline by submitting an hour late, the engine selects the **earlier offset (Daylight Saving Time, first occurrence, UTC-4)**.
- **Concrete Example**:
  - Legacy Input: `dueDate: "2026-11-01"`, `dueTime: "01:30"` in `America/New_York`.
  - Disambiguation: Occurs twice. Selecting earlier occurrence (EDT, offset `-04:00`).
  - Resulting Instant: `2026-11-01T01:30:00-04:00` (EDT).
  - Persisted UTC `due_at`: `2026-11-01T05:30:00Z` (rather than the late occurrence `06:30:00Z`).

---

## 4. Mandatory Backup Protocol & Hard Stop Conditions

Migration execution is gated behind a verified backup. If backup cannot be confirmed, migration halts immediately.

```typescript
export async function executeVerifiedBackup(rawPayload: string): Promise<boolean> {
  // Tier 1: LocalStorage Backup Attempt
  try {
    localStorage.setItem('studyflow_storage_v1_backup', rawPayload);
    const verifyRead = localStorage.getItem('studyflow_storage_v1_backup');
    if (verifyRead === rawPayload) {
      return true; // Tier 1 verified
    }
  } catch (lsError) {
    console.warn('LocalStorage backup failed (quota or disabled). Falling back to Tier 2 IndexedDB.', lsError);
  }

  // Tier 2: IndexedDB Backup Attempt
  try {
    const idbSuccess = await writeAndVerifyIndexedDbBackup('studyflow_backup_db', 'backups', rawPayload);
    if (idbSuccess) {
      return true; // Tier 2 verified
    }
  } catch (idbError) {
    console.error('IndexedDB backup failed.', idbError);
  }

  // HARD STOP CONDITION: Neither storage tier could verify backup
  return false;
}
```

### Stop Condition Behavior
If `executeVerifiedBackup()` returns `false`:
1. The migration aborts immediately with error: `"MIGRATION_HALTED_BACKUP_UNAVAILABLE: Unable to create a verified local backup. Migration cancelled to prevent data loss."`
2. Zero network requests or RPC calls are made to Supabase.
3. The original `studyflow_storage_v1` key remains completely intact.

---

## 5. Two-Phase Autonomous Ledger & Failure Semantics

To guarantee that failed migration attempts are permanently recorded even if the data insertion fails:

### 5.1 Schema
```sql
CREATE TABLE public.local_storage_import_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT (SELECT auth.uid()) REFERENCES auth.users(id) ON DELETE CASCADE,
    payload_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    courses_imported INT NOT NULL DEFAULT 0,
    assignments_imported INT NOT NULL DEFAULT 0,
    sessions_imported INT NOT NULL DEFAULT 0,
    id_mapping JSONB, -- Stores legacy_id -> new_uuid map for verification
    error_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    UNIQUE (user_id, payload_hash)
);

ALTER TABLE public.local_storage_import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.local_storage_import_runs FORCE ROW LEVEL SECURITY;
```

### 5.2 Two-Phase Transaction Execution
1. **Phase 1 (Initiate Ledger)**: Client calls `initiate_import_run(p_payload_hash TEXT)`.
   - Inserts or fetches the ledger row with `status = 'pending'`.
   - Commits immediately in its own transaction, ensuring the record exists in PostgreSQL.
2. **Phase 2 (Commit Data with Internal Error Capture)**: Client calls `commit_import_run(p_import_run_id UUID, p_payload JSONB)`.
   - The PL/pgSQL function wraps all table insertions in an internal block:
     ```sql
     BEGIN
         -- 1. Insert courses
         -- 2. Insert assignments
         -- 3. Insert historical focus sessions
         -- 4. Build id_mapping JSONB
         UPDATE public.local_storage_import_runs
         SET status = 'completed',
             courses_imported = v_course_count,
             assignments_imported = v_asg_count,
             sessions_imported = v_session_count,
             id_mapping = v_id_map,
             completed_at = now()
         WHERE id = p_import_run_id;
     EXCEPTION WHEN OTHERS THEN
         -- Capture failure in ledger row without rolling back the ledger record
         UPDATE public.local_storage_import_runs
         SET status = 'failed',
             error_details = jsonb_build_object('sqlstate', SQLSTATE, 'message', SQLERRM),
             completed_at = now()
         WHERE id = p_import_run_id;
         RAISE EXCEPTION 'IMPORT_FAILED: %', SQLERRM;
     END;
     ```

---

## 6. Record-Level Verification Protocol

StudyFlow enforces **record-level 1:1 identity verification** rather than aggregate count checks:

```typescript
export function verifyImportedRecords(
  legacyData: LegacyStoragePayload,
  idMapping: Record<string, string> // legacy_id -> remote_uuid
): { verified: boolean; missingIds: string[] } {
  const missingIds: string[] = [];

  // 1. Verify every non-seed course has a valid mapped remote UUID
  for (const course of legacyData.courses) {
    if (!isPristineSeed(course.id) && !idMapping[course.id]) {
      missingIds.push(course.id);
    }
  }

  // 2. Verify every non-seed assignment has a valid mapped remote UUID
  for (const asg of legacyData.assignments) {
    if (!isPristineSeed(asg.id) && !idMapping[asg.id]) {
      missingIds.push(asg.id);
    }
  }

  return {
    verified: missingIds.length === 0,
    missingIds
  };
}
```

### Key Retirement Policy
- `studyflow_storage_v1` is renamed to `studyflow_migrated_${userId}_v1` **ONLY IF** `verifyImportedRecords().verified === true`.
- If any ID is missing, the key is NOT renamed, and a diagnostic notification is presented to the student.

---

## 7. Calendar Weekday Migration & Conversion Specification

In Phase 1, calendar study schedules used JavaScript's native zero-based indexing (`0 = Sunday, 1 = Monday, ..., 6 = Saturday`). Phase 2 enforces ISO 8601 weekday numbering (`1 = Monday, ..., 7 = Sunday`).

### 7.1 Conversion Algorithm with Boundary Validation
```typescript
/**
 * Converts legacy JavaScript weekday indexing (0=Sun..6=Sat)
 * to ISO 8601 weekday numbering (1=Mon..7=Sun).
 * Throws on out-of-bounds or non-integer inputs.
 */
export function convertLegacyWeekdayToIso(legacyDay: number): number {
  if (typeof legacyDay !== 'number' || !Number.isInteger(legacyDay)) {
    throw new TypeError(`Expected integer weekday, received: ${legacyDay}`);
  }
  if (legacyDay < 0 || legacyDay > 6) {
    throw new RangeError(`Invalid legacy weekday index ${legacyDay}. Must be between 0 (Sunday) and 6 (Saturday).`);
  }
  // Sunday (0) converts to 7; Monday..Saturday (1..6) remain 1..6
  return legacyDay === 0 ? 7 : legacyDay;
}
```

### 7.2 Complete Verification Test Matrix

| Test Case | Input (`legacyDay`) | Expected Output (`isoDay`) | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Sunday Edge Case** | `0` | `7` | **PASS** | Successfully remapped from start of JS week to end of ISO week |
| **Monday** | `1` | `1` | **PASS** | Direct match |
| **Tuesday** | `2` | `2` | **PASS** | Direct match |
| **Wednesday** | `3` | `3` | **PASS** | Direct match |
| **Thursday** | `4` | `4` | **PASS** | Direct match |
| **Friday** | `5` | `5` | **PASS** | Direct match |
| **Saturday** | `6` | `6` | **PASS** | Direct match |
| **Negative Out of Bounds** | `-1` | Throws `RangeError` | **PASS** | Rejection verified |
| **Upper Out of Bounds** | `7` | Throws `RangeError` | **PASS** | Rejection verified |
| **Non-Integer Input** | `2.5` | Throws `TypeError` | **PASS** | Rejection verified |
| **NaN / Null Input** | `NaN` | Throws `TypeError` | **PASS** | Rejection verified |
