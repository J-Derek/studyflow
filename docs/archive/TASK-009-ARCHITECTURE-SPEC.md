# StudyFlow Phase 2 — System Architecture & Security Design Specification

**PROJECT**: StudyFlow  
**PHASE**: 2 — Production Hardening & Backend Expansion  
**TASK**: 009 — Architecture Specification & Security Design  
**STATUS**: READY FOR SUPERVISOR REVIEW & IMPLEMENTATION

---

## SECTION 1 — DOCUMENTATION BASELINE & COMPLETION PLAN
1. **PRD (Product Requirements Document)**: Define student user personas, multi-device synchronization requirements, light/dark mode ergonomics, and time management metrics.
2. **User Stories**:
   - *US-01*: As a student, I want to authenticate via Email OTP / Google OAuth so my assignments sync across my laptop and phone.
   - *US-02*: As a night-owl student, I want a high-contrast dark mode matching Figma typography so studying in low light avoids eye strain.
   - *US-03*: As a student, I want my focus sessions linked directly to specific course assignments so I know where my study hours went.
   - *US-04*: As a student, if my internet drops in the library, I want to edit assignments and have them safely sync when reconnected.
3. **Architecture & Schema Docs**: Retain this specification as the master architecture blueprint.

---

## SECTION 2 — SYSTEM ARCHITECTURE & COMPONENT BOUNDARIES

```
+-----------------------------------------------------------------------------------+
|                                 BROWSER CLIENT                                    |
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   |                       REACT 19 APPLICATION SHELL                          |   |
|   |                                                                           |   |
|   |   +-----------------------+   +-------------------+   +---------------+   |   |
|   |   |  PAGES & COMPONENTS   |   |  THEME PROVIDER   |   | MODAL PORTALS |   |   |
|   |   | (Dashboard, Cal, etc) |   |  (Light/Dark/Sys) |   | (Trap focus)  |   |   |
|   |   +-----------+-----------+   +---------+---------+   +-------+-------+   |   |
|   |               |                         |                     |           |   |
|   |   +-----------v-------------------------v---------------------v-------+   |   |
|   |   |                     ZUSTAND UI STORE                              |   |   |
|   |   |  - Active Navigation Tab               - Modal Visibility         |   |   |
|   |   |  - Filter & Search UI State            - Theme Preference State   |   |   |
|   |   +-------------------------------------+-----------------------------+   |   |
|   |                                         |                                 |   |
|   |   +-------------------------------------v-----------------------------+   |   |
|   |   |                   TANSTACK QUERY (SERVER STATE)                   |   |   |
|   |   |  - Cache Keys: ['assignments'], ['courses'], ['sessions'], etc.   |   |   |
|   |   |  - Optimistic mutations with rollback on network failure          |   |   |
|   |   |  - LocalStorage / IndexedDB cache persistence layer               |   |   |
|   |   +-------------------------------------+-----------------------------+   |   |
|   |                                         |                                 |   |
|   |   +-------------------------------------v-----------------------------+   |   |
|   |   |                       DATA ACCESS LAYER                           |   |   |
|   |   |  - Zod Runtime Validation Schemas (Input/Output boundary)         |   |   |
|   |   |  - Supabase JS Client (v2) with Token Auto-Refresh                |   |   |
|   |   |  - Legacy 'studyflow_storage_v1' Migration Handler                |   |   |
|   |   +-------------------------------------+-----------------------------+   |   |
|   +-----------------------------------------|---------------------------------+   |
+---------------------------------------------|-------------------------------------+
                                              | HTTPS (WSS for Realtime)
+---------------------------------------------v-------------------------------------+
|                                SUPABASE CLOUD                                     |
|                                                                                   |
|   +--------------------------+   +--------------------------------------------+   |
|   |      SUPABASE AUTH       |   |             POSTGRESQL DATABASE            |   |
|   |  - Email OTP / MagicLink |   |  - Tables: profiles, courses, assignments, |   |
|   |  - Google OAuth          |   |            study_sessions, focus_logs      |   |
|   |  - JWT with auth.uid()   |   |  - Row Level Security (RLS) on all tables  |   |
|   |  - Session Cookies / JWT |   |  - Automated updated_at triggers           |   |
|   +--------------------------+   +--------------------------------------------+   |
+-----------------------------------------------------------------------------------+
```

---

## SECTION 3 — POSTGRESQL DATABASE DESIGN & ERD

```sql
-- 1. PROFILES (Extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  university TEXT DEFAULT '',
  program TEXT DEFAULT '',
  semester TEXT DEFAULT '',
  theme_preference TEXT NOT NULL DEFAULT 'system' CHECK (theme_preference IN ('light', 'dark', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. COURSES
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#312E81',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, code)
);

-- 3. ASSIGNMENTS
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
  due_at TIMESTAMPTZ NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status TEXT GENERATED ALWAYS AS (
    CASE 
      WHEN progress = 100 THEN 'completed'
      WHEN progress > 0 THEN 'in_progress'
      ELSE 'pending'
    END
  ) STORED,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. STUDY SESSIONS (Weekly Calendar)
CREATE TABLE public.study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL CHECK (end_time > start_time),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('lecture', 'lab', 'study', 'review', 'exam')),
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. FOCUS LOGS (Linked Pomodoro Sessions)
CREATE TABLE public.focus_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE SET NULL,
  mode TEXT NOT NULL CHECK (mode IN ('focus', 'shortBreak', 'longBreak')),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. ACTIVE TIMERS (Cloud Drift-Proof State)
CREATE TABLE public.active_timers (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE SET NULL,
  mode TEXT NOT NULL CHECK (mode IN ('focus', 'shortBreak', 'longBreak')),
  started_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_running BOOLEAN NOT NULL DEFAULT false,
  remaining_seconds INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX idx_assignments_user_due ON public.assignments(user_id, due_at);
CREATE INDEX idx_study_sessions_user ON public.study_sessions(user_id, day_of_week);
CREATE INDEX idx_focus_logs_user_date ON public.focus_logs(user_id, started_at);
```

---

## SECTION 4 — ROW LEVEL SECURITY (RLS) MATRIX

Every table has RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).

| Table | Operation | Policy Using Expression | Rationale |
|---|---|---|---|
| `profiles` | SELECT | `auth.uid() = id` | Students only see their own profile. |
| `profiles` | UPDATE | `auth.uid() = id` | Profile updates locked to token owner. |
| `courses` | ALL | `auth.uid() = user_id` | Isolated course namespaces per student. |
| `assignments` | ALL | `auth.uid() = user_id` | Full CRUD isolation; foreign keys validated. |
| `study_sessions` | ALL | `auth.uid() = user_id` | Weekly schedule locked to student ID. |
| `focus_logs` | ALL | `auth.uid() = user_id` | Focus logs private to student. |
| `active_timers` | ALL | `auth.uid() = user_id` | Active timer synchronized per authenticated user. |

---

## SECTION 5 — LOCAL DATA MIGRATION SPECIFICATION
1. **Extraction**: Inspect `localStorage.getItem('studyflow_storage_v1')`.
2. **Quarantine & Safety**: Before reading or modifying, copy to backup key `studyflow_storage_v1_backup`.
3. **Zod Validation**: Validate raw items against `LegacyStoreSchema`.
4. **Course Extraction & Normalization**: Deduplicate course strings into `courses` table; map legacy strings to newly generated `course_id` UUIDs.
5. **Idempotency**: Check if `profiles.migration_completed = true`. If true, skip to prevent duplication.
6. **Graceful Degradation**: If migration fails or is interrupted, notify user and keep local store intact.

---

## SECTION 6 — TIMER ARCHITECTURE (THE `endsAt` SCHEDULER)
1. **Source of Truth**: `ends_at = started_at + duration_seconds`.
2. **Background / Tab Sleep**: When browser tab sleeps, no per-second state writes are triggered. On wake or re-render, remaining seconds are calculated as:
   $$\text{remaining} = \max(0, \text{ends\_at} - \text{Date.now}())$$
3. **Completion**: If $\text{Date.now}() \ge \text{ends\_at}$, trigger confetti, sound, and write record to `focus_logs`.
4. **Assignment Linkage**: Each focus session optionally selects `assignment_id`, automatically incrementing the target assignment's focus metrics.

---

## SECTION 7 — CANONICAL STATE & DERIVED STATUS
- **Single Source of Truth**: The progress slider ($0 \le \text{progress} \le 100$) is the sole source of truth.
- **Derived Status**: `status` is a generated column in SQL and a pure computed getter in TypeScript:
  - $\text{progress} = 100 \implies \text{completed}$
  - $0 < \text{progress} < 100 \implies \text{in\_progress}$
  - $\text{progress} = 0 \implies \text{pending}$
- Toggling the complete checkbox sets $\text{progress} = 100$ (or rolls back to 0 on uncheck). Eliminates the status vs progress desynchronization bug identified by Claude.

---

## SECTION 8 — THEMING (LIGHT & DARK MODE) & ACCESSIBILITY
1. **Theme Engine**:
   - `dark` class attached to `document.documentElement`.
   - Palette extension:
     - Light: Canvas `#FAF9F6`, Card `#FFFFFF`, Text Primary `#1E1B4B`, Border `#E2E8F0`.
     - Dark: Canvas `#0F172A`, Card `#1E293B`, Text Primary `#F8FAFC`, Border `#334155`, Accent `#818CF8`.
2. **Accessibility**:
   - Keyboard focus trap on `AssignmentModal`.
   - `role="status"` and `aria-live="polite"` on Timer announcements.
   - Contrast ratio $\ge 4.5:1$ across all text in both light and dark modes.

---

## SECTION 9 — THREAT MODEL & SECURITY CONTROLS
1. **XSS Protection**: Sanitization of user notes via Zod schema trimming and React JSX automatic text node encoding.
2. **RLS Bypass Defense**: No service role key bundled into frontend bundle. Only `VITE_SUPABASE_ANON_KEY` is client-facing.
3. **IDOR Defense**: All database queries strictly parameterized and scoped by PostgreSQL RLS with `auth.uid()`.
4. **Client Storage Quotas**: Move heavy state to Supabase, capping LocalStorage to minimal UI cache under 100 kB.

---

## SECTION 10 — HUMAN DECISION GATES
- **Gate 1 (Auth)**: Email Magic Link + Google OAuth (Recommended).
- **Gate 2 (Offline Sync)**: Online-first with TanStack Query local caching and clear offline indicators (Recommended).

---

## SECTION 11 — IMPLEMENTATION TASK ROADMAP
- **Task 010**: Supabase Client Scaffolding, Environment Configuration, & Zod Runtime Schemas.
- **Task 011**: Supabase Database Migration (SQL Tables, Constraints, Indexes, & RLS Policies).
- **Task 012**: Auth Integration (Magic Link, Google OAuth, Protected App Shell, & Profile Lifecycle).
- **Task 013**: Legacy `studyflow_storage_v1` Data Migration Engine & Recovery Pipeline.
- **Task 014**: Dark Mode Theming Engine & Semantic Design System Overhaul.
- **Task 015**: Timer Architecture Refactor (`endsAt` Scheduler, Assignment Linkage, & Audio/Notifications).
- **Task 016**: Cross-Viewport Responsiveness & Accessibility Verification (360px to 4K, WCAG 2.1 AA).
- **Task 017**: Production Release Preflight, Security Audit, & Final Vercel Production Deployment.
