-- ============================================================================
-- StudyFlow — Authoritative Relational Database Schema (PostgreSQL / Supabase)
-- Reference: CONTEXT.md & DESIGN.md (November 2026)
-- Standards: Multi-Tenant Row Level Security (RLS) + Hard Composite FK Invariants
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ENUMS & DOMAIN TYPES
-- ============================================================================

CREATE TYPE priority_tier AS ENUM ('low', 'medium', 'high');
CREATE TYPE assignment_status AS ENUM ('pending', 'in_progress', 'completed');
CREATE TYPE assignment_kind AS ENUM ('assignment', 'exam', 'test', 'reading', 'project');
CREATE TYPE timer_mode AS ENUM ('focus', 'shortBreak', 'longBreak');
CREATE TYPE timer_status AS ENUM ('idle', 'running', 'paused');
CREATE TYPE session_type AS ENUM ('lecture', 'lab', 'study', 'review', 'exam');
CREATE TYPE period_label AS ENUM ('semester', 'term', 'trimester');
CREATE TYPE grading_scale AS ENUM ('us4', 'pct', 'uk', 'ke');

-- ============================================================================
-- 2. HARD ARCHITECTURAL INVARIANT TRIGGERS
-- ============================================================================

-- Invariant 2: User ID Immutability Invariant
-- Any UPDATE attempting to mutate user_id is strictly aborted.
CREATE OR REPLACE FUNCTION fn_prevent_user_id_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'Hard Invariant Violation: user_id is immutable (table: %, row: %)', 
      TG_TABLE_NAME, OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Automated timestamp updater
CREATE OR REPLACE FUNCTION fn_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. USER PROFILES & PREFERENCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY,
  name VARCHAR(120) NOT NULL DEFAULT 'Student',
  university VARCHAR(160) NOT NULL DEFAULT 'Academic Workspace',
  program VARCHAR(160) NOT NULL DEFAULT 'Undergraduate',
  semester VARCHAR(100) NOT NULL DEFAULT 'Current semester',
  period_label period_label NOT NULL DEFAULT 'semester',
  grading_scale grading_scale NOT NULL DEFAULT 'us4',
  avatar_url TEXT,
  
  -- Local device preferences synced to cloud
  timer_focus_sec INT NOT NULL DEFAULT 1500 CHECK (timer_focus_sec BETWEEN 60 AND 7200),
  timer_short_break_sec INT NOT NULL DEFAULT 300 CHECK (timer_short_break_sec BETWEEN 60 AND 3600),
  timer_long_break_sec INT NOT NULL DEFAULT 900 CHECK (timer_long_break_sec BETWEEN 60 AND 3600),
  soundscape VARCHAR(32) NOT NULL DEFAULT 'off',
  break_soundscape VARCHAR(32) NOT NULL DEFAULT 'off',
  soundscape_volume NUMERIC(3, 2) NOT NULL DEFAULT 0.70 CHECK (soundscape_volume BETWEEN 0.0 AND 1.0),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. ACADEMIC PERIODS (Semesters / Terms / Trimesters)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.periods (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  label period_label NOT NULL DEFAULT 'semester',
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Cached snapshot counts at the time of archival
  counts_assignments INT NOT NULL DEFAULT 0,
  counts_sessions INT NOT NULL DEFAULT 0,
  counts_grades INT NOT NULL DEFAULT 0,
  counts_notes INT NOT NULL DEFAULT 0,

  PRIMARY KEY (id),
  CONSTRAINT uq_periods_tenant UNIQUE (user_id, id)
);

CREATE TRIGGER tr_periods_user_id_immutable
  BEFORE UPDATE ON public.periods
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_user_id_change();

-- ============================================================================
-- 5. COURSES & MODULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  title VARCHAR(150) NOT NULL,
  color VARCHAR(32) NOT NULL DEFAULT '#2563EB',
  credits NUMERIC(4, 1) NOT NULL DEFAULT 3.0 CHECK (credits >= 0.0),
  target_letter VARCHAR(8) NOT NULL DEFAULT 'A',
  
  -- Archival linkage (NULL means active semester)
  archived_period_id UUID,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (id),
  CONSTRAINT uq_courses_tenant UNIQUE (user_id, id),
  CONSTRAINT uq_courses_user_code_active UNIQUE (user_id, code, archived_period_id),
  
  -- Composite Foreign Key to periods
  CONSTRAINT fk_courses_period
    FOREIGN KEY (user_id, archived_period_id)
    REFERENCES public.periods (user_id, id)
    ON DELETE SET NULL
);

CREATE TRIGGER tr_courses_user_id_immutable
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_user_id_change();

CREATE TRIGGER tr_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

-- ============================================================================
-- 6. COURSE ASSESSMENTS (Grade Components)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.course_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  course_id UUID NOT NULL,
  name VARCHAR(120) NOT NULL,
  weight NUMERIC(5, 2) NOT NULL CHECK (weight >= 0.0 AND weight <= 100.0),
  score NUMERIC(5, 2) CHECK (score IS NULL OR (score >= 0.0 AND score <= 100.0)),
  position INT NOT NULL DEFAULT 0,

  PRIMARY KEY (id),
  CONSTRAINT uq_course_assessments_tenant UNIQUE (user_id, id),
  
  -- Composite FK: Enforces tenant-isolation between assessment and parent course
  CONSTRAINT fk_course_assessments_course
    FOREIGN KEY (user_id, course_id)
    REFERENCES public.courses (user_id, id)
    ON DELETE CASCADE
);

CREATE TRIGGER tr_course_assessments_user_id_immutable
  BEFORE UPDATE ON public.course_assessments
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_user_id_change();

-- ============================================================================
-- 7. ASSIGNMENTS & DELIVERABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  course_id UUID,
  title VARCHAR(200) NOT NULL,
  due_date DATE NOT NULL,
  due_time TIME,
  priority priority_tier NOT NULL DEFAULT 'medium',
  kind assignment_kind NOT NULL DEFAULT 'assignment',
  
  -- Progress State Machine (0 - 100)
  progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  previous_progress INT CHECK (previous_progress BETWEEN 0 AND 100),
  
  -- Invariant 5: Derived Status
  status assignment_status GENERATED ALWAYS AS (
    CASE 
      WHEN progress = 100 THEN 'completed'::assignment_status
      WHEN progress > 0 THEN 'in_progress'::assignment_status
      ELSE 'pending'::assignment_status
    END
  ) STORED,

  notes VARCHAR(1000),
  
  -- Weekly recurrence engine
  repeat_every VARCHAR(16),
  repeat_until DATE,
  repeat_of_id UUID,

  archived_period_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (id),
  CONSTRAINT uq_assignments_tenant UNIQUE (user_id, id),

  -- Composite FK Invariant: Must match tenant on course linkage
  CONSTRAINT fk_assignments_course
    FOREIGN KEY (user_id, course_id)
    REFERENCES public.courses (user_id, id)
    ON DELETE SET NULL,

  -- Composite FK Invariant: Must match tenant on period linkage
  CONSTRAINT fk_assignments_period
    FOREIGN KEY (user_id, archived_period_id)
    REFERENCES public.periods (user_id, id)
    ON DELETE SET NULL,

  -- Composite FK Invariant: Self-referential repeat series parent
  CONSTRAINT fk_assignments_repeat_of
    FOREIGN KEY (user_id, repeat_of_id)
    REFERENCES public.assignments (user_id, id)
    ON DELETE SET NULL
);

CREATE TRIGGER tr_assignments_user_id_immutable
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_user_id_change();

CREATE TRIGGER tr_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

-- ============================================================================
-- 8. SUBTASKS (Assignment Checklists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  assignment_id UUID NOT NULL,
  title VARCHAR(200) NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (id),
  CONSTRAINT uq_subtasks_tenant UNIQUE (user_id, id),

  -- Composite FK Invariant: Tenant scoped to assignment
  CONSTRAINT fk_subtasks_assignment
    FOREIGN KEY (user_id, assignment_id)
    REFERENCES public.assignments (user_id, id)
    ON DELETE CASCADE
);

CREATE TRIGGER tr_subtasks_user_id_immutable
  BEFORE UPDATE ON public.subtasks
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_user_id_change();

-- ============================================================================
-- 9. CALENDAR BLOCKS & TIMETABLE (Study Sessions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.calendar_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  course_id UUID,
  title VARCHAR(150) NOT NULL,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 1=Mon, ..., 6=Sat
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INT GENERATED ALWAYS AS (
    (EXTRACT(EPOCH FROM end_time) - EXTRACT(EPOCH FROM start_time)) / 60
  ) STORED,
  type session_type NOT NULL DEFAULT 'lecture',
  color VARCHAR(32),

  archived_period_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (id),
  CONSTRAINT uq_calendar_blocks_tenant UNIQUE (user_id, id),
  CONSTRAINT chk_calendar_time_order CHECK (end_time > start_time),

  CONSTRAINT fk_calendar_blocks_course
    FOREIGN KEY (user_id, course_id)
    REFERENCES public.courses (user_id, id)
    ON DELETE SET NULL,

  CONSTRAINT fk_calendar_blocks_period
    FOREIGN KEY (user_id, archived_period_id)
    REFERENCES public.periods (user_id, id)
    ON DELETE SET NULL
);

CREATE TRIGGER tr_calendar_blocks_user_id_immutable
  BEFORE UPDATE ON public.calendar_blocks
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_user_id_change();

CREATE TRIGGER tr_calendar_blocks_updated_at
  BEFORE UPDATE ON public.calendar_blocks
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

-- ============================================================================
-- 10. TIMERS (Server-Authoritative Focus Engine)
-- ============================================================================

-- Invariant 3: Timer Exclusivity Invariant
-- A user has at most ONE active timer row. The primary key of public.timers is user_id.
CREATE TABLE IF NOT EXISTS public.timers (
  user_id UUID PRIMARY KEY,
  status timer_status NOT NULL DEFAULT 'idle',
  mode timer_mode NOT NULL DEFAULT 'focus',
  duration_seconds INT NOT NULL DEFAULT 1500 CHECK (duration_seconds > 0),
  
  -- Invariant 4: Zero-Drift Timer Invariant
  -- While running, countdown is anchored by ends_at. Client computes math.
  started_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  elapsed_before_ms BIGINT NOT NULL DEFAULT 0,
  
  -- Compare-And-Swap (CAS) revision number
  revision BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tr_timers_user_id_immutable
  BEFORE UPDATE ON public.timers
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_user_id_change();

CREATE TRIGGER tr_timers_updated_at
  BEFORE UPDATE ON public.timers
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

-- ============================================================================
-- 11. FOCUS SESSIONS (Immutable Historical Ledger)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  duration_seconds INT NOT NULL CHECK (duration_seconds > 0),
  mode timer_mode NOT NULL DEFAULT 'focus',
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  course_id UUID,
  assignment_id UUID,
  timer_revision BIGINT NOT NULL,

  PRIMARY KEY (id),
  CONSTRAINT uq_focus_sessions_tenant UNIQUE (user_id, id),
  CONSTRAINT chk_focus_time_valid CHECK (ended_at >= started_at),

  CONSTRAINT fk_focus_sessions_course
    FOREIGN KEY (user_id, course_id)
    REFERENCES public.courses (user_id, id)
    ON DELETE SET NULL,

  CONSTRAINT fk_focus_sessions_assignment
    FOREIGN KEY (user_id, assignment_id)
    REFERENCES public.assignments (user_id, id)
    ON DELETE SET NULL
);

CREATE TRIGGER tr_focus_sessions_user_id_immutable
  BEFORE UPDATE ON public.focus_sessions
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_user_id_change();

-- ============================================================================
-- 12. NOTES & WRITING SPACE (Drafts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  course_id UUID,
  title VARCHAR(200) NOT NULL DEFAULT 'Untitled note',
  body TEXT NOT NULL DEFAULT '',
  pinned BOOLEAN NOT NULL DEFAULT FALSE,

  archived_period_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (id),
  CONSTRAINT uq_notes_tenant UNIQUE (user_id, id),

  CONSTRAINT fk_notes_course
    FOREIGN KEY (user_id, course_id)
    REFERENCES public.courses (user_id, id)
    ON DELETE SET NULL,

  CONSTRAINT fk_notes_period
    FOREIGN KEY (user_id, archived_period_id)
    REFERENCES public.periods (user_id, id)
    ON DELETE SET NULL
);

CREATE TRIGGER tr_notes_user_id_immutable
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_user_id_change();

CREATE TRIGGER tr_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

-- Drafts: One dedicated Markdown writing space per assignment
CREATE TABLE IF NOT EXISTS public.drafts (
  assignment_id UUID NOT NULL,
  user_id UUID NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (assignment_id),
  CONSTRAINT uq_drafts_tenant UNIQUE (user_id, assignment_id),

  -- Composite FK: Deleted assignment automatically purges its draft
  CONSTRAINT fk_drafts_assignment
    FOREIGN KEY (user_id, assignment_id)
    REFERENCES public.assignments (user_id, id)
    ON DELETE CASCADE
);

CREATE TRIGGER tr_drafts_user_id_immutable
  BEFORE UPDATE ON public.drafts
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_user_id_change();

CREATE TRIGGER tr_drafts_updated_at
  BEFORE UPDATE ON public.drafts
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

-- ============================================================================
-- 13. CLIENT MIGRATION / IMPORT LEDGER
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.local_storage_import_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  payload_hash CHAR(64) NOT NULL, -- SHA-256 of imported backup/state
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (id),
  CONSTRAINT uq_import_runs_tenant UNIQUE (user_id, id),
  CONSTRAINT uq_import_payload UNIQUE (user_id, payload_hash)
);

CREATE TRIGGER tr_import_runs_user_id_immutable
  BEFORE UPDATE ON public.local_storage_import_runs
  FOR EACH ROW EXECUTE FUNCTION fn_prevent_user_id_change();

-- ============================================================================
-- 14. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.local_storage_import_runs ENABLE ROW LEVEL SECURITY;

-- Standard tenant isolation macro policies (auth.uid() matches user_id)
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'user_preferences', 'periods', 'courses', 'course_assessments',
    'assignments', 'subtasks', 'calendar_blocks', 'timers',
    'focus_sessions', 'notes', 'drafts', 'local_storage_import_runs'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS p_tenant_all_%I ON public.%I;
      CREATE POLICY p_tenant_all_%I ON public.%I
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    ', tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- Focus sessions cannot be updated (immutable ledger)
DROP POLICY IF EXISTS p_tenant_no_update_sessions ON public.focus_sessions;
CREATE POLICY p_tenant_no_update_sessions ON public.focus_sessions
  FOR UPDATE USING (FALSE);

-- ============================================================================
-- 15. PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_assignments_due ON public.assignments (user_id, due_date, priority);
CREATE INDEX IF NOT EXISTS idx_assignments_course ON public.assignments (user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_assignment ON public.subtasks (user_id, assignment_id, position);
CREATE INDEX IF NOT EXISTS idx_calendar_day_time ON public.calendar_blocks (user_id, day_of_week, start_time);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_time ON public.focus_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_course ON public.notes (user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_assessments_course ON public.course_assessments (user_id, course_id, position);

