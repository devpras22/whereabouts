import { action, internalAction } from "./_generated/server";
import { env } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { components, internal, api } from "./_generated/api";

const limiter = new RateLimiter(components.rateLimiter, {
  heidiSend: { kind: "token bucket", rate: 20, period: MINUTE, capacity: 30 },
});

async function agentmail(path: string, body: unknown, method = "POST") {
  const key = env.AGENTMAIL_API_KEY;
  if (!key) throw new ConvexError("AgentMail key not configured");
  const res = await fetch(`https://api.agentmail.to/v0${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: method === "DELETE" ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new ConvexError(`AgentMail ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// --- emails Heidi sends -------------------------------------------------

export const sendInvite = internalAction({
  args: { to: v.string(), name: v.string(), teamName: v.string() },
  handler: async (ctx, { to, name, teamName }) => {
    const limit = await limiter.limit(ctx, "heidiSend", { key: "global" });
    if (!limit.ok) throw new ConvexError("Heidi is sending too fast — try again shortly");
    const site = "https://perceptive-falcon-524.convex.site";
    const text =
      `Hi ${name},\n\n` +
      `You've been added to your team's Whereabouts board — a live view of who's around, ` +
      `so nobody pings you at 3am by accident.\n\n` +
      `Sign in here: ${site}\n` +
      `Use this email (${to}) and any password of 8+ characters — first sign-in creates your account ` +
      `and links you to your card on ${teamName}'s board.\n\n` +
      `Every weekday morning I'll send you one digest: who's around, who's off, whose local holiday it is.\n` +
      `And you can just reply to any of my emails — "off friday, family thing" — and I'll update the board for you.\n\n` +
      `— Heidi, your team's HR inbox\n`;
    await agentmail(`/inboxes/${env.AGENTMAIL_INBOX_ID}/messages/send`, {
      to,
      subject: `You're on the ${teamName} board`,
      text,
    });
    return "invited";
  },
});

// Build and send one person's morning digest at their local morning.
export const sendDigest = internalAction({
  args: { personId: v.id("people") },
  handler: async (ctx, { personId }) => {
    const limit = await limiter.limit(ctx, "heidiSend", { key: "global" });
    if (!limit.ok) throw new ConvexError("Heidi is sending too fast");
    const board = await ctx.runQuery(internal.people.digestView, { personId });
    if (!board || !board.email) return "no email on file";
    const { person, teamName, around, off, ahead, shiftings } = board;
    const lines: string[] = [];
    lines.push(`Good morning ${person.name} — here's ${teamName} today.`);
    lines.push("");
    lines.push(`Around: ${around.length ? around.join(", ") : "just you so far"}.`);
    if (off.length) lines.push(`Off / away: ${off.join("; ")}.`);
    if (ahead.length) lines.push(`Holidays ahead: ${ahead.join("; ")}.`);
    if (shiftings.length) lines.push("");
    for (const s of shiftings) lines.push(`· ${s}`);
    lines.push("");
    lines.push(`Reply to this email to update your status — "off friday, family thing" — and I'll sort it.`);
    lines.push(`Board: https://perceptive-falcon-524.convex.site/#/board`);
    await agentmail(`/inboxes/${env.AGENTMAIL_INBOX_ID}/messages/send`, {
      to: board.email,
      subject: `${teamName}: ${around.length + 1} around today`,
      text: lines.join("\n"),
    });
    return "sent";
  },
});

// Manual demo trigger: send MY digest now.
export const sendMyDigestNow = action({
  args: {},
  handler: async (ctx): Promise<string> => {
    const personId = await ctx.runQuery(internal.people.myPersonId, {});
    if (!personId) throw new ConvexError("Sign in as a teammate first");
    const r = await ctx.runAction(internal.heidi.sendDigest, { personId });
    return `Heidi sent your digest (${r}).`;
  },
});

// --- inbound: reply to Heidi → parse → update board → confirm ------------

export const handleInbound = internalAction({
  args: { fromEmail: v.string(), text: v.string() },
  handler: async (ctx, { fromEmail, text }): Promise<{ ok: boolean; reason?: string; kind?: string }> => {
    const personId = await ctx.runQuery(internal.people.personByEmail, { email: fromEmail });
    if (!personId) {
      // Unknown sender: don't go silent — tell them how to get on a board.
      try {
        const limit = await limiter.limit(ctx, "heidiSend", { key: "global" });
        if (limit.ok) {
          await agentmail(`/inboxes/${env.AGENTMAIL_INBOX_ID}/messages/send`, {
            to: fromEmail,
            subject: "You're not on a Whereabouts board yet",
            text:
              `I couldn't find ${fromEmail} on any team board, so I can't update a status for you.\n\n` +
              `If you're part of a team on Whereabouts, ask whoever added you to use this email — ` +
              `or sign in and create your team at https://perceptive-falcon-524.convex.site/#/board ` +
              `and add yourself as a teammate.\n\n— Heidi`,
          });
        }
      } catch {
        // best-effort
      }
      return { ok: false, reason: "no teammate with that email" };
    }
    const parsed = await ctx.runAction(api.parse.parseMessage, { text });
    await ctx.runMutation(internal.people.insertStatus, {
      personId,
      kind: parsed.parsed.kind,
      from: parsed.parsed.from,
      to: parsed.parsed.to,
      note: parsed.parsed.note,
      source: "paste",
    });
    await ctx.runAction(internal.heidi.sendConfirmation, {
      to: fromEmail,
      name: parsed.parsed.personName ?? "",
      kind: parsed.parsed.kind,
      from: parsed.parsed.from,
      until: parsed.parsed.to,
    });
    return { ok: true, kind: parsed.parsed.kind };
  },
});

export const sendConfirmation = internalAction({
  args: { to: v.string(), name: v.string(), kind: v.string(), from: v.string(), until: v.string() },
  handler: async (_ctx, { to, name, kind, from }) => {
    try {
      const limit = await limiter.limit(_ctx, "heidiSend", { key: "global" });
      if (!limit.ok) return;
      await agentmail(`/inboxes/${env.AGENTMAIL_INBOX_ID}/messages/send`, {
        to,
        subject: `Noted — you're ${kind} from ${from}`,
        text: `Got it, ${name}. You're marked ${kind} starting ${from}. The board's updated — everyone can see it now.\n\n— Heidi`,
      });
    } catch {
      // Confirmation is best-effort; the status update already landed.
    }
  },
});

// One live smoke test of the outbound path (single send).
export const smokeTest = action({
  args: { to: v.string() },
  handler: async (_ctx, { to }) => {
    await agentmail(`/inboxes/${env.AGENTMAIL_INBOX_ID}/messages/send`, {
      to,
      subject: "Heidi is live",
      text: "This is Heidi, the Whereabouts HR inbox. If you can read this, the pipeline works. Reply to test the board update.",
    });
    return "sent";
  },
});
