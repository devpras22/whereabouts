import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";

// Demo accounts — one per seeded teammate. Click = sign in (auto-registers on
// first use). Judges can pick any identity and see the board as that person.
const DEMO_TEAM = [
  { name: "Arjun Mehta", city: "Pune", email: "arjun@demo.whereabouts.app" },
  { name: "Sana Kulkarni", city: "Pune", email: "sana@demo.whereabouts.app" },
  { name: "Pankaj Rao", city: "Bhopal", email: "pankaj@demo.whereabouts.app" },
  { name: "Meera Iyer", city: "Bengaluru", email: "meera@demo.whereabouts.app" },
  { name: "Greg Palmer", city: "Austin", email: "greg@demo.whereabouts.app" },
  { name: "Tom Whitfield", city: "London", email: "tom@demo.whereabouts.app" },
  { name: "Lena Fischer", city: "Berlin", email: "lena@demo.whereabouts.app" },
  { name: "Marco Dela Cruz", city: "Manila", email: "marco@demo.whereabouts.app" },
  { name: "Ana Souza", city: "São Paulo", email: "ana@demo.whereabouts.app" },
];

const DEMO_PASSWORD = "demo1234";

export default function SignIn({ onHome }: { onHome: () => void }) {
  const { signIn } = useAuthActions();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enter = async (email: string, password: string) => {
    setBusy(email);
    setError(null);
    try {
      await signIn("password", { email, password, flow: "signIn" });
    } catch {
      // First ever login for this demo account — register it, then continue.
      try {
        await signIn("password", { email, password, flow: "signUp" });
      } catch (e2) {
        setError(String(e2).slice(0, 120));
        setBusy(null);
        return;
      }
    }
    setBusy(null);
  };

  return (
    <div className="signin">
      <nav className="nav">
        <button className="brandlink" onClick={onHome}>Whereabouts</button>
        <span className="meta mono">sign in</span>
      </nav>

      <section className="hero">
        <h1>Sign in as a teammate.</h1>
        <p className="sub">
          The demo team is pre-seeded on Convex. Pick anyone — you'll land on the
          board as them, and only your own status is yours to change.
        </p>

        <div className="demo-grid">
          {DEMO_TEAM.map((p) => (
            <button
              key={p.email}
              className="strip-card demo"
              disabled={busy !== null}
              onClick={() => enter(p.email, DEMO_PASSWORD)}
            >
              <div>
                <strong>{busy === p.email ? "Signing in…" : p.name}</strong>
                <span className="tagline">{p.city}</span>
              </div>
              <span className="strip-clock mono">→</span>
            </button>
          ))}
        </div>

        <p className="meta mono">
          password for all demo accounts: demo1234 · or use your own email below
        </p>
        <CustomAccount enter={enter} busy={busy !== null} />
        {error && <div className="parse-error">{error}</div>}
      </section>
    </div>
  );
}

function CustomAccount({ enter, busy }: { enter: (email: string, password: string) => void; busy: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="pastebox custom-account">
      <div className="pastebox-row">
        <input placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="password (8+ chars)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn primary" disabled={busy || !email || password.length < 8} onClick={() => enter(email, password)}>
          Create account
        </button>
      </div>
      <p className="meta">Custom accounts create YOUR OWN team — Heidi (your HR inbox) then invites your teammates by email.</p>
    </div>
  );
}
