import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  teams: defineTable({
    name: v.string(),
    inboxId: v.optional(v.string()), // Heidi's AgentMail inbox
    createdAt: v.number(),
  }),

  people: defineTable({
    name: v.string(),
    role: v.string(),
    city: v.string(),
    region: v.string(), // state/country key for holidays, e.g. "IN-MH", "DE"
    tz: v.string(), // IANA timezone
    email: v.optional(v.string()), // links an account to this person
    teamId: v.optional(v.id("teams")),
    workStart: v.number(), // local hour, e.g. 9
    workEnd: v.number(), // local hour, e.g. 18 (night shift: 22 → 6)
    avatarSeed: v.optional(v.string()), // DiceBear seed; falls back to name
    avatarDataUrl: v.optional(v.string()), // uploaded face, small PNG data URL
    lat: v.optional(v.number()), // geocoded pin for the Atlas
    lng: v.optional(v.number()),
    lastDigestOn: v.optional(v.string()), // YYYY-MM-DD local — digest dedupe
  }).index("by_email", ["email"]).index("by_team", ["teamId"]),

  statuses: defineTable({
    personId: v.id("people"),
    kind: v.union(
      v.literal("around"),
      v.literal("off"),
      v.literal("away"),
      v.literal("holiday"),
    ),
    from: v.string(), // YYYY-MM-DD inclusive
    to: v.string(), // YYYY-MM-DD inclusive
    note: v.optional(v.string()),
    source: v.union(v.literal("tap"), v.literal("paste"), v.literal("seed")),
    createdAt: v.number(),
  }).index("by_person", ["personId"]),

  holidays: defineTable({
    region: v.string(),
    name: v.string(),
    date: v.string(), // YYYY-MM-DD
    source: v.union(v.literal("seed"), v.literal("firecrawl")),
  }).index("by_region", ["region"]),

  digests: defineTable({
    to: v.string(),
    body: v.string(),
    mode: v.union(v.literal("stub"), v.literal("sent")),
    createdAt: v.number(),
  }),

  parses: defineTable({
    userId: v.optional(v.string()),
    text: v.string(),
    mode: v.union(v.literal("openai"), v.literal("stub")),
    result: v.object({
      personName: v.optional(v.string()),
      kind: v.string(),
      from: v.string(),
      to: v.string(),
      note: v.optional(v.string()),
    }),
    createdAt: v.number(),
  }),
});
