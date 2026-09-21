import { useEffect, useRef, useState } from "react";

export type Place = {
  city: string;
  admin: string;
  country: string;
  region: string; // ISO country code for holidays
  tz: string;
  lat: number;
  lng: number;
};

// Open-Meteo geocoding: free, keyless. One call returns the city, its IANA
// timezone, coordinates and country — everything a teammate pin needs.
export default function GeocodeBox({
  initial = "",
  onPick,
  label = "city",
}: {
  initial?: string;
  onPick: (p: Place) => void;
  label?: string;
}) {
  const [q, setQ] = useState(initial);
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); return; }
    timer.current = window.setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=6&language=en&format=json`,
        );
        const data: any = await res.json();
        const places: Place[] = (data?.results ?? []).map((r: any) => ({
          city: r.name,
          admin: r.admin1 ?? "",
          country: r.country ?? "",
          region: r.country_code ?? "",
          tz: r.timezone ?? "UTC",
          lat: r.latitude,
          lng: r.longitude,
        }));
        setResults(places);
        setOpen(true);
      } catch { /* offline: keep the typed text as a plain city */ }
      setBusy(false);
    }, 350);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [q]);

  return (
    <div className="geocode">
      <input
        placeholder={`start typing a ${label}…`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => { if (results.length) setOpen(true); }}
        autoComplete="off"
      />
      {busy && <span className="meta mono gbusy">…</span>}
      {open && results.length > 0 && (
        <>
          <div className="cal-overlay" onClick={() => setOpen(false)} />
          <div className="geopop">
            {results.map((p, i) => (
              <button
                key={`${p.city}-${p.lat}-${i}`}
                className="geoopt"
                onClick={() => {
                  setQ(`${p.city}${p.admin ? `, ${p.admin}` : ""} · ${p.tz}`);
                  setOpen(false);
                  onPick(p);
                }}
              >
                <strong>{p.city}</strong>
                <span className="meta mono">{[p.admin, p.country, p.tz.split("/").pop()?.replace("_", " ")].filter(Boolean).join(" · ")}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
