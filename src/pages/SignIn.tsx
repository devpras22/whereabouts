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

  // Demo buttons: sign in, auto-registering the seeded account on first click.
  const enterDemo = async (email: string, password: string) => {
    setBusy(email);
    setError(null);
    try {
      await signIn("password", { email, password, flow: "signIn" });
    } catch {
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

  // Custom accounts: explicit sign-in — no silent fallbacks, human errors.
  const signInOnly = async (email: string, password: string) => {
    setBusy(email);
    setError(null);
    try {
      await signIn("password", { email, password, flow: "signIn" });
    } catch {
      setError("That email and password don't match. Demo accounts use demo1234.");
      setBusy(null);
      return;
    }
    setBusy(null);
  };

  const signUpOnly = async (email: string, password: string) => {
    setBusy(email);
    setError(null);
    try {
      await signIn("password", { email, password, flow: "signUp" });
    } catch (e) {
      const msg = String(e);
      setError(
        /exist|taken|registered|already/i.test(msg)
          ? "That email already has an account. Switch to Sign in."
          : "Couldn't create the account. Check the email and use 8+ characters.",
      );
      setBusy(null);
      return;
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
          The demo team is pre-seeded on Convex. Pick anyone: you'll land on the
          board as them, and only your own status is yours to change.
        </p>

        <div className="demo-grid">
          {DEMO_TEAM.map((p) => (
            <button
              key={p.email}
              className="strip-card demo"
              disabled={busy !== null}
              onClick={() => enterDemo(p.email, DEMO_PASSWORD)}
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
        <CustomAccount
          busy={busy !== null}
          onSignIn={signInOnly}
          onSignUp={signUpOnly}
        />
        {error && <div className="parse-error">{error}</div>}
      </section>
    </div>
  );
}

function CustomAccount({
  busy,
  onSignIn,
  onSignUp,
}: {
  busy: boolean;
  onSignIn: (email: string, password: string) => void;
  onSignUp: (email: string, password: string) => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const valid = email.includes("@") && password.length >= 8;
  return (
    <div className="pastebox custom-account">
      <div className="pastebox-row">
        <input placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="password (8+ chars)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {mode === "signin" ? (
          <button className="btn primary" disabled={busy || !valid} onClick={() => onSignIn(email, password)}>
            Sign in
          </button>
        ) : (
          <button className="btn primary" disabled={busy || !valid} onClick={() => onSignUp(email, password)}>
            Create account
          </button>
        )}
      </div>
      <p className="meta">
        {mode === "signin" ? (
          <>New here? <button className="linkbtn" onClick={() => setMode("signup")}>Create an account</button> It starts your own team, and Heidi emails your teammates an invite.</>
        ) : (
          <>Already have an account? <button className="linkbtn" onClick={() => setMode("signin")}>Sign in</button></>
        )}
      </p>
    </div>
  );
}
