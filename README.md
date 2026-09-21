# Whereabouts

Know who's around before you ping. A live availability board for small remote
teams — local clocks, work shifts (night shifts included), time-off, per-region
holidays, plus **Heidi**, the AI agent who runs HR (on
[AgentMail](https://agentmail.to)): she invites teammates, sends each person a
digest at *their* local 8am, and turns an email reply into a board update.

**Convex All Gas hackathon build.** Live: https://perceptive-falcon-524.convex.site

## What's in the demo

- **The board** — every teammate as a card: ticking local clock, city, shift
  window, status dot, planned time-off, today's regional holiday. Cards dim
  outside that person's working hours.
- **Tell it once** — tap your status, or paste the message you already sent
  anywhere ("out thursday and friday, family thing") and gpt-4o-mini parses it
  into structured status. Rate-limited per user.
- **Week view** — click any card: your shared working hours with that person,
  highlighted, with the best call window.
- **Your own team** — sign in with your own email, create a team, add
  teammates: Heidi emails them a real invite with their sign-in link.
- **Heidi** — reply to any of her emails ("off tomorrow, sick day") and the
  board updates itself; she confirms by email. Verified end-to-end on
  production.
- Fictional 9-person sample team on the demo board; sign in as anyone
  (password `demo1234`) or bring your own team.

## Run locally

```bash
npm install
npx convex dev      # backend + local functions (one-time `npx convex login`)
npm run dev         # http://localhost:5180
```

Environment (server-side only, never in the bundle): `OPENAI_API_KEY`
(gpt-4o-mini parses announcements), `AGENTMAIL_API_KEY` /
`AGENTMAIL_INBOX_ID` / `AGENTMAIL_WEBHOOK_SECRET` (Heidi). Webhook endpoint:
`POST {deployment}.convex.site/agentmail/webhook` for AgentMail
`message.received` events.

## Stack

Convex (database, backend, realtime subscriptions, password auth, scheduled
functions, crons, http actions, static hosting) · @convex-dev/rate-limiter ·
@convex-dev/static-hosting · OpenAI gpt-4o-mini · AgentMail · React + Vite.

See CHANGELOG.md, TODO.md, and hackathon.md (build log).
