import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  useBoard,
  useParseMessage,
  useSetStatus,
  useSendMyDigestNow,
  useUpdateMe,
  useImportHolidays,
  useRenameTeam,
  useRemoveTeammate,
} from "../lib/store";
import { AddTeammate, TeamSetup } from "./TeamSetup";
import ThemeToggle from "./ThemeToggle";
import WorldMap from "../components/WorldMap";
import DayRibbon from "../components/DayRibbon";
import GeocodeBox from "../components/GeocodeBox";
import type { Place } from "../components/GeocodeBox";

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

function PersonCard({ card, tick, onOpen, viewerTz }: { card: BoardCard; tick: number; onOpen: () => void; viewerTz?: string }) {
  const t = localTime(card.tz, tick);
  const myDate = localTime(viewerTz ?? card.tz, tick).date;
  const quiet = isOffShift(card.workStart, card.workEnd, t.h);
  const nightShift = card.workStart >= 18 || card.workStart < 7;

  return (
    <button className={`card ${quiet ? "quiet" : ""} ${card.isViewer ? "viewer" : ""}`} onClick={onOpen}>
      <div className="card-top">
        <img className="avatar-img" src={card.avatarDataUrl ?? avatarUrl(card.avatarSeed ?? card.name)} alt="" loading="lazy" />
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
        <span className={`card-date${t.date !== myDate ? " diff" : ""}`}>{t.date}</span>
      </div>
      {card.holidayToday ? (
        <div className="planned"><span className="dot dot-neutral" />{card.holidayToday.name}</div>
      ) : card.status.kind !== "around" && card.status.note ? (
        <div className="planned"><span className="dot dot-warning" />{card.status.kind} · {card.status.note}</div>
      ) : null}
      {card.plannedStatus && (
        <div className="planned">
          <span className="dot dot-warning" />
          {card.plannedStatus.kind === "away" ? "away" : "off"} {fmtDate(card.plannedStatus.from)}
          {card.plannedStatus.to !== card.plannedStatus.from ? ` → ${fmtDate(card.plannedStatus.to)}` : ""}
          {card.plannedStatus.note ? ` · ${card.plannedStatus.note}` : ""}
        </div>
      )}
      <span className="card-peek">week view ↗</span>
    </button>
  );
}

function CalendarPop({ pick, close }: { pick: (isoDate: string) => void; close: () => void }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const first = new Date(month.y, month.m, 1);
  const startDow = (first.getDay() + 6) % 7; // Monday-first
  const days = new Date(month.y, month.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const todayIso = iso(0);
  const nav = (dir: number) =>
    setMonth((m) => {
      const d = new Date(m.y, m.m + dir, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  return (
    <>
      <div className="cal-overlay" onClick={close} />
      <div className="calpop">
        <div className="cal-head">
          <button className="cal-nav" onClick={() => nav(-1)} aria-label="Previous month">‹</button>
          <span>{first.toLocaleString("en-GB", { month: "long", year: "numeric" })}</span>
          <button className="cal-nav" onClick={() => nav(1)} aria-label="Next month">›</button>
        </div>
        <div className="cal-grid">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} className="cal-dow">{d}</span>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <span key={`e${i}`} />;
            const is = `${month.y}-${String(month.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            return (
              <button
                key={is}
                className={`cal-day ${is === todayIso ? "today" : ""}`}
                disabled={is < todayIso}
                onClick={() => pick(is)}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function HolidayImport() {
  const importRegion = useImportHolidays();
  const [open, setOpen] = useState(false);
  const [region, setRegion] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const go = () => {
    if (!region.trim()) return;
    setBusy(true); setMsg(null);
    importRegion({ region: region.trim() })
      .then((r) => { setMsg(`Firecrawl pulled ${r.added} new holidays for ${r.country}${r.skipped ? `, ${r.skipped} already on the board` : ""}.`); })
      .catch((e) => setMsg(String(e).replace(/^Error: /, "").replace(/^ConvexError: /, "").slice(0, 140)))
      .finally(() => setBusy(false));
  };
  return (
    <span className="holimport">
      <button className="linkbtn" onClick={() => setOpen((o) => !o)}>+ import via firecrawl</button>
      {open && (
        <>
          <div className="cal-overlay" onClick={() => setOpen(false)} />
          <div className="calpop holpop">
            <span className="label">country or region code</span>
            <div className="pastebox-row">
              <input
                placeholder="e.g. IN, US, DE, PH, BR"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") go(); }}
              />
              <button className="btn primary" disabled={busy || !region.trim()} onClick={go}>{busy ? "Crawling…" : "Import"}</button>
            </div>
            {msg && <p className="meta mono">{msg}</p>}
            <p className="meta">firecrawl reads timeanddate.com · lands on everyone's board live</p>
          </div>
        </>
      )}
    </span>
  );
}

function TeamBox({ board }: { board: Board }) {
  const renameTeam = useRenameTeam();
  const removeTeammate = useRemoveTeammate();
  const [name, setName] = useState(board.teamName);
  const [saved, setSaved] = useState(false);
  const others = board.cards.filter((c) => !c.isViewer);
  return (
    <div className="teambox">
      <div className="pastebox-row">
        <span className="label" style={{ alignSelf: "center" }}>team</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <button
          className="btn small"
          disabled={!name.trim() || name === board.teamName}
          onClick={() => renameTeam({ name }).then(() => { setSaved(true); setTimeout(() => setSaved(false), 2500); })}
        >
          Rename
        </button>
        {saved && <span className="flash">renamed</span>}
      </div>
      {others.length > 0 && (
        <div className="team-list">
          {others.map((c) => (
            <span key={c._id} className="team-member">
              <img className="avatar-img" src={c.avatarDataUrl ?? avatarUrl(c.avatarSeed ?? c.name)} alt="" />
              <span>{c.name.split(" ")[0]}</span>
              <button className="linkbtn" title="remove from team" onClick={() => removeTeammate({ personId: c._id })}>remove</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const AVATAR_PRESETS = ["Ava", "Bolt", "Cleo", "Dune", "Echo", "Fern", "Gale", "Hero", "Indigo", "Juno", "Kite", "Lumen"];

function ProfileModal({ viewer, onClose }: { viewer: BoardCard; onClose: () => void }) {
  const updateMe = useUpdateMe();
  const [name, setName] = useState(viewer.name);
  const [seed, setSeed] = useState(viewer.avatarSeed ?? viewer.name);
  const [place, setPlace] = useState<Place | null>(null);
  const [ws, setWs] = useState(String(viewer.workStart));
  const [we, setWe] = useState(String(viewer.workEnd));
  const [upload, setUpload] = useState<string | null>(viewer.avatarDataUrl ?? null);
  const [busy, setBusy] = useState(false);

  const save = () => {
    setBusy(true);
    updateMe({
      name: name.trim() || undefined,
      avatarSeed: seed,
      avatarDataUrl: upload ?? undefined,
      city: place?.city,
      tz: place?.tz,
      region: place?.region,
      lat: place?.lat,
      lng: place?.lng,
      workStart: parseInt(ws, 10) || undefined,
      workEnd: parseInt(we, 10) || undefined,
    })
      .then(onClose)
      .catch(() => setBusy(false));
  };

  const onFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 4_000_000) return;
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const cv = document.createElement("canvas");
      cv.width = 128; cv.height = 128;
      cv.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 128, 128);
      setUpload(cv.toDataURL("image/png"));
    };
    img.src = URL.createObjectURL(f);
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <strong>Edit profile</strong>
            <span className="meta">face, name, city, timezone, shift</span>
          </div>
          <button className="btn small" onClick={onClose}>Close</button>
        </div>
        <div className="profile-upload">
          {upload && <img className="avatar-img big" src={upload} alt="" />}
          <div className="profile-upload-btns">
            <label className="btn small upload-btn">
              upload your own
              <input type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
            </label>
            {upload && <button className="linkbtn" onClick={() => setUpload(null)}>remove upload</button>}
          </div>
        </div>
        <div className="avatar-grid">
          {AVATAR_PRESETS.map((p) => (
            <button
              key={p}
              className={`avatar-pick ${!upload && seed === p ? "picked" : ""}`}
              onClick={() => { setUpload(null); setSeed(p); }}
              aria-label={`avatar ${p}`}
            >
              <img className="avatar-img" src={avatarUrl(p)} alt="" />
            </button>
          ))}
        </div>
        <div className="profile-fields">
          <div className="profile-name">
            <span className="label">your name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="profile-name">
            <span className="label">city (timezone, map pin and holidays update with it)</span>
            <GeocodeBox initial={viewer.city} onPick={setPlace} />
          </div>
          <div className="profile-name shiftfield">
            <span className="label">shift (local hours)</span>
            <span className="shiftrow">
              <input value={ws} onChange={(e) => setWs(e.target.value)} inputMode="numeric" />
              –
              <input value={we} onChange={(e) => setWe(e.target.value)} inputMode="numeric" />
            </span>
          </div>
        </div>
        <button className="btn primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}

function YourRow({ viewer }: { viewer: BoardCard }) {
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [rangeFrom, setRangeFrom] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const setStatus = useSetStatus();

  const apply = (kind: StatusKind, from = iso(0), to?: string) => {
    setStatus({
      kind,
      from,
      to: kind === "around" ? from : (to ?? from),
      note: note || undefined,
      source: "tap",
    }).then(() => {
      setSent(
        kind === "around"
          ? "You're around."
          : kind === "off"
            ? "Marked off for today. Everyone's board just updated."
            : from === iso(0)
              ? `Marked away till ${fmtDate(to ?? from)}. Everyone's board just updated.`
              : `Marked away ${fmtDate(from)} → ${fmtDate(to ?? from)}. Everyone sees it coming.`,
      );
      setNote("");
      setTimeout(() => setSent(null), 5000);
    }).catch((e) => setSent(String(e).slice(0, 80)));
  };

  // Two taps book a range: first day, then last day (same day twice = one day).
  const pickRange = (d: string) => {
    if (!rangeFrom) { setRangeFrom(d); return; }
    const [a, b] = rangeFrom <= d ? [rangeFrom, d] : [d, rangeFrom];
    setRangeFrom(null);
    setCalOpen(false);
    apply("away", a, b);
  };

  const chip =
    viewer.status.kind === "around" ? (
      <span className="tag tag-ok"><span className="dot dot-success" /> you're around</span>
    ) : viewer.status.kind === "off" ? (
      <span className="tag"><span className="dot dot-warning" /> off today{viewer.status.note ? ` · ${viewer.status.note}` : ""}</span>
    ) : (
      <span className="tag"><span className="dot dot-warning" /> away till {fmtDate(viewer.status.to)}{viewer.status.note ? ` · ${viewer.status.note}` : ""}</span>
    );

  return (
    <div className="yourrow">
      <img className="avatar-img yourrow-avatar" src={viewer.avatarDataUrl ?? avatarUrl(viewer.avatarSeed ?? viewer.name)} alt="" />
      <div className="yourrow-left">
        <strong>
          {viewer.name}{" "}
          <button className="linkbtn" onClick={() => setEditOpen(true)}>edit profile</button>
        </strong>
        {chip}
      </div>
      <div className="yourrow-actions">
        <button className={`btn ${viewer.status.kind === "around" ? "primary" : ""}`} onClick={() => apply("around")}>Around</button>
        <button className={`btn ${viewer.status.kind === "off" ? "primary" : ""}`} onClick={() => apply("off")}>Off today</button>
        <span className="awaywrap">
          <button className={`btn ${viewer.status.kind === "away" ? "primary" : ""}`} onClick={() => { setRangeFrom(null); setCalOpen((o) => !o); }}>Book away…</button>
          {calOpen && (
            <>
              {rangeFrom && (
                <span className="range-hint mono">away from {fmtDate(rangeFrom)} · pick the last day</span>
              )}
              <CalendarPop
                pick={pickRange}
                close={() => { setCalOpen(false); setRangeFrom(null); }}
              />
            </>
          )}
        </span>
        <input
          className="note"
          placeholder="note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {sent && <span className="flash">{sent}</span>}
      {editOpen && <ProfileModal viewer={viewer} onClose={() => setEditOpen(false)} />}
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
  const [applied, setApplied] = useState(false);

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
      setApplied(true);
      setTimeout(() => setApplied(false), 4000);
    }).catch((e) => setError(String(e).slice(0, 140)));
  };

  return (
    <div className="pastebox">
      <div className="pastebox-head">
        <strong>Already told your team you're off? Paste it here</strong>
        <span className="meta">paste the message you already sent anywhere · gpt-4o-mini reads it and updates your board · applies to you ({viewer.name})</span>
      </div>
      <div className="pastebox-row">
        <textarea
          placeholder='e.g. "out thursday and friday, family thing" or "back monday"'
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!busy) run(); }
            else if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && result && !busy) { e.preventDefault(); apply(); }
          }}
          rows={1}
        />
        <button className="btn primary" onClick={run} disabled={busy}>
          {busy ? "Reading…" : "Parse"}
        </button>
      </div>
      {result && (
        <div className="parse-result">
          <span className={`mode ${result.mode}`}>
            {result.mode === "openai" ? "[read by gpt-4o-mini]" : "[demo parser · add openai key]"}
          </span>
          {result.debug && <span className="debug">{result.debug}</span>}
          <code>
            {KIND_LABEL[result.parsed.kind]} {fmtDate(result.parsed.from)}
            {result.parsed.to !== result.parsed.from ? ` → ${fmtDate(result.parsed.to)}` : ""}
            {result.parsed.note ? ` · "${result.parsed.note}"` : ""}
          </code>
          <button className="btn small" onClick={apply}>Apply to board</button>
        </div>
      )}
      {applied && <div className="flash">On the board. Everyone on the team sees it now.</div>}
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
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

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
      : "no clean overlap · async it";
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
              <div key={d} className={`daycell ${s.cls} ${isToday ? "today" : ""}`} title={isToday ? `Today: ${s.title}` : s.title}>
                <span className="daylabel">{fmtDate(d)}{isToday ? " · today" : ""}</span>
                <span className="daydot" />
              </div>
            );
          })}
        </div>
        <div className="overlap">
          <div className="overlap-head">
            <strong>Working-hours overlap</strong>
            <span className={`callwin ${overlap.cells.some((c) => c.both) ? "" : "none"}`}>
              best call window: {overlap.label}
            </span>
          </div>
          <div className="shift-readout">
            you {String(viewer.workStart).padStart(2, "0")}–{String(viewer.workEnd).padStart(2, "0")}
            {" · "}
            {card.name.split(" ")[0]} {String(card.workStart).padStart(2, "0")}–{String(card.workEnd).padStart(2, "0")}
            {" · "}times below are yours
          </div>
          <div className="hours">
            {overlap.cells.map((c, i) => (
              <span key={i} className={`hcell ${inShift(viewer.workStart, viewer.workEnd, c.viewerH) ? "mine" : ""} ${c.both ? "both" : ""}`} title={`you ${c.viewerH}:00 · them ${c.theirH}:00`} />
            ))}
          </div>
          <div className="hours-axis">
            {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
              <span key={h} className="haxis">{String(h).padStart(2, "0")}</span>
            ))}
          </div>
          <div className="legend meta">
            <span className="swatch mine" /> your shift
            <span className="swatch both" /> shared · good to ping
          </div>
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
  const [view, setView] = useState<"wall" | "map" | "day">("wall");
  const snapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

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
      .then((m) => { setDigestMsg(`${m} From Heidi.`); setTimeout(() => setDigestMsg(null), 6000); })
      .catch((e) => setDigestMsg(String(e).slice(0, 100)));
  };

  return (
    <div className="board">
      <header className="board-head">
        <button className="brandlink" onClick={onHome}>Whereabouts</button>
        <span className="date">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
        <div className="head-right">
          {board.cards.length > 0 && (
            <span className="stat"><b className="ok">{aroundNow} of {board.cards.length} around</b> · <b className="warn">{offToday} off today</b></span>
          )}
          <ThemeToggle onToggle={toggleThemeSafe} />
          <button className="btn small" onClick={sendDigest}>Send digest</button>
          <button className="btn small" onClick={onSignOut}>Sign out</button>
          {digestMsg && <span className="flash">{digestMsg}</span>}
        </div>
      </header>

      <div className="holiday-banner">
        {board.upcoming.length > 0 ? (
          <>
            <span className="lead">● Upcoming</span>
            {board.upcoming.map((h) => (
              <span key={h.region + h.date} className="hol">
                {h.name} · {fmtDate(h.date)} <em>({regionLabel(h.region)})</em>
              </span>
            ))}
          </>
        ) : (
          <span className="lead">● No holidays loaded yet</span>
        )}
        {viewer && <HolidayImport />}
      </div>

      {viewer ? (
        <>
          <YourRow viewer={viewer} />
          <PasteBox viewer={viewer} />
          {board.viewerHasTeam ? (
            <>
              <TeamBox board={board} />
              <AddTeammate />
            </>
          ) : null}
        </>
      ) : board.viewerHasTeam ? (
        <AddTeammate />
      ) : (
        <TeamSetup onDone={() => {}} />
      )}

      <div className="viewbar">
        {([["wall", "Wall clock"], ["map", "Atlas"], ["day", "24 hours"]] as const).map(([k, label], i) => (
          <button
            key={k}
            className={`pillbtn ${view === k ? "on" : ""}`}
            onClick={() => {
              setView(k);
              const el = snapRef.current;
              if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        className="viewsnap"
        ref={snapRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          const k = (["wall", "map", "day"] as const)[i];
          if (k && k !== view) setView(k);
        }}
      >
        <section className="viewpane">
          <div className="grid">
            {sorted.map((c) => (
              <PersonCard key={c._id} card={c} tick={tick} viewerTz={viewer?.tz} onOpen={() => setOpen(c._id)} />
            ))}
          </div>
        </section>
        <section className="viewpane">
          <WorldMap cards={board.cards.map((c) => ({ name: c.name, city: c.city, tz: c.tz, kind: c.status.kind, lat: c.lat, lng: c.lng }))} />
        </section>
        <section className="viewpane">
          <DayRibbon cards={board.cards.map((c) => ({ _id: c._id, name: c.name, city: c.city, tz: c.tz, workStart: c.workStart, workEnd: c.workEnd, kind: c.status.kind, isViewer: c.isViewer }))} />
        </section>
      </div>

      <footer className="board-foot">
        Live on Convex · every card is a subscription · OpenAI parses announcements · rate-limited per user · holidays seedable via Firecrawl
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
