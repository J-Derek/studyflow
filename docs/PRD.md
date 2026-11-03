# StudyFlow — Product Requirements Document (PRD)

**Document Version**: 2.0.0  
**Phase**: Phase 2 — Production Hardening & Cloud Expansion  
**Author**: Antigravity (Lead Full-Stack Engineer) in collaboration with ChatGPT (Architect / PM) & Claude Sonnet (Security & Systems Reviewer)  
**Target Audience**: Engineering, Product Management, QA  
**Date**: November 2026  

---

## 1. Executive Summary

StudyFlow is a modern, high-performance academic productivity web application designed to help university students manage assignments, track deadlines, execute focused study blocks via a Pomodoro timer, and visualize academic workload.

- **Phase 1 Status**: Shipped and live in production at `https://app-beta-lilac-23.vercel.app` as a client-side single-page application using Zustand and browser LocalStorage (`studyflow_storage_v1`).
- **Phase 2 Objective**: Evolve StudyFlow into a secure, multi-tenant cloud-backed application powered by Supabase (PostgreSQL, Auth, Row Level Security), providing cross-device synchronization, high-reliability timer scheduling, a dual light/dark mode design system, flawless responsiveness from 360px mobile up to 4K desktop, and a safe, non-destructive migration engine for legacy users.

---

## 2. Problem Statement & User Personas

### 2.1 The Problem
University students balance multiple rigorous courses with competing deadlines, fragmented syllabi, and irregular study habits. Existing productivity tools are either overly generic (leading to cognitive overhead) or desktop-only. Students need an academic-tailored command center that works seamlessly across their laptop in the library, phone between lectures, and tablet in study hall, without losing timer state or leaking data on shared campus machines.

### 2.2 Target Personas
1. **Undergraduate Student (Primary)**:
   - Needs: Rapid assignment entry, visual priority flags, daily/weekly calendar view, distraction-free study timer.
   - Devices: Budget Android/iOS mobile phone (360px–390px), campus library lab desktop (shared workstation), personal laptop (1366px–1920px).
   - Constraints: Intermittent campus Wi-Fi, battery constraints, potential sleep/wake backgrounding of browser tabs.
2. **Graduate / Research Student (Secondary)**:
   - Needs: Multi-hour deep focus blocks, course-specific study session analytics, long-term deadline tracking.
   - Devices: High-resolution external displays (1440p–4K), multi-window split screening.

---

## 3. Product Scope: Current vs. Planned

| Feature Area | Phase 1 (Shipped / Current) | Phase 2 (Target / Planned) |
|---|---|---|
| **Data Persistence** | Synchronous LocalStorage (`studyflow_storage_v1`) | Multi-tenant Supabase PostgreSQL with strict RLS |
| **Authentication** | Anonymous / Local-only (Alex Vance seed) | Supabase Auth (Email Magic Link / OTP & Google OAuth) |
| **Legacy Data** | Stored in browser LocalStorage | Idempotent ledger-based migration engine with backup |
| **Focus Timer** | `setInterval` in UI component; drifts on sleep/tab-switch | Server-authoritative `ends_at` runtime scheduler with microsecond precision |
| **Theming** | Light mode only (`#FAF9F6` canvas) | Dual-token Light (`#FAF9F6`) and Dark (`#0F172A`) mode |
| **Responsiveness** | Mobile-responsive with minor horizontal overflows | Full responsive layout engineered for 360px up to 3840px (4K) |
| **Security & Privacy** | Client-only trust model | RLS WITH CHECK, composite cross-user FK denial, JWT isolation |
| **Offline Mode** | 100% offline (LocalStorage) | Online-first with read-only cached view & offline status banner |

---

## 4. Detailed Functional Requirements

### 4.1 Authentication & Multi-Tenancy (AUTH)
- **AUTH-01**: The system shall support passwordless email authentication (Magic Link / OTP) and Google OAuth.
- **AUTH-02**: Upon initial authentication, the system shall automatically provision a profile in `public.profiles` via an idempotent PostgreSQL database trigger on `auth.users`.
- **AUTH-03**: Upon logout, all client query caches, in-memory Zustand states, and sensitive session tokens must be immediately purged from memory and storage.
- **AUTH-04**: On shared devices, one user's cached data must never appear in another user's session under any condition.

### 4.2 Legacy LocalStorage Data Migration (MIG)
- **MIG-01**: Upon first sign-in of a user possessing `studyflow_storage_v1` in LocalStorage, the application shall prompt the user to import their existing offline data into their cloud account.
- **MIG-02**: Prior to parsing, the client shall create a raw immutable backup in `studyflow_storage_v1_backup`.
- **MIG-03**: The migration engine shall skip fictional seed entities (such as "Alex Vance", mock courses, and sample assignments) to prevent contaminating production accounts.
- **MIG-04**: Migration execution must be recorded in a dedicated server ledger `public.local_storage_import_runs` with SHA-256 payload hashing to guarantee idempotency.
- **MIG-05**: In the event of a network or database failure, the migration must abort safely without data loss, leaving the local storage intact for retry.

### 4.3 Assignment Management & Course Tracking (ASM)
- **ASM-01**: Users shall create, read, update, and delete academic courses (name, course code, color token).
- **ASM-02**: Users shall manage assignments linked to their courses with title, description, due date/time (`TIMESTAMPTZ` + IANA timezone), priority (`low`, `medium`, `high`, `urgent`), and estimated study duration.
- **ASM-03**: Assignment completion shall be decoupled from progress. A completed assignment stores `completed_at TIMESTAMPTZ`. Un-completing an assignment sets `completed_at = NULL` and preserves the previously recorded progress value.
- **ASM-04**: Assignment deletion or course deletion must maintain database referential integrity (`ON DELETE RESTRICT` for courses with active assignments, or `ON DELETE SET NULL` on `assignments.course_id` with composite user ownership preserved).

### 4.4 Study Calendar & Weekly Planning (CAL)
- **CAL-01**: The calendar shall display assignments by due date and scheduled recurring study sessions.
- **CAL-02**: Weekly study schedules shall be stored as local wall-clock times (`start_time TIME`, `duration_minutes INT`, `day_of_week INT 1..7`, `timezone TEXT`) to remain immune to daylight saving shifts.
- **CAL-03**: Overnight sessions (where `start_time + duration` crosses midnight) shall be represented unambiguously and rendered across day boundaries in the UI.

### 4.5 Focus Timer & Pomodoro Engine (TMR)
- **TMR-01**: The timer shall support three modes: Focus (default 25m), Short Break (default 5m), and Long Break (default 15m).
- **TMR-02**: The server database table `public.timers` shall enforce a single active timer per user with a strict XOR state CHECK constraint between `idle`, `running`, and `paused`.
- **TMR-03**: Running timers shall be driven by an absolute expiration timestamp (`ends_at TIMESTAMPTZ`), eliminating `setInterval` drift across backgrounded tabs and OS sleep.
- **TMR-04**: When a timer reaches completion, the completing tab shall log a record into `public.focus_sessions`. Multi-tab race conditions shall be prevented via a unique constraint `UNIQUE (user_id, session_id)`.
- **TMR-05**: Focus time analytics must only aggregate completed focus intervals (`mode = 'focus'`); break intervals must never inflate academic focus metrics.

### 4.6 Theme & Design System (UIX)
- **UIX-01**: The application shall provide a dual-token visual hierarchy: Light Mode (Warm Canvas `#FAF9F6`, Deep Indigo `#1E1B4B`) and Dark Mode (Deep Slate Canvas `#0F172A`, Crisp Slate `#F8FAFC`).
- **UIX-02**: The user's theme preference (`light`, `dark`, `system`) shall be persisted locally and synchronized to the user profile when authenticated.
- **UIX-03**: All interactive tap targets must measure at least 44x44 CSS pixels across touch viewports.
- **UIX-04**: All text elements must satisfy WCAG 2.1 AA contrast requirements (minimum 4.5:1 for normal text, 3:1 for large text) in both themes.

---

## 5. Non-Functional Requirements

1. **Performance**:
   - Initial bundle size < 250 KB compressed.
   - Core Web Vitals: LCP < 1.8s, CLS < 0.05, INP < 100ms.
   - Timer drift: Zero drift over 60 minutes across browser sleep/wake cycles.
2. **Security & Compliance**:
   - 100% of public database tables protected with `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`.
   - Cross-user foreign key spoofing structurally prohibited via composite foreign keys `(user_id, parent_id)`.
   - Zero exposure of `service_role` credentials in client-side code.
   - Alignment with data privacy regulations (Kenya Data Protection Act 2019 / GDPR) including complete cascade on account deletion.
3. **Availability & Reliability**:
   - Client operates gracefully in read-only mode during network outages with clear visual indicators.
   - LocalStorage import operates atomically with zero partial data corruption.

---

## 6. Assumptions & Out-of-Scope Items for Phase 2

- **Out of Scope**:
  - Two-way real-time collaborative study rooms (deferred to Phase 3).
  - Background offline mutation queue with conflict-resolution merge (read-only offline viewing is delivered in Phase 2).
  - Native mobile application builds (Capacitor/React Native deferred to Phase 3; PWA responsive web is primary).
  - Third-party calendar two-way synchronization (Google Calendar / Outlook API integration deferred to Phase 3).
