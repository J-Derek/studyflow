# StudyFlow — User Stories & Acceptance Criteria

**Document Version**: 2.0.0  
**Status**: Architecture Baseline Approved  
**Last Updated**: November 2026  

---

## Epic 1: Identity, Authentication & Multi-Tenancy

### US-01: Passwordless Sign-In & Onboarding
**As a** university student,  
**I want to** sign in to StudyFlow using my Google account or an email magic link,  
**So that** my academic records, courses, and focus stats sync automatically across my phone and laptop without remembering passwords.

#### Acceptance Criteria
1. User can submit their email address on `/login` and receive a one-time magic link / 6-digit OTP code.
2. User can click "Continue with Google" to complete OAuth 2.0 authentication.
3. Upon first sign-in, an account profile is provisioned in PostgreSQL with `email`, `display_name`, `avatar_url`, and `timezone` detected from the browser's `Intl` API.
4. If authentication fails, a clear, actionable error banner is shown without technical jargon.

---

### US-02: Secure Sign-Out & Shared Device Cache Purge
**As a** student using a shared computer in the university library,  
**I want to** sign out of my StudyFlow account with a single click,  
**So that** no next user can view my courses, assignments, or personal study history.

#### Acceptance Criteria
1. Clicking "Sign Out" in the sidebar triggers immediate global session revocation.
2. The TanStack Query client cancels all pending network requests and executes `queryClient.clear()`.
3. The in-memory Zustand application store is reset to empty initial state.
4. User-namespaced LocalStorage keys (`studyflow_${userId}_*`) are wiped from storage.
5. All active Supabase Realtime subscriptions and background timer intervals/timeouts are terminated.
6. Navigating back in the browser history (`bfcache` traversal) redirects to `/login` with zero cached student data rendered.

---

## Epic 2: Legacy LocalStorage Data Migration

### US-03: Safe & Non-Destructive Offline Data Import
**As a** Phase 1 StudyFlow user who has recorded real assignments in browser storage,  
**I want to** import my existing local data into my new authenticated cloud account,  
**So that** I do not lose my existing courses and pending academic deadlines.

#### Acceptance Criteria
1. On initial login, if `studyflow_storage_v1` is detected with user-created records, a non-blocking banner prompts: *"We found local assignments from this browser. Would you like to import them to your account?"*.
2. Prior to import, the raw string is archived into `studyflow_storage_v1_backup`.
3. Seed data (e.g. fictional user "Alex Vance", placeholder assignments with predefined mock IDs) are identified and excluded during import.
4. The migration is executed against a server-side ledger table (`local_storage_import_runs`) using a SHA-256 payload hash to prevent double-importing upon repeated attempts.
5. If the import succeeds, the UI displays a confirmation toast and namespaces the local cache to the authenticated user ID.
6. If the import encounters network errors, the local data remains completely intact and the user can retry anytime.

---

## Epic 3: Course & Assignment Management

### US-04: Course Hierarchy & Cross-User Security
**As a** student,  
**I want to** organize my work by university courses with distinct color badges,  
**So that** I can visually separate demanding technical modules from general electives.

#### Acceptance Criteria
1. User can create courses with a title (e.g. "Distributed Systems"), course code ("CS 401"), and color theme.
2. Foreign key relationships between assignments and courses enforce composite ownership: an assignment's `course_id` MUST be owned by the identical `user_id`.
3. Attempting to assign an assignment to another student's course is rejected at the database level with a foreign key violation.
4. Deleting a course with existing assignments triggers a warning; assignments may either be cascade-deleted or set to unassigned (`course_id = NULL`) while maintaining valid user ownership.

---

### US-05: Assignment Progress & Non-Destructive Completion
**As a** student updating my coursework,  
**I want to** slide my progress percentage or check off completed assignments,  
**So that** my dashboard accurately reflects my remaining academic obligations.

#### Acceptance Criteria
1. An assignment has an explicit `progress` integer (0 to 100) and an independent `completed_at` timestamp.
2. Dragging the progress slider to 100 automatically sets `completed_at = now()` and sets derived status to `'completed'`.
3. Toggling the "Mark as Complete" checkbox sets `completed_at = now()`.
4. Unchecking a completed assignment sets `completed_at = NULL` and restores the previously recorded progress value (e.g. 75%), NEVER wiping the student's work down to 0%.
5. The `assignments` table includes an optimistic concurrency `version` integer to prevent lost updates across concurrent tabs.

---

## Epic 4: Calendar & Recurring Study Sessions

### US-06: Accurate Deadline & Timezone Visualization
**As an** international or commuting student,  
**I want to** view assignment due dates anchored to my university's local timezone,  
**So that** I never miss an 11:59 PM deadline due to daylight saving time or travel across timezones.

#### Acceptance Criteria
1. Deadlines are stored in PostgreSQL as `due_at TIMESTAMPTZ` alongside `due_tz TEXT` (e.g. `'Africa/Nairobi'`).
2. Assignment deadlines default to 23:59:00 in the target timezone if no explicit time of day was entered.
3. Recurring weekly study sessions are stored as wall-clock times (`start_time TIME`, `duration_minutes INT`, `day_of_week INT 1..7`) to remain immune to DST instant shifts.
4. Study blocks extending past midnight are represented as continuous intervals with `duration_minutes` up to 1440 and split cleanly across day columns in the weekly grid view.

---

## Epic 5: Deep Focus Timer & Productivity Tracking

### US-07: Drift-Free Server-Authoritative Study Timer
**As a** student running a 25-minute Pomodoro focus block,  
**I want** my study timer to stay accurate even if I close my laptop lid, switch tabs, or lock my phone,  
**So that** my recorded study intervals reflect genuine focused effort.

#### Acceptance Criteria
1. Starting a timer calculates an absolute expiration timestamp (`ends_at = now() + interval`) computed on the server via a PostgreSQL RPC function.
2. The UI client computes remaining display time by measuring the difference between `ends_at` and current calibrated server time.
3. Reopening a sleeping laptop correctly updates the display to the actual remaining time with zero interval drift.
4. Pausing the timer freezes the remaining duration in `remaining_ms` and nullifies `ends_at`.
5. Resuming recalculates a new `ends_at = now() + (remaining_ms * interval '1 millisecond')`.

---

### US-08: Multi-Tab Race Defense & Focus Session Logging
**As a** student with StudyFlow open in multiple browser tabs,  
**I want** timer completion to log exactly one study session,  
**So that** my academic productivity graphs are not artificially inflated.

#### Acceptance Criteria
1. When a timer reaches expiration, completion is processed via the `complete_timer` RPC.
2. The database validates that `now() >= ends_at - interval '2 seconds'`, rejecting fabricated completion requests.
3. A completed focus round inserts a record into `public.focus_sessions` with `UNIQUE (user_id, session_id)` using `ON CONFLICT DO NOTHING`.
4. Only focus intervals (`mode = 'focus'`) are credited toward assignment and course study minutes; break intervals (`short_break`, `long_break`) are logged for session history but excluded from academic focus totals.

---

## Epic 6: Visual Ergonomics & Accessibility

### US-09: Dual-Theme Light/Dark Mode
**As a** student studying late at night in a dim dorm room,  
**I want to** toggle StudyFlow to Dark Mode,  
**So that** eye strain is minimized during extended night sessions.

#### Acceptance Criteria
1. The app provides a high-contrast dark theme with an obsidian canvas (`#0F172A`) and soft slate containers (`#1E293B`).
2. Theme options include: `Light`, `Dark`, and `System` (matches OS `prefers-color-scheme`).
3. Switching themes transitions smoothly without visual flash or layout shift.
4. All text and interactive icons achieve a minimum contrast ratio of 4.5:1 against their backgrounds in both themes.

---

### US-10: Cross-Viewport Responsiveness & Touch Targets
**As a** mobile student checking deadlines on the bus,  
**I want** the interface to adapt fluidly to my narrow 360px screen,  
**So that** buttons are easy to tap and content does not overflow horizontally.

#### Acceptance Criteria
1. The UI renders without horizontal scrollbars or clipping at 360px, 390px, 768px, 1024px, 1440px, and 4K displays.
2. All touch interactive targets (checkboxes, navigation icons, timer controls) have minimum hit dimensions of 44x44 CSS pixels.
3. Forms display full-width stacked inputs on mobile viewports and multi-column layouts on desktop viewports.

---

## Epic 7: Offline State Handling

### US-11: Clear Offline Status & Cached Read-Only Access
**As a** student experiencing an intermittent campus Wi-Fi dropout,  
**I want to** view my previously loaded assignments and study schedule,  
**So that** I know what to work on even while disconnected.

#### Acceptance Criteria
1. When network connectivity is lost, an unobtrusive banner appears: *"Offline Mode — Viewing cached study data. Editing is temporarily disabled until connection is restored."*
2. Previously fetched assignments, courses, and calendar entries remain browsable from the client query cache.
3. Destructive actions (deleting courses, creating new assignments) are disabled with a helpful tooltip to prevent silent mutation loss.
4. When connectivity returns, the banner dismisses and TanStack Query automatically revalidates fresh server data.
