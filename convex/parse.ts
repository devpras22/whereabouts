import { action, env } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

// Token bucket per signed-in user: protects the OpenAI balance from abuse.
const limiter = new RateLimiter(components.rateLimiter, {
  parseMessage: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 20 },
});

interface Parsed {
  personName?: string;
  kind: "around" | "off" | "away";
  from: string;
  to: string;
  note?: string;
}

function iso(offsetDays: number): string {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() + offsetDays);
  return t.toISOString().slice(0, 10);
}

// Demo-mode fallback so the app runs with zero keys. Labelled in the UI as
// stub; the real path is the OpenAI call below.
function stubParse(text: string): Parsed {
  const t = text.toLowerCase();
  let kind: Parsed["kind"] = "off";
  if (/\b(back|returned|returning|available)\b/.test(t)) kind = "around";
  else if (/\b(travell?ing|trip|conference|pto|vacation|holiday)\b/.test(t)) kind = "away";
  const days = /(\d+)\s*days?\b/.exec(t);
  const span = days ? parseInt(days[1], 10) - 1 : 0;
  return { kind, from: iso(0), to: iso(span), note: text.slice(0, 80) };
}

export const parseMessage = action({
  args: { text: v.string() },
  handler: async (ctx, { text }): Promise<{ mode: "openai" | "stub"; parsed: Parsed }> => {
    const userId = await getAuthUserId(ctx);
    const limit = await limiter.limit(ctx, "parseMessage", { key: userId ?? "anonymous" });
    if (!limit.ok) {
      throw new ConvexError(`Rate limit — try again in ${Math.ceil(limit.retryAfter / 1000)}s`);
    }

    const key = env.OPENAI_API_KEY;
    if (!key) {
      return { mode: "stub", parsed: stubParse(text) };
    }
    const now = new Date();
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const cal: string[] = [];
    for (let i = 0; i < 10; i++) {
      const d = new Date(now.getTime() + i * 86400_000);
      cal.push(`${d.toISOString().slice(0, 10)} = ${dayNames[d.getUTCDay()]}`);
    }
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              `You read casual teammate messages about time off and return strict JSON. ` +
              `${cal[0]} is TODAY. The calendar: ${cal.join("; ")}. ` +
              `Schema: {"personName": string|null, "kind": "off"|"away"|"around", ` +
              `"from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "note": string}. ` +
              `"off" = staying home / a day or few off. "away" = travelling, trip, conference, vacation. ` +
              `"around" = back at work. "today" always maps to ${cal[0].split(" = ")[0]}. ` +
              `If a trip or absence is ongoing or unqualified, from = today unless the message states a future start. ` +
              `Resolve ALL relative dates ONLY from the calendar — never guess weekdays. ` +
              `If no person is named, personName is null. Keep note under 60 chars, or null.`,
          },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new ConvexError(`OpenAI ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new ConvexError("OpenAI returned no content");
    const parsed = JSON.parse(content) as Parsed;
    if (!parsed.from) parsed.from = iso(0);
    if (!parsed.to) parsed.to = parsed.from;
    return { mode: "openai", parsed };
  },
});
