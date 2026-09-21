import { localTime, isQuiet, toggleTheme, avatarUrl } from "../lib/data";
import ThemeToggle from "./ThemeToggle";

// Full names keep the avatar seed identical to the board's cards.
const PREVIEW = [
  { name: "Arjun", full: "Arjun Mehta", city: "Pune", tz: "Asia/Kolkata" },
  { name: "Lena", full: "Lena Fischer", city: "Berlin", tz: "Europe/Berlin" },
  { name: "Greg", full: "Greg Palmer", city: "Austin", tz: "America/Chicago" },
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
            <img className="avatar-img strip-avatar" src={avatarUrl(p.full)} alt="" />
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
          <img className="avatar-img strip-avatar" src={avatarUrl("Greg Palmer")} alt="" />
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
  return (
    <div className="landing">
      <nav className="nav">
        <strong>Whereabouts</strong>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <ThemeToggle onToggle={toggleTheme} />
          <button className="btn" onClick={onBoard}>Open the board →</button>
        </div>
      </nav>

      <section className="hero">
        <h1>Know who's around before you ping.</h1>
        <p className="sub">
          Greg's asleep. Lena's off Thursday. One live board knows.
          Heidi, your AI HR agent, keeps it real.
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
            <p>Every person: their local clock, big and live. Cards dim when it's past 9pm where they are. That's your "don't ping Greg."</p>
          </div>
          <div className="step">
            <span className="stepnum">02</span>
            <h3>Tell it once</h3>
            <p>Two taps on your row: "off today," "away till the 30th." Or paste the message you already sent anywhere; it gets read and the board updates itself.</p>
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
          Small remote teams don't have HR systems. They have a group chat where "is tomorrow off?" gets asked
          every festival week. Calendars stay empty because nobody files leave into them; chat statuses go stale.
          Whereabouts is the one glance that answers <em>who's around</em>, and the two-second update that keeps it true.
        </p>
        <ul>
          <li>Holidays per person's region, ahead of time. Ganesh visarjan hits Pune, not Berlin.</li>
          <li>Click anyone: your shared working hours, highlighted, with the best call window.</li>
          <li>Timezone clocks with manners. Quiet hours are visual, not a settings maze.</li>
        </ul>
      </section>

      <section className="stack">
        <h2>Built with</h2>
        <div className="chips">
          <span className="stackchip">Convex: database · backend · realtime · hosting</span>
          <span className="stackchip">OpenAI: reads your pasted messages</span>
          <span className="stackchip">Firecrawl: pulls each region's official holidays</span>
          <span className="stackchip">AgentMail: powers Heidi, the AI agent who runs HR</span>
        </div>
        <p className="meta">
          Heidi runs on AgentMail: she invites teammates, sends each person a digest at their
          local 8am, and updates the board when you reply to her. Firecrawl imports each country's real holidays
          (try it on the board). v2: this board in your macOS menu bar.
        </p>
      </section>

      <footer className="footer">
        Whereabouts · a Convex All Gas hackathon build · sample data · fictional people
      </footer>
    </div>
  );
}
