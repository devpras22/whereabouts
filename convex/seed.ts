import { mutation } from "./_generated/server";

// Fictional demo team; emails bind demo accounts to people. Sample holidays.
const SHIFTS: Record<string, [number, number]> = {
  "Arjun Mehta": [9, 18],
  "Sana Kulkarni": [9, 18],
  "Pankaj Rao": [10, 19],
  "Meera Iyer": [9, 18],
  "Greg Palmer": [8, 16],
  "Tom Whitfield": [9, 17],
  "Lena Fischer": [9, 18],
  "Marco Dela Cruz": [22, 6], // night shift, Manila
  "Ana Souza": [9, 18],
};

const TEAM = [
  { name: "Arjun Mehta", role: "Founder", city: "Pune", region: "IN-MH", tz: "Asia/Kolkata", email: "arjun@demo.whereabouts.app" },
  { name: "Sana Kulkarni", role: "Product", city: "Pune", region: "IN-MH", tz: "Asia/Kolkata", email: "sana@demo.whereabouts.app" },
  { name: "Pankaj Rao", role: "PM", city: "Bhopal", region: "IN-MP", tz: "Asia/Kolkata", email: "pankaj@demo.whereabouts.app" },
  { name: "Meera Iyer", role: "Design", city: "Bengaluru", region: "IN-KA", tz: "Asia/Kolkata", email: "meera@demo.whereabouts.app" },
  { name: "Greg Palmer", role: "Engineering", city: "Austin", region: "US-TX", tz: "America/Chicago", email: "greg@demo.whereabouts.app" },
  { name: "Tom Whitfield", role: "Engineering", city: "London", region: "GB", tz: "Europe/London", email: "tom@demo.whereabouts.app" },
  { name: "Lena Fischer", role: "Ops", city: "Berlin", region: "DE", tz: "Europe/Berlin", email: "lena@demo.whereabouts.app" },
  { name: "Marco Dela Cruz", role: "Support", city: "Manila", region: "PH", tz: "Asia/Manila", email: "marco@demo.whereabouts.app" },
  { name: "Ana Souza", role: "Marketing", city: "São Paulo", region: "BR", tz: "America/Sao_Paulo", email: "ana@demo.whereabouts.app" },
];

function d(offsetDays: number): string {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() + offsetDays);
  return t.toISOString().slice(0, 10);
}

const HOLIDAYS = [
  { region: "IN-MH", name: "Anant Chaturdashi (Ganesh visarjan)", date: d(4) },
  { region: "IN", name: "Gandhi Jayanti", date: d(11) },
  { region: "DE", name: "Tag der Deutschen Einheit", date: d(12) },
  { region: "IN-KA", name: "Mahalaya Amavasya", date: d(25) },
  { region: "US-TX", name: "Indigenous Peoples' Day", date: d(21) },
  { region: "PH", name: "All Saints' Day", date: d(41) },
];

export const initTeam = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("people").first();
    if (existing) return "already seeded";
    const ids: Record<string, any> = {};
    const now = Date.now();
    for (const p of TEAM) {
      const [ws, we] = SHIFTS[p.name] ?? [9, 18];
      ids[p.name] = await ctx.db.insert("people", { ...p, workStart: ws, workEnd: we });
    }
    for (const h of HOLIDAYS) {
      await ctx.db.insert("holidays", { ...h, source: "seed" });
    }
    await ctx.db.insert("statuses", { personId: ids["Sana Kulkarni"], kind: "off", from: d(0), to: d(0), note: "family thing", source: "seed", createdAt: now - 5000 });
    await ctx.db.insert("statuses", { personId: ids["Greg Palmer"], kind: "away", from: d(0), to: d(5), note: "PTO, Big Bend", source: "seed", createdAt: now - 4000 });
    await ctx.db.insert("statuses", { personId: ids["Ana Souza"], kind: "away", from: d(2), to: d(4), note: "conference in Rio", source: "seed", createdAt: now - 3000 });
    return "seeded";
  },
});

export const resetTeam = mutation({
  args: {},
  handler: async (ctx) => {
    for (const t of ["statuses", "holidays", "people"] as const) {
      for await (const row of ctx.db.query(t)) {
        await ctx.db.delete(t, row._id);
      }
    }
    return "reset";
  },
});
