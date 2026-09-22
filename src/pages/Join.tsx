import { useState } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";

// The page Heidi's invite links to: "you've been invited to join <team>".
// Email comes from the link; first password creates the account and the
// board links it to the teammate card by that email.
export default function Join({ onDone }: { onDone: () => void }) {
  const { signIn } = useAuthActions();
  const params = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
  const email = (params.get("email") ?? "").toLowerCase();
  const teamId = params.get("team") ?? "";
  const team = useQuery(
    api.people.teamInfo,
    teamId ? ({ teamId } as any) : "skip",
  );
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn("password", { email, password, flow: "signUp" });
      onDone();
    } catch {
      // Already has an account (tested earlier) — sign in instead.
      try {
        await signIn("password", { email, password, flow: "signIn" });
        onDone();
      } catch {
        setError("That password doesn't match. If you signed in with this email before, use that password.");
        setBusy(false);
      }
    }
  };

  return (
    <div className="signin">
      <nav className="nav">
        <strong>Whereabouts</strong>
        <span className="meta mono">invite</span>
      </nav>
      <section className="hero">
        <span className="label">heidi, the ai who runs hr, sent you this</span>
        <h1>You've been invited to join {team?.name ?? "the team"}.</h1>
        <p className="sub">
          Your card is already on the board. Set a password with {email || "your email"} and it goes live —
          clocks, holidays and all.
        </p>
        <div className="pastebox custom-account join-card">
          <div className="pastebox-row">
            <input value={email} readOnly aria-label="your email" />
            <input
              placeholder="pick a password (8+ chars)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && password.length >= 8) go(); }}
            />
            <button className="btn primary" disabled={busy || !email || password.length < 8} onClick={go}>
              {busy ? "Joining…" : "Join the team"}
            </button>
          </div>
          {error && <div className="parse-error">{error}</div>}
        </div>
        {team && <span className="meta mono">{team.count} people are already on the board</span>}
      </section>
    </div>
  );
}
