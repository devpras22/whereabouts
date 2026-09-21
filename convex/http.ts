import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { components, internal } from "./_generated/api";

const http = httpRouter();

auth.addHttpRoutes(http);

// AgentMail inbound webhook: Heidi receives a reply → parse → board.
http.route({
  path: "/agentmail/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const raw = await req.text();
    let event: any;
    try {
      event = JSON.parse(raw);
    } catch {
      return new Response("bad json", { status: 400 });
    }
    // Only fresh receives: skip spam/blocked/unauthenticated variants.
    if (event?.event_type && event.event_type !== "message.received") {
      return new Response("skipped", { status: 200 });
    }
    const msg = event?.message ?? {};
    // from is a string like "Sana <sana@x.com>" (or a bare address).
    const rawFrom = typeof msg.from === "string" ? msg.from : msg.from?.email_address ?? null;
    const from = rawFrom ? (rawFrom.match(/<([^>]+)>/)?.[1] ?? rawFrom.trim()) : null;
    // AgentMail's extracted_text already strips quoted reply history.
    const text = msg.extracted_text ?? msg.text ?? msg.body?.text ?? "";
    const subject = msg.subject ?? "";
    if (!from || typeof text !== "string") return new Response("ignored", { status: 200 });
    const fresh = text
      .split(/\nOn .+wrote:\n?/)[0]
      .split(/^--\s*$/m)[0]
      .trim();
    const instruction = fresh || subject;
    if (!instruction) return new Response("empty", { status: 200 });
    try {
      await ctx.runAction(internal.heidi.handleInbound, { fromEmail: from, text: instruction });
    } catch (e) {
      console.error("heidi inbound failed", e);
      return new Response("error", { status: 200 }); // ack anyway; at-least-once retries shouldn't loop
    }
    return new Response("ok", { status: 200 });
  }),
});

registerStaticRoutes(http, components.staticHosting);

export default http;
