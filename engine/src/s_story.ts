// "The Dancing Plague" (Strasbourg 1518): shot list, camera keys and lens, timed to the approved voice
// (voice_final.wav, 71.9 s). Built on the MIT engine (camera grammar from story.ts).
import { D0 } from "./story";
export { D0 };
export const FPS = 30;
export const TOTAL = 2180;
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export type Light = "day" | "golden" | "night";

// ---------------- places ----------------
export const STAGE = { x0: -5, x1: 5, z0: 11.5, z1: 16.5, h: 1.2 };
export const DOOR: V3 = [-50, D0, -5.0];          // Frau Troffea's front door (south side of her street)
export const HALL_X = 28;                          // town hall front (faces -x), steps in front of it
export const SHRINE_POST: V3 = [-72, D0, 4.1];     // wayside shrine of St Vitus (north side of the street)
export const CHAPEL: V3 = [150, D0, -172];         // St Vitus chapel outside the city (front faces +z)
export const SIGN: V3 = [7.2, D0, 8.6];            // the council's "no music" board on the square
export const DOC: V3 = [24.1, D0, -2.9];           // the doctor with the flask (shots 16-18)
/** flask insert (shot 17b): the camera sits low-left of the doctor, the big flask floats at his raised hand */
export const FLASK_CAM: V3 = [22.55, D0 + 1.86, -4.05];
export const FLASK: V3 = [23.72, D0 + 1.98, -2.82];
/** interiors live 200 m under the town (nothing of the city can reach their shots): the hungry family's room, the council chamber */
export const RY = D0 - 200;
export const HOME: V3 = [0, RY, 0];
export const HALL: V3 = [60, RY, 0];
export const HALL_DOOR: V3 = [HALL[0] - 4.5, RY, HALL[2] + 0.9]; // left wall, the doctors come in here
export const HDOC: V3 = [HALL[0] - 0.85, RY, HALL[2] + 0.2];      // where the doctor holds up the flask (shots 17-18)
export const HFLASK: V3 = [HALL[0] - 0.87, RY + 1.98, HALL[2] + 0.66]; // the flask insert, just in front of his face
export const HFLASK_CAM: V3 = [HALL[0] - 0.8, RY + 1.97, HALL[2] + 2.05];

// ---------------- shots ----------------
export type ShotDef = { id: number; a: number; b: number; light: Light };
const L: [number, Light][] = [
  [0, "day"],      // 1 hook: band on the stage, exhausted dancers
  [146, "day"],    // 2 "You see, in Strasbourg," aerial
  [197, "day"],    // 3 Troffea steps out, starts to dance
  [287, "day"],    // 4 "No music. No reason."
  [333, "day"],    // 5 CU "She just can't stop."
  [372, "day"],    // 6 husband begs her
  [431, "day"],    // 7 six days: day
  [449, "night"],  // 8 night
  [467, "day"],    // 9 day
  [482, "night"],  // 10 night
  [498, "day"],    // 11 thirty neighbours
  [574, "day"],    // 12 aerial, four hundred
  [689, "day"],    // 13 among dancers "day and"
  [716, "night"],  // 14 "night"
  [729, "day"],    // 15 feet CU "until their feet bleed"
  [773, "day"],    // 16 council calls the doctors
  [845, "day"],    // 17 doctor CU "Their verdict? Hot blood."
  [893, "day"],    // 18 "dance it out"
  [953, "day"],    // 19 clear the grain market
  [996, "day"],    // 20 build a stage
  [1025, "day"],   // 21 hire musicians
  [1064, "day"],   // 22 professional dancers
  [1139, "day"],   // 23 "It works perfectly."
  [1181, "day"],   // 24 "The dancing gets worse."
  [1235, "golden"],// 25 "danced themselves to death"
  [1316, "golden"],// 26 "what was making a whole city dance?"
  [1390, "night"], // 27 "Well, Strasbourg was starving..."
  [1556, "night"], // 28 St Vitus statue
  [1636, "night"], // 29 scared, exhausted, body follows
  [1806, "night"], // 30 yawn
  [1884, "day"],   // 31 council bans music
  [1950, "day"],   // 32 procession to the shrine
  [2005, "day"],   // 33 red shoes
  [2041, "golden"],// 34 "And it worked."
  [2064, "golden"],// 35 crane out
];
export const SHOTS: ShotDef[] = L.map(([a, light], i) => ({ id: i + 1, a, b: i + 1 < L.length ? L[i + 1][0] : TOTAL, light }));
export const XFADE: Record<number, number> = { 8: 6, 9: 6, 10: 6, 11: 6, 14: 6, 25: 8, 27: 8, 31: 8, 32: 8, 34: 8 };
export const FLASH_AT = 146;
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- camera (grammar of story.ts: smootherstep glides, creeping push-ins, cuts on words) ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
/** a framing that creeps in from frame f0 (dolly) */
const D = (pos: V3, look: V3, f0: number, rate = 0.0022, rest: Partial<Cam> = {}, punch = 0, n = 35) => (f: number) => dolly(pos, look, pushK(f, f0, rate, punch, n), rest);
const Z = (pos: V3, look: V3, fov: number, f0: number, rate = 0.0018, rest: Partial<Cam> = {}, punch = 0, n = 35) => (f: number) => zoom(pos, look, fov, pushK(f, f0, rate, punch, n), rest);
const y = (h: number) => D0 + h;
/** quadratic Bezier crane from a framing to another, eased with glide over dur */
const crane = (a: Shot, c: V3, b: Shot, f0: number, dur: number) => (f: number): Shot => {
  const s = glide((f - f0) / dur), r = 1 - s;
  return { pos: [0, 1, 2].map((i) => r * r * a.pos[i] + 2 * s * r * c[i] + s * s * b.pos[i]) as V3,
    look: [0, 1, 2].map((i) => a.look[i] + (b.look[i] - a.look[i]) * s) as V3, fov: (a.fov ?? 40) + ((b.fov ?? 40) - (a.fov ?? 40)) * s, roll: 0 };
};

const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: D([1.6, y(1.55), -3.2], [0, y(1.55), 2.2], 0, 0.0025, { fov: 38, roll: -0.03 }) },
    { f: 66, dur: 32, s: D([-2.6, y(2.9), -7.5], [0, y(2.0), 12.5], 66, 0.002, { fov: 42 }) },
    { f: 114, cut: true, s: D([1.3, y(2.55), 7.2], [0, y(2.75), 13.8], 114, 0.003, { fov: 38, roll: 0.03 }) },
  ],
  2: [{ f: 140, s: Z([-34, y(66), -140], [6, y(22), 36], 44, 140, 0.0025) }],
  3: [
    { f: 197, s: D([-47.6, y(1.5), 3.0], [-50, y(1.3), -3.9], 197, 0.0022, { fov: 42 }) },
    { f: 240, dur: 26, s: D([-46.6, y(1.25), 3.6], [-50.2, y(1.15), -2.4], 240, 0.0025, { fov: 42, roll: 0.03 }) },
  ],
  4: [ // low angle in the street: she dances, the neighbours stare from their doorsteps
    { f: 287, s: D([-45.4, y(1.35), 0.9], [-49.9, y(1.2), -2.4], 287, 0.0025, { fov: 44, roll: 0.03 }) },
    { f: 304, dur: 22, s: D([-46.0, y(1.3), 0.5], [-50.0, y(1.25), -2.3], 304, 0.003, { fov: 40, roll: -0.03 }) },
  ],
  5: [{ f: 333, s: D([-49.3, y(1.72), 1.3], [-50.1, y(1.62), -1.7], 333, 0.003, { fov: 34 }, 0.006, 30) }],
  6: [ // two-shot: the husband pleads at her side, the open door behind them
    { f: 372, s: D([-48.3, y(1.45), 1.75], [-49.55, y(1.3), -2.6], 372, 0.0025, { fov: 40 }) },
    { f: 404, dur: 20, s: D([-48.5, y(1.42), 1.25], [-49.55, y(1.32), -2.6], 404, 0.003, { fov: 39, roll: 0.03 }) },
  ],
  7: [{ f: 425, s: D([-45.2, y(1.55), 1.9], [-49.4, y(1.05), -3.0], 425, 0.0015, { fov: 44 }) }],
  11: [
    { f: 494, s: D([-39.5, y(1.6), 0.4], [-52, y(1.5), -0.4], 494, 0.0015, { fov: 44 }) },
    { f: 522, dur: 44, s: D([-35, y(8.5), 2.2], [-54, y(0.6), -0.2], 522, 0.0015, { fov: 46 }) },
  ],
  12: [{ f: 570, s: D([2, y(27), -46], [0, y(0), -2], 570, 0.0018, { fov: 44 }, 0.005, 34) }],
  13: [{ f: 689, s: D([3.2, y(1.75), -15.5], [0, y(1.5), -6], 689, 0.0025, { fov: 42, roll: 0.02 }) }],
  15: [{ f: 729, s: D([0.1, y(0.55), -8.9], [0.0, y(0.35), -5.2], 729, 0.0025, { fov: 26, roll: 0.03 }, 0.006, 30) }], // long lens on dancing legs, worn shoes, red marks
  16: [ // council chamber: the mayor bangs the gavel on "calls", the doors fly open, the doctors stride in
    { f: 773, s: D([HALL[0] + 0.3, RY + 1.8, HALL[2] + 4.5], [HALL[0], RY + 1.3, HALL[2] - 1.9], 773, 0.0028, { fov: 46 }, 0.006, 26) },
    { f: 813, cut: true, s: D([HALL[0] + 1.7, RY + 1.45, HALL[2] - 0.2], [HALL[0] - 3.2, RY + 1.3, HALL[2] + 1.2], 813, 0.002, { fov: 44, roll: 0.03 }) },
  ],
  17: [ // in the chamber: the doctor holds the urine flask up to the window ("Their verdict?"), then the flask fills the frame
    { f: 845, s: D([HALL[0] - 0.25, RY + 1.0, HALL[2] + 2.6], [HALL[0] - 0.8, RY + 1.85, HALL[2] + 0.2], 845, 0.003, { fov: 42, roll: 0.03 }) },
    { f: 864, cut: true, s: D(HFLASK_CAM, [HFLASK[0], HFLASK[1] + 0.03, HFLASK[2]], 864, 0.0025, { fov: 36, roll: -0.03 }, 0.009, 22) },
  ],
  18: [ // "The only cure is to dance it out": the doctor turns to the council, points outside, then shows them the jig
    { f: 893, s: D([HALL[0] + 1.3, RY + 1.6, HALL[2] + 3.6], [HALL[0] - 0.75, RY + 1.3, HALL[2] - 0.6], 893, 0.0022, { fov: 46 }) },
    { f: 921, dur: 18, s: D([HALL[0] + 0.9, RY + 1.45, HALL[2] + 3.0], [HALL[0] - 0.8, RY + 1.2, HALL[2] - 0.5], 921, 0.003, { fov: 44, roll: -0.03 }) },
  ],
  19: [{ f: 953, s: D([-8.2, y(2.4), -16.6], [-15, y(0.9), -9.6], 953, 0.0018, { fov: 44 }) }],
  20: [{ f: 996, s: D([0.7, y(2.2), 3.7], [0, y(1.15), 12.2], 996, 0.003, { fov: 50, roll: 0.03 }) }], // three hammers in front, the stage pops up behind them
  21: [{ f: 1025, s: D([2.4, y(2.45), 6.2], [0, y(2.6), 14.2], 1025, 0.0025, { fov: 40 }) }],
  22: [
    { f: 1064, s: D([-2.6, y(1.62), -7.2], [0, y(1.55), 0.4], 1064, 0.0022, { fov: 40 }) },
    { f: 1100, dur: 26, s: D([-1.2, y(1.55), -5.2], [0, y(1.55), 0.4], 1100, 0.002, { fov: 38, roll: -0.03 }) },
  ],
  23: [{ f: 1139, s: D([24.8, y(1.5), -9.5], [26.3, y(1.7), 1.0], 1139, 0.003, { fov: 40, roll: -0.04 }) }], // along the steps: the proud council left, the dancers right
  24: [
    { f: 1181, s: D([0.5, y(4.6), 11.2], [0, y(1.0), -5], 1181, 0.002, { fov: 46 }) },
    { f: 1199, dur: 20, s: D([0.5, y(4.6), 11.2], [0, y(1.0), -5], 1199, 0.004, { fov: 46, roll: 0.05 }) },
  ],
  25: [
    { f: 1231, s: D([2.4, y(1.45), -8.6], [0, y(0.9), -2.9], 1231, 0.002, { fov: 40 }) },
    { f: 1268, dur: 26, s: D([1.6, y(0.9), -6.8], [0, y(0.45), -3.0], 1268, 0.002, { fov: 38, roll: 0.03 }) },
  ],
  26: [
    { f: 1316, s: D([0.5, y(2.4), -13], [0, y(2.0), 4], 1316, 0.001, { fov: 42 }) },
    { f: 1324, cut: true, s: crane({ pos: [0.5, y(2.4), -13], look: [0, y(2.0), 4], fov: 42 }, [-2, y(14), -22], { pos: [-8, y(30), -46], look: [2, y(6), 22], fov: 46 }, 1324, 66) },
  ],
  27: [ // the hungry family at a bare table by one candle; "Famine": the empty bowl; "disease": the father coughs
    { f: 1386, s: D([HOME[0] + 0.05, RY + 1.32, HOME[2] + 3.0], [HOME[0], RY + 1.12, HOME[2] - 1.3], 1386, 0.0026, { fov: 40 }) },
    { f: 1462, cut: true, s: D([HOME[0] - 0.52, RY + 1.16, HOME[2] - 0.06], [HOME[0] - 0.56, RY + 0.86, HOME[2] - 0.7], 1462, 0.003, { fov: 34, roll: -0.03 }) },
    { f: 1475, dur: 9, s: D([HOME[0] + 0.42, RY + 1.28, HOME[2] + 0.3], [HOME[0] + 0.56, RY + 1.16, HOME[2] - 1.6], 1475, 0.0025, { fov: 38, roll: 0.03 }) },
    { f: 1496, cut: true, s: D([-69.2, y(1.7), -1.8], [-72, y(2.2), 4.0], 1496, 0.003, { fov: 40 }) },
  ],
  28: [
    { f: 1556, s: D([-71.6, y(2.25), 0.9], [-72, y(2.45), 4.0], 1556, 0.003, { fov: 34 }, 0.007, 30) },
  ],
  29: [
    { f: 1636, s: D([-65.3, y(1.72), 2.0], [-66, y(1.66), -1.1], 1636, 0.0025, { fov: 36 }, 0.006, 24) },
    { f: 1655, dur: 14, s: D([-65.2, y(1.74), 1.5], [-66, y(1.68), -1.1], 1655, 0.0025, { fov: 35, roll: -0.03 }) },
    { f: 1683, dur: 14, s: D([-65.6, y(1.7), 1.6], [-66, y(1.64), -1.1], 1683, 0.0025, { fov: 35, roll: 0.03 }) },
    { f: 1700, dur: 24, s: D([-65.0, y(1.72), 1.6], [-66, y(1.66), -1.1], 1700, 0.003, { fov: 34, roll: 0.04 }) },
    { f: 1776, cut: true, s: D([-64.4, y(1.2), 3.6], [-66, y(1.0), -1.1], 1776, 0.0022, { fov: 42 }) },
  ],
  30: [{ f: 1806, s: D([-63.4, y(1.1), -1.4], [-66.5, y(0.78), -4.3], 1806, 0.0022, { fov: 40, roll: 0.03 }) }], // diagonal down the row of yawners
  31: [
    { f: 1880, s: D([10.4, y(1.75), 3.4], [7.0, y(1.55), 8.8], 1880, 0.002, { fov: 42 }) },
    { f: 1920, dur: 24, s: D([3, y(3), -2], [0, y(1.8), 13], 1920, 0.002, { fov: 44 }) },
  ],
  32: [{ f: 1946, s: (f: number) => { const zc = -139.4 - (f / FPS - 64.5) * 0.95; return { pos: [146.0, y(1.35), zc + 1.2], look: [149.7, y(1.25), zc - 0.6], fov: 42 }; } }], // tracking beside the procession
  33: [{ f: 2005, s: D([152.2, y(0.42), -128.5], [149.6, y(0.32), -129.8], 2005, 0.002, { fov: 38 }) }],
  34: [{ f: 2037, s: D([150.8, y(1.65), -151.5], [150, y(1.55), -160.5], 2037, 0.0025, { fov: 42 }) }],
  35: [
    { f: 2064, s: D([150.8, y(1.65), -151.5], [150, y(1.55), -160.5], 2037, 0.0025, { fov: 42 }) },
    { f: 2078, cut: true, s: crane({ pos: [151, y(2.2), -150], look: [150, y(2.0), -165], fov: 42 }, [175, y(12), -150], { pos: [196, y(34), -212], look: [110, y(6), -95], fov: 46 }, 2078, 100) },
  ],
};
CAMS[8] = CAMS[9] = CAMS[10] = CAMS[7];
CAMS[14] = CAMS[13];

// impact kicks: image offset flips sign every frame, decays in 7 f
const KICKS: [number, number][] = [[28.98, 0.8], [29.24, 0.4], [31.3, 0.35], [7.18, 0.25], [33.32, 0.5], [33.66, 0.5], [40.26, 0.8], [43.1, 0.6], [53.46, 0.7], [63.72, 0.6], [64.12, 0.6]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(f / FPS);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const Ln = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * Ln * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 14 },                 // hook MS among dancers
  { f: 66, dur: 32, cInf: 6 },        // reveal band
  { f: 114, cInf: 12 },               // band MS
  { f: 146, cInf: 0 },                // aerial
  { f: 197, cInf: 8 },                // her door
  { f: 287, cInf: 0 },                // street wide
  { f: 333, cInf: 15 },               // CU
  { f: 372, cInf: 9 },                // husband
  { f: 431, cInf: 0 },                // timelapse, thirty neighbours, aerial
  { f: 689, cInf: 10 },               // among dancers
  { f: 729, cInf: 15 },               // feet CU
  { f: 773, cInf: 7 },                // council chamber
  { f: 813, cInf: 9 },                // the doctors come in
  { f: 845, cInf: 8, focus: () => [HDOC[0], RY + 1.8, HDOC[2]] }, // doctor holds the flask up
  { f: 864, cInf: 16, focus: () => HFLASK }, // flask insert
  { f: 893, cInf: 7 },                // doctor + council
  { f: 953, cInf: 0 },                // clearing, building
  { f: 1025, cInf: 9 },               // band
  { f: 1064, cInf: 12 },              // pro dancer
  { f: 1139, cInf: 10 },              // council proud
  { f: 1181, cInf: 0 },               // worse (wide)
  { f: 1235, cInf: 10 },              // collapse
  { f: 1316, cInf: 0 },               // crane
  { f: 1390, cInf: 9 },               // the hungry family
  { f: 1462, cInf: 15, focus: () => [HOME[0] - 0.56, RY + 0.86, HOME[2] - 0.7] }, // empty bowl
  { f: 1475, dur: 9, cInf: 12 },      // father coughs
  { f: 1496, cInf: 8 },               // to the shrine
  { f: 1556, cInf: 14 },              // statue CU
  { f: 1636, cInf: 15 },              // scared CU
  { f: 1776, cInf: 9 },               // body follows
  { f: 1806, cInf: 6 },               // yawn bench
  { f: 1884, cInf: 10 },              // sign
  { f: 1920, dur: 24, cInf: 0 },
  { f: 2005, cInf: 14 },              // red shoes
  { f: 2041, cInf: 8 },               // at the chapel
  { f: 2078, cInf: 0 },               // crane out
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
