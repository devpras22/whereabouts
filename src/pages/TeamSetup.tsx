import { useState } from "react";
import { useAddTeammate, useCreateTeam, useUpdateMe } from "../lib/store";

export const COMMON_TZ = [
  "Asia/Kolkata", "Asia/Manila", "Asia/Singapore", "Asia/Dubai",
  "Europe/London", "Europe/Berlin", "Europe/Lisbon",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Sao_Paulo",
  "Australia/Sydney",
];

function num(v: string, d: number): number {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? ((n % 24) + 24) % 24 : d;
}

export function TeamSetup({ onDone }: { onDone: () => void }) {
  const createTeam = useCreateTeam();
  const updateMe = useUpdateMe();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [tz, setTz] = useState("Asia/Kolkata");
  const [ws, setWs] = useState("9");
  const [we, setWe] = useState("18");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await createTeam({ name: name.trim() });
      await updateMe({
        name: undefined, role: undefined, region: undefined,
        city: city.trim() || undefined,
        tz,
        workStart: num(ws, 9),
        workEnd: num(we, 18),
      });
      onDone();
    } catch (e) {
      setError(String(e).slice(0, 120));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pastebox teambox">
      <div className="pastebox-head">
        <strong>Create your team</strong>
        <span className="meta">your board starts empty · Heidi, the AI agent who runs your HR, onboards everyone</span>
      </div>
      <div className="pastebox-row">
        <input placeholder="Team name, e.g. Acme" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Your city" value={city} onChange={(e) => setCity(e.target.value)} />
        <select value={tz} onChange={(e) => setTz(e.target.value)}>
          {COMMON_TZ.map((z) => <option key={z} value={z}>{z.split("/")[1]?.replace("_", " ") ?? z}</option>)}
        </select>
        <span className="till">
          shift <input className="shift-in" value={ws} onChange={(e) => setWs(e.target.value)} />–
          <input className="shift-in" value={we} onChange={(e) => setWe(e.target.value)} />
        </span>
        <button className="btn primary" disabled={busy || !name.trim()} onClick={go}>
          {busy ? "Creating…" : "Create team"}
        </button>
      </div>
      {error && <div className="parse-error">{error}</div>}
    </div>
  );
}

export function AddTeammate() {
  const addTeammate = useAddTeammate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [tz, setTz] = useState("Asia/Kolkata");
  const [ws, setWs] = useState("9");
  const [we, setWe] = useState("18");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await addTeammate({
        name: name.trim(),
        email: email.trim(),
        city: city.trim() || undefined,
        tz,
        workStart: num(ws, 9),
        workEnd: num(we, 18),
      });
      setMsg(`Added ${name.trim()}. Heidi just emailed their invite.`);
      setName(""); setEmail(""); setCity("");
    } catch (e) {
      setMsg(String(e).slice(0, 120));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pastebox teambox">
      <div className="pastebox-head">
        <strong>Add a teammate</strong>
        <span className="meta">they get a real invite from Heidi with their sign-in link</span>
      </div>
      <div className="pastebox-row">
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="their@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <select value={tz} onChange={(e) => setTz(e.target.value)}>
          {COMMON_TZ.map((z) => <option key={z} value={z}>{z.split("/")[1]?.replace("_", " ") ?? z}</option>)}
        </select>
        <span className="till">
          shift <input className="shift-in" value={ws} onChange={(e) => setWs(e.target.value)} />–
          <input className="shift-in" value={we} onChange={(e) => setWe(e.target.value)} />
        </span>
        <button className="btn primary" disabled={busy || !name.trim() || !email.includes("@")} onClick={go}>
          {busy ? "Inviting…" : "Add + invite"}
        </button>
      </div>
      {msg && <div className="parse-result"><span className="mode openai">[heidi]</span><code>{msg}</code></div>}
    </div>
  );
}
