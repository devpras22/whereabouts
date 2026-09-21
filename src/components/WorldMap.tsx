import { useEffect, useRef, useState } from "react";

type MapCard = { name: string; city: string; tz: string; kind: string };

const W = 1440;
const H = 720;

const CITY_COORDS: Record<string, [number, number]> = {
  pune: [18.52, 73.86],
  bhopal: [23.26, 77.41],
  bengaluru: [12.97, 77.59],
  austin: [30.27, -97.74],
  london: [51.51, -0.13],
  berlin: [52.52, 13.4],
  manila: [14.6, 120.98],
  "são paulo": [-23.55, -46.63],
  "sao paulo": [-23.55, -46.63],
  lisbon: [38.72, -9.14],
  dubai: [25.2, 55.27],
  singapore: [1.35, 103.82],
  sydney: [-33.87, 151.21],
  "new york": [40.71, -74.01],
  chicago: [41.88, -87.63],
  denver: [39.74, -104.99],
  "los angeles": [34.05, -118.24],
};

const TZ_COORDS: Record<string, [number, number]> = {
  "Asia/Kolkata": [22, 79],
  "Asia/Manila": [14.6, 120.98],
  "Asia/Singapore": [1.35, 103.82],
  "Asia/Dubai": [25.2, 55.27],
  "Europe/London": [51.51, -0.13],
  "Europe/Berlin": [52.52, 13.4],
  "Europe/Lisbon": [38.72, -9.14],
  "America/New_York": [40.71, -74.01],
  "America/Chicago": [41.88, -87.63],
  "America/Denver": [39.74, -104.99],
  "America/Los_Angeles": [34.05, -118.24],
  "America/Sao_Paulo": [-23.55, -46.63],
  "Australia/Sydney": [-33.87, 151.21],
};

function coordsFor(city: string, tz: string): [number, number] | null {
  return CITY_COORDS[city.trim().toLowerCase()] ?? TZ_COORDS[tz] ?? null;
}

// Subsolar point right now: where the sun is directly overhead.
function sunPos(d: Date): [number, number] {
  const utcH = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const lon = (12 - utcH) * 15;
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const day = (d.getTime() - start) / 86_400_000;
  const decl = 23.44 * Math.sin((2 * Math.PI * (day - 81)) / 365);
  return [lon, decl];
}

function isDay(lon: number, lat: number, sun: [number, number]): boolean {
  const r = Math.PI / 180;
  const cosZ =
    Math.sin(lat * r) * Math.sin(sun[1] * r) +
    Math.cos(lat * r) * Math.cos(sun[1] * r) * Math.cos((lon - sun[0]) * r);
  return cosZ > 0;
}

function localHour(tz: string, d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(d);
}

// Fetch world-atlas TopoJSON, rasterize land to a dot grid (lon/lat pairs).
async function loadLandDots(): Promise<[number, number][] | null> {
  try {
    const res = await fetch("https://unpkg.com/world-atlas@2/countries-110m.json");
    if (!res.ok) return null;
    const topo = await res.json();
    const t = topo.transform;
    // TopoJSON deltas accumulate ACROSS arcs — the accumulator must live
    // outside the map or every country after the first shifts position.
    let ax = 0, ay = 0;
    const arcs: number[][][] = topo.arcs.map((arc: number[][]) =>
      arc.map(([dx, dy]: number[]) => {
        ax += dx; ay += dy;
        return [t.translate[0] + ax * t.scale[0], t.translate[1] + ay * t.scale[1]];
      }),
    );
    const ringPoints = (idxs: number[]): number[][] =>
      idxs.flatMap((i) => (i < 0 ? [...arcs[~i]].reverse() : arcs[i]));

    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const c = cv.getContext("2d")!;
    c.fillStyle = "#fff";
    for (const g of topo.objects.countries.geometries) {
      const polys: number[][][] = g.type === "Polygon" ? [g.arcs] : g.type === "MultiPolygon" ? g.arcs : [];
      for (const rings of polys) {
        c.beginPath();
        for (const r of rings) {
          const pts = ringPoints(r);
          pts.forEach(([lon, lat], i) => {
            const x = ((lon + 180) / 360) * W;
            const y = ((90 - lat) / 180) * H;
            if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
          });
          c.closePath();
        }
        c.fill("evenodd");
      }
    }
    const img = c.getImageData(0, 0, W, H).data;
    const dots: [number, number][] = [];
    const step = 3; // degrees per dot
    for (let lat = -84; lat <= 84; lat += step) {
      for (let lon = -180; lon < 180; lon += step) {
        const x = Math.floor(((lon + 180) / 360) * W);
        const y = Math.floor(((90 - lat) / 180) * H);
        if (img[(y * W + x) * 4 + 3] > 120) dots.push([lon, lat]);
      }
    }
    return dots;
  } catch {
    return null;
  }
}

export default function WorldMap({ cards }: { cards: MapCard[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [land, setLand] = useState<[number, number][] | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    loadLandDots().then((d) => { if (alive) setLand(d); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const c = cv.getContext("2d")!;
    let raf = 0;
    const draw = () => {
      const now = new Date();
      const sun = sunPos(now);
      c.clearRect(0, 0, W, H);
      const px = (lon: number) => ((lon + 180) / 360) * W;
      const py = (lat: number) => ((90 - lat) / 180) * H;

      if (land) {
        for (const [lon, lat] of land) {
          c.fillStyle = isDay(lon, lat, sun) ? "#4A4A4A" : "#2B2B2B";
          c.fillRect(px(lon), py(lat), 2.8, 2.8);
        }
      } else if (land === null) {
        // fallback: graticule so the pins still have a world to sit on
        c.fillStyle = "#222222";
        for (let lat = -75; lat <= 75; lat += 15)
          for (let lon = -180; lon < 180; lon += 7.5) c.fillRect(px(lon), py(lat), 2, 2);
        for (let lon = -180; lon < 180; lon += 15)
          for (let lat = -90; lat < 90; lat += 4) c.fillRect(px(lon), py(lat), 2, 2);
      }

      const pins = cards
        .map((card, i) => ({ card, ll: coordsFor(card.city, card.tz), i }))
        .filter((p): p is { card: MapCard; ll: [number, number]; i: number } => p.ll !== null)
        .sort((a, b) => a.ll[0] - b.ll[0]);

      const t = now.getTime() / 1000;
      for (const { card, ll, i } of pins) {
        const [lon, lat] = ll;
        const x = px(lon), y = py(lat);
        const off = card.kind !== "around";
        const col = off ? "#D4A843" : "#4A9E5C";
        const pulse = 5 + 3.5 * Math.sin(t * 2 + i);
        c.beginPath();
        c.arc(x, y, pulse, 0, Math.PI * 2);
        c.strokeStyle = off ? "rgba(212,168,67,0.45)" : "rgba(74,158,92,0.45)";
        c.lineWidth = 1.6;
        c.stroke();
        c.beginPath();
        c.arc(x, y, 4, 0, Math.PI * 2);
        c.fillStyle = col;
        c.fill();
        c.strokeStyle = "#FFFFFF";
        c.lineWidth = 1.2;
        c.stroke();

        const label = `${card.name.split(" ")[0]} ${localHour(card.tz, now)}`;
        c.font = "600 15px 'Space Mono', monospace";
        const wLabel = c.measureText(label).width;
        const offsets = [-16, 16, -32, 32];
        const ly = y + offsets[i % 4];
        c.fillStyle = "rgba(0,0,0,0.55)";
        c.fillRect(x - wLabel / 2 - 5, ly - 12, wLabel + 10, 17);
        c.fillStyle = off ? "#EBD28A" : "#C9E8CF";
        c.textAlign = "center";
        c.fillText(label, x, ly);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [cards, land]);

  return (
    <div className="atlas">
      <canvas ref={canvasRef} width={W} height={H} className="atlas-canvas" />
      <p className="meta mono atlas-note">
        {land === undefined
          ? "loading atlas…"
          : land === null
            ? "atlas data unavailable · pins only"
            : "lit dots: daytime there · dark dots: night · green pin: around · amber pin: off"}
      </p>
    </div>
  );
}
