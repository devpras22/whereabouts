import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal, api } from "./_generated/api";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(dateISO: string, days: number): string {
  const t = new Date(dateISO + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

// Local hour for a timezone right now (V8 Intl).
function localHourNow(tz: string, at: number): number {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false });
  return parseInt(fmt.format(new Date(at)), 10) % 24;
}

function localDateNow(tz: string, at: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
}

// Resolve the signed-in user's email, then the person row bound to it.
// Real authz: your identity decides whose status you can move.
async function callerPerson(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return { user: null, person: null };
  const user = (await ctx.db.get(userId)) as any;
  const email = user?.email as string | undefined;
  const person = email
    ? (await ctx.db.query("people").withIndex("by_email", (q: any) => q.eq("email", email)).unique()) ?? null
    : null;
  return { user, person };
}

export const listBoard = query({
  args: {},
  handler: async (ctx) => {
    const people = await ctx.db.query("people").collect();
    const statuses = await ctx.db.query("statuses").collect();
    const holidays = await ctx.db.query("holidays").collect();
    const teams = await ctx.db.query("teams").collect();
    const today = todayISO();
    const { user, person: caller } = await callerPerson(ctx);
    const team = caller?.teamId ? teams.find((t) => t._id === caller.teamId) : null;

    // Own team if the caller has one. Demo teammates (a person row, no team)
    // see the demo board. A signed-in account with NO person row yet (fresh
    // custom signup) sees an empty board with the create-team form. Signed-out
    // visitors see the demo board.
    const demo = people.filter((p) => !p.teamId);
    const scoped = caller?.teamId
      ? people.filter((p) => p.teamId === caller.teamId)
      : caller || !user
        ? demo
        : [];
    const cards = scoped.map((p) => {
      const mine = statuses
        .filter((s) => s.personId === p._id)
        .sort((a, b) => b.createdAt - a.createdAt);
      const active = mine.find((s) => s.from <= today && s.to >= today);
      const planned = mine.find((s) => s.from > today && s.kind !== "around");
      const regionKey = (h: { region: string }) => h.region === p.region || h.region === p.region.slice(0, 2);
      const holidayToday = holidays.find((h) => regionKey(h) && h.date === today);
      const upcoming = holidays
        .filter((h) => regionKey(h) && h.date > today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 2);
      return {
        _id: p._id,
        name: p.name,
        role: p.role,
        city: p.city,
        region: p.region,
        tz: p.tz,
        workStart: p.workStart,
        workEnd: p.workEnd,
        avatarSeed: p.avatarSeed ?? null,
        avatarDataUrl: p.avatarDataUrl ?? null,
        lat: p.lat ?? null,
        lng: p.lng ?? null,
        email: p.email ?? null,
        isViewer: caller?._id != null && caller._id === p._id,
        status: active
          ? { kind: active.kind, note: active.note, from: active.from, to: active.to, source: active.source }
          : { kind: "around" as const, note: undefined, from: today, to: today, source: "seed" as const },
        plannedStatus: planned
          ? { kind: planned.kind, note: planned.note, from: planned.from, to: planned.to }
          : undefined,
        holidayToday: holidayToday ? { name: holidayToday.name, date: holidayToday.date } : undefined,
        upcomingHolidays: upcoming.map((h) => ({ name: h.name, date: h.date })),
      };
    });

    const teamRegions = [...new Set(scoped.map((p) => p.region))];
    const seenHols = new Set<string>();
    const globalUpcoming = holidays
      .filter((h) => teamRegions.some((r) => h.region === r || h.region === r.slice(0, 2)) && h.date >= today && h.date <= addDaysISO(today, 14))
      .sort((a, b) => a.date.localeCompare(b.date))
      .filter((h) => {
        const k = `${h.region.slice(0, 2)}|${h.date}`;
        if (seenHols.has(k)) return false;
        seenHols.add(k);
        return true;
      })
      .map((h) => ({ region: h.region, name: h.name, date: h.date }));

    return { cards, upcoming: globalUpcoming, today, teamName: team?.name ?? "Demo team", viewerHasTeam: caller?.teamId != null };
  },
});

export const setStatus = mutation({
  args: {
    kind: v.union(v.literal("around"), v.literal("off"), v.literal("away")),
    from: v.string(),
    to: v.string(),
    note: v.optional(v.string()),
    source: v.union(v.literal("tap"), v.literal("paste")),
  },
  handler: async (ctx, { kind, from, to, note, source }) => {
    const { person } = await callerPerson(ctx);
    if (!person) throw new Error("Sign in to set your status.");
    await ctx.db.insert("statuses", { personId: person._id, kind, from, to, note, source, createdAt: Date.now() });
  },
});

// --- team creation -------------------------------------------------------

export const createTeam = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const { user, person } = await callerPerson(ctx);
    if (!user?.email) throw new Error("Sign in with an email account first.");
    if (person?.teamId) throw new Error("You're already on a team.");
    const teamId = await ctx.db.insert("teams", { name, inboxId: "heidi-hr@agentmail.to", createdAt: Date.now() });
    // Founder: create a person card bound to this account. City/tz/pin
    // arrive right after via updateMe once they pick a city (geocoded).
    const founder = await ctx.db.insert("people", {
      name: user.name ?? user.email.split("@")[0],
      role: "Founder",
      city: "",
      region: "",
      tz: "Asia/Kolkata",
      email: user.email,
      teamId,
      workStart: 9,
      workEnd: 18,
    });
    return { teamId, founder };
  },
});

export const updateMe = mutation({
  args: {
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    city: v.optional(v.string()),
    tz: v.optional(v.string()),
    region: v.optional(v.string()),
    workStart: v.optional(v.number()),
    workEnd: v.optional(v.number()),
    avatarSeed: v.optional(v.string()),
    avatarDataUrl: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { person } = await callerPerson(ctx);
    if (!person) throw new Error("Sign in first.");
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(args)) if (v !== undefined) patch[k] = v;
    if (Object.keys(patch).length) await ctx.db.patch(person._id, patch);
  },
});

export const addTeammate = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.optional(v.string()),
    city: v.optional(v.string()),
    tz: v.optional(v.string()),
    region: v.optional(v.string()),
    workStart: v.optional(v.number()),
    workEnd: v.optional(v.number()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { person } = await callerPerson(ctx);
    if (!person?.teamId) throw new Error("Create your team first.");
    const team = (await ctx.db.get(person.teamId)) as any;
    const dup = await ctx.db.query("people").withIndex("by_email", (q: any) => q.eq("email", args.email)).unique();
    if (dup) throw new Error("That email is already on a board.");
    const id = await ctx.db.insert("people", {
      name: args.name,
      role: args.role ?? "Teammate",
      city: args.city ?? "",
      region: args.region ?? "",
      tz: args.tz ?? "Asia/Kolkata",
      email: args.email,
      teamId: person.teamId,
      workStart: args.workStart ?? 9,
      workEnd: args.workEnd ?? 18,
    });
    // New country on the team? Firecrawl pulls its holidays in the background.
    const cc = (args.region ?? "").split("-")[0].toUpperCase();
    const known = cc
      ? (await ctx.db.query("holidays").withIndex("by_region", (q: any) => q.eq("region", cc)).first()) != null
      : false;
    if (cc && !known) {
      await ctx.scheduler.runAfter(0, api.holidays.importRegion, { region: cc });
    }
    // Heidi sends the invite after the write commits.
    await ctx.scheduler.runAfter(0, internal.heidi.sendInvite, {
      to: args.email,
      name: args.name,
      teamName: team?.name ?? "your team's",
      inviter: person.name,
      teamId: person.teamId,
    });
    return id;
  },
});

// --- digest plumbing -----------------------------------------------------

export const personByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const person = await ctx.db
      .query("people")
      .withIndex("by_email", (q: any) => q.eq("email", email))
      .unique();
    return person?._id ?? null;
  },
});

export const insertStatus = internalMutation({
  args: {
    personId: v.id("people"),
    kind: v.union(v.literal("around"), v.literal("off"), v.literal("away"), v.literal("holiday")),
    from: v.string(),
    to: v.string(),
    note: v.optional(v.string()),
    source: v.union(v.literal("tap"), v.literal("paste"), v.literal("seed")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("statuses", { ...args, createdAt: Date.now() });
  },
});

export const myPersonId = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { person } = await callerPerson(ctx);
    return person?._id ?? null;
  },
});

export const digestView = internalQuery({
  args: { personId: v.id("people") },
  handler: async (ctx, { personId }) => {
    const person = await ctx.db.get(personId);
    if (!person?.email) return null;
    const team = person.teamId ? await ctx.db.get(person.teamId) : null;
    const mates = person.teamId
      ? await ctx.db.query("people").withIndex("by_team", (q: any) => q.eq("teamId", person.teamId)).collect()
      : await ctx.db.query("people").collect();
    const statuses = await ctx.db.query("statuses").collect();
    const holidays = await ctx.db.query("holidays").collect();
    const today = todayISO();
    const others = mates.filter((m) => m._id !== personId);
    const around: string[] = [];
    const off: string[] = [];
    for (const m of others) {
      const st = statuses
        .filter((s) => s.personId === m._id && s.from <= today && s.to >= today)
        .sort((a, b) => b.createdAt - a.createdAt)[0];
      const hol = holidays.find((h) => (h.region === m.region || h.region === m.region.slice(0, 2)) && h.date === today);
      if (hol) off.push(`${m.name} (${m.city || m.region} — ${hol.name})`);
      else if (st && st.kind !== "around") off.push(`${m.name} (${st.kind}${st.note ? ", " + st.note : ""})`);
      else around.push(m.name);
    }
    const ahead = holidays
      .filter((h) => h.date > today && h.date <= addDaysISO(today, 7))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3)
      .map((h) => `${h.name} on ${h.date}`);
    const fmt = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;
    const shiftings = others
      .filter((m) => m.workStart >= 18 || m.workStart < 7)
      .slice(0, 3)
      .map((m) => `${m.name} works ${fmt(m.workStart)}–${fmt(m.workEnd)} local (${m.city || m.tz})`);
    const t = team as any;
    return { person, teamName: t?.name ?? "your team", around, off, ahead, shiftings, email: person.email };
  },
});

// Cron tick every 15 minutes: whose local morning is it (08:00 hour, Mon–Fri)?
export const digestTick = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const people = await ctx.db.query("people").collect();
    for (const p of people) {
      if (!p.email || !p.tz) continue;
      // Seeded demo people have nonexistent addresses — skip, don't bounce.
      if (p.email.endsWith("@demo.whereabouts.app") || p.email.endsWith("@wbtest.dev")) continue;
      const h = localHourNow(p.tz, now);
      const localDate = localDateNow(p.tz, now);
      const localDow = new Date(localDate + "T12:00:00Z").getUTCDay();
      if (localDow === 0 || localDow === 6) continue;
      if (h !== 8) continue;
      if (p.lastDigestOn === localDate) continue;
      await ctx.db.patch(p._id, { lastDigestOn: localDate });
      await ctx.scheduler.runAfter(0, internal.heidi.sendDigest, { personId: p._id });
    }
  },
});


// --- team management (founder only) ---

export const renameTeam = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const { person } = await callerPerson(ctx);
    if (!person?.teamId) throw new Error("Create your team first.");
    if (!name.trim()) throw new Error("Team name can't be empty.");
    await ctx.db.patch(person.teamId, { name: name.trim() });
  },
});

export const removeTeammate = mutation({
  args: { personId: v.id("people") },
  handler: async (ctx, { personId }) => {
    const { person: me } = await callerPerson(ctx);
    if (!me?.teamId) throw new Error("Create your team first.");
    const target = await ctx.db.get(personId);
    if (!target || target.teamId !== me.teamId) throw new Error("That person isn't on your team.");
    if (target._id === me._id) throw new Error("You can't remove yourself.");
    for await (const s of ctx.db.query("statuses").withIndex("by_person", (q: any) => q.eq("personId", personId))) {
      await ctx.db.delete(s._id);
    }
    await ctx.db.delete(personId);
  },
});

// One-off: remove every custom team (demo people have no teamId) plus their
// statuses and teams. Used to reset test artifacts before recording.
export const purgeTeams = mutation({
  args: {},
  handler: async (ctx) => {
    let people = 0, statuses = 0, teams = 0;
    for await (const p of ctx.db.query("people")) {
      const isTest = !p.teamId && (p.email ?? "").endsWith("@hellogoddo.com");
      if (!p.teamId && !isTest) continue;
      for await (const s of ctx.db.query("statuses").withIndex("by_person", (q: any) => q.eq("personId", p._id))) {
        await ctx.db.delete(s._id); statuses++;
      }
      await ctx.db.delete(p._id); people++;
    }
    for await (const t of ctx.db.query("teams")) { await ctx.db.delete(t._id); teams++; }
    return { people, statuses, teams };
  },
});

// Remove test auth users so invite links land on a clean first-time signup.
export const purgeTestUsers = mutation({
  args: {},
  handler: async (ctx) => {
    let users = 0;
    for await (const u of ctx.db.query("users") as any) {
      const email = (u.email ?? "") as string;
      if (email.endsWith("@agentmail.to") || email.endsWith("@hellogoddo.com")) {
        await ctx.db.delete(u._id);
        users++;
      }
    }
    return { users };
  },
});


export const teamInfo = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => {
    const team = await ctx.db.get(teamId);
    if (!team) return null;
    const members = await ctx.db.query("people").withIndex("by_team", (q: any) => q.eq("teamId", teamId)).collect();
    return { name: team.name, count: members.length };
  },
});
