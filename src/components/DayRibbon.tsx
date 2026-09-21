import { useEffect, useState } from "react";

type RibbonCard = {
  _id: string;
  name: string;
  city: string;
  tz: string;
  workStart: number;
  workEnd: number;
  kind: string;
  isViewer: boolean;
};

function localHourNow(tz: string, at: number): number {
  return (
    parseInt(
      new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: tz }).format(new Date(at)),
      10,
    ) % 24
  );
}

function inShift(start: number, end: number, h: number): boolean {
  if (start === end) return true;
  if (start < end) return h >= start && h < end;
  return h >= start || h < end; // overnight wrap
}

export default function DayRibbon({ cards }: { cards: RibbonCard[] }) {
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="dayribbon">
      <div className="dayribbon-scale">
        <span className="daylabel-name" />
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="ribbon-tick">{String(i * 3).padStart(2, "0")}</span>
        ))}
      </div>
      {cards.map((c) => {
        const now = localHourNow(c.tz, tick);
        const off = c.kind !== "around";
        return (
          <div key={c._id} className={`dayrow ${off ? "row-off" : ""} ${c.isViewer ? "row-viewer" : ""}`}>
            <span className="daylabel-name">
              <b>{c.name.split(" ")[0]}</b>
              <em>{c.city || c.tz.split("/").pop()}</em>
            </span>
            <div className="band">
              {Array.from({ length: 24 }, (_, h) => (
                <span
                  key={h}
                  className={`bcell ${inShift(c.workStart, c.workEnd, h) ? "work" : ""}`}
                />
              ))}
              <span className="nowdot" style={{ left: `calc(${(now / 24) * 100}% - 1px)` }} />
              <span className="nowpip" style={{ left: `calc(${(now / 24) * 100}% - 3.5px)` }} />
            </div>
          </div>
        );
      })}
      <p className="meta mono ribbon-note">green blocks: on shift (their local hours) · white line: where their now is · amber row: off or away today</p>
    </div>
  );
}
