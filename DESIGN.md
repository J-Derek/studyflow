# StudyFlow — High-Craft Design System & Architecture Specification (DESIGN.md)

**Document Version**: 3.0.0  
**Status**: Authoritative Design System & System Design Specification  
**Inspiration & Benchmark**: `VoltAgent/awesome-design-md` (Linear, Raycast, Vercel), `bradtraversy/design-resources-for-developers`, `shadcn/ui`, `donnemartin/system-design-primer`  
**Last Updated**: November 2026  

---

## 1. Visual Philosophy: The Anti-Slop Discipline

StudyFlow is an exquisite, high-density academic command center built for engineering, mathematics, and computer science scholars. It rejects the bubbly, purple-glowing "AI-generated SaaS" aesthetic in favor of **Linear's mathematical density, Raycast's command-driven fluidity, and Vercel's stark monochrome precision**.

### Core Tenets
1. **Zero Radioactive Dyes**: No synthetic violet clouds, no pulsing gradients, no generic pastel cards.
2. **Hairline Geometry**: Containers do not float as disconnected bubbly islands. Structural elements are organized in continuous grids connected by 1px precision hairlines (`border-zinc-200/80` in light, `border-zinc-800/80` in dark).
3. **Tabular Monospace Discipline**: Every numerical value, course code (`CS 4400`), GPA score, countdown tag, and system timestamp is strictly locked to tabular numbers (`font-mono tabular-nums`).
4. **Command-First Ergonomics**: Instant keyboard access (`⌘K` / `Ctrl+K`) to all navigation targets, coursework searches, focus session timers, and system tools.

---

## 2. Surface & Color Ladder (`VoltAgent/awesome-design-md`)

### Dark Mode (Obsidian Engineering Tone)
- **Level 0 (Canvas)**: `#07080A` — Pure near-black deep canvas, eliminates library eye fatigue.
- **Level 1 (Card / Surface)**: `#0E1013` — Base structural panels, sidebars, and timetables.
- **Level 2 (Elevated Panels)**: `#15171B` — Filter rows, modal surfaces, and active elements.
- **Level 3 (Hover & Focus)**: `#1C1F24` — Interactive selection highlight.
- **Hairline Dividers**: `rgba(255, 255, 255, 0.08)` / `border-zinc-800/80`.
- **Text Primary**: `#F4F4F5` (Zinc 100) — High-contrast, sharp legibility.
- **Text Muted / Meta**: `#71717A` (Zinc 500) — Tabular tags and metadata.
- **Brand / Accent**: `#2563EB` (Varsity Cobalt) — Precise, institutional accent.

### Light Mode (Architectural Parchment Tone)
- **Level 0 (Canvas)**: `#F8F9FA` — Crisp academic paper.
- **Level 1 (Card / Surface)**: `#FFFFFF` — Pure white architectural panels.
- **Level 2 (Elevated Panels)**: `#F1F3F5` — Recessed input bays and table headers.
- **Level 3 (Hover & Focus)**: `#E9ECEF` — Clean selection tint.
- **Hairline Dividers**: `rgba(0, 0, 0, 0.08)` / `border-zinc-200/80`.
- **Text Primary**: `#090A0C` (Deep Ink) — Stark typographical contrast.
- **Text Muted / Meta**: `#6B7280` (Zinc 500) — Supporting metadata.
- **Brand / Accent**: `#1D4ED8` (Cobalt Blue) — Crisp link and active state indicator.

---

## 3. Typographical Hierarchy & Monospace Integration

| Role | Font Family | Size | Weight | Line Height | Tracking | Usage |
|---|---|---|---|---|---|---|
| **App Monogram** | Sans | 14px | 700 | 1.0 | -0.02em | Sidebar brand monogram badge |
| **Section Header** | Sans | 20px | 600 | 1.3 | -0.02em | Page title (`Coursework Registry`, `Academic Ledger`) |
| **Monospace Eyebrow**| Mono | 10px | 600 | 1.2 | +0.05em | Institutional context (`POLYTECHNIC INSTITUTE / WEEK 10`) |
| **Tabular Numbers** | Mono | 24px - 32px| 600 | 1.0 | -0.03em | GPA figures (`3.85`), Timer countdown (`25:00`) |
| **Course Code Pill** | Mono | 11px | 500 | 1.2 | 0 | Course identifiers (`CS 4400`, `MATH 310`) |
| **Table Cell Body** | Sans | 12px | 500 | 1.4 | 0 | Assignment title, syllabus item description |
| **Countdown Tag** | Mono | 11px | 600 | 1.2 | 0 | Due indicators (`Due tomorrow`, `Pending date`, `2d overdue`) |

---

## 4. Component Primitives (`shadcn/ui` Architecture)

1. **Command Palette (`CommandPalette.tsx`)**:
   - Shortcut: `⌘K` or `Ctrl+K`, plus header click bay.
   - Fuzzy search indexing: Coursework titles, course codes, navigation destinations, quick action triggers.
   - Micro-action triggers: "Start 25m Deep Work", "Export .ICS Schedule", "Toggle Theme", "Backup Ledger".
2. **Buttons (`Button`)**:
   - `default`: `bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-medium text-xs px-3 py-1.5 rounded-lg shadow-2xs hover:opacity-90 active:scale-[0.98]`
   - `outline`: `border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800`
   - `ghost`: `text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60`
3. **Badges (`Badge`)**:
   - `default`: High contrast, tabular monospaced numbers.
   - `urgent`: `bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/60`
   - `medium`: `bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/60`

---

## 5. System Design & Data Durability (`donnemartin/system-design-primer`)

1. **Client-Side Cache & Offline Fallback**:
   - Local state is synchronously persisted in localStorage / IndexedDB via Zustand.
   - Sync layer operates optimistically: UI mutations apply at 0ms latency; asynchronous Firestore pushes happen in the background with exponential backoff retry.
2. **System Health & Latency Telemetry**:
   - Live network status detection (`navigator.onLine`).
   - Header sync indicator displays real telemetry: `● Live Cloud` when connected, `Offline Mode (Changes cached locally)` when disconnected.
3. **Zero Lock-In Disaster Recovery**:
   - Full JSON state export (`Export Academic Ledger (.json)`).
   - Instant restore / import function (`Restore from Backup (.json)`).
   - Standard iCalendar export (`.ics`) compatible with Google Calendar, Apple Calendar, and Outlook.
