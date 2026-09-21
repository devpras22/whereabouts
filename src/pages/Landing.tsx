import { useState } from "react";
import { currentTheme, localTime, isQuiet, toggleTheme } from "../lib/data";

const PREVIEW = [
  { name: "Arjun", city: "Pune", tz: "Asia/Kolkata" },
  { name: "Lena", city: "Berlin", tz: "Europe/Berlin" },
  { name: "Greg", city: "Austin", tz: "America/Chicago" },
];

function HeroStrip() {
  const tick = Date.now();
  const gregT = localTime("America/Chicago", tick);
  const gregQuiet = isQuiet(gregT.h);
  return (
    <div className="hero-strip">
      {PREVIEW.map((p) => {
        const t = localTime(p.tz, tick);
        const quiet = isQuiet(t.h);
        return (
          <div key={p.name} className={`strip-card ${quiet ? "quiet" : ""}`}>
            <div>
              <strong>{p.name}</strong>
              <span className="tagline">{p.city}</span>
            </div>
            <span className="strip-clock">{t.label}</span>
          </div>
        );
      })}
      {gregQuiet ? (
        <div className="strip-card dimstrip">
          <div>
            <strong>Greg is asleep</strong>
            <span className="tagline">don't ping</span>
          </div>
          <span className="strip-clock">{gregT.label}</span>
        </div>
      ) : (
        <div className="strip-card dimstrip">
          <div>
            <strong>Good time to ping Greg</strong>
            <span className="tagline">it's {gregT.label} in Austin</span>
          </div>
          <span className="strip-clock">●</span>
        </div>
      )}
    </div>
  );
}

export default function Landing({ onBoard }: { onBoard: () => void }) {
  const [theme, setTheme] = useState(currentTheme());
  return (
    <div className="landing">
      <nav className="nav">
        <strong>Whereabouts</strong>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" onClick={() => { toggleTheme(); setTheme(currentTheme()); }}>
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button className="btn" onClick={onBoard}>Open the board →</button>
        </div>
      </nav>

      <section className="hero">
        <h1>Know who's around before you ping.</h1>
        <p className="sub">
          A live board of your remote team — local time, who's off, whose holiday it is.
          With Heidi, your team's HR inbox: daily digests, invites, and "just reply to update".
        </p>
        <HeroStrip />
        <button className="btn primary" onClick={onBoard}>Open the board →</button>
        <span className="meta">live demo · sign in as anyone on the sample team, or create your own</span>
      </section>

      <section className="how">
        <h2>How it works</h2>
        <div className="steps">
          <div className="step">
            <span className="stepnum">01</span>
            <h3>Glance</h3>
            <p>Every person: their local clock, big and live. Cards dim when it's past 9pm where they are — that's your "don't ping Greg."</p>
          </div>
          <div className="step">
            <span className="stepnum">02</span>
            <h3>Tell it once</h3>
            <p>Two taps on your row — "off today," "away till the 30th." Or paste the message you already sent anywhere; it gets read and the board updates itself.</p>
          </div>
          <div className="step">
            <span className="stepnum">03</span>
            <h3>Everyone sees it, live</h3>
            <p>The board updates for the whole team the moment anything changes. No calendar invites, no status fields nobody fills, no "is today off?" group chat.</p>
          </div>
        </div>
      </section>

      <section className="why">
        <h2>Why this exists</h2>
        <p>
          Small remote teams don't have HR systems — they have a group chat where "is tomorrow off?" gets asked
          every festival week. Calendars stay empty because nobody files leave into them; chat statuses go stale.
          Whereabouts is the one glance that answers <em>who's around</em> — and the two-second update that keeps it true.
        </p>
        <ul>
          <li>Holidays per person's region, ahead of time — Ganesh visarjan hits Pune, not Berlin.</li>
          <li>Click anyone: your shared working hours, highlighted, with the best call window.</li>
          <li>Timezone clocks with manners — quiet hours are visual, not a settings maze.</li>
        </ul>
      </section>

      <section className="stack">
        <h2>Built with</h2>
        <div className="chips">
          <span className="stackchip">Convex — database · backend · realtime · hosting</span>
          <span className="stackchip">OpenAI — reads your pasted messages</span>
          <span className="stackchip">Firecrawl — pulls each region's official holidays</span>
          <span className="stackchip">AgentMail — Heidi, the HR inbox that emails and reads replies</span>
        </div>
        <p className="meta">
          Heidi is live on AgentMail: invites go out when you add a teammate, each person gets the digest at
          their own local 8am, and replying to any of her emails updates the board. Firecrawl holiday import
          is seeded for the demo. The v2: this board in your macOS menu bar.
        </p>
      </section>

      <footer className="footer">
        Whereabouts — a Convex All Gas hackathon build · sample data · fictional people
      </footer>
    </div>
  );
}
