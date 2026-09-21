import { defineApp } from "convex/server";
import { v } from "convex/values";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import staticHosting from "@convex-dev/static-hosting/convex.config";

const app = defineApp({
  env: {
    OPENAI_API_KEY: v.optional(v.string()),
    AGENTMAIL_API_KEY: v.optional(v.string()),
    AGENTMAIL_INBOX_ID: v.optional(v.string()),
  },
});
app.use(rateLimiter);
app.use(staticHosting);
export default app;
