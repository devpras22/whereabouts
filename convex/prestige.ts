import { mutation } from "./_generated/server";

// Prestige Worldwide — the demo company for the recording. Maya is the CEO
// you log in as; the CTO slot stays empty until Pras is invited live.
export const seedPrestige = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("teams").collect();
    if (existing.some((t: any) => t.name === "Prestige Worldwide")) return "already seeded";
    const teamId = await ctx.db.insert("teams", { name: "Prestige Worldwide", inboxId: "", createdAt: Date.now() });

    const d = (n: number) => {
      const t = new Date();
      t.setUTCDate(t.getUTCDate() + n);
      return t.toISOString().slice(0, 10);
    };

    const cast = [
      { name: "Maya Chen", role: "CEO", city: "San Francisco", region: "US", tz: "America/Los_Angeles", email: "maya@demo.whereabouts.app", lat: 37.77, lng: -122.42, ws: 9, we: 18 },
      { name: "Lars Brandt", role: "Engineering", city: "Berlin", region: "DE", tz: "Europe/Berlin", email: "lars@demo.whereabouts.app", lat: 52.52, lng: 13.4, ws: 9, we: 17 },
      { name: "Sofia Almeida", role: "Design", city: "Lisbon", region: "PT", tz: "Europe/Lisbon", email: "sofia@demo.whereabouts.app", lat: 38.72, lng: -9.14, ws: 10, we: 18 },
      { name: "Jack Weston", role: "Support", city: "Sydney", region: "AU", tz: "Australia/Sydney", email: "jack@demo.whereabouts.app", lat: -33.87, lng: 151.21, ws: 22, we: 6 },
      { name: "Diego Souza", role: "Growth", city: "São Paulo", region: "BR", tz: "America/Sao_Paulo", email: "diego@demo.whereabouts.app", lat: -23.55, lng: -46.63, ws: 9, we: 18 },
    ];
    const ids: Record<string, any> = {};
    for (const c of cast) {
      ids[c.name] = await ctx.db.insert("people", {
        name: c.name, role: c.role, city: c.city, region: c.region, tz: c.tz,
        email: c.email, teamId, workStart: c.ws, workEnd: c.we, lat: c.lat, lng: c.lng,
      });
    }
    const now = Date.now();
    await ctx.db.insert("statuses", { personId: ids["Sofia Almeida"], kind: "off", from: d(0), to: d(0), note: "family thing", source: "seed", createdAt: now - 6000 });
    await ctx.db.insert("statuses", { personId: ids["Lars Brandt"], kind: "away", from: d(11), to: d(13), note: "conference in Munich", source: "seed", createdAt: now - 5000 });
    return "seeded";
  },
});
