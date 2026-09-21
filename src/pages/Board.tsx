import { useEffect, useMemo, useState } from "react";
import { useConvexAuth } from "@convex-dev/auth/react";
import {
  addDays,
  avatarUrl,
  fmtDate,
  isOffShift,
  iso,
  localTime,
  regionLabel,
  shiftLabel,
} from "../lib/data";
import type { StatusKind } from "../lib/data";
import { useBoard, useParseMessage, useSetStatus, useSendMyDigestNow } from "../lib/store";
import { AddTeammate, TeamSetup } from "./TeamSetup";

type ParseResult = {
  mode: "openai" | "stub";
  parsed: { personName?: string; kind: StatusKind; from: string; to: string; note?: string };
  debug?: string;
};

const KIND_LABEL: Record<StatusKind, string> = {
  around: "Around",
  off: "Off",
  away: "Away",
};

type BoardCard = NonNullable<ReturnType<typeof useBoard>>["cards"][number];
type Board = NonNullable<ReturnType<typeof useBoard>>;

function StatusTag({ card }: { card: BoardCard }) {
  if (card.holidayToday) return <span className="tag"><span className="dot dot-neutral" />Holiday</span>;
  if (card.status.kind === "around") return <span className="tag"><span className="dot dot-success" />Around</span>;
  return (
    <span className="tag" title={card.status.note}>
      <span className="dot dot-warning" />{card.status.kind === "away" ? "Away" : "Off"}
    </span>
  );
}

function PersonCard({ card, tick, onOpen }: { card: BoardCard; tick: number; onOpen: () => void }) {
  const t = localTime(card.tz, tick);
  const quiet = isOffShift(card.workStart, card.workEnd, t.h);
  const nightShift = card.workStart >= 18 || card.workStart < 7;

  return (
    <button className={`card ${quiet ? "quiet" : ""} ${card.isViewer ? "viewer" : ""}`} onClick={onOpen}>
      <div className="card-top">
        <img className="avatar-img" src={avatarUrl(card.name)} alt="" loading="lazy" />
        <div className="card-id">
          <span className="name">
            {card.name}
            {card.isViewer ? <em className="you">you</em> : null}
          </span>
          <span className="meta">
            {card.role} · {card.city}
            {nightShift ? ` · ${shiftLabel(card.workStart, card.workEnd)} shift` : ""}
          </span>
        </div>
        {quiet ? <span className="quiettag">off shift</span> : null}
      </div>
      <div className="card-time">
        <span className="clock">{t.label}</span>
        <StatusTag card={card} />
      </div>
      {card.holidayToday ? (
        <div className="planned"><span className="dot dot-neutral" />{card.holidayToday.name}</div>
      ) : card.status.kind !== "around" && card.status.note ? (
        <div className="planned"><span className="dot dot-warning" />{card.status.kind} — {card.status.note}</div>
      ) : null}
      {card.plannedStatus && (
        <div className="planned">
          <span className="dot dot-warning" />
          {card.plannedStatus.kind === "away" ? "away" : "off"} {fmtDate(card.plannedStatus.from)}
          {card.plannedStatus.to !== card.plannedStatus.from ? ` → ${fmtDate(card.plannedStatus.to)}` : ""}
          {card.plannedStatus.note ? ` — ${card.plannedStatus.note}` : ""}
        </div>
      )}
    </button>
  );
}

function YourRow({ viewer }: { viewer: BoardCard }) {
  const [note, setNote] = useState("");
  const [until, setUntil] = useState(iso(0));
  const [sent, setSent] = useState<string | null>(null);
  const setStatus = useSetStatus();

  const apply = (kind: StatusKind) => {
    setStatus({
      kind,
      from: iso(0),
      to: kind === "around" ? iso(0) : until,
      note: note || undefined,
      source: "tap",
    }).then(() => {
      setSent(
        kind === "around"
          ? "You're marked around — any off marker is cleared."
          : kind === "off"
            ? "Marked off for today — everyone's board just updated."
            : `Marked away until ${fmtDate(until)} — everyone's board just updated.`,
      );
      setNote("");
      setTimeout(() => setSent(null), 5000);
    }).catch((e) => setSent(String(e).slice(0, 80)));
  };

  return (
    <div className="yourrow">
      <div className="yourrow-left">
        <div>
          <strong>{viewer.name}</strong>
          <div className="yourrow-caption">
            your status — tap what's true · off = today · away = till the date shown
          </div>
        </div>
      </div>
      <div className="yourrow-actions">
        {viewer.status.kind !== "around" && (
          <span className="tag">
            <span className="dot dot-warning" />
            now: {viewer.status.kind === "away" ? "away" : "off"}
            {viewer.status.to !== iso(0) ? ` till ${fmtDate(viewer.status.to)}` : ""}
          </span>
        )}
        <button className="btn" onClick={() => apply("around")}>I'm around</button>
        <button className="btn primary" onClick={() => apply("off")}>Off today</button>
        <span className="till">
          till <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        </span>
        <input
          className="note"
          placeholder="note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="btn" onClick={() => apply("away")}>Away</button>
      </div>
      {sent && <span className="flash">{sent}</span>}
    </div>
  );
}

function PasteBox({ viewer }: { viewer: BoardCard }) {
  const parseMessage = useParseMessage();
  const setStatus = useSetStatus();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await parseMessage({ text }));
    } catch (e) {
      setError(String(e).slice(0, 140));
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!result) return;
    setStatus({
      kind: result.parsed.kind,
      from: result.parsed.from,
      to: result.parsed.to,
      note: result.parsed.note,
      source: "paste",
    }).then(() => {
      setText("");
      setResult(null);
    }).catch((e) => setError(String(e).slice(0, 140)));
  };

  return (
    <div className="pastebox">
      <div className="pastebox-head">
        <strong>Paste an announcement</strong>
        <span className="meta">anything you already sent — Slack, WhatsApp, anything · applies to you ({viewer.name})</span>
      </div>
      <div className="pastebox-row">
        <textarea
          placeholder='e.g. "out thursday and friday, family thing" — or "back monday"'
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
        />
        <button className="btn primary" onClick={run} disabled={busy}>
          {busy ? "Reading…" : "Parse"}
        </button>
      </div>
      {result && (
        <div className="parse-result">
          <span className={`mode ${result.mode}`}>
            {result.mode === "openai" ? "[read by gpt-4o-mini]" : "[demo parser — add openai key]"}
          </span>
          {result.debug && <span className="debug">{result.debug}</span>}
          <code>
            {KIND_LABEL[result.parsed.kind]} {fmtDate(result.parsed.from)}
            {result.parsed.to !== result.parsed.from ? ` → ${fmtDate(result.parsed.to)}` : ""}
            {result.parsed.note ? ` — "${result.parsed.note}"` : ""}
          </code>
          <button className="btn small" onClick={apply}>Apply to board</button>
        </div>
      )}
      {error && <div className="parse-error">{error}</div>}
    </div>
  );
}

function inShift(start: number, end: number, h: number): boolean {
  if (start === end) return true;
  if (start < end) return h >= start && h < end;
  return h >= start || h < end;
}

function WeekModal({ card, viewer, board, onClose }: { card: BoardCard; viewer: BoardCard; board: Board; onClose: () => void }) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(board.today, i)), [board.today]);

  const dayStatus = (date: string) => {
    const hol =
      (card.holidayToday?.date === date ? card.holidayToday.name : undefined) ??
      card.upcomingHolidays.find((h) => h.date === date)?.name;
    if (hol) return { title: hol, cls: "cell-holiday" };
    const covers = (s: { from: string; to: string; kind: string; note?: string }) =>
      s.from <= date && s.to >= date && s.kind !== "around";
    if (covers(card.status)) return { title: card.status.note ?? KIND_LABEL[card.status.kind as StatusKind] ?? "Off", cls: "cell-off" };
    if (card.plannedStatus && covers(card.plannedStatus))
      return { title: card.plannedStatus.note ?? KIND_LABEL[card.plannedStatus.kind as StatusKind] ?? "Off", cls: "cell-off" };
    return { title: "Around", cls: "cell-around" };
  };

  const overlap = useMemo(() => {
    const cells: { viewerH: number; theirH: number; both: boolean }[] = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let i = 0; i < 24; i++) {
      const d = new Date(base.getTime() + i * 3600_000);
      const vh = parseInt(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: viewer.tz }).format(d), 10) % 24;
      const th = parseInt(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: card.tz }).format(d), 10) % 24;
      const vWork = inShift(viewer.workStart, viewer.workEnd, vh);
      const tWork = inShift(card.workStart, card.workEnd, th);
      cells.push({ viewerH: vh, theirH: th, both: vWork && tWork });
    }
    const good = cells.filter((c) => c.both);
    const label = good.length
      ? `${String(good[0].viewerH).padStart(2, "0")}:00–${String((good[good.length - 1].viewerH + 1) % 24).padStart(2, "0")}:00 your time`
      : "no clean overlap — async it";
    return { cells, label };
  }, [card.tz, viewer.tz]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <strong>{card.name}</strong>
            <span className="meta">{card.role} · {card.city} · {card.tz}</span>
          </div>
          <button className="btn small" onClick={onClose}>Close</button>
        </div>
        <div className="week">
          {days.map((d) => {
            const s = dayStatus(d);
            const isToday = d === board.today;
            return (
              <div key={d} className={`daycell ${s.cls} ${isToday ? "today" : ""}`} title={isToday ? `Today — ${s.title}` : s.title}>
                <span className="daylabel">{fmtDate(d)}{isToday ? " · today" : ""}</span>
                <span className="daydot" />
              </div>
            );
          })}
        </div>
        <div className="overlap">
          <div className="overlap-head">
            <strong>Working-hours overlap</strong>
            <span className="callwin">best call window: {overlap.label}</span>
          </div>
          <div className="hours">
            {overlap.cells.map((c, i) => (
              <span key={i} className={`hcell ${inShift(viewer.workStart, viewer.workEnd, c.viewerH) ? "mine" : ""} ${c.both ? "both" : ""}`} title={`you ${c.viewerH}:00 · them ${c.theirH}:00`} />
            ))}
          </div>
          <div className="legend meta">grey: your shift · white: shared working hours</div>
        </div>
        {card.upcomingHolidays.length ? (
          <div className="meta">Upcoming where they are: {card.upcomingHolidays.map((h) => `${h.name} (${fmtDate(h.date)})`).join(" · ")}</div>
        ) : null}
      </div>
    </div>
  );
}

export default function Board({ onHome, onSignOut }: { onHome: () => void; onSignOut: () => void }) {
  const board = useBoard();
  const sendMyDigestNow = useSendMyDigestNow();
  const { isLoading } = useConvexAuth();
  const [tick, setTick] = useState(Date.now());
  const [open, setOpen] = useState<string | null>(null);
  const [digestMsg, setDigestMsg] = useState<string | null>(null);
  const [theme, setTheme] = useState(currentThemeSafe());

  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  function currentThemeSafe(): "dark" | "light" {
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  }

  if (isLoading || board === undefined) {
    return <div className="board"><p className="meta mono">[connecting to convex…]</p></div>;
  }

  const viewer = board.cards.find((c) => c.isViewer);
  const offToday = board.cards.filter((c) => c.status.kind !== "around").length;
  const aroundNow = board.cards.length - offToday;
  const sorted = [...board.cards].sort((a, b) => Number(b.isViewer) - Number(a.isViewer));
  const openCard = board.cards.find((c) => c._id === open);

  const sendDigest = () => {
    sendMyDigestNow({})
      .then((m) => { setDigestMsg(`${m} — from heidi-hr@agentmail.to`); setTimeout(() => setDigestMsg(null), 6000); })
      .catch((e) => setDigestMsg(String(e).slice(0, 100)));
  };

  return (
    <div className="board">
      <header className="board-head">
        <button className="brandlink" onClick={onHome}>Whereabouts</button>
        <span className="date">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
        <span className="stat"><b className="ok">{aroundNow} of {board.cards.length} around</b> · <b className="warn">{offToday} off today</b></span>
        <button className="btn small" onClick={() => { toggleThemeSafe(); setTheme(currentThemeSafe()); }}>
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <button className="btn small" onClick={sendDigest}>Send my digest now (demo)</button>
        <button className="btn small" onClick={onSignOut}>Sign out</button>
        {digestMsg && <span className="flash">{digestMsg}</span>}
      </header>

      {board.upcoming.length > 0 && (
        <div className="holiday-banner">
          <span className="lead">● Upcoming</span>
          {board.upcoming.map((h) => (
            <span key={h.region + h.date} className="hol">
              {h.name} · {fmtDate(h.date)} <em>({regionLabel(h.region)})</em>
            </span>
          ))}
        </div>
      )}

      {viewer ? (
        <>
          <YourRow viewer={viewer} />
          <PasteBox viewer={viewer} />
          {board.viewerHasTeam ? <AddTeammate /> : null}
        </>
      ) : board.viewerHasTeam ? (
        <AddTeammate />
      ) : (
        <TeamSetup onDone={() => {}} />
      )}

      <div className="grid">
        {sorted.map((c) => (
          <PersonCard key={c._id} card={c} tick={tick} onOpen={() => setOpen(c._id)} />
        ))}
      </div>

      <footer className="board-foot">
        Live on Convex — every card is a subscription · OpenAI parses announcements · rate-limited per user · holidays seedable via Firecrawl
      </footer>

      {openCard && viewer && <WeekModal card={openCard} viewer={viewer} board={board} onClose={() => setOpen(null)} />}
    </div>
  );
}

function toggleThemeSafe() {
  const t = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("wb-theme", t); } catch { /* private mode */ }
}
