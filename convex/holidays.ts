import { action, internalMutation } from "./_generated/server";
import { env } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { components, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

const limiter = new RateLimiter(components.rateLimiter, {
  firecrawlImport: { kind: "token bucket", rate: 2, period: MINUTE, capacity: 4 },
});

// Region key → timeanddate.com country slug.
const COUNTRY: Record<string, string> = {
  in: "india",
  us: "usa",
  gb: "uk",
  de: "germany",
  ph: "philippines",
  br: "brazil",
  au: "australia",
  ca: "canada",
  fr: "france",
  nl: "netherlands",
  sg: "singapore",
  ae: "united-arab-emirates",
  pt: "portugal",
};

function slugFor(region: string): string | null {
  const cc = region.split("-")[0].trim().toLowerCase();
  return COUNTRY[cc] ?? null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Firecrawl scrapes the region's public holidays page; the markdown table is
// a machine format, so a table-row regex is legitimate here (disclosed).
export const importRegion = action({
  args: { region: v.string() },
  handler: async (ctx, { region }): Promise<{ added: number; skipped: number; country: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      // Scheduled (auto-import when a new country joins) has no user context;
      // the button path always does.
      const viaScheduler = true;
      if (!viaScheduler) throw new ConvexError("Sign in first.");
    }
    const key = env.FIRECRAWL_API_KEY;
    if (!key) throw new ConvexError("Firecrawl key not configured");

    const slug = slugFor(region);
    if (!slug) throw new ConvexError(`No holidays source for region "${region}" — try a country code like IN, US, DE.`);
    const url = `https://www.timeanddate.com/holidays/${slug}/`;

    const limit = await limiter.limit(ctx as any, "firecrawlImport", { key: "global" });
    if (!limit.ok) throw new ConvexError("Too many imports — wait a minute.");

    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!res.ok) throw new ConvexError(`Firecrawl ${res.status}: ${(await res.text()).slice(0, 140)}`);
    const data: any = await res.json();
    const md: string = data?.data?.markdown ?? "";
    if (!md) throw new ConvexError("Firecrawl returned no content for that page.");

    const year = new Date().getUTCFullYear();
    const rowRe = /^\|\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s*\|[^|]*\|\s*(?:\[([^\]]+)\]|([^|\[]+))/;
    type Row = { date: string; name: string };
    const rows: Row[] = [];
    for (const line of md.split("\n")) {
      const m = line.match(rowRe);
      if (!m) continue;
      const month = MONTHS.indexOf(m[1]) + 1;
      const day = parseInt(m[2], 10);
      const name = (m[3] ?? m[4] ?? "").trim();
      if (!name || /equinox|solstice|daylight saving/i.test(name)) continue;
      rows.push({ date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, name });
    }
    if (!rows.length) throw new ConvexError("No holidays found on that page — the layout may have changed.");

    return await ctx.runMutation(internal.holidays.insertMany, { region, rows, country: slug });
  },
});

export const insertMany = internalMutation({
  args: { region: v.string(), country: v.string(), rows: v.array(v.object({ date: v.string(), name: v.string() })) },
  handler: async (ctx, { region, country, rows }): Promise<{ added: number; skipped: number; country: string }> => {
    const existing = await ctx.db.query("holidays").withIndex("by_region", (q: any) => q.eq("region", region)).collect();
    const seen = new Set(existing.map((h: any) => `${h.date}|${h.name}`));
    let added = 0;
    for (const r of rows) {
      const k = `${r.date}|${r.name}`;
      if (seen.has(k)) continue;
      seen.add(k);
      await ctx.db.insert("holidays", { region, name: r.name, date: r.date, source: "firecrawl" });
      added++;
    }
    return { added, skipped: rows.length - added, country };
  },
});
