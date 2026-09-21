# Changelog

## 0.1.0 — 2026-09-21

- Scaffolded Vite + React + TS; Convex installed (local backend deferred to login)
- Landing page with live timezone preview strip
- Board: 9-person sample team, ticking local clocks, sun/moon, quiet-hours dimming
- Your-row status buttons; paste box → OpenAI parse (calendar-anchored prompt,
  gpt-4o-mini) with labeled demo-parser fallback
- Planned statuses display on cards ("off Thu 24 Sept")
- Week modal: 7-day strip, overlap hours, best call window, regional holidays
- Holiday banner with friendly region names (seeded data)
- Team digest stub; Vite proxy keeps the OpenAI key server-side

## 0.2.0 — 2026-09-21 (design pass)

- Full redesign per the Nothing design system: OLED black, Space Grotesk body,
  Space Mono ALL-CAPS labels, Doto dot-matrix clocks as card heroes
- Emoji removed from UI — status = colored dot + mono caps tag
  (green around / amber off-away / white holiday); quiet-hours tag instead of sun/moon
- Buttons: mono-caps pills (white primary, outlined secondary); underline inputs
- Status tag moved to clock row; active + planned notes as bordered sub-lines
- Week modal: dot calendar, white shared-hours bar, mono caps throughout

## 0.2.1 — 2026-09-21 (readability + themes)

- Font sizes bumped ~2-3px across every screen (labels 13px, stats 14px, banner
  14px, planned lines 14px, inputs 15px, meta 15px)
- Light mode added — header toggle, persisted in localStorage; full Nothing
  light tokens (paper #F5F5F5, white surfaces, black ink)
- Week view highlights today ("MON 21 SEPT · TODAY", outlined cell)
- Header stats now read "7 of 9 around · 2 off today"
- Your-row: caption explains the buttons; current-status tag shows beside
  actions; flash messages say exactly what changed

## 0.3.0 — 2026-09-21 (live backend + Heidi)

- Wired to a live Convex deployment: realtime board subscription, mutations,
  password auth (9 seeded demo accounts + custom-account sign-up)
- Deployed to Convex static hosting: https://perceptive-falcon-524.convex.site
- @convex-dev/rate-limiter: OpenAI parses throttled per user
- Work hours per person, night shifts supported (overnight wrap): cards show
  "off shift" / shift windows; week-view overlap honors shifts
- Team creation flow: custom account → create team → add teammates → Heidi
  invite emails; founders can keep adding teammates from the board
- Heidi (AgentMail, heidi-hr@agentmail.to): invites, per-person local-8am
  digest via 15-min cron (deduped, skips demo addresses), inbound webhook
  parses replies into statuses + email confirmation — verified end-to-end on
  production
- Clean generated avatars (DiceBear notionists, muted palette)
- Digest button ("Send my digest now") for demoing without waiting for 8am
