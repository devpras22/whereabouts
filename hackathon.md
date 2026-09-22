# Hackathon log

- **Project:** Whereabouts
- **Event:** Convex All Gas Hackathon
- **What it does:** A live "who's around" board for small remote teams — ticking local clocks per teammate, work-shift awareness (incl. night shifts), tap-to-set time-off status, pasted announcements parsed to status by OpenAI, per-region holiday awareness, and Heidi — an AgentMail HR inbox that sends invites, per-person local-morning digests, and turns email replies into board updates.
- **Live app:** https://perceptive-falcon-524.convex.site
- **Repo:** https://github.com/devpras22/whereabouts
- **Frontend:** Convex static hosting
- **Convex deployment:** https://perceptive-falcon-524.convex.cloud
- **Components:** @convex-dev/rate-limiter, @convex-dev/static-hosting
- **Convex features:** schema, tables, indexes, queries, mutations, actions, http actions, scheduled functions, crons, auth
- **Auth:** Convex Auth (password)
- **AI models:** gpt-4o-mini
- **Started:** 2026-09-21T15:41:03Z
- **Last updated:** 2026-09-22T09:50:00Z

## Log

Repo history begins at the initial commit 1a6d692, which contains all of the
work below — the repository was initialized at the end of the build day, so
those entries are date-only. Entries from the initial commit onward carry
commit SHAs.

### 2026-09-21 (afternoon)
Scaffolded the app (Vite + React + TypeScript) and drafted the full Convex
backend in `convex/`: schema with people / statuses / holidays / digests / parses
tables (`convex/schema.ts`, indexes on statuses), team seed data
(`convex/seed.ts`), list/status queries and mutations (`convex/people.ts`), and
an OpenAI action that reads casual time-off messages into structured status using
a calendar-anchored prompt (`convex/parse.ts`). Convex features: schema, tables,
indexes, queries, mutations, actions (`convex/`).

### 2026-09-21 (afternoon)
Built the product: landing page plus the board — nine fictional teammates with
live local clocks, quiet-hours dimming, tap-status row for the viewer, a paste
box whose announcements are parsed by gpt-4o-mini through a server-side proxy,
planned-status lines, a week view with working-hours overlap, and a regional
holiday banner. The running localhost app currently uses an in-memory store with
the same data shapes (`src/lib/store.ts`); wiring it to the Convex deployment is
the next step and needs a one-time Convex login. Convex is not yet running the
app — claims above about live behavior refer to the local demo, not a Convex
deployment (`src/pages/Board.tsx`, `src/pages/Landing.tsx`, `src/lib/`).

### 2026-09-21 (evening)
Redesigned the whole interface on the Nothing design system — dot-matrix clock
displays as card heroes, monospace caps labels, colored status dots instead of
emoji, pill buttons — and bumped type sizes after a readability pass. Added a
persisted light/dark theme toggle and a today highlight in the week view
(`src/index.css`, `src/pages/`, `src/lib/data.ts`).

### 2026-09-21 (evening)
Hackathon environment setup: installed the global Convex agent skills, configured
the Convex MCP server in the agent config, installed Convex managed AI files
(`AGENTS.md`, `CLAUDE.md`, `convex/_generated/ai/guidelines.md`), and added the
convex-hackathon-skill project-locally (`.agents/skills/convex-hackathon-skill/`).
No application code changed in this step.

### 2026-09-21 (night)
Wired the running app from the in-memory stand-in to a live Convex deployment:
every board read is a real-time subscription, every status write is a mutation.
Added Convex Auth (password provider) with seeded demo accounts — sign-in gates
the board and your session identity decides whose status you can move. Mounted
the @convex-dev/rate-limiter component to throttle OpenAI parses per user, added
a scheduled-function cron for the morning digest, and registered the
@convex-dev/static-hosting component. Verified the round-trip end to end:
sign in as a teammate, tap a status, confirm the write in the database from a
second client, and read the live URL back. Deployed to
https://perceptive-falcon-524.convex.site (`convex/http.ts`, `convex/auth.ts`,
`convex/auth.config.ts`, `convex/crons.ts`, `convex/convex.config.ts`,
`src/lib/store.ts`, `src/pages/SignIn.tsx`).

### 2026-09-21 (late night)
Built Heidi, the HR agent inbox on AgentMail (AGENTMAIL_INBOX_ID): teammate
invites go out when a founder adds someone; a 15-minute cron sends each person
their digest at their own local 8am (shift-aware lines, deduped per day); and an
inbound webhook route on Convex parses human replies ("off friday, family
thing") into board statuses and confirms by email (`convex/heidi.ts`,
`convex/http.ts`, `convex/crons.ts`). Added work hours per person with
night-shift support (cards show "off shift" / shift windows; week-view overlap
uses shifts), team creation for judges (custom account → create team → add
teammates → Heidi invites), and clean generated avatars. End-to-end verified on
production with a throwaway AgentMail inbox: invite email received, reply
"off friday, road trip" → board shows planned off on Friday + confirmation
email received; same loop on a self-created team ("off tomorrow, sick day" →
off from Tue 22 Sept + confirmation). Send API route is
`/v0/inboxes/{inbox_id}/messages/send` (documented), webhook `message.received`
payload has `message.from` as a plain string and `extracted_text` pre-stripped.

### 2026-09-21 (late night) - 1a6d692
Published the repository (public GitHub, linked above) and brought this log to
the required format: commit SHAs on entries from the initial commit forward,
normalized repo URL, and inbox addresses redacted per the log rules. Localhost
development now runs against the dev deployment with a fresh seed.

### 2026-09-21 - efc8f7b
Dark-mode week view was hard to read: your-shift cells sat near-invisible on
black and the hour strip had no axis. Added hour labels (00–21) under the
strip, brightened shift cells, promoted the best-call-window line to display
contrast, and showed both people's shifts above the chart
(`src/pages/Board.tsx`, `src/index.css`).

### 2026-09-22 - 54a70f0
Shipped the full sponsor stack and the polish pass: Firecrawl now scrapes a
region's public-holidays page on demand and the banner updates live
(`convex/holidays.ts`, rate-limited action); team management (rename, remove
teammate); profile editing with avatar upload plus preset faces; a custom
calendar replaces the native date picker and the away-date bug is gone;
Atlas view (dot-matrix world map with real day/night terminator) and a 24-hour
ribbon view, swipeable; viewer card gets a green ring; OG image and mobile
styles. Fixed a TopoJSON delta-decoding bug that had garbled the map.

### 2026-09-22 - working tree
Demo company seed (Prestige Worldwide: CEO plus four employees across five
continents, pre-set statuses and shifts), a personalized Heidi invite that
deep-links to a join page ("You've been invited to join Prestige Worldwide"),
a role field on teammate invites, geocoded city autocomplete replacing every
hardcoded timezone list, exact Atlas pins from stored coordinates, two-pass
label placement that avoids pins, calendar range booking with hover preview,
local dates under each wall clock, holiday dedupe, and organic Firecrawl:
adding a teammate from a new country auto-imports that country's holidays
(`convex/prestige.ts`, `src/pages/Join.tsx`, `convex/holidays.ts`,
`convex/people.ts`, `src/components/GeocodeBox.tsx`, `src/components/WorldMap.tsx`).
