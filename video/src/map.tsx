// A flat dot-grid world in the app's colours, no borders. Land is coarse 5° latitude bands of longitude ranges,
// close enough for a stylised map. Longitudes run -10..340 so Europe, Asia and the Americas all sit on screen.
import { interpolate } from 'remotion';
import { evolvePath } from '@remotion/paths';
import { C } from './theme.ts';
import { clamp, DUR, ease, enter, MOTION_FPS, pop, smooth, useFrame } from './motion.ts';

// Top of each band: 80, 75, ... -55.
const LAND: [number, number][][] = [
  [[-120, -62], [-70, -18], [12, 28], [55, 62], [95, 110], [135, 150]],
  [[-168, -140], [-128, -62], [-60, -20], [18, 32], [58, 180]],
  [[-166, -140], [-140, -62], [-55, -22], [-24, -14], [12, 180]],
  [[-166, -138], [-138, -96], [-78, -64], [-50, -42], [-22, -14], [5, 30], [30, 142], [150, 166]],
  [[-160, -132], [-130, -96], [-78, -56], [-6, -2], [6, 30], [30, 140], [155, 164]],
  [[-130, -56], [-10, 2], [0, 140], [142, 145], [156, 160]],
  [[-125, -55], [-5, 140], [140, 146]],
  [[-124, -70], [-9, 3], [3, 28], [40, 48], [54, 132], [139, 142]],
  [[-122, -76], [-9, -1], [-2, 11], [15, 18], [20, 45], [45, 122], [126, 129], [132, 141]],
  [[-118, -80], [-10, 33], [35, 37], [38, 122], [129, 133]],
  [[-115, -97], [-83, -80], [-13, 34], [36, 50], [50, 90], [90, 122]],
  [[-112, -97], [-85, -74], [-17, 37], [39, 59], [68, 90], [92, 110]],
  [[-105, -88], [-74, -65], [-17, 41], [42, 52], [73, 86], [97, 109], [120, 126]],
  [[-92, -83], [-75, -60], [-17, 51], [74, 80], [98, 109], [122, 126]],
  [[-83, -52], [-13, 48], [80, 82], [99, 104], [104, 107], [122, 126]],
  [[-80, -50], [9, 42], [95, 105], [109, 119], [120, 125]],
  [[-81, -35], [9, 41], [100, 106], [110, 117], [120, 123], [131, 150]],
  [[-80, -35], [12, 40], [105, 115], [137, 150]],
  [[-77, -38], [13, 41], [47, 50], [130, 143]],
  [[-75, -39], [12, 36], [44, 50], [123, 146]],
  [[-70, -40], [14, 35], [44, 48], [114, 153]],
  [[-71, -48], [15, 33], [114, 153]],
  [[-72, -52], [18, 30], [115, 124], [135, 152]],
  [[-73, -57], [140, 150], [173, 178]],
  [[-73, -63], [145, 148], [168, 176]],
  [[-75, -66], [166, 171]],
  [[-74, -64]],
];
// Soft white on the near-black canvas, so the land reads clearly without competing with pins.
const LAND_DOT = 'rgba(255,255,255,.24)';
const TOP = 80, STEP = 2.5, LON0 = -10, LON1 = 340;
// The map fills 1920 wide: 350° of longitude, the same scale on both axes.
export const PX = 1920 / (LON1 - LON0), MAP_TOP = 40;
const wrap = (lon: number) => lon < LON0 ? lon + 360 : lon;
export const project = (lat: number, lon: number) => ({ x: (wrap(lon) - LON0) * PX, y: MAP_TOP + (TOP - lat) * PX });

const DOTS = (() => {
  const out: { x: number; y: number }[] = [];
  for (let lat = TOP - STEP / 2; lat > TOP - LAND.length * 5; lat -= STEP) {
    const band = LAND[Math.floor((TOP - lat) / 5)];
    for (let x = LON0 + STEP / 2; x < LON1; x += STEP) {
      const lon = x >= 180 ? x - 360 : x;
      if (band.some(([a, b]) => lon >= a && lon <= b)) out.push(project(lat, lon));
    }
  }
  return out;
})();

export const CITIES = {
  seoul: { lat: 37.5, lon: 127, name: 'Seoul', side: 'left' },
  tokyo: { lat: 35.7, lon: 139.7, name: 'Tokyo', side: 'right' },
  milan: { lat: 45.5, lon: 9.2, name: 'Milan', side: 'right' },
  mexico: { lat: 19.4, lon: -99.1, name: 'Mexico City' },
  lagos: { lat: 6.5, lon: 3.4, name: 'Lagos' },
  california: { lat: 36.8, lon: -119.4, name: 'California' },
} as const;
export type City = keyof typeof CITIES;
export const at = (city: City) => project(CITIES[city].lat, CITIES[city].lon);
export const SHOPS: City[] = ['seoul', 'tokyo', 'milan', 'mexico', 'lagos'];
export const FEES: Record<string, string> = { seoul: '+ shipping', tokyo: '+ duties', milan: 'checkout 3 of 5', mexico: '+ fees', lagos: "doesn't ship abroad" };

// An arc from a shop to the shopper, bowed upward so the five read as separate trips.
export function arc(from: City, to: City = 'california', bow = 0.28) {
  const a = at(from), b = at(to), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, d = Math.hypot(b.x - a.x, b.y - a.y);
  const c = { x: mx, y: my - d * bow };
  return { d: `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`, mid: { x: (a.x + 2 * c.x + b.x) / 4, y: (a.y + 2 * c.y + b.y) / 4 } };
}

// The camera on the map: a point to centre and a zoom. 1 shows the whole world.
export type MapView = { x: number; y: number; zoom: number };
export const WORLD: MapView = { x: 960, y: 420, zoom: 1 };
export const mapTransform = (v: MapView) => `translate(${960 - v.x * v.zoom} ${470 - v.y * v.zoom}) scale(${v.zoom})`;
// Where a map point lands on screen under a view.
export const onScreen = (v: MapView, p: { x: number; y: number }) => ({ x: 960 + (p.x - v.x) * v.zoom, y: 470 + (p.y - v.y) * v.zoom });
export const lerpView = (a: MapView, b: MapView, p: number): MapView => ({ x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, zoom: a.zoom * (b.zoom / a.zoom) ** p });

// Dots breathe very slightly, so a held map is never a still frame.
export function Land({ opacity = 1 }: { opacity?: number }) {
  const frame = useFrame();
  return <g opacity={opacity}>{DOTS.map((dot, i) => <circle key={i} cx={dot.x} cy={dot.y} r={2.6 + 0.35 * Math.sin(frame / 22 + dot.x / 90 + dot.y / 70)} fill={LAND_DOT} />)}</g>;
}

export function Pin({ city, from, color = C.accent, label, sub, pulse = false, scale = 1 }: { city: City; from: number; color?: string; label?: string; sub?: string; pulse?: boolean; scale?: number }) {
  const frame = useFrame(), fps = MOTION_FPS;
  const p = at(city), shown = pop(frame, fps, from);
  const where = (CITIES[city] as { side?: string }).side, side = where === 'left' ? -1 : where === 'right' ? 1 : 0;
  if (frame < from) return null;
  const ring = pulse ? ((frame - from) % 45) / 45 : 0;
  return <g transform={`translate(${p.x} ${p.y}) scale(${scale})`}>
    {pulse && <circle r={9 + 22 * ring} fill="none" stroke={color} strokeWidth={2} opacity={1 - ring} />}
    <circle r={9 * Math.min(1.2, shown)} fill={color} stroke={C.surface} strokeWidth={3} />
    {label && <text x={side ? side * 20 : 0} y={side ? 0 : -24} textAnchor={side ? (side > 0 ? 'start' : 'end') : 'middle'} fontSize={27} fontWeight={800} fill={C.ink} stroke={C.ground} strokeWidth={6} paintOrder="stroke" opacity={Math.min(1, shown)}>{label}</text>}
    {sub && <text x={side ? side * 20 : 0} y={side ? 26 : 40} textAnchor={side ? (side > 0 ? 'start' : 'end') : 'middle'} fontSize={21} fontWeight={700} fill={color === C.muted ? C.ink : color} stroke={C.ground} strokeWidth={5} paintOrder="stroke" opacity={Math.min(1, shown)}>{sub}</text>}
  </g>;
}

export function Arc({ from, at: start, dashed = true, color = C.ink, width = 3, fade = 1 }: { from: City; at: number; dashed?: boolean; color?: string; width?: number; fade?: number }) {
  const frame = useFrame();
  const { d } = arc(from);
  const p = ease(interpolate(frame, [start, start + DUR.camera], [0, 1], clamp));
  const draw = evolvePath(p, d);
  if (frame < start || fade <= 0) return null;
  // A dashed line is revealed by a mask, since the dash array is taken by the drawing.
  return dashed
    ? <g opacity={fade}><mask id={`m-${from}`}><path d={d} stroke="#fff" strokeWidth={width + 4} fill="none" strokeDasharray={draw.strokeDasharray} strokeDashoffset={draw.strokeDashoffset} /></mask><path d={d} stroke={color} strokeWidth={width} fill="none" strokeDasharray="8 9" mask={`url(#m-${from})`} /></g>
    : <path d={d} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeDasharray={draw.strokeDasharray} strokeDashoffset={draw.strokeDashoffset} opacity={fade} />;
}

// One box travelling the single arc from Seoul, as the five trips merge into one.
export function Parcel({ from, at: start, frames = 50 }: { from: City; at: number; frames?: number }) {
  const frame = useFrame(), fps = MOTION_FPS;
  if (frame < start) return null;
  const a = at(from), b = at('california'), d = Math.hypot(b.x - a.x, b.y - a.y);
  const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - d * 0.28 };
  const u = smooth((frame - start) / frames), q = 1 - u;
  const x = q * q * a.x + 2 * q * u * c.x + u * u * b.x, y = q * q * a.y + 2 * q * u * c.y + u * u * b.y;
  const s = enter(frame, fps, start, DUR.standard);
  return <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x={-17} y={-15} width={34} height={30} rx={5} fill={C.butter} stroke={C.ink} strokeWidth={2.5} />
    <path d="M -17 -4 H 17 M 0 -15 V -4" stroke={C.ink} strokeWidth={2.5} />
  </g>;
}
