# StudyFlow — Architectural & Design Decisions

## Approved Technology Stack (Decided by ChatGPT Architect - Task 001 Review)
- **Frontend Framework**: React + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **State Management**: Zustand
- **Persistence**: Local Storage (IndexedDB/Supabase deferred to v2)

## Visual Identity & Design System (Specified by ChatGPT Director)
- **Aesthetic**: Minimal, modern, premium productivity software.
- **Background**: Warm off-white (`#F8F9FA` / `#FAF9F6`)
- **Primary**: Deep indigo (`#1E1B4B` / `#312E81`)
- **Secondary**: Soft lavender (`#DDD6FE` / `#C7D2FE`)
- **Accent**: Muted green (`#10B981` / `#059669`)
- **Typography**: Inter (Body, Headings, Numbers)
- **Layout Structure**: Collapsible sidebar navigation + spacious header + multi-column dashboard grid.

## Core Screens Required for V1
1. **Main Dashboard**: Welcome header, quick-add assignment modal/action, upcoming deadlines, progress stats, today's study schedule.
2. **Assignment Management**: List/board view, priority tags, deadline badges, status toggles, filter/search.
3. **Weekly Study Calendar**: Time grid, assignment markers, planned study sessions.
4. **Focus Timer**: Pomodoro workflow (25/5/15), session counter, progress ring.
