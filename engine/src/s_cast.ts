// The cast of "The Dancing Plague" as lit cards (sprite system of the engine, cast.ts): who stands where,
// doing what, in every shot. stageCast(id, t, cam) -> places (characters) + fx (effects, contact shadows).
import * as THREE from "three";
import { Pen, bodyFront, bodySide, Outfit, Expr, FrontOpts, SideOpts, fxNote, fxBurst, fxPuff, fxStars, fxShadow, fxContact, fxCreak, INK, mix } from "./toon";
import { Place, FxPlace, CamInfo } from "./cast";
import { FPS, D0, V3, STAGE, DOOR, SHRINE_POST, CHAPEL, SIGN, DOC, FLASK, smooth, clamp01, Light, HOME, HALL, HALL_DOOR, RY, HDOC, HFLASK } from "./s_story";
import { TROFFEA, HUSBAND, COUNCIL, DOCTOR, MUSICIAN, PRO, WORKER, FOLKS, STATUE, KIDF } from "./s_people";

export type Stage = { places: Place[]; fx: FxPlace[] };
const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
// card canvas tiers were sized for a 1440 x 2560 master; scale them with the render size (preview renders stay fast)
const RS = typeof location !== "undefined" ? +(new URLSearchParams(location.search).get("scale") || "1") : 1;
const TS = Math.max(0.3, Math.min(1, RS / 1.333));
const tier = (d: number): [number, number, number] => {
  const [w, h, k]: [number, number, number] = d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];
  const s = d < 16 ? TS : Math.max(TS, 0.6);
  return [Math.round(w * s), Math.round(h * s), k * s];
};
const tmp = new THREE.Vector3();
let SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
let LNAME: Light = "day";
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number) => {
  const f = Math.round(t * FPS);
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13));
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));
type Who = { i: number; o: Outfit; okey: string };
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, side: boolean, mirror: boolean, fo: FrontOpts, so: SideOpts = {}, scale = 1): Place => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2 * scale, z)) / scale;
  const [w, h, k] = tier(d);
  const far = d > 14;
  const mir = side && mirror, light = light2D(cam, mir), seed = far ? (who.okey.charCodeAt(who.okey.length - 1) % 7) + 1 : (who.i * 5 + 3) % 7 + 1;
  const f2: FrontOpts = { ...fo, light, seed, blink: far ? 0 : fo.blink }, s2: SideOpts = { ...so, light, seed };
  const key = side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return { key, x, y, z, scale, mirror: mir, draw: (p) => (side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)), size: [w, h, k] };
};
const CONTACT: Record<Light, [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33], night: [0.3, 0.32, 0.45] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h;
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.03, z: z + oz * c, w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.036, z: z + oz * 0.03 * sc, w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- effects drawn here ----------------
type P2 = [number, number];
const fxZ = (p: Pen) => { // "z z" of a sleeper on a 200 x 200 canvas
  for (const [x, y, s] of [[60, 140, 1], [130, 70, 0.7]] as const) {
    const w = 50 * s;
    p.stroke([[x - w, y - w], [x + w, y - w], [x - w, y + w], [x + w, y + w]], 26 * s, INK);
    p.stroke([[x - w, y - w], [x + w, y - w], [x - w, y + w], [x + w, y + w]], 14 * s, "#f4efe2");
  }
};
const fxGlow = (p: Pen, col: string) => { const g = p.g, gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, col); gr.addColorStop(0.35, col.replace(/[\d.]+\)$/, "0.35)")); gr.addColorStop(1, col.replace(/[\d.]+\)$/, "0)")); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); };
const fxFlame = (p: Pen, t: number) => { // candle / torch flame on a 120 x 200 canvas
  const s = 1 + 0.12 * Math.sin(t * 6.28), lean = 6 * Math.sin(t * 12.56);
  const fl = (w: number, h: number, col: string) => p.poly([[60 - w, 170], [60 + w, 170], [60 + lean + w * 0.3, 170 - h * s], [60 + lean, 170 - h * s - 12], [60 + lean - w * 0.3, 170 - h * s]], col, 0);
  fl(34, 120, "#ff9a3c"); fl(20, 80, "#ffd65a"); fl(9, 40, "#fff6d0");
};
const fxSwirl = (p: Pen, t: number, col = "#9b5ad9") => { // curse swirl on a 400 x 400 canvas
  const pts: P2[] = [];
  for (let k = 0; k < 60; k++) { const a = k * 0.32 + t * 6.28, r = 20 + k * 2.9; pts.push([200 + r * Math.cos(a), 200 + r * Math.sin(a) * 0.8]); }
  p.stroke(pts, 26, INK); p.stroke(pts, 14, col);
  for (let k = 0; k < 5; k++) { const a = t * 6.28 + k * 1.26, r = 150 + 20 * Math.sin(t * 9 + k); p.ell(200 + r * Math.cos(a), 200 + r * 0.8 * Math.sin(a), 12, 12, "#d9b8ff", 6); }
};
const fxSteam = (p: Pen, t: number) => { // rising steam curls on a 200 x 300 canvas
  for (let k = 0; k < 3; k++) {
    const u = (t + k / 3) % 1, x = 100 + 30 * Math.sin(u * 9 + k), y = 260 - 220 * u, r = 16 + 26 * u;
    p.ell(x, y, r, r * 0.8, `rgba(245,245,250,${(0.9 * (1 - u)).toFixed(3)})`, 0);
  }
};
const fxDrops = (p: Pen, t: number) => { // red worn-out spots (no gore) on a 200 x 120 canvas: flat on the cobbles
  const g = p.g; g.fillStyle = "rgba(170,40,50,0.55)";
  for (const [x, y, r] of [[60, 60, 14], [110, 50, 9], [140, 74, 7], [88, 84, 6]] as const) { g.beginPath(); g.ellipse(x, y, r * (0.8 + 0.2 * t), r * 0.6, 0, 0, Math.PI * 2); g.fill(); }
};

/** big round-bottom flask for the "Hot blood" insert on a 420 x 560 canvas: heat 0 yellow .. 1 boiling red */
const fxFlaskBig = (p: Pen, heat: number, b: number) => {
  const g = p.g, cx = 210, cy = 370, R = 150;
  const liq = mix("#f2c23c", "#d8283a", heat), deep = mix("#d99a1e", "#8c1426", heat);
  p.poly([[cx - 34, 70], [cx + 34, 70], [cx + 34, 235], [cx - 34, 235]], "#eef4f8", 12);            // neck
  p.ell(cx, 66, 46, 14, "#dfe9ef", 10);                                                              // lip
  p.ell(cx, cy, R, R, "#eef4f8", 14);
  g.save(); p.path(Array.from({ length: 49 }, (_, i) => [cx + (R - 8) * Math.cos((i / 48) * 6.283), cy + (R - 8) * Math.sin((i / 48) * 6.283)] as [number, number]), true); g.clip();
  const lvl = cy - 40 - 30 * heat + 8 * Math.sin(b * 12.6);
  const gr = g.createLinearGradient(0, lvl, 0, cy + R); gr.addColorStop(0, liq); gr.addColorStop(1, deep);
  g.fillStyle = gr; g.beginPath(); g.moveTo(cx - R, lvl);
  for (let x = -R; x <= R; x += 10) g.lineTo(cx + x, lvl + (heat > 0.3 ? 10 * Math.sin(x * 0.08 + b * 25) : 3 * Math.sin(x * 0.05)));
  g.lineTo(cx + R, cy + R); g.lineTo(cx - R, cy + R); g.closePath(); g.fill();
  g.strokeStyle = INK; g.lineWidth = 7; g.stroke();
  if (heat > 0.2) for (let k = 0; k < 9; k++) { // bubbles rising
    const u = (b + k / 9) % 1, x = cx - 100 + ((k * 53) % 200), y = cy + R - 30 - u * (cy + R - lvl - 20), r = 8 + 10 * ((k * 7) % 3) / 2;
    p.ell(x + 6 * Math.sin(u * 9 + k), y, r * heat, r * heat, mix("#ffd9c0", "#ffffff", 0.4), 5);
  }
  g.restore();
  p.ell(cx, cy, R, R, null, 14);
  g.fillStyle = "rgba(255,255,255,0.75)"; g.beginPath(); g.ellipse(cx - 70, cy - 70, 26, 48, -0.6, 0, 6.283); g.fill();   // glass glint
  g.fillRect(cx - 24, 90, 10, 120);
};
/** "Hot blood" insert on a 440 x 640 canvas: the urine flask held up in front of the doctor's face. heat 0 golden .. 1 boiling
 *  red, b = boil clock, eye 0 squint .. 1 wide (his eye, magnified through the liquid, until the boil hides it). The glass is
 *  see-through (soft card): his face shows behind the neck and above the liquid. */
const fxFlaskHot = (p: Pen, heat: number, b: number, eye: number) => {
  const g = p.g, cx = 220, cy = 410, R = 162;
  const liq = mix("#f7c83a", "#e3233a", heat), deep = mix("#d6901a", "#7a0c20", heat), hi = mix("#fff3a6", "#ff9a7e", heat);
  // the doctor's arm from the bottom left, dot hand around the neck
  p.stroke([[-20, 600], [40, 470], [150, 268]], 13, INK);
  // neck + lip (see-through glass)
  p.poly([[cx - 38, 70], [cx + 38, 70], [cx + 38, 262], [cx - 38, 262]], "rgba(232,244,250,0.42)", 11);
  p.ell(cx, 68, 52, 16, "rgba(225,238,245,0.92)", 10);
  p.ell(cx, cy, R, R, "rgba(232,244,250,0.30)", 0);
  g.save(); p.path(Array.from({ length: 64 }, (_, i) => [cx + (R - 9) * Math.cos((i / 64) * 6.283), cy + (R - 9) * Math.sin((i / 64) * 6.283)] as [number, number]), true); g.clip();
  const lvl = cy - 70 - 26 * heat + (heat > 0.3 ? 8 * Math.sin(b * 25) : 3 * Math.sin(b * 6.28));
  const gr = g.createLinearGradient(0, lvl, 0, cy + R); gr.addColorStop(0, liq); gr.addColorStop(1, deep);
  g.fillStyle = gr; g.beginPath(); g.moveTo(cx - R, lvl);
  for (let x = -R; x <= R; x += 8) g.lineTo(cx + x, lvl + (heat > 0.3 ? 12 * heat * Math.sin(x * 0.07 + b * 31) : 4 * Math.sin(x * 0.05 + b * 6)));
  g.lineTo(cx + R, cy + R); g.lineTo(cx - R, cy + R); g.closePath(); g.fill();
  g.strokeStyle = "rgba(60,20,20,0.55)"; g.lineWidth = 6; g.stroke();
  const glow = g.createRadialGradient(cx - 20, cy + 30, 10, cx, cy + 20, R); glow.addColorStop(0, hi + "cc"); glow.addColorStop(1, hi + "00");
  g.fillStyle = glow; g.fillRect(cx - R, lvl, 2 * R, cy + R - lvl);
  // his eye, magnified through the liquid (fades as it boils)
  const ea = Math.max(0, 1 - heat / 0.55);
  if (ea > 0) {
    g.globalAlpha = ea; const ex = cx + 34, ey = cy + 34, ry = 12 + 46 * eye;
    p.ell(ex, ey, 70, ry, "#fbf6ea", 7);
    p.dot(ex + 6 - 10 * eye, ey + 2, 16 + 6 * eye, INK);
    p.stroke(eye < 0.5 ? [[ex - 70, ey - ry - 18], [ex + 70, ey - ry - 6]] : [[ex - 66, ey - ry - 30], [ex + 66, ey - ry - 36]], 9, INK);
    g.globalAlpha = 1;
  }
  // bubbles: more and bigger as it heats, rising and wobbling
  const nb = Math.round(4 + 9 * heat);
  for (let k = 0; k < nb; k++) {
    const u = (b * (1 + heat) + k / nb) % 1, x = cx - 110 + ((k * 61) % 220), y = cy + R - 20 - u * (cy + R - lvl - 10), r = (4 + ((k * 7) % 4) * 3) * (0.5 + 0.8 * heat);
    p.ell(x + 8 * Math.sin(u * 9 + k), y, r, r, "rgba(255,235,220,0.85)", 3.5);
  }
  if (heat > 0.5) for (let k = 0; k < 7; k++) p.ell(cx - R + 30 + k * 46, lvl + 4, 22, 13, "rgba(255,220,210,0.95)", 4); // foam
  g.restore();
  p.ell(cx, cy, R, R, null, 13);
  g.fillStyle = "rgba(255,255,255,0.8)"; g.beginPath(); g.ellipse(cx - 78, cy - 70, 24, 54, -0.6, 0, 6.283); g.fill();
  g.fillRect(cx - 26, 96, 11, 140);
  // fingers around the neck
  p.dot(cx - 36, 262, 15, INK);
};
/** inked steam curl on a 300 x 300 canvas, fading as it rises (a 0..1) */
const fxCurl = (p: Pen, a: number) => {
  const al = a < 0.15 ? a / 0.15 : 1 - (a - 0.15) / 0.85;
  p.g.globalAlpha = Math.max(0, al);
  for (const [x, y, r] of [[150, 170, 70], [95, 150, 46], [205, 140, 52], [150, 105, 50]] as const) p.ell(x, y, r, r * 0.86, "#ffffff", 0);
  for (const [x, y, r] of [[150, 170, 70], [95, 150, 46], [205, 140, 52], [150, 105, 50]] as const) p.ell(x, y, r, r * 0.86, null, 9, 160, 380);
  p.g.globalAlpha = 1;
};
/** a fat leather coin purse on a 220 x 240 canvas (shot 21) */
const fxPurse = (p: Pen) => {
  const bag: P2[] = Array.from({ length: 36 }, (_, i) => { const a = (i / 36) * Math.PI * 2; return [110 + 82 * Math.cos(a) * (Math.sin(a) > 0 ? 1.05 : 0.82), 150 + 72 * Math.sin(a)] as P2; });
  p.poly(bag, "#8a5a32", 9);
  p.poly([[78, 92], [142, 92], [154, 50], [66, 50]], "#9c6a3c", 8);
  p.stroke([[70, 92], [150, 92]], 12, "#d9b04a");
  for (const [x, y] of [[96, 44], [124, 40], [110, 30]] as const) p.ell(x, y, 18, 9, "#ffd23f", 5);
  p.ell(88, 140, 16, 24, "rgba(255,220,170,0.35)", 0);
};
/** sweat drop on a 120 x 160 canvas */
const fxDrop = (p: Pen) => p.poly([[60, 14], [96, 96], [60, 146], [24, 96]].map(([x, y]) => [x, y] as [number, number]), "#9fd4ff", 8);

// ---------------- crowds ----------------
const SQUARE: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let i = 0; out.length < 420 && i < 4000; i++) {
    const x = -21 + hh(i, 1) * 42, z = -17.5 + hh(i, 2) * 27;
    if (Math.hypot(x + 19, z + 16) < 2.4) continue; // the well
    if (out.some(([a, b]) => Math.hypot(a - x, b - z) < 1.05)) continue;
    out.push([x, z]);
  }
  return out;
})();
const STREET: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let i = 0; out.length < 40 && i < 3000; i++) {
    const x = -64 + hh(i, 4) * 28, z = -3.8 + hh(i, 5) * 7.6;
    if (Math.hypot(x + 50, z + 1.6) < 1.4) continue;
    if (out.some(([a, b]) => Math.hypot(a - x, b - z) < 1.1)) continue;
    out.push([x, z]);
  }
  return out;
})();
const TIRED: Expr[] = ["dazed", "pained", "tired", "nervous", "tired", "dazed", "pained", "grin"];
type DanceOpt = { energy?: number; armsUp?: number; expr?: Expr; rate?: number; sore?: boolean; scale?: number; blink?: boolean };
/** one dancer: jig phase on the 120 bpm beat (kicks land on beats), the hop is the card's height */
const dancer = (out: Stage, cam: CamInfo, who: Who, x: number, z: number, t: number, o: DanceOpt = {}, y0 = D0) => {
  let energy = o.energy ?? 1, armsUp = o.armsUp ?? 1, expr = o.expr ?? "dazed";
  const rate = o.rate ?? 1;
  const d = cam.pos.distanceTo(tmp.set(x, y0 + 1.2, z)), far = d > 14;
  // far dancers share drawings: 4 phase groups, 2 energy / arm levels, the expression goes with the outfit
  if (far) { energy = energy > 0.75 ? 0.9 : 0.6; armsUp = armsUp > 0.5 ? 0.8 : 0.3; if (!o.expr || who.i >= 300) expr = TIRED[who.o === undefined ? 0 : (who.okey.length + who.okey.charCodeAt(who.okey.length - 1)) % 8]; }
  const phase = q(((t * rate + hh(who.i, 7) * (far ? 0 : 0.15) + (who.i % 4) * 0.25) % 1 + 1) % 1, far ? 8 : 24);
  const hop = 0.085 * energy * Math.abs(Math.sin(2 * Math.PI * phase));
  const fo: FrontOpts = { mode: "dance", phase, energy: q(energy, 10), armsUp: q(armsUp, 10), expr, blink: o.blink === false || far ? 0 : lidAt(t, who.i), sore: o.sore && d < 8 };
  const pl = person(cam, who, x, y0 + hop, z, false, false, fo, {}, o.scale ?? 1);
  if (who.i >= 300 && who.i % 2) pl.mirror = true; // crowd: every other dancer flipped = twice the variety, same drawings
  out.places.push(pl);
  blob(out, x, y0, z, o.scale ?? 1, hop > 0.03 ? 0.7 : 1);
  if (o.sore && d < 6) out.fx.push({ key: "drops", cw: 200, ch: 120, draw: (p) => fxDrops(p, 0.5), x: x + 0.05, y: y0 + 0.024, z: z - 0.1, w: 0.7, h: 0.42, flat: true, rot: hh(who.i, 3) * 3 });
};
const folk = (i: number): Who => { const v = (i * 7 + (i >> 3)) % FOLKS.length; return { i, o: FOLKS[v], okey: `folk${v}` }; };
/** the dancing crowd on the square: energy/arms/expressions per person; skips anyone too close to the lens */
const squareCrowd = (out: Stage, cam: CamInfo, t: number, n: number, o: { energy?: number; worse?: boolean; keep?: (x: number, z: number) => boolean; sore?: boolean; clear?: number } = {}) => {
  for (let i = 0; i < Math.min(n, SQUARE.length); i++) {
    const [x, z] = SQUARE[i];
    if (o.keep && !o.keep(x, z)) continue;
    if (cam.pos.distanceTo(tmp.set(x, D0 + 1.2, z)) < (o.clear ?? 2.4)) continue;
    const e = (o.energy ?? 0.75) * (0.6 + 0.4 * hh(i, 11));
    dancer(out, cam, folk(i + 1000), x, z, t, { energy: o.worse ? Math.min(1, e * 1.4) : e, armsUp: hh(i, 12) * (o.worse ? 1 : 0.8), expr: o.worse ? (["pained", "dazed", "scared", "pained"] as Expr[])[i % 4] : TIRED[i % 8], rate: o.worse ? 1.15 : 1, sore: o.sore });
  }
};
const streetCrowd = (out: Stage, cam: CamInfo, t: number, n: number, ramp = 1) => {
  for (let i = 0; i < Math.min(n, STREET.length); i++) {
    const [x, z] = STREET[i];
    if (cam.pos.distanceTo(tmp.set(x, D0 + 1.2, z)) < 2.2) continue;
    dancer(out, cam, folk(i + 500), x, z, t, { energy: (0.55 + 0.45 * hh(i, 21)) * ramp, armsUp: hh(i, 22), expr: TIRED[(i + 3) % 8] });
  }
};
const strollers = (out: Stage, cam: CamInfo, t: number, n: number) => {
  for (let i = 0; i < n; i++) {
    const a = hh(i, 30) * 6.28, sp = 0.6 + 0.4 * hh(i, 31), x0 = -20 + hh(i, 32) * 40, z0 = -18 + hh(i, 33) * 34;
    const x = x0 + Math.cos(a) * sp * (t - 5), z = z0 + Math.sin(a) * sp * (t - 5);
    out.places.push(person(cam, folk(i + 300), x, D0, z, false, false, { mode: "stroll", phase: q((t * sp * 1.4 + hh(i, 34)) % 1, 16), expr: "smile" }));
    blob(out, x, D0, z);
  }
};

// ---------------- named characters ----------------
const TRO: Who = { i: 1, o: TROFFEA, okey: "tro" };
const HUS: Who = { i: 2, o: HUSBAND, okey: "hus" };
/** someone standing (fo.phase carries the clock for the blinks only) */
const stand = (out: Stage, cam: CamInfo, who: Who, x: number, z: number, fo: FrontOpts, y0 = D0, sc = 1) => {
  const { phase: tt = 0, ...rest } = fo;
  // idle life: breathing (1 cm), a slow weight shift, small head tilts; drawn on twos-ish via quantised angles
  const k = who.i * 1.7, tilt = rest.tilt ?? q(1.6 * Math.sin(tt * 1.4 + k), 2), head = rest.headTilt ?? q(3 * Math.sin(tt * 0.9 + k * 2.1), 1);
  const breath = 0.008 * Math.sin(tt * 2.4 + k);
  out.places.push(person(cam, who, x, y0 + breath, z, false, false, { mode: "stand", blink: lidAt(tt, who.i), ...rest, tilt, headTilt: head }, {}, sc));
  blob(out, x, y0, z, sc);
};
/** her front door (shots 3-11): swings out at 6.95 s with a little overshoot, stays open */
export const doorAngle = (id: number, t: number) => {
  if (id < 3 || id > 11) return 0;
  const u = clamp01((t - 6.95) / 0.3);
  return (Math.PI / 180) * 104 * (u >= 1 ? 1 : 1 - (1 - u) ** 3 + 0.12 * Math.sin(u * Math.PI));
};
/** Frau Troffea in her street (shots 3-11): door 6.95, in the doorway 7.05, step down 7.45, walks, stops 8.15,
 *  a twitch on "starts" (8.22) and the dance takes her on "dance" (8.7) */
const troffea = (out: Stage, cam: CamInfo, t: number, at: [number, number] = [-50, -2.2]) => {
  if (t < 7.02) return;
  const blink = lidAt(t, 1), dz = DOOR[2] + 0.06;
  if (t < 8.5) {
    let x = DOOR[0], z = dz, y = D0 + 0.2, mode: "stand" | "stroll" = "stand", expr: Expr = "neutral", look = 0; const tilt = 0;
    if (t < 7.45) { look = t < 7.22 ? -1 : 1; expr = "smile"; }                       // a glance down the street both ways
    else if (t < 8.15) {
      mode = "stroll"; expr = "smile";
      const u = (t - 7.45) / 0.7, e = u * u * (3 - 2 * u);
      x = DOOR[0] + (at[0] - DOOR[0]) * e; z = dz + (at[1] - dz) * e;
      y = D0 + 0.2 * (1 - smooth((z - dz) / 0.55));                                 // off the doorstep
    } else if (t < 8.22) { x = at[0]; z = at[1]; y = D0; expr = "smile"; }
    else { dancer(out, cam, TRO, at[0], at[1], t, { energy: 0.28, armsUp: 0, expr: "shock" }); return; } // the first jolts: her feet move by themselves
    const ph = q(((t - 7.45) * 1.6) % 1, 24);
    out.places.push(person(cam, TRO, x, y, z, false, false, { mode, phase: ph, expr, blink, look, tilt }));
    blob(out, x, y, z);
    return;
  }
  const ramp = smooth((t - 8.5) / 0.7);
  const expr: Expr = t < 9.5 ? "shock" : t < 11.06 ? "nervous" : t < 14.3 ? "scared" : t < 16.6 ? "tired" : "dazed";
  const e = t < 14.3 ? 0.35 + 0.65 * ramp : t < 16.6 ? 0.85 : 0.75;
  dancer(out, cam, TRO, at[0], at[1], t, { energy: e, armsUp: t < 14.3 ? ramp : 0.55, expr });
};

const COUNCILS = [0, 1, 2, 3].map((v): Who => ({ i: 40 + v, o: COUNCIL(v), okey: `cou${v}` }));
const DOCS = [0, 1].map((v): Who => ({ i: 50 + v, o: DOCTOR(v), okey: `doc${v}` }));
const MUS = [0, 1, 2, 3].map((v): Who => ({ i: 60 + v, o: MUSICIAN(v), okey: `mus${v}` }));
const MUSPOSE = ["drum", "shawm", "fiddle", "lute"] as const;
const band = (out: Stage, cam: CamInfo, t: number, playing = true, leave = 0) => {
  MUS.forEach((w, k) => {
    const x = -3 + k * 2 - leave * (k < 2 ? 1 : -1) * 8, z = 14.2 + (k % 2) * 0.5;
    const play = q((t * (k === 0 ? 2 : 1) + k * 0.13) % 1, 16);
    const fo: FrontOpts = leave > 0 ? { mode: "stroll", phase: q((t * 1.4) % 1, 16), expr: "tired", pose: MUSPOSE[k], play: 0 }
      : { mode: "stand", pose: MUSPOSE[k], play: playing ? play : 0, expr: (["grin", "whistle", "smile_closed", "smile"] as Expr[])[k], blink: lidAt(t, w.i) };
    const bob = playing && leave === 0 ? 0.03 * Math.abs(Math.sin(Math.PI * 2 * t)) : 0;
    if (x < STAGE.x0 - 0.2 || x > STAGE.x1 + 0.2) return;
    out.places.push(person(cam, w, x, D0 + STAGE.h + bob, z, false, false, fo));
    blob(out, x, D0 + STAGE.h, z);
    if (playing && leave === 0 && cam.pos.distanceTo(tmp.set(x, D0 + 2.8, z)) < 30) for (let n = 0; n < 2; n++) {
      const age = ((t * 0.7 + n * 0.5 + k * 0.23) % 1);
      const pop = Math.min(1, age * 7) * (age > 0.8 ? (1 - age) / 0.2 : 1), kind = (n + k) % 2;
      out.fx.push({ key: `note${kind}`, cw: 220, ch: 260, draw: (p) => fxNote(p, kind), x: x + 0.3 * Math.sin(age * 5 + k), y: D0 + STAGE.h + 2.0 + 1.1 * age, z: z - 0.2,
        w: 0.26 * pop, h: 0.3 * pop, rot: 0.3 * Math.sin(age * 6 + n) });
    }
  });
};
const lanternGlow = (out: Stage) => {
  for (let x = -96; x <= -34; x += 12) {
    out.fx.push({ key: "glowWarm", cw: 256, ch: 256, draw: (p) => fxGlow(p, "rgba(255,200,120,0.85)"), x, y: D0 + 2.45, z: -4.55, w: 1.6, h: 1.6, soft: true });
    out.fx.push({ key: "glowWarmGround", cw: 256, ch: 256, draw: (p) => fxGlow(p, "rgba(255,190,110,0.35)"), x, y: D0 + 0.03, z: -3.8, w: 5, h: 4, soft: true, flat: true });
  }
};

// ---------------- the shots ----------------
export const SACKS: [number, number, number, number][] = (() => {
  const out: [number, number, number, number][] = [];
  [[-14, 4.2], [12.5, 2.2], [18.5, -16.5], [-15, -10.2]].forEach(([cx, cz], h) => {
    for (let k = 0; k < 5; k++) out.push([cx - 1.4 + (k % 3) * 0.95 + hh(h * 9 + k) * 0.2, 0, cz - 1.0 - Math.floor(k / 3) * 0.7, hh(h * 9 + k, 2) * 3]);
    out.push([cx - 0.9, 0.62, cz - 1.2, 0.4]);
  });
  return out;
})();
export const sackGone = (id: number, t: number, i: number) => id > 19 || (id === 19 && t > 31.9 + i * 0.055);
export const stageBuild = (id: number, t: number) => (id === 1 || id > 20 ? Infinity : id === 20 ? Math.max(0, t - 33.25) : -1);

export const stageCast = (id: number, t: number, cam: CamInfo, light: Light): Stage => {
  const out: Stage = { places: [], fx: [] };
  LNAME = light;
  if (cam.sun) SUN = cam.sun.clone().normalize();
  switch (id) {
    case 1: { // hook: band on the stage, exhausted dancers in front
      band(out, cam, t);
      dancer(out, cam, folk(7), 0.1, 2.1, t, { energy: 0.55, armsUp: 0.25, expr: "tired" });
      dancer(out, cam, folk(8), -1.5, 3.6, t, { energy: 0.7, armsUp: 0.6, expr: "dazed" });
      dancer(out, cam, folk(9), 1.7, 4.6, t, { energy: 0.6, armsUp: 0.4, expr: "pained" });
      squareCrowd(out, cam, t, 420, { energy: 0.7, keep: (x, z) => Math.hypot(x - 0.1, z - 2.1) > 1.2 && Math.hypot(x + 1.5, z - 3.6) > 1.2 && Math.hypot(x - 1.7, z - 4.6) > 1.2 });
      break;
    }
    case 2: strollers(out, cam, t, 40); break;
    case 3: case 5: troffea(out, cam, t); break;
    case 4: {
      troffea(out, cam, t);
      const look = q(Math.sin(t * 2), 4) > 0 ? 1 : -1;
      // neighbours stare: one big in the left foreground, a mother + child and a grumpy one behind her
      stand(out, cam, { i: 24, o: FOLKS[5], okey: "nb4" }, -47.05, -0.75, { expr: t < 10.3 ? "shock" : "nervous", phase: t, look: 1 });
      stand(out, cam, { i: 20, o: FOLKS[2], okey: "nb1" }, -47.9, -4.1, { expr: t < 10.3 ? "shock" : "nervous", look: -1, phase: t });
      stand(out, cam, { i: 21, o: FOLKS[3], okey: "nb2" }, -52.3, -4.0, { expr: "nervous", phase: t, pose: "plead", look: 1 });
      stand(out, cam, { i: 22, o: KIDF, okey: "kid" }, -51.6, -3.8, { expr: "shock", phase: t, look: 1 }, D0, 0.72);
      stand(out, cam, { i: 23, o: FOLKS[4], okey: "nb3" }, -54.6, -3.7, { expr: "stern", phase: t, pose: "hips", look: 1 });
      break;
    }
    case 6: {
      troffea(out, cam, t, [-48.95, -2.2]);
      const beg = t < 13.45;
      stand(out, cam, HUS, -50.15, -2.75, { expr: beg ? "nervous" : "pained", pose: beg ? "plead" : "point", play: q(t * 1.5 % 1, 12), phase: t, look: 1, facing: 1 });
      if (t > 12.9 && t < 14.2) { const a = ((t - 12.9) % 0.65) / 0.65; out.fx.push({ key: "sweat", cw: 120, ch: 160, draw: fxDrop, x: -50.15 - 0.2 * cam.right.x, y: D0 + 2.0 - 0.3 * a * a, z: -2.65 - 0.2 * cam.right.z, w: 0.06, h: 0.08 }); }
      break;
    }
    case 7: case 8: case 9: case 10: {
      troffea(out, cam, t, [-47.7, -1.7]);
      const night = light === "night";
      out.places.push(person(cam, HUS, -52.4, D0, -4.5, false, false, { mode: "sit", expr: night ? "smile_closed" : "tired", blink: night ? 1 : lidAt(t, 2) }));
      blob(out, -52.4, D0, -4.5, 1.05);
      if (night) {
        lanternGlow(out);
        const u = (t * 0.8) % 1;
        out.fx.push({ key: "zzz", cw: 200, ch: 200, draw: fxZ, x: -52.2, y: D0 + 1.45 + 0.4 * u, z: -4.35, w: 0.42, h: 0.42, rot: 0.2 });
      }
      break;
    }
    case 11: {
      dancer(out, cam, TRO, -50, -1.6, t, { energy: 0.8, armsUp: 0.6, expr: "dazed" });
      streetCrowd(out, cam, t, 30, smooth((t - 16.4) / 1.6) * 0.6 + 0.4);
      break;
    }
    case 12: squareCrowd(out, cam, t, 420, { energy: 0.8 }); streetCrowd(out, cam, t, 40); break;
    case 13: case 14: {
      dancer(out, cam, folk(41), 0.3, -9.8, t, { energy: 0.9, armsUp: 0.9, expr: light === "night" ? "tired" : "dazed" });
      squareCrowd(out, cam, t, 420, { energy: 0.85, clear: 4.6, keep: (x, z) => Math.hypot(x - 0.3, z + 9.8) > 1.3 });
      if (light === "night") for (const [x, z] of [[-6, -8], [5, -9], [-2, -2], [7, 0], [-9, 1]]) {
        out.places.push(person(cam, folk(900 + x), x, D0, z, false, false, { mode: "stand", expr: "tired" }));
        out.fx.push({ key: `flame${q(t % 1, 8)}`, cw: 120, ch: 200, draw: (p) => fxFlame(p, q(t % 1, 8)), x: x + 0.55, y: D0 + 2.25, z, w: 0.36, h: 0.6 });
        out.fx.push({ key: "glowTorch", cw: 256, ch: 256, draw: (p) => fxGlow(p, "rgba(255,180,90,0.8)"), x: x + 0.55, y: D0 + 2.2, z: z - 0.05, w: 2.4, h: 2.4, soft: true });
        out.fx.push({ key: "glowTorchGround", cw: 256, ch: 256, draw: (p) => fxGlow(p, "rgba(255,170,90,0.45)"), x, y: D0 + 0.03, z, w: 6, h: 6, soft: true, flat: true });
      }
      break;
    }
    case 15: { // feet CU: worn-out shoes, red marks on the cobbles
      for (const [k, x, z] of [[0, -0.55, -5.9], [1, 0.45, -5.5], [2, -1.05, -4.8], [3, 0.95, -4.6], [4, 0.0, -4.1]] as const)
        dancer(out, cam, folk(k + 30), x, z, t, { energy: 0.8, armsUp: 0.3, expr: "pained", sore: true });
      squareCrowd(out, cam, t, 420, { energy: 0.8, keep: (x, z) => z > -3.8 });
      break;
    }
    case 16: { // council chamber: seated council, the mayor bangs the gavel on "calls", doors fly open, the doctors stride in
      const [hx, , hz] = HALL, hits = [26.95, 27.2];
      COUNCILS.forEach((w, k) => {
        const x = hx + [-1.45, -0.48, 0.48, 1.45][k], z = hz - 2.05, open = t > 27.3;
        if (k === 1 && t > 26.45) { // the mayor stands and bangs the gavel
          const n = (h: number) => (t - h) * FPS; let kk = 1;
          for (const h of hits) { const m = n(h); if (m >= -9 && m < -5) kk = Math.min(kk, 1 - smooth((m + 9) / 4)); else if (m >= -5 && m < 0) kk = 0; }
          stand(out, cam, w, x, z + 0.25, { expr: open ? "shock" : "stern", prop: ["hammer", q(kk, 12)], facing: 1, phase: t, look: open ? -1 : 0 }, RY);
          for (const h of hits) if (t >= h && t < h + 5 / FPS) { const u = q((t - h) / (5 / FPS), 10); out.fx.push({ key: `burst${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u), x: x + 0.45, y: RY + 0.95, z: hz - 1.15, w: 0.8, h: 0.8 }); }
          return;
        }
        out.places.push(person(cam, w, x, RY + 0.44, z, false, false, { mode: "sit", expr: open ? (k % 2 ? "shock" : "nervous") : (["stern", "stern", "nervous", "stern"][k] as Expr), look: open ? -1 : 0, blink: lidAt(t, w.i) }));
      });
      DOCS.forEach((w, k) => {
        const t0 = 27.36 + k * 0.18; if (t < t0) return;
        const u = Math.min(1, (t - t0) / 0.95), e = u * (2 - u), dist = 2.3 * e;  // decelerating stride into the room
        const x = HALL_DOOR[0] - 0.4 + dist, z = HALL_DOOR[2] + (k ? 0.45 : -0.35);
        const ph = q((dist / 1.44 + k * 0.5) % 1, 24);
        out.places.push(person(cam, w, x, RY, z, false, false, { mode: u < 1 ? "march" : "stand", phase: ph, expr: "stern", blink: lidAt(t, w.i), pose: k === 0 && u >= 1 ? "flask" : undefined }));
        blob(out, x, RY, z);
      });
      break;
    }
    case 17: case 18: { // the chamber: the verdict ("Hot blood") and the cure ("dance it out")
      const [hx, , hz] = HALL, hot = 28.98, tz = 30.92;
      COUNCILS.forEach((w, k) => {
        const x = hx + [-1.45, -0.48, 0.48, 1.45][k], z = hz - 2.05;
        let expr: Expr = "nervous", look = k < 2 ? 1 : -1;
        if (id === 17) expr = t < hot ? (k % 2 ? "squint" : "nervous") : "shock";
        else if (t < 30.1) expr = "shock";
        else if (t < tz) { expr = "nervous"; look = k % 2 ? 1 : -1; }      // they look at each other
        else expr = k % 2 ? "laugh" : "grin";
        if (id === 18 && k === 1 && t > 30.95) { // the mayor approves: up, gavel on "out"
          const h = 31.3, m = (t - h) * FPS; const kk = m >= -9 && m < -5 ? 1 - smooth((m + 9) / 4) : m >= -5 && m < 0 ? 0 : 1;
          stand(out, cam, w, x, z + 0.25, { expr: "grin", prop: ["hammer", q(kk, 12)], facing: 1, phase: t }, RY);
          if (t >= h && t < h + 5 / FPS) { const u = q((t - h) / (5 / FPS), 10); out.fx.push({ key: `burst${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u), x: x + 0.45, y: RY + 0.95, z: hz - 1.15, w: 0.8, h: 0.8 }); }
          return;
        }
        out.places.push(person(cam, w, x, RY + 0.44, z, false, false, { mode: "sit", expr, look, blink: lidAt(t, w.i), headTilt: id === 18 && t > tz ? q(5 * Math.sin(t * 8 + k), 1) : 0 }));
      });
      // the second doctor waits by the door side, nodding
      stand(out, cam, DOCS[1], hx - 1.95, hz + 0.75, { expr: id === 17 ? (t < hot ? "stern" : "shock") : t < tz ? "stern" : "grin", phase: t, headTilt: id === 18 && t > tz ? q(6 * Math.sin(t * 9), 1) : 0, look: 1 }, RY);
      const [dx, , dz] = HDOC, w0 = DOCS[0];
      if (id === 17) {
        if (t < 28.8) stand(out, cam, w0, dx, dz, { expr: "squint", pose: "flask", phase: t, headTilt: -6, tilt: -3, blink: 0 }, RY);
        else {
          // insert: his face behind the flask; the flask boils red on "Hot", a steam puff pops on "blood"
          stand(out, cam, w0, dx, dz, { expr: t < hot + 0.1 ? "squint" : "shock", phase: t, blink: 0, tilt: t > hot ? q(2 * Math.sin(t * 40), 1) : 0 }, RY);
          const heat = q(smooth((t - hot) / 0.3), 16), bb = q((t * 1.7) % 1, 24), eye = q(smooth((t - hot) / 0.12), 4);
          const sh = t > hot ? 0.004 * Math.sin(t * 70) : 0;
          out.fx.push({ key: `fhot${heat}|${bb}|${eye}`, cw: 440, ch: 640, draw: (p) => fxFlaskHot(p, heat, bb, eye), x: HFLASK[0] + sh, y: HFLASK[1], z: HFLASK[2], w: 0.36, h: 0.524, soft: true });
          if (t > hot) {
            const k2 = smooth((t - hot) / 0.25);
            out.fx.push({ key: "glowBlood", cw: 256, ch: 256, draw: (p) => fxGlow(p, "rgba(255,40,40,0.75)"), x: HFLASK[0], y: HFLASK[1] - 0.04, z: HFLASK[2] - 0.12, w: 0.95 * k2, h: 0.95 * k2, soft: true });
            for (let n = 0; n < 4; n++) {
              const a = ((t - hot) * 1.3 + n / 4) % 1, sz = 0.07 + 0.16 * a;
              out.fx.push({ key: `curl${q(a, 12)}`, cw: 300, ch: 300, draw: (p) => fxCurl(p, q(a, 12)), x: HFLASK[0] + 0.05 * Math.sin(a * 7 + n), y: HFLASK[1] + 0.23 + 0.3 * a, z: HFLASK[2] + 0.01 * n, w: sz, h: sz });
            }
          }
          if (t > 29.24 && t < 29.6) { const v = q((t - 29.24) / 0.36, 10); out.fx.push({ key: `puff${v}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, v), x: HFLASK[0], y: HFLASK[1] + 0.3, z: HFLASK[2] + 0.02, w: 0.32, h: 0.32 }); }
        }
      } else {
        // turns to the council, points to the window ("cure"), then shows them the jig on "dance it out"
        if (t < tz) stand(out, cam, w0, dx, dz, { expr: t < 30.1 ? "stern" : "grin", pose: t > 30.1 ? "point" : "hold", phase: t, look: -1, facing: -1 }, RY);
        else dancer(out, cam, w0, dx, dz, t, { energy: 0.75, armsUp: 0.7, expr: "laugh" }, RY);
      }
      break;
    }
    case 99: {
      const docT = 26.4, arr = smooth((t - docT) / 1.5);
      COUNCILS.forEach((w, k) => {
        const z = -2.4 + k * 1.6, expr: Expr = id === 18 ? (k % 2 ? "grin" : "smile") : "stern";
        if (id === 17) return;
        const nod = id === 18 ? q(5 * Math.sin(t * 7 + k), 1) : undefined;
        stand(out, cam, w, 26.3, z, { expr, pose: id === 18 && k === 2 ? "cheer" : k === 1 ? "scroll" : "hips", phase: t, headTilt: nod, play: q(t % 1, 12) });
      });
      DOCS.forEach((w, k) => {
        const zEnd = k ? -4.6 : -2.9, xEnd = k ? 23.3 : 24.1, z = id === 16 ? zEnd - (1 - arr) * 2.2 : zEnd, x = xEnd;
        if (id === 16 && t < docT) return;
        const walking = id === 16 && arr < 1;
        if (walking) {
          // side view, feet planted: speed = d z / d t of the smooth arrival, steps 0.72 m
          const mir = cam.right.z < 0, ph = q(((2.2 * arr) / 1.44 + k * 0.3) % 1, 24); // phase from the distance walked: planted feet
          out.places.push(person(cam, w, x, D0, z, true, mir, {}, { mode: "march", phase: ph, expr: "stern", stomp: 0.45, stride: 0.9, blink: lidAt(t, w.i) }));
          blob(out, x, D0, z);
          return;
        }
        let fo: FrontOpts = { mode: "stand", phase: q((t * 1.4) % 1, 16), expr: "stern", blink: lidAt(t, w.i) };
        if (id === 17 && k === 0) fo = t < 28.58 ? { mode: "stand", pose: "flask", expr: "squint", blink: 0, headTilt: -6, tilt: -3 }
          : { mode: "stand", pose: "hold", expr: t < 28.7 ? "squint" : "shock", blink: 0, tilt: q(2 * Math.sin(t * 30), 1) };
        if (id === 18) fo = k === 0 ? { mode: "stand", pose: "point", expr: "grin", blink: lidAt(t, w.i) } : { mode: "stand", pose: "cheer", play: q(t % 1, 12), expr: "laugh", blink: lidAt(t, w.i) };
        out.places.push(person(cam, w, x, D0, z, false, false, fo));
        blob(out, x, D0, z);
        if (id === 17 && k === 0 && t >= 28.58) {
          // the flask fills the frame: yellow -> red on "Hot", boiling, steam curls out of the neck
          const heat = q(smooth((t - 28.6) / 0.25), 12), b = q((t * 1.6) % 1, 24);
          out.fx.push({ key: `flask${heat}|${b}`, cw: 420, ch: 560, draw: (p) => fxFlaskBig(p, heat, b), x: FLASK[0], y: FLASK[1], z: FLASK[2], w: 0.33, h: 0.44 });
          for (let n = 0; n < 3 && t > 28.65; n++) {
            const a = ((t - 28.65) * 1.1 + n / 3) % 1, s = 0.12 + 0.22 * a;
            out.fx.push({ key: `curl${q(a, 12)}`, cw: 300, ch: 300, draw: (p) => fxCurl(p, q(a, 12)), x: FLASK[0] + 0.06 * Math.sin(a * 7 + n), y: FLASK[1] + 0.26 + 0.42 * a, z: FLASK[2] - 0.01 * n, w: s, h: s });
          }
          if (t < 28.8) { const v = q((t - 28.6) / 0.2, 8); out.fx.push({ key: `burstR${v}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, v, "#ffb3a0", 12, 60, 240, false), x: FLASK[0], y: FLASK[1], z: FLASK[2] + 0.05, w: 0.7, h: 0.7 }); }
        }
      });
      squareCrowd(out, cam, t, 420, { energy: 0.8, keep: (x) => x < 16 });
      break;
    }
    case 19: { // workers carry the grain away
      [0, 1, 2, 3, 4].forEach((k) => {
        const u = Math.max(0, t - 31.75 - k * 0.12) * 1.1, x0 = [-15.6, -13.8, -16.4, -14.6, -12.9][k], z0 = [-10.4, -9.2, -8.6, -11.6, -10.9][k];
        const x = x0 + u * 0.62, z = z0 - u * 0.78;
        out.places.push(person(cam, { i: 70 + k, o: WORKER(k), okey: `wk${k}` }, x, D0, z, false, false, { mode: "stroll", pose: "sack", phase: q((t * 1.5) % 1, 16), expr: "pained" }));
        blob(out, x, D0, z);
      });
      squareCrowd(out, cam, t, 420, { energy: 0.8, keep: (x, z) => x > -6 && z < 8, clear: 5 });
      break;
    }
    case 20: { // build a stage
      const hits = [33.32, 33.66, 33.96];
      [-1.1, 0.15, 1.35].forEach((x, k) => {
        const th = hits[k] ?? 34, n = (t - th) * FPS, kk = n >= -11 && n < -7 ? 1 - smooth((n + 11) / 4) : n >= -7 && n < 0 ? 0 : 1;
        stand(out, cam, { i: 80 + k, o: WORKER(k), okey: `wk${k}` }, x, 10.6, { expr: "grin", prop: ["hammer", q(kk, 12)], facing: 1, phase: t });
        if (t >= th && t < th + 5 / FPS) { const u = q((t - th) / (5 / FPS), 10); out.fx.push({ key: `burst${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u), x: x + 0.6, y: D0 + 1.25, z: 11.3, w: 0.9, h: 0.9 }); }
      });
      squareCrowd(out, cam, t, 420, { energy: 0.8, keep: (x, z) => z < 6, clear: 5.5 });
      break;
    }
    case 21: { // "hire musicians": a fat purse flies in, the band catches it in a burst of gold and starts to play
      band(out, cam, t, t > 34.58);
      const t0 = 34.18, t1 = 34.52, u = clamp01((t - t0) / (t1 - t0));
      if (t > t0 && t < t1) {
        const x = 2.0 + (1.0 - 2.0) * u, z = 11.2 + (14.0 - 11.2) * u, yy = D0 + 2.0 + (2.3 - 2.0) * u + 0.5 * Math.sin(Math.PI * u);
        out.fx.push({ key: "purse", cw: 220, ch: 240, draw: fxPurse, x, y: yy, z, w: 0.32, h: 0.35, rot: q(u * 7, 8) });
      }
      if (t >= t1 && t < t1 + 0.3) {
        const v = q((t - t1) / 0.3, 10);
        out.fx.push({ key: `burstG${v}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, v, "#ffd84a", 12, 40, 230), x: 1.0, y: D0 + 2.3, z: 14.0, w: 1.0, h: 1.0 });
        out.fx.push({ key: `coins${v}`, cw: 420, ch: 210, draw: (p) => fxStars(p, v), x: 1.0, y: D0 + 2.6 + 0.2 * v, z: 13.95, w: 0.8, h: 0.4 });
      }
      squareCrowd(out, cam, t, 420, { energy: 0.8 });
      break;
    }
    case 22: {
      dancer(out, cam, { i: 90, o: PRO(0), okey: "pro0" }, 0, 0.6, t, { energy: 1, armsUp: 1, expr: "laugh", rate: 1 });
      dancer(out, cam, { i: 91, o: PRO(1), okey: "pro1" }, -1.8, 2.4, t, { energy: 1, armsUp: 1, expr: "grin" });
      dancer(out, cam, { i: 92, o: PRO(2), okey: "pro2" }, 1.9, 2.9, t, { energy: 1, armsUp: 1, expr: "grin" });
      squareCrowd(out, cam, t, 420, { energy: 0.75, clear: 4.2, keep: (x, z) => Math.hypot(x, z - 0.6) > 1.3 && Math.hypot(x + 1.8, z - 2.4) > 1.2 && Math.hypot(x - 1.9, z - 2.9) > 1.2 });
      band(out, cam, t);
      break;
    }
    case 23: {
      [[27.45, -1.5], [27.55, 0.1], [27.45, 1.7]].forEach(([x, z], k) => stand(out, cam, COUNCILS[k], x, z, { expr: k === 1 ? "laugh" : "grin", pose: k === 1 ? "cheer" : "hips", phase: t, play: q(t % 1, 12) }, D0 + 0.36));
      band(out, cam, t);
      squareCrowd(out, cam, t, 420, { energy: 0.85, keep: (x) => x < 25.2, clear: 2.8 });
      for (let k = 0; k < 12; k++) { // dancers right below the town hall steps
        const x = 23.8 + hh(k, 41) * 1.6, z = -4.4 + k * 0.75 + hh(k, 42) * 0.4;
        if (cam.pos.distanceTo(tmp.set(x, D0 + 1.2, z)) < 2.6) continue;
        dancer(out, cam, folk(k + 700), x, z, t, { energy: 0.8, armsUp: hh(k, 43), expr: TIRED[k % 8] });
      }
      break;
    }
    case 24: band(out, cam, t); squareCrowd(out, cam, t, 420, { worse: true, energy: 0.9 }); break;
    case 25: { // collapse (golden)
      const tf = 43.08, k = clamp01((t - tf) / 0.3);   // tips over on "death"
      if (t < tf) dancer(out, cam, folk(33), 0, -2.9, t, { energy: 0.6, armsUp: 0.2, expr: "pained" });
      else {
        // tips over sideways: the card rolls about its feet, head to screen left; lying body centred on the spot
        const kk = smooth(k), off = 0.95 * kk, y = D0 + 0.22 * kk;
        const px = 0 + cam.right.x * off, pz = -2.9 + cam.right.z * off;
        out.places.push({ ...person(cam, folk(33), px, y, pz, false, false, { mode: k < 1 ? "fall" : "stand", expr: "dazed", blink: 0 }), roll: 1.5 * kk });
        const u = q((t * 0.9) % 1, 20);
        if (k >= 1) out.fx.push({ key: `stars${u}`, cw: 420, ch: 210, draw: (p) => fxStars(p, u), x: -cam.right.x * 1.05, y: D0 + 0.62, z: -2.9 - cam.right.z * 1.05, w: 0.6, h: 0.3 });
        if (t < tf + 0.4) { const v = q((t - tf) / 0.4, 10); out.fx.push({ key: `puff${v}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, v), x: 0, y: D0 + 0.3, z: -2.7, w: 1.4, h: 1.4 }); }
      }
      band(out, cam, t);
      squareCrowd(out, cam, t, 420, { worse: true, energy: 0.8, clear: 4.8, keep: (x, z) => Math.hypot(x, z + 2.9) > 1.8 });
      break;
    }
    case 26: band(out, cam, t); squareCrowd(out, cam, t, 420, { worse: true, energy: 0.9 }); break;
    case 27: { // starving (night): the family at the bare table, one candle; then the shrine
      if (t < 49.86) {
        const [hx, , hz] = HOME, z = hz - 1.62, cough = t > 49.22 && t < 49.9;
        const sit = (k: number, x: number, o: Outfit, expr: Expr, sc = 1, extra: FrontOpts = {}) =>
          out.places.push(person(cam, { i: 100 + k, o, okey: `st${k}` }, x, RY + 0.36 + (sc < 1 ? 0.06 : 0), z, false, false, { mode: "sit", expr, blink: lidAt(t, 100 + k), ...extra }, {}, sc));
        sit(0, hx - 0.56, FOLKS[1], t > 48.8 ? "pained" : "tired", 1, { look: t > 47.7 && t < 48.8 ? 1 : 0, headTilt: -4 });
        sit(1, hx + 0.02, KIDF, t > 47.6 ? "pained" : "tired", 0.72, { headTilt: q(4 * Math.sin(t * 2), 1) });
        sit(2, hx + 0.56, FOLKS[0], cough ? "pained" : "tired", 1, { tilt: cough ? q(3 * Math.sin(t * 40), 1) : 0, headTilt: cough ? 10 : 3 });
        if (t > 47.65 && t < 48.7) { const u = q(t % 1, 12); out.fx.push({ key: `creak${u}`, cw: 300, ch: 300, draw: (p) => fxCreak(p, u), x: hx + 0.17, y: RY + 0.92, z: z + 0.25, w: 0.26, h: 0.26, rot: 0.3 }); }
        if (cough) { const u = q(((t - 49.22) * 2.2) % 1, 10); out.fx.push({ key: `puff${u}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, u), x: hx + 0.4, y: RY + 1.32, z: z + 0.25, w: 0.42, h: 0.42 }); }
        // the candle: flame, halo, a warm pool on the table and a faint warm wash on the family
        const cu = q((t * 1.3) % 1, 8), cx = hx + 0.3, cz = hz - 0.98;
        out.fx.push({ key: `flame${cu}`, cw: 120, ch: 200, draw: (p) => fxFlame(p, cu), x: cx, y: RY + 1.04, z: cz, w: 0.06, h: 0.1 });
        out.fx.push({ key: "candleGlow", cw: 256, ch: 256, draw: (p) => fxGlow(p, "rgba(255,190,110,0.9)"), x: cx, y: RY + 1.04, z: cz + 0.02, w: 0.6, h: 0.6, soft: true });
        out.fx.push({ key: "glowWarm", cw: 256, ch: 256, draw: (p) => fxGlow(p, "rgba(255,200,120,0.85)"), x: cx, y: RY + 1.02, z: cz - 0.05, w: 1.2, h: 1.0, soft: true });
        out.fx.push({ key: "glowWarmGround", cw: 256, ch: 256, draw: (p) => fxGlow(p, "rgba(255,190,110,0.35)"), x: cx - 0.2, y: RY + 0.83, z: cz + 0.1, w: 2.4, h: 1.0, soft: true, flat: true });
        break;
      }
      lanternGlow(out);
      statue(out, cam, t);
      break;
    }
    case 28: statue(out, cam, t); break;
    case 29: { // fear -> exhaustion -> belief -> the body follows
      const tf = 59.48, ramp = smooth((t - tf) / 0.9);
      const expr: Expr = t < 55.3 ? "nervous" : t < 56.2 ? "scared" : t < 57.9 ? "tired" : "dazed";
      const who = { i: 120, o: FOLKS[2], okey: "vil" };
      const shiver = t > 55.3 && t < 57.9 ? 0.012 * (Math.round(t * 15) % 2 ? 1 : -1) : 0;
      if (t < tf) stand(out, cam, who, -66 + shiver, -1.1, { expr, phase: t, pose: t < 57.9 ? "plead" : undefined, play: q(t * 2 % 1, 12), tilt: t > 56.2 && t < 57.9 ? -4 : undefined });
      if (t > 56.25 && t < 57.6) { const a = (t - 56.25) / 1.35; out.fx.push({ key: "sweat", cw: 120, ch: 160, draw: fxDrop, x: -66 + 0.2 * cam.right.x, y: D0 + 2.05 - 0.35 * a * a, z: -1.0 + 0.2 * cam.right.z, w: 0.07, h: 0.095 }); }
      else dancer(out, cam, who, -66, -1.1, t, { energy: 0.3 + 0.7 * ramp, armsUp: ramp, expr: "dazed" });
      if (t > 57.9) { const u = q((t * 0.6) % 1, 24); out.fx.push({ key: `swirl${u}`, cw: 400, ch: 400, draw: (p) => fxSwirl(p, u), x: -66, y: D0 + 2.65, z: -1.0, w: 0.9, h: 0.9, soft: false }); }
      lanternGlow(out);
      break;
    }
    case 30: { // one yawn spreads along the wall
      [-67.2, -66.4, -65.6, -64.8].forEach((x, k) => {
        const ty = 60.72 + k * 0.38, yawn = t > ty && t < ty + 1.0;
        out.places.push(person(cam, { i: 130 + k, o: FOLKS[(k * 5 + 1) % 12], okey: `y${k}` }, x, D0, -4.2, false, false, { mode: "sit", expr: yawn ? "yawn" : "tired", blink: yawn ? 0 : lidAt(t, 130 + k) }));
        blob(out, x, D0, -4.2);
      });
      break;
    }
    case 31: { // the council bans music
      const hits = [63.72, 64.12], n = (h: number) => (t - h) * FPS;
      let kk = 1; for (const h of hits) { const m = n(h); if (m >= -11 && m < -7) kk = Math.min(kk, 1 - smooth((m + 11) / 4)); else if (m >= -7 && m < 0) kk = 0; }
      stand(out, cam, COUNCILS[2], SIGN[0] + 0.95, SIGN[2] - 0.75, { expr: "stern", prop: ["hammer", q(kk, 12)], facing: -1, phase: t });
      stand(out, cam, COUNCILS[0], SIGN[0] + 2.4, SIGN[2] - 1.6, { expr: "stern", pose: "scroll", phase: t });
      for (const h of hits) if (t >= h && t < h + 5 / FPS) { const u = q((t - h) / (5 / FPS), 10); out.fx.push({ key: `burst${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u), x: SIGN[0] + 0.3, y: D0 + 1.6, z: SIGN[2] - 0.35, w: 0.9, h: 0.9 }); }
      band(out, cam, t, false, clamp01((t - 64.0) / 2.2));
      squareCrowd(out, cam, t, 420, { energy: 0.35, keep: (x, z) => z < 5, clear: 6 });
      break;
    }
    case 32: case 33: case 34: case 35: procession(out, cam, t, id); break;
  }
  return out;
};

const statue = (out: Stage, cam: CamInfo, t: number) => {
  const [sx, , sz] = SHRINE_POST, angry = t > 51.8;
  out.places.push(person(cam, { i: 140, o: STATUE, okey: "statue" }, sx, D0 + 1.68, sz + 0.12, false, false, { mode: "stand", expr: "stern", pose: "point", blink: 0 }, {}, 0.55));
  for (const dx of [-0.32, 0.32]) {
    const u = q((t * 1.3 + dx) % 1, 8);
    out.fx.push({ key: `flame${u}`, cw: 120, ch: 200, draw: (p) => fxFlame(p, u), x: sx + dx, y: D0 + 1.8, z: sz - 0.25, w: 0.07, h: 0.12 });
    out.fx.push({ key: "candleGlow", cw: 256, ch: 256, draw: (p) => fxGlow(p, "rgba(255,190,110,0.9)"), x: sx + dx, y: D0 + 1.82, z: sz - 0.28, w: 0.7, h: 0.7, soft: true });
  }
  if (angry) {
    const k = smooth((t - 51.8) / 0.3);
    out.fx.push({ key: "glowRed", cw: 256, ch: 256, draw: (p) => fxGlow(p, "rgba(255,60,70,0.55)"), x: sx, y: D0 + 2.4, z: sz + 0.32, w: 1.3 * k, h: 1.6 * k, soft: true });
    for (const e of [-1, 1]) out.fx.push({ key: "eyeRed", cw: 256, ch: 256, draw: (p) => fxGlow(p, "rgba(255,70,60,1)"), x: sx + e * 0.034 * cam.right.x, y: D0 + 2.47, z: sz + 0.08 + e * 0.034 * cam.right.z, w: 0.09 * k, h: 0.09 * k, soft: true });
    if (t > 53.4) { const u = q((t * 0.7) % 1, 24), d = clamp01((t - 53.4) / 1.0); out.fx.push({ key: `swirl${u}`, cw: 400, ch: 400, draw: (p) => fxSwirl(p, u), x: sx + 1.2 * d, y: D0 + 2.2 - 0.3 * d, z: sz - 1.6 * d, w: 0.8, h: 0.8 }); }
  }
};

/** the dancers in red shoes walk out to the St Vitus chapel; it stops there */
const RED: Outfit[] = FOLKS.map((o) => ({ ...o, boots: "#d0302f" }));
const procession = (out: Stage, cam: CamInfo, t: number, id: number) => {
  const n = 14;
  for (let k = 0; k < n; k++) {
    const who = { i: 150 + k, o: RED[k % 12], okey: `red${k % 12}` };
    if (id <= 33) {
      const sp = 0.95, z = (id === 33 ? -118 : -136) - k * 1.7 - (t - 64.5) * sp, x = 149.5 + (k % 2 ? 0.55 : -0.55) + (hh(k) - 0.5) * 0.3;
      const ph = q(((t * sp / 1.44) + k * 0.37) % 1, 24); // 0.72 m steps: no foot sliding
      const side = id === 33 || id === 32 || Math.abs(cam.pos.x - x) > 6;
      const so: SideOpts = { mode: "march", phase: ph, expr: "tired", stomp: 0.5, stride: 0.9, blink: lidAt(t, who.i) };
      out.places.push(person(cam, who, x, D0, z, side, id === 32 ? cam.right.z > 0 : false, { mode: "stroll", phase: ph, expr: "tired", blink: lidAt(t, who.i) }, so));
      blob(out, x, D0, z);
    } else {
      const row = Math.floor(k / 5), x = CHAPEL[0] - 2.4 + (k % 5) * 1.2 + (row % 2) * 0.5, z = CHAPEL[2] + 9.5 + row * 1.3;
      const expr: Expr = id === 34 ? (t < 68.2 ? "tired" : (["relief", "relief_open", "smile_closed", "relief"] as Expr[])[k % 4]) : (["relief", "smile_closed", "smile"] as Expr[])[k % 3];
      stand(out, cam, who, x, z, { expr, phase: t, pose: k % 4 === 1 && t > 68.3 ? "cheer" : undefined, play: q(t % 1, 8) });
    }
  }
};
