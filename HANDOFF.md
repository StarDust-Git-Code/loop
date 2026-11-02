
## Dashboard routes (added)
the standalone app in `dashboard/` is the hand-built Home. The other 12 screens (`studio, chat, run, agents, workflows, knowledge, skills, connections, tasks, automations, my-space, schedule`) are static HTML ports of the design files in `components/dashboard/screens/`, rendered by `FitScreen` (scaled to width) via `app/dashboard/[screen]/page.tsx`. Cross-links live in `lib/dashboard/screens.ts` (matched by button text). `files` and `settings` are placeholders (never designed). App icon: `public/logo-app.svg`.

### Update: dashboard is now a separate app
Moved to `dashboard/` with its own `package.json`. Routes drop the `/dashboard` prefix (`/`, `/chat`, `/run`...). Deploy it as a second Vercel project with Root Directory = `dashboard` and the domain `dashboard.loopmates.com` (the landing page already links there). The landing project (root `./`) no longer contains it.
