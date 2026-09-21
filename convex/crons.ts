import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Heidi's morning tick: whoever's local time is in the 08:00 hour on a
// weekday gets their digest — deduped per local day.
crons.interval(
  "heidi-digest-tick",
  { minutes: 15 },
  internal.people.digestTick,
);

export default crons;
