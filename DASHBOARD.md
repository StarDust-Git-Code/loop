# Dashboard — Home (new task), white theme

Route: `/dashboard`. Ported from `White-Home.dc.html` in the Loop design artifact.

## Files
- `app/dashboard/layout.tsx` — shell (sidebar + content), fonts, noindex metadata. Future screens go under `app/dashboard/<screen>/page.tsx` and reuse it.
- `app/dashboard/page.tsx` — Home screen route.
- `components/dashboard/` — `Sidebar`, `HomeScreen`, `TaskComposer`, `SavedWorkflows`, `ActivityRail`, `ApprovalCard`, `Mate`, `Icon`, and `dashboard.module.css` (CSS module, so the landing page's `globals.css` is untouched).
- `lib/dashboard/brand.ts` — `BRAND` ("Loop") and `AGENT` ("Mate"). Product name is undecided; change it here.
- `lib/dashboard/data.ts` — all sample content (nav, workflows, run steps, approval, recent runs).
- `public/dashboard/mates/*.png` — the six Mates used on this screen (extracted from the design).

## Needs from the repo
`@fontsource/inter`, `@fontsource/jetbrains-mono`, `next`, `react` (all already in the landing page's stack).

## Working vs placeholder
- Working: composer text, attach files (list + remove), "Ask before risky actions" toggle, Ctrl/Cmd+Enter or Run (shows a confirmation line), Approve (local state), active nav state.
- Placeholder: Run and Approve do not call a backend (`TODO` comments mark the spots). Voice input is disabled. Nav items other than Home, "View all", "Open live run", "Review files", workflow cards and run rows link to `#` until those screens exist. All run, workflow and approval content is sample data.

## Responsive
Design is 1760×1000. Below 1180px the activity rail moves under the content; below 900px the sidebar collapses to icons; below 720px workflow cards stack.
