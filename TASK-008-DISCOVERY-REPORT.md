# StudyFlow — Task 008 Discovery & Architecture Baseline Report

**PROJECT**: StudyFlow  
**PHASE**: 2 — Production Hardening & Backend Expansion  
**TASK**: 008 — Phase 2 Codebase & Architecture Discovery  
**STATUS**: COMPLETE (Read-Only Audit)

---

## 1. PROJECT DISCOVERY & BASELINE INVENTORY

### Repository & Structure
- Application Root: `c:\Users\Jiva\Documents\Freelance\studyflow\app`
- Tech Stack: React 19, Vite 8, TypeScript 7 (`tsc -b`), Tailwind CSS 3.4.17, Zustand 5, Lucide React, Canvas Confetti.
- Git Status: No `.git` repository initialized at root (unversioned directory structure).
- Available Tooling:
  - `graphify`: Available at `C:\Users\Jiva\AppData\Roaming\Python\Python314\Scripts\graphify.exe`.
  - `npx` / Node: Node v24.21.0 available.
  - `hallmark`, `gstack`, `ui-ux-pro-max`: Not installed locally (flagged for human approval per restrictions).

### Documentation Inventory
- `studyflow/project-context.md`: Project background, original ChatGPT directives, Figma link (`wR5rd4aSflnjveT8bLsI5M`).
- `studyflow/decisions.md`: Key architectural decisions (Vite/TS/Tailwind, Zustand key `studyflow_storage_v1`, omitting ambient sound, drift-proof timestamp timer).
- `studyflow/current-status.md`: Phase status tracking.
- `studyflow/execution-report.md`: Task 006 preflight report.
- `studyflow/RELEASE-REPORT.md`: Production release details & Tri-agent collaboration logs.
- Missing Docs: Formal standalone PRD, User Stories document, Database Schema Doc, System Architecture Doc, API Spec, `DESIGN.md`, `CONTEXT.md`, `README.md`.

---

## 2. APPLICATION AUDIT & CURRENT STATE

### A. Persistence Architecture
- Store: Single Zustand store (`src/store/studyFlowStore.ts`) wrapped with `persist` middleware.
- Key: `studyflow_storage_v1`.
- Serialized State: `user`, `activeTab`, `assignments`, `sessions`, `pomodorosCompleted`, `timerSettings`.
- Weaknesses:
  - Zero runtime schema validation (raw JSON deserialization into TypeScript types).
  - No migration function defined in Zustand persist configuration (`version` and `migrate` omitted).
  - No multi-tab event listener (`window.addEventListener('storage')`). Last write silently overwrites.
  - Synchronous LocalStorage access with 5MB ceiling and unhandled quota exhaustion.

### B. Application Data Models (`src/types/index.ts`)
- `Assignment`: `id`, `title`, `course`, `dueDate` (YYYY-MM-DD), `dueTime` (HH:mm), `priority` ('low'|'medium'|'high'), `status` ('pending'|'in_progress'|'completed'), `progress` (0-100), `notes`, `createdAt`, `completedAt`.
- `StudySession`: `id`, `title`, `course`, `dayOfWeek` (0-6), `startTime` (HH:mm), `endTime` (HH:mm), `type` ('lecture'|'lab'|'study'|'review'|'exam'), `color`.
- `TimerSettings`: `focusDuration`, `shortBreakDuration`, `longBreakDuration`, `autoStartBreaks`, `autoStartFocus`.
- `UserPreferences`: `name`, `university`, `program`, `semester`, `avatarUrl`.
- Gaps:
  - No independent `Course` entity (courses are redundant string fields).
  - `status` and `progress` are uncoupled (progress can be 100% while status is `pending`).
  - No relational linkage between `Assignment` and `pomodorosCompleted` or calendar events.

### C. Timer & Synchronization
- Implementation: `src/pages/FocusTimer.tsx` and `studyFlowStore.ts`.
- Timestamp Sync: `timerLastTimestamp` recorded; `syncInactiveTime()` calculates `Math.floor((Date.now() - timerLastTimestamp) / 1000)` on tab visibility restore.
- Gaps:
  - Timer active state is purely in-memory; closing tab completely resets timer rather than preserving `endsAt`.
  - No Notification API, Web Audio oscillator, or Screen Wake Lock.
  - Per-second interval ticks cause re-renders without granular `useShallow` selectors.

### D. UI, Theming & Responsiveness
- Theming: Static light theme only (Canvas: `#FAF9F6`, Brand: `#1E1B4B` / `#312E81`). No dark mode classes or Tailwind `darkMode: 'class'` configured.
- Breakpoints: Responsive across desktop (sidebar), tablet (collapsible), mobile (390px fixed bottom navigation bar). Verified clean down to 360px viewport.
- Accessibility: Semantic landmarks used; lacks automated axe-core coverage, focus trapping in AssignmentModal, and live region announcements for timer.

### E. Security & Validation
- Validation: Basic HTML5 form required fields in `AssignmentModal.tsx`. No Zod runtime validation.
- XSS: React JSX escaping protects text nodes; no `dangerouslySetInnerHTML` in codebase.
- Auth: Purely client-side mock user state (`Alex Vance`). No authentication or authorization boundaries exist.

---

## 3. CLAUDE REVIEW EVIDENCE & INTEGRATION

The Claude review was conducted directly in the active browser session (`Villain roast of StudyFlow`):
1. **Storage Boundary**: Claude identified that `studyflow_storage_v1` lacks runtime schema validation and migration logic, risking silent state corruption upon schema updates.
2. **Timer Architecture**: Recommended replacing reactive per-second state writes with an `endsAt` absolute timestamp model, Web Worker ticker, and linking sessions to assignment IDs.
3. **Time & Date Handling**: Flagged naive date/time strings for DST/timezone edge cases (e.g., `America/New_York` vs non-DST `Africa/Nairobi`) and midnight rollover bugs.
4. **State Normalization**: Flagged independent `progress` vs `status` duality as an anti-pattern.

---

## 4. PHASE 2 GAP ANALYSIS MATRIX

| Requirement | Current Status | Evidence / Affected Components |
|---|---|---|
| Supabase DB & Auth | **Not Implemented** | Only LocalStorage mock in `studyFlowStore.ts` |
| Database Schema & RLS | **Not Implemented** | No backend schema or Supabase client installed |
| Cross-Device Persistence | **Not Implemented** | Data bound to single browser profile |
| Recoverable LocalStorage Migration | **Not Implemented** | Raw `localStorage.setItem` without fallback or export |
| Light & Dark Theming | **Partially Implemented** | Tailwind palette defined; dark mode variant missing |
| Responsive 360px to Ultrawide | **Already Implemented** | Verified via 4 QA viewport snapshots |
| Runtime Validation (Zod) | **Not Implemented** | TypeScript compile-time types only |
| Timer `endsAt` & Session Linkage | **Partially Implemented** | Drift sync exists, but lacks `endsAt` & assignment link |

---

## 5. TASK 009 ARCHITECTURE RECOMMENDATION

### Recommended Supabase Schema:
- `profiles`: `id (uuid, FK auth.users)`, `name`, `university`, `program`, `semester`, `theme_preference ('light'|'dark'|'system')`.
- `courses`: `id (uuid)`, `user_id (FK)`, `code`, `title`, `color`.
- `assignments`: `id (uuid)`, `user_id (FK)`, `course_id (FK)`, `title`, `due_at (timestamptz)`, `priority`, `progress`, `notes`.
- `study_sessions`: `id (uuid)`, `user_id (FK)`, `course_id (FK)`, `day_of_week`, `start_time`, `end_time`, `activity_type`.
- `focus_logs`: `id (uuid)`, `user_id (FK)`, `assignment_id (FK, nullable)`, `duration_seconds`, `completed_at (timestamptz)`.

### RLS Policies:
- Enforce strict `auth.uid() = user_id` for all `SELECT`, `INSERT`, `UPDATE`, `DELETE` operations on all tables.

### Questions for Human Architectural Decision:
1. **Auth Mode**: Should Supabase Auth support Magic Link (email OTP), Google OAuth, or GitHub OAuth?
2. **Offline-First Strategy**: Should the app maintain an offline-first cache with background sync (via TanStack Query / WatermelonDB / Dexie), or dual-write Zustand with Supabase hydration?
