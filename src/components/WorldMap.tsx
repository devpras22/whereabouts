import { useEffect, useRef, useState } from "react";

type MapCard = { name: string; city: string; tz: string; kind: string; lat: number | null; lng: number | null };

const W = 1440;
const H = 760;
const LAT_TOP = 78; // inhabited-world crop: no empty polar bands
const LAT_BOTTOM = -56;

// All entries are [lng, lat] — the same order coordsFor returns and the
// draw loop consumes. (They were [lat, lng] once; every demo pin rendered
// transposed, a continent away. Never again without the numeric check.)
const CITY_COORDS: Record<string, [number, number]> = {
  pune: [73.86, 18.52],
  bhopal: [77.41, 23.26],
  bengaluru: [77.59, 12.97],
  austin: [-97.74, 30.27],
  london: [-0.13, 51.51],
  berlin: [13.4, 52.52],
  manila: [120.98, 14.6],
  "são paulo": [-46.63, -23.55],
  "sao paulo": [-46.63, -23.55],
  lisbon: [-9.14, 38.72],
  dubai: [55.27, 25.2],
  singapore: [103.82, 1.35],
  sydney: [151.21, -33.87],
  "new york": [-74.01, 40.71],
  chicago: [-87.63, 41.88],
  denver: [-104.99, 39.74],
  "los angeles": [-118.24, 34.05],
};

const TZ_COORDS: Record<string, [number, number]> = {
  "Asia/Kolkata": [79, 22],
  "Asia/Manila": [120.98, 14.6],
  "Asia/Singapore": [103.82, 1.35],
  "Asia/Dubai": [55.27, 25.2],
  "Europe/London": [-0.13, 51.51],
  "Europe/Berlin": [13.4, 52.52],
  "Europe/Lisbon": [-9.14, 38.72],
  "America/New_York": [-74.01, 40.71],
  "America/Chicago": [-87.63, 41.88],
  "America/Denver": [-104.99, 39.74],
  "America/Los_Angeles": [-118.24, 34.05],
  "America/Sao_Paulo": [-46.63, -23.55],
  "Australia/Sydney": [151.21, -33.87],
};

function coordsFor(card: MapCard): [number, number] | null {
  // Exact geocoded pin wins; approximations only as fallbacks.
  if (card.lat != null && card.lng != null) return [card.lng, card.lat];
  const c = CITY_COORDS[card.city.trim().toLowerCase()];
  if (c) return c;
  return TZ_COORDS[card.tz] ?? null;
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
    // Deltas reset per arc (verified empirically: India decodes to
    // lon 68..97, lat 8..35 with per-arc reset, garbage otherwise).
    const arcs: number[][][] = topo.arcs.map((arc: number[][]) => {
      let x = 0, y = 0;
      return arc.map(([dx, dy]: number[]) => {
        x += dx; y += dy;
        return [t.translate[0] + x * t.scale[0], t.translate[1] + y * t.scale[1]];
      });
    });
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
            const y = ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * H;
            if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
          });
          c.closePath();
        }
        c.fill("evenodd");
      }
    }
    const py0 = (lat: number) => ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * H;
    const img = c.getImageData(0, 0, W, H).data;
    const dots: [number, number][] = [];
    const step = 3; // degrees per dot
    for (let lat = LAT_BOTTOM; lat <= LAT_TOP; lat += step) {
      for (let lon = -180; lon < 180; lon += step) {
        const x = Math.floor(((lon + 180) / 360) * W);
        const y = Math.floor(py0(lat));
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
      const py = (lat: number) => ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * H;

      if (land) {
        const lightMode = document.documentElement.dataset.theme === "light";
        const dayCol = lightMode ? "#CDCDCD" : "#4A4A4A";
        const nightCol = lightMode ? "#8E8E8E" : "#2B2B2B";
        for (const [lon, lat] of land) {
          c.fillStyle = isDay(lon, lat, sun) ? dayCol : nightCol;
          c.fillRect(px(lon), py(lat), 2.8, 2.8);
        }
      } else if (land === null) {
        // fallback: graticule so the pins still have a world to sit on
        c.fillStyle = "#222222";
        for (let lat = LAT_BOTTOM; lat <= LAT_TOP; lat += 12)
          for (let lon = -180; lon < 180; lon += 7.5) c.fillRect(px(lon), py(lat), 2, 2);
        for (let lon = -180; lon < 180; lon += 15)
          for (let lat = LAT_BOTTOM; lat < LAT_TOP; lat += 4) c.fillRect(px(lon), py(lat), 2, 2);
      }

      const pins = cards
        .map((card, i) => ({ card, ll: coordsFor(card), i }))
        .filter((p): p is { card: MapCard; ll: [number, number]; i: number } => p.ll !== null)
        .sort((a, b) => a.ll[0] - b.ll[0]);

      // Place labels right of each pin, nudged DOWN past any label already
      // placed there, with a leader line back to the pin — the label can
      // never read as a different location than the pin.
      c.font = "600 15px 'Space Mono', monospace";
      const placed: { x1: number; x2: number; y: number }[] = [];
      const t = now.getTime() / 1000;
      pins.forEach(({ card, ll, i }) => {
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
        const wLabel = c.measureText(label).width;
        let lx = x + 14;
        let ly = y - 8;
        if (lx + wLabel + 8 > W) { lx = x - 14 - wLabel - 8; ly = y - 8; }
        let guard = 0;
        while (placed.some((p) => lx < p.x2 + 8 && lx + wLabel + 8 > p.x1 && Math.abs(ly - p.y) < 19) && guard++ < 12) {
          ly += 19;
        }
        placed.push({ x1: lx - 6, x2: lx + wLabel + 6, y: ly });

        // leader line from pin to label
        c.beginPath();
        c.moveTo(x + 5, y - 3);
        c.lineTo(lx - 6, ly - 5);
        c.strokeStyle = off ? "rgba(212,168,67,0.5)" : "rgba(74,158,92,0.5)";
        c.lineWidth = 1;
        c.stroke();

        c.fillStyle = "rgba(0,0,0,0.6)";
        c.fillRect(lx - 6, ly - 12, wLabel + 12, 17);
        c.fillStyle = off ? "#EBD28A" : "#C9E8CF";
        c.textAlign = "left";
        c.fillText(label, lx, ly);
      });

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
