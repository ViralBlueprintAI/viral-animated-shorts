// Strasbourg, 1518, as one three.js scene for "The Dancing Plague": sky (day / golden / night), the grain market square
// with the stage, Frau Troffea's street, the town hall, the cathedral, the wayside shrine of St Vitus and the St Vitus
// chapel outside the city. Built with the MIT engine pieces (build.ts, paint.ts,
// shade.ts, cast.ts sprites). update(id, f, camera) poses everything for shot `id` at frame f.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Batch, boxGeo, V, lam, Kit, Ray, kitClone, house, prop, quad, tri, setSight, WINDOWS } from "./build";
import { rep, ctex, planksHD, beamHD, stoneHD, cobbleHD, grassHD, cloudHD, roofHD, rng, brick } from "./paint";
import { Pen, INK } from "./toon";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx } from "./cast";
import { FPS, D0, SHOTS, camAt, V3, ShotDef, STAGE, SHRINE_POST, CHAPEL, SIGN, DOOR, smooth, clamp01 } from "./s_story";
import { stageCast, SACKS, sackGone, stageBuild, doorAngle } from "./s_cast";
import { buildRooms, Rooms, hallDoorAngle } from "./s_rooms";

const staticFile = (p: string) => "/" + p;
const KENNEY = ["food/bowl", "food/pot", "food/mug", "food/bread", "dungeon/barrel", "dungeon/chest", "dungeon/shield-round", "tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree_cone", "tree-high-round", "tree", "plant_bushLarge", "plant_bushDetailed",
  "plant_bush", "hedge", "flower_redA", "flower_yellowA", "flower_purpleA", "lantern", "cart", "stall-red", "stall-green", "stall-bench", "banner-red", "banner-green"];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(KENNEY.map((n) => loader.loadAsync(staticFile(`bridge/kenney/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});
/** per-shot sun override: degrees from the camera forward axis (+ = screen right), elevation */
const SUN_SHOT: Record<number, { az?: number; el?: number }> = { 2: { az: 110, el: 40 }, 12: { az: 120, el: 50 }, 25: { az: 25, el: 12 }, 26: { az: -20, el: 10 }, 35: { az: -35, el: 8 } };

const WIDE = new Set([2, 11, 12, 24, 26, 35]);
/** every lens of the film looking at its subject (houses in the way are left out) */
const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) for (let f = s.a - 8; f < s.b + 8; f += 2) {
    const c = camAt(s.id, Math.max(0, f)), o = V(...c.pos), look = V(...c.look);
    // high wide shots look over the roofs: only their centre line may clear a house (the lens never sits in a roof)
    const coreOnly = WIDE.has(s.id);
    const fw = look.clone().sub(o), len = fw.length();
    fw.normalize();
    const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
    const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
    for (const [sx, sy] of coreOnly ? [[0, 0]] : [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
      out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len, core: sx === 0 && sy === 0 });
  }
  return out;
};

function quadUp(x0: number, x1: number, z0: number, z1: number, u: number, v: number, dy = 0) {
  const y = D0 + dy, g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
}
/** flat strip on the ground from a to b, width w (roads); uv tiles every `tile` m */
function strip(a: [number, number], b: [number, number], w: number, dy: number, tile: number) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), nx = -dz / l * w / 2, nz = dx / l * w / 2, y = D0 + dy;
  return quad(V(a[0] - nx, y, a[1] - nz), V(a[0] + nx, y, a[1] + nz), V(b[0] + nx, y, b[1] + nz), V(b[0] - nx, y, b[1] - nz), w / tile, l / tile);
}

// ---------------- painted pieces ----------------
const PINK = ["#d99a86", "#cf8d79", "#e0a692", "#c9846f"];
const cathFacade = () => ctex("cathFacade", 1040, 1840, (g, r) => {
  const W = 1040, H = 1840; // 26 x 46 m at 40 px/m
  g.fillStyle = "#d89a85"; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "255,240,230" : "120,60,50"},0.06)`; g.fillRect(r() * W, r() * H, 30 + r() * 80, 12 + r() * 30); }
  // vertical tracery ("harp strings" of the Strasbourg west front)
  g.strokeStyle = "rgba(120,60,55,0.55)"; g.lineWidth = 3;
  for (let x = 30; x < W; x += 26) { g.beginPath(); g.moveTo(x, 160); g.lineTo(x, H - 420); g.stroke(); }
  g.fillStyle = "rgba(255,235,225,0.25)"; for (let x = 33; x < W; x += 26) g.fillRect(x, 160, 3, H - 580);
  // string courses
  for (const yy of [150, 700, 1180, 1420]) { g.fillStyle = "#b9776a"; g.fillRect(0, yy, W, 22); g.fillStyle = "rgba(255,240,230,0.35)"; g.fillRect(0, yy, W, 5); }
  // rose window
  const cx = W / 2, cy = 900, R = 230;
  g.fillStyle = "#b9776a"; g.beginPath(); g.arc(cx, cy, R + 26, 0, Math.PI * 2); g.fill();
  const gr = g.createRadialGradient(cx, cy, 20, cx, cy, R); gr.addColorStop(0, "#f2c75a"); gr.addColorStop(0.35, "#4a6fb5"); gr.addColorStop(0.7, "#8c3b6a"); gr.addColorStop(1, "#3a4f9a");
  g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#d89a85"; g.lineWidth = 10;
  for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8; g.beginPath(); g.moveTo(cx + 40 * Math.cos(a), cy + 40 * Math.sin(a)); g.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a)); g.stroke(); }
  for (const rr of [40, 120, R]) { g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.stroke(); }
  g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, R + 26, 0, Math.PI * 2); g.stroke();
  // three portals with gables
  for (const [px, pw, ph] of [[W / 2, 220, 380], [170, 150, 280], [W - 170, 150, 280]] as const) {
    const base = H - 10;
    g.fillStyle = "#b9776a"; g.beginPath(); g.moveTo(px - pw / 2 - 40, base); g.lineTo(px - pw / 2 - 40, base - ph); g.lineTo(px, base - ph - pw * 0.9); g.lineTo(px + pw / 2 + 40, base - ph); g.lineTo(px + pw / 2 + 40, base); g.fill();
    g.strokeStyle = INK; g.lineWidth = 4; g.stroke();
    g.fillStyle = "#4a2a22"; g.beginPath(); g.moveTo(px - pw / 2, base); g.lineTo(px - pw / 2, base - ph + pw / 2); g.arc(px, base - ph + pw / 2, pw / 2, Math.PI, 0); g.lineTo(px + pw / 2, base); g.fill();
    g.strokeStyle = "rgba(255,230,220,0.35)"; g.lineWidth = 6; for (let k = 1; k < 4; k++) { g.beginPath(); g.arc(px, base - ph + pw / 2, pw / 2 + k * 9, Math.PI, 0); g.stroke(); }
  }
  // statues / niches row
  for (let x = 60; x < W - 40; x += 70) { g.fillStyle = "rgba(90,40,35,0.45)"; g.fillRect(x, 1240, 30, 140); g.fillStyle = "#e2ab98"; g.fillRect(x + 6, 1262, 18, 112); }
});
const signTex = () => ctex("noMusicSign", 700, 520, (g) => {
  const p = new Pen(g), RED = "#d42f2f";
  g.fillStyle = "#f3e6c4"; g.fillRect(14, 14, 672, 492);
  g.strokeStyle = INK; g.lineWidth = 14; g.strokeRect(14, 14, 672, 492);
  // lute + drum + note: music
  p.ell(260, 300, 95, 120, "#c98a4b", 10, 0, 360, -35);
  p.dot(250, 290, 26, "#3a2a22");
  p.line([[300, 230], [420, 90]], "#6e4326", 26);
  p.poly([[400, 70], [450, 40], [470, 70], [430, 110]], "#6e4326", 9);
  p.poly([[470, 300], [600, 300], [600, 420], [470, 420]], "#f1ece0", 9);
  p.poly([[460, 290], [610, 290], [610, 318], [460, 318]], "#c9373a", 8);
  p.ell(150, 140, 30, 22, INK, 0, 0, 360, -20); p.stroke([[176, 132], [176, 50]], 12); p.poly([[176, 50], [220, 70], [220, 100], [176, 84]], INK, 0);
  for (const [a, b] of [[[96, 70], [604, 452]], [[604, 70], [96, 452]]] as [[number, number], [number, number]][]) {
    p.stroke([a, b], 58, "#ffffff"); p.stroke([a, b], 42, RED);
  }
});
const clothTex = () => ctex("stageCloth", 512, 256, (g) => {
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#e2b33c" : "#b8333a"; g.fillRect(i * 64, 0, 64, 256); }
  g.fillStyle = "rgba(0,0,0,0.15)"; g.fillRect(0, 220, 512, 36);
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#b8333a" : "#e2b33c"; g.beginPath(); g.moveTo(i * 64, 256); g.lineTo(i * 64 + 32, 200); g.lineTo(i * 64 + 64, 256); g.fill(); }
});
const sackTex = () => ctex("sack", 256, 256, (g, r) => {
  g.fillStyle = "#cdb07a"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,240,200,0.12)" : "rgba(90,60,30,0.12)"; g.fillRect(r() * 256, r() * 256, 2 + r() * 6, 2); }
  g.strokeStyle = "rgba(90,60,30,0.4)"; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 120); g.lineTo(256, 130); g.stroke();
});
const dirtTex = () => { const t = ctex("dirtRoad", 512, 512, (g, r) => {
  g.fillStyle = "#c9a877"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 300; i++) { const l = r() < 0.5; g.fillStyle = l ? "rgba(255,240,210,0.12)" : "rgba(110,80,50,0.12)"; g.beginPath(); g.ellipse(r() * 512, r() * 512, 6 + r() * 26, 3 + r() * 10, r() * 3, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 90; i++) { g.fillStyle = "rgba(120,110,100,0.5)"; g.beginPath(); g.ellipse(r() * 512, r() * 512, 3 + r() * 5, 2 + r() * 3, 0, 0, Math.PI * 2); g.fill(); }
}); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

const NOCULL = typeof location !== "undefined" && location.search.includes("cam=");
const chapelDoorTex = () => ctex("chapelDoor", 190, 330, (g) => {
  const W = 190, H = 330, r = W / 2 - 8;
  const path = (k: number) => { g.beginPath(); g.moveTo(8 - k, H); g.lineTo(8 - k, H - 230 + 0); g.arc(W / 2, H - 230, r + k, Math.PI, 0); g.lineTo(W - 8 + k, H); g.closePath(); };
  path(6); g.fillStyle = "#b9a78a"; g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
  path(-8); g.fillStyle = "#7a4a2c"; g.fill();
  g.save(); path(-8); g.clip(); for (let x = 20; x < W; x += 22) { g.fillStyle = "rgba(40,20,10,0.45)"; g.fillRect(x, 0, 3, H); }
  g.fillStyle = "#3d414c"; for (const y of [H - 70, H - 190]) g.fillRect(14, y, W - 28, 9); g.restore();
  path(-8); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  g.fillStyle = "#c9a24e"; g.beginPath(); g.arc(W / 2 + 30, H - 120, 7, 0, Math.PI * 2); g.fill();
});
const roseTex = () => ctex("chapelRose", 180, 180, (g) => {
  const c = 90, R = 80;
  g.fillStyle = "#b9a78a"; g.beginPath(); g.arc(c, c, R + 8, 0, Math.PI * 2); g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
  const gr = g.createRadialGradient(c, c, 5, c, c, R); gr.addColorStop(0, "#f2c75a"); gr.addColorStop(0.5, "#4a6fb5"); gr.addColorStop(1, "#8c3b6a");
  g.fillStyle = gr; g.beginPath(); g.arc(c, c, R - 6, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#b9a78a"; g.lineWidth = 6; for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; g.beginPath(); g.moveTo(c, c); g.lineTo(c + R * Math.cos(a), c + R * Math.sin(a)); g.stroke(); }
  g.beginPath(); g.arc(c, c, 24, 0, Math.PI * 2); g.stroke();
});
const slitTex = () => ctex("chapelSlit", 70, 220, (g) => {
  g.fillStyle = "#b9a78a"; g.beginPath(); g.moveTo(4, 220); g.lineTo(4, 35); g.arc(35, 35, 31, Math.PI, 0); g.lineTo(66, 220); g.closePath(); g.fill();
  g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  g.fillStyle = "#4a6fb5"; g.beginPath(); g.moveTo(14, 210); g.lineTo(14, 38); g.arc(35, 38, 21, Math.PI, 0); g.lineTo(56, 210); g.closePath(); g.fill();
});
/** arched doorway / door leaf textures, 110 x 210 px = 1.1 x 2.1 m (matches facadeHD's painted door) */
const archPath = (g: CanvasRenderingContext2D, W: number, H: number, k = 0) => {
  g.beginPath(); g.moveTo(k, H); g.lineTo(k, W / 2); g.arc(W / 2, W / 2, W / 2 - k, Math.PI, 0); g.lineTo(W - k, H); g.closePath();
};
const doorwayTex = () => ctex("doorway", 220, 420, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 420); gr.addColorStop(0, "#1c1418"); gr.addColorStop(1, "#3a2a26");
  archPath(g, 220, 420); g.fillStyle = gr; g.fill();
  g.fillStyle = "rgba(255,200,140,0.08)"; g.fillRect(30, 300, 160, 120); // a hint of floor inside
});
const leafTex = () => ctex("doorLeaf", 220, 420, (g) => {
  archPath(g, 220, 420); g.fillStyle = "#7a4a2c"; g.fill();
  g.save(); archPath(g, 220, 420); g.clip();
  for (let x = 28; x < 220; x += 28) { g.fillStyle = "rgba(40,20,10,0.5)"; g.fillRect(x - 2, 0, 4, 420); g.fillStyle = "rgba(255,225,190,0.16)"; g.fillRect(x + 2, 0, 3, 420); }
  g.fillStyle = "#3d414c"; for (const y of [120, 330]) g.fillRect(0, y, 220, 16);
  g.restore();
  archPath(g, 220, 420, 3); g.strokeStyle = "#241726"; g.lineWidth = 6; g.stroke();
  g.fillStyle = "#d9b04a"; g.beginPath(); g.arc(180, 240, 9, 0, Math.PI * 2); g.fill();
});
/** a lit window at night: warm pane, cross mullions, a curtain edge (128 x 188 px = 0.85 x 1.25 m) */
const litWinTex = () => ctex("litWin", 128, 188, (g, r) => {
  const gr = g.createLinearGradient(0, 0, 0, 188); gr.addColorStop(0, "#ffe6a8"); gr.addColorStop(0.55, "#ffc464"); gr.addColorStop(1, "#ff9e3e");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 188);
  g.fillStyle = "rgba(255,250,230,0.55)"; g.beginPath(); g.ellipse(64, 70, 40, 54, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(190,90,60,0.55)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(34, 0); g.lineTo(0, 120); g.fill();  // curtain
  g.fillStyle = "#4a2c22"; g.fillRect(60, 0, 8, 188); g.fillRect(0, 84, 128, 8);                                   // mullions
  g.strokeStyle = "#3a2420"; g.lineWidth = 8; g.strokeRect(0, 0, 128, 188);
});
const spillTex = () => ctex("winSpill", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 6, 64, 64, 64); gr.addColorStop(0, "rgba(255,190,110,0.55)"); gr.addColorStop(0.45, "rgba(255,170,90,0.18)"); gr.addColorStop(1, "rgba(255,160,80,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const hash = (x: number, y: number, z: number) => { const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return v - Math.floor(v); };
/** night: about half the windows light up (pane quads + an additive warm spill on the wall around them) */
const nightWindows = () => {
  const pane: number[] = [], puv: number[] = [], spill: number[] = [], suv: number[] = [];
  const up = V(0, 1, 0), quadAt = (pos: number[], uv: number[], c: THREE.Vector3, n: THREE.Vector3, w: number, h: number) => {
    const rt = up.clone().cross(n).normalize().multiplyScalar(w / 2), u = V(0, h / 2, 0);
    const a = c.clone().sub(rt).sub(u), b = c.clone().add(rt).sub(u), cc = c.clone().add(rt).add(u), d = c.clone().sub(rt).add(u);
    for (const q of [a, b, cc, a, cc, d]) pos.push(q.x, q.y, q.z);
    uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  };
  for (const wdw of WINDOWS) {
    if (hash(wdw.p.x, wdw.p.y, wdw.p.z) > (wdw.fl === 0 ? 0.55 : 0.42)) continue;
    quadAt(pane, puv, wdw.p, wdw.n, wdw.w, wdw.h);
    quadAt(spill, suv, wdw.p.clone().addScaledVector(wdw.n, 0.03), wdw.n, wdw.w * 3.0, wdw.h * 2.3);
  }
  const mk = (pos: number[], uv: number[]) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); return g; };
  const panes = new THREE.Mesh(mk(pane, puv), new THREE.MeshBasicMaterial({ map: litWinTex(), color: new THREE.Color(1.7, 1.45, 1.15) }));
  const glow = new THREE.Mesh(mk(spill, suv), new THREE.MeshBasicMaterial({ map: spillTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.2, 1.0, 0.8) }));
  for (const m of [panes, glow]) { m.layers.set(NOINK); m.frustumCulled = false; }
  glow.renderOrder = 2;
  const grp = new THREE.Group(); grp.add(panes, glow); return grp;
};
type Pop = { o: THREE.Object3D; f: number; base: THREE.Vector3 };

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden" | "night", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private city = new THREE.Group();
  private stage = new THREE.Group(); private stagePops: Pop[] = [];
  private market = new THREE.Group(); private sacks: THREE.Object3D[] = [];
  private sign = new THREE.Group();
  private door = new THREE.Group();
  private nightWin: THREE.Group;
  private rooms: Rooms;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root;
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() }, stars: { value: 0 } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; uniform float stars; varying vec3 vP;
        float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        void main(){ vec3 d = normalize(vP); float el = asin(clamp(d.y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          if (stars > 0.0) { vec3 q = floor(d * 260.0); float s = step(0.9965, h3(q)) * smoothstep(0.06, 0.3, el);
            vec3 f = fract(d * 260.0) - 0.5; s *= smoothstep(0.42, 0.12, length(f)); c += stars * s * vec3(0.9, 0.95, 1.0); }
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true,
      transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    const SM = +(new URLSearchParams(location.search).get("scale") || "1") < 0.6 ? 2048 : 4096;
    this.sun.shadow.mapSize.set(SM, SM);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)),
      night: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.night.cloud)) };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }
    setSight(sightLines());
    this.buildGround(R);
    R.add(this.city);
    this.buildCity(this.city, kit);
    this.nightWin = nightWindows(); R.add(this.nightWin);
    setSight([]); this.rooms = buildRooms(kit); setSight(sightLines());
    R.add(this.rooms.home, this.rooms.hall);
    this.buildStage(R);
    this.buildMarket(R, kit);
    // the council's board (shot 31 on)
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.97), new THREE.MeshBasicMaterial({ map: signTex(), alphaTest: 0.5, color: 0xe6e6e6 }));
    board.layers.set(NOINK); board.position.set(SIGN[0], D0 + 1.62, SIGN[2] - 0.04); board.rotation.y = Math.PI + 0.5;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.36, 1.03, 0.06), lam("wood", () => ({ map: beamHD() })));
    back.position.set(SIGN[0] + 0.02, D0 + 1.62, SIGN[2]); back.rotation.y = 0.5;
    this.sign.add(board, back);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.15, 0.12), lam("wood", () => ({ map: beamHD() }))); p.position.set(SIGN[0] + s * 0.48 * Math.cos(0.5), D0 + 1.07, SIGN[2] - s * 0.48 * Math.sin(0.5) + 0.06); this.sign.add(p); }
    this.sign.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    R.add(this.sign);
    // Frau Troffea's front door: a dark doorway over the painted door and a real leaf hinged at its left edge
    const way = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.1), new THREE.MeshBasicMaterial({ map: doorwayTex(), alphaTest: 0.5 }));
    way.position.set(DOOR[0], D0 + 1.05, DOOR[2] + 0.015); way.layers.set(NOINK); R.add(way);
    const leafM = lam("doorLeaf", () => ({ map: leafTex(), alphaTest: 0.5, side: THREE.DoubleSide }));
    for (const dz of [0.0, -0.06]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.9).translate(0.55, 0.95, dz), leafM); m.castShadow = true; m.receiveShadow = true; this.door.add(m); }
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.35, 0.06).translate(1.08, 0.68, -0.03), lam("wood", () => ({ map: beamHD() })));
    edge.castShadow = true; this.door.add(edge);
    this.door.position.set(DOOR[0] - 0.55, D0 + 0.2, DOOR[2] + 0.075);
    R.add(this.door);
  }

  private buildGround(R: THREE.Object3D) {
    const b = new Batch();
    const grass = lam("grassHD", () => ({ map: grassHD() })), cob = lam("cobbleHD", () => ({ map: cobbleHD() }));
    const dirt = lam("dirtRoad", () => ({ map: dirtTex() }));
    b.add(quadUp(-900, 900, -900, 900, 450, 450, -0.06), grass); // a hand below the paving: no z-fight at grazing views
    b.add(quadUp(-27, 27, -23.5, 23.5, 13.5, 11.75), cob);           // grain market square
    b.add(quadUp(-104, -27, -5.3, 5.3, 19.25, 2.65), cob);           // Troffea's street
    b.add(quadUp(-5, 5, 23.5, 100, 2.5, 19.1, -0.002), cob);                // lane to the cathedral
    b.add(quadUp(-30, 60, 96, 104, 22.5, 2, -0.004), cob);                  // cathedral parvis
    // country road: chapel <- fields <- city gate
    const road: [number, number][] = [[150, -171], [150, -70], [128, -40], [80, -26], [40, -22]];
    for (let i = 0; i < road.length - 1; i++) b.add(strip(road[i], road[i + 1], 4.2, -0.004 * (i % 2), 4), dirt);
    b.add(quadUp(144, 156, -178, -166, 3, 3, -0.002), dirt);                // forecourt of the chapel
    b.build(R);
  }

  private buildCity(R: THREE.Object3D, kit: Kit) {
    const b = new Batch(), r = rng(1518);
    const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length) % a.length];
    const TIMBER = [8, 9, 10, 11, 8, 9, 10, 11, 0, 1, 4, 6];
    const hs = () => pick(TIMBER), hh = () => pick([8.4, 9.8, 11.2]);
    /** a row of houses along x (fronts face dir: +1 = +z, -1 = -z) or along z (+1 = +x, -1 = -x) */
    const rowX = (x0: number, x1: number, z: number, dir: 1 | -1, skip: (x: number) => boolean = () => false) => {
      let x = x0;
      while (x < x1) {
        const w = pick([7, 8, 9]), cx = x + w / 2;
        if (!skip(cx) && cx + w / 2 <= x1 + 0.5) house(b, cx, z - dir * 4, dir > 0 ? 0 : Math.PI, w, 8, hh(), hs());
        x += w + 0.15;
      }
    };
    const rowZ = (z0: number, z1: number, x: number, dir: 1 | -1, skip: (z: number) => boolean = () => false) => {
      let z = z0;
      while (z < z1) {
        const w = pick([7, 8, 9]), cz = z + w / 2;
        if (!skip(cz) && cz + w / 2 <= z1 + 0.5) house(b, x - dir * 4, cz, dir > 0 ? Math.PI / 2 : -Math.PI / 2, w, 8, hh(), hs());
        z += w + 0.15;
      }
    };
    // grain market square
    rowX(-27, 27, 24, -1, (x) => Math.abs(x) < 9);
    rowX(-27, 27, -24, 1);
    rowZ(-24, 24, -28, 1, (z) => Math.abs(z) < 9);
    rowZ(-24, -9, 28, -1); rowZ(9, 24, 28, -1);
    // Troffea's street: her house (door at DOOR) on the south side
    const south: [number, number][] = [[-37.75, 7.5], [-43.8, 4.4], [-50, 0], [-58.5, 9], [-66.5, 7], [-74.5, 9], [-83, 8], [-91.5, 9], [-99.5, 7]];
    for (const [x, w] of south) {
      if (w === 0) { setSight([]); house(b, -50, -9, 0, 8, 8, 9.8, 8); setSight(sightLines()); continue; }
      house(b, x, -9.2, 0, w - 0.2, 8, hh(), hs());
    }
    rowX(-104, -32, 5.2, -1);
    // second ring (skyline)
    rowX(-40, 40, 40, -1, (x) => Math.abs(x) < 8); rowX(-40, 40, -40, 1);
    rowX(-104, -36, 21, -1); rowX(-104, -36, -21, 1);
    rowZ(-36, 36, -44, 1, (z) => Math.abs(z) < 16); rowZ(-36, 36, 44, -1, (z) => Math.abs(z) < 30);
    // scattered roofs out to the walls (for the aerials)
    for (let i = 0; i < 90; i++) {
      const x = -130 + r() * 240, z = -80 + r() * 170;
      if (Math.abs(x) < 50 && Math.abs(z) < 46) continue;
      if (x < -30 && Math.abs(z) < 28) continue;
      if (x > -14 && x < 44 && z > 88) continue;
      if (Math.abs(x) < 8 && z > 20) continue;
      if (x > 30 && z < -10 && z > -48) continue; // road out to the chapel
      house(b, x, z, Math.round(r() * 3) * (Math.PI / 2), pick([7, 8, 9]), 8, hh(), hs());
    }
    // ---- hero buildings (always built) ----
    setSight([]);
    house(b, 33.5, 0, -Math.PI / 2, 18, 11, 11, 2);   // town hall, front at x = 28
    setSight(sightLines());
    const stone = lam("cathStone", () => ({ map: stoneHD("cathHD", PINK, "#a86a5c") }));
    const trim = lam("trimStone", () => ({ color: "#efe3c8" })), ws = lam("hallStep", () => ({ map: stoneHD("copeHD") }));
    // town hall steps, door canopy, banners
    for (const [x0, h] of [[26.6, 0.18], [27.2, 0.36]] as const) b.add(boxGeo(V(x0, D0, -3.2), V(28.0, D0 + h, 3.2), 2), ws);
    prop(b, kit, "banner-red", 27.4, D0, -5.6, 4.2, -Math.PI / 2);
    prop(b, kit, "banner-red", 27.4, D0, 5.6, 4.2, -Math.PI / 2);
    // cathedral (Notre-Dame, pink Vosges sandstone): nave, west block, north tower, octagon, spire
    const cx0 = 2, cx1 = 28, cz = 100;
    b.add(boxGeo(V(6, D0, 106), V(24, D0 + 22, 165), 4), stone);
    const roofC = lam("cathRoof", () => ({ map: roofHD("#7d8f8c", true), side: THREE.DoubleSide }));
    b.add(quad(V(5.4, D0 + 21.8, 165.5), V(5.4, D0 + 21.8, 106), V(15, D0 + 32, 106), V(15, D0 + 32, 165.5), 15, 4), roofC);
    b.add(quad(V(24.6, D0 + 21.8, 106), V(24.6, D0 + 21.8, 165.5), V(15, D0 + 32, 165.5), V(15, D0 + 32, 106), 15, 4), roofC);
    b.add(tri(V(6, D0 + 22, 165), V(24, D0 + 22, 165), V(15, D0 + 32, 165)), stone);
    b.add(boxGeo(V(cx0, D0, cz), V(cx1, D0 + 34, cz + 7), 4), stone);
    b.add(quad(V(cx1, D0, cz - 0.03), V(cx0, D0, cz - 0.03), V(cx0, D0 + 34, cz - 0.03), V(cx1, D0 + 34, cz - 0.03)),
      lam("cathFacade", () => ({ map: cathFacade() })));
    b.add(boxGeo(V(cx0 - 0.3, D0 + 33.6, cz - 0.4), V(cx1 + 0.3, D0 + 34.6, cz + 7.4), 2), trim);
    const tx0 = 16, tx1 = 28;
    b.add(boxGeo(V(tx0, D0 + 34, cz), V(tx1, D0 + 50, cz + 7), 4), stone);
    b.add(boxGeo(V(tx0 - 0.3, D0 + 49.6, cz - 0.3), V(tx1 + 0.3, D0 + 50.6, cz + 7.3), 2), trim);
    const oct = new THREE.CylinderGeometry(3.8, 4.4, 10, 8, 1); oct.translate(0, 5, 0);
    b.add(oct, stone, new THREE.Matrix4().makeTranslation(22, D0 + 50.6, cz + 3.5));
    const spire = new THREE.ConeGeometry(3.9, 24, 8, 1); spire.translate(0, 12, 0);
    b.add(spire, stone, new THREE.Matrix4().makeTranslation(22, D0 + 60.6, cz + 3.5));
    for (const s of [-1, 1]) {
      const tur = new THREE.ConeGeometry(0.9, 7, 8); tur.translate(0, 3.5, 0);
      b.add(tur, stone, new THREE.Matrix4().makeTranslation(22 + s * 3.4, D0 + 60.6, cz + 3.5 - s * 1.8));
    }
    // wayside shrine of St Vitus: pillar + open niche (the statue is a card, s_cast.ts)
    const [sx, , sz] = SHRINE_POST, sm = lam("shrineStone", () => ({ map: stoneHD("shrineHD", ["#cfc4b2", "#c4b8a4", "#d8cdbb", "#bdb19d"], "#9a8e7c") }));
    b.add(boxGeo(V(sx - 0.32, D0, sz - 0.32), V(sx + 0.32, D0 + 1.55, sz + 0.32), 1), sm);
    b.add(boxGeo(V(sx - 0.55, D0 + 1.55, sz - 0.4), V(sx + 0.55, D0 + 1.68, sz + 0.45), 1), sm);
    b.add(boxGeo(V(sx - 0.55, D0 + 1.68, sz + 0.3), V(sx + 0.55, D0 + 3.05, sz + 0.45), 1), sm); // back
    for (const s of [-1, 1]) b.add(boxGeo(V(sx + s * 0.55 - (s > 0 ? 0.13 : 0), D0 + 1.68, sz - 0.4), V(sx + s * 0.55 + (s < 0 ? 0.13 : 0), D0 + 3.05, sz + 0.45), 1), sm);
    const nr = lam("roof#7a5a48", () => ({ map: roofHD("#7a5a48"), side: THREE.DoubleSide }));
    b.add(quad(V(sx - 0.75, D0 + 3.0, sz - 0.6), V(sx + 0.75, D0 + 3.0, sz - 0.6), V(sx + 0.75, D0 + 3.45, sz + 0.1), V(sx - 0.75, D0 + 3.45, sz + 0.1), 1, 1), nr);
    b.add(quad(V(sx + 0.75, D0 + 3.0, sz + 0.75), V(sx - 0.75, D0 + 3.0, sz + 0.75), V(sx - 0.75, D0 + 3.45, sz + 0.1), V(sx + 0.75, D0 + 3.45, sz + 0.1), 1, 1), nr);
    const cr = new THREE.BoxGeometry(0.06, 0.4, 0.06), crx = new THREE.BoxGeometry(0.24, 0.06, 0.06);
    b.add(cr, lam("iron", () => ({ color: "#3d414c" })), new THREE.Matrix4().makeTranslation(sx, D0 + 3.65, sz + 0.1));
    b.add(crx, lam("iron", () => ({ color: "#3d414c" })), new THREE.Matrix4().makeTranslation(sx, D0 + 3.72, sz + 0.1));
    // St Vitus chapel: stone nave, steep slate roof, arched door, rose window, bell turret, cross
    const [qx, , qz] = CHAPEL, cw = 3.6, cd = 11, wh = 5.6, rh = 5.0;
    const cs = lam("chapelStone", () => ({ map: stoneHD("chapelHD", ["#e4d8c2", "#dbcdb4", "#ebe0cc", "#d2c3a8"], "#ab9c84") }));
    b.add(boxGeo(V(qx - cw, D0 - 0.05, qz - cd), V(qx + cw, D0 + wh, qz), 2), cs);
    b.add(tri(V(qx - cw, D0 + wh, qz), V(qx + cw, D0 + wh, qz), V(qx, D0 + wh + rh, qz)), cs);
    b.add(tri(V(qx + cw, D0 + wh, qz - cd), V(qx - cw, D0 + wh, qz - cd), V(qx, D0 + wh + rh, qz - cd)), cs);
    const slate = lam("roof#6f7a8a", () => ({ map: roofHD("#6f7a8a", true), side: THREE.DoubleSide }));
    b.add(quad(V(qx - cw - 0.4, D0 + wh - 0.3, qz + 0.4), V(qx - cw - 0.4, D0 + wh - 0.3, qz - cd - 0.4), V(qx, D0 + wh + rh, qz - cd - 0.4), V(qx, D0 + wh + rh, qz + 0.4), 3, 2), slate);
    b.add(quad(V(qx + cw + 0.4, D0 + wh - 0.3, qz - cd - 0.4), V(qx + cw + 0.4, D0 + wh - 0.3, qz + 0.4), V(qx, D0 + wh + rh, qz + 0.4), V(qx, D0 + wh + rh, qz - cd - 0.4), 3, 2), slate);
    const doorT = lam("chapelDoor", () => ({ map: chapelDoorTex(), alphaTest: 0.5 })), roseT = lam("chapelRose", () => ({ map: roseTex(), alphaTest: 0.5 }));
    b.add(quad(V(qx - 0.95, D0, qz + 0.03), V(qx + 0.95, D0, qz + 0.03), V(qx + 0.95, D0 + 3.3, qz + 0.03), V(qx - 0.95, D0 + 3.3, qz + 0.03)), doorT);
    b.add(quad(V(qx - 0.9, D0 + 4.4, qz + 0.03), V(qx + 0.9, D0 + 4.4, qz + 0.03), V(qx + 0.9, D0 + 6.2, qz + 0.03), V(qx - 0.9, D0 + 6.2, qz + 0.03)), roseT);
    for (const s2 of [-1, 1]) for (const zz of [-3, -6.5, -9]) {
      const x = qx + s2 * (cw + 0.03), w = 0.35;
      b.add(s2 < 0 ? quad(V(x, D0 + 2, qz + zz + w), V(x, D0 + 2, qz + zz - w), V(x, D0 + 4.2, qz + zz - w), V(x, D0 + 4.2, qz + zz + w))
        : quad(V(x, D0 + 2, qz + zz - w), V(x, D0 + 2, qz + zz + w), V(x, D0 + 4.2, qz + zz + w), V(x, D0 + 4.2, qz + zz - w)), lam("chapelWin", () => ({ map: slitTex(), alphaTest: 0.5 })));
    }
    b.add(boxGeo(V(qx - 0.75, D0 + wh + rh - 1.2, qz - 1.9), V(qx + 0.75, D0 + wh + rh + 1.6, qz - 0.4), 1), cs);
    const cap = new THREE.ConeGeometry(1.2, 2.6, 4); cap.rotateY(Math.PI / 4); cap.translate(0, 1.3, 0);
    b.add(cap, slate, new THREE.Matrix4().makeTranslation(qx, D0 + wh + rh + 1.6, qz - 1.15));
    b.add(new THREE.BoxGeometry(0.12, 1.1, 0.12), lam("gold", () => ({ color: "#c9a24e" })), new THREE.Matrix4().makeTranslation(qx, D0 + wh + rh + 4.7, qz - 1.15));
    b.add(new THREE.BoxGeometry(0.6, 0.12, 0.12), lam("gold", () => ({ color: "#c9a24e" })), new THREE.Matrix4().makeTranslation(qx, D0 + wh + rh + 4.9, qz - 1.15));
    b.add(boxGeo(V(qx - 1.3, D0 - 0.05, qz), V(qx + 1.3, D0 + 0.16, qz + 1.0), 1), lam("hallStep", () => ({ map: stoneHD("copeHD") })));
    // street furniture: lanterns along the street + square, a well, carts
    for (let x = -96; x <= -34; x += 12) prop(b, kit, "lantern", x, D0, -4.6, 2.8);
    for (const [x, z] of [[-24, -21], [24, -21], [-24, 21], [24, 21]]) prop(b, kit, "lantern", x, D0, z, 2.8);
    const well = new THREE.CylinderGeometry(1.1, 1.15, 0.9, 20, 1, true); well.translate(0, 0.45, 0);
    b.add(well, sm, new THREE.Matrix4().makeTranslation(-19, D0, -16));
    b.add(new THREE.CylinderGeometry(1.0, 1.0, 0.05, 20), lam("wellWater", () => ({ color: "#2a4a6a" })), new THREE.Matrix4().makeTranslation(-19, D0 + 0.7, -16));
    for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(0.14, 2.2, 0.14).translate(0, 1.1, 0), lam("wood", () => ({ map: beamHD() })), new THREE.Matrix4().makeTranslation(-19 + s * 1.0, D0, -16));
    b.add(new THREE.BoxGeometry(2.4, 0.14, 0.14), lam("wood", () => ({ map: beamHD() })), new THREE.Matrix4().makeTranslation(-19, D0 + 2.15, -16));
    prop(b, kit, "cart", -88, D0, 3.4, 2.2, 0.3);
    // countryside: hills, trees, bushes, fields
    const hill = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const hm = [lam("hillA", () => ({ color: "#78b257" })), lam("hillB", () => ({ color: "#6aa24e" })), lam("hillC", () => ({ color: "#8bbf63" }))];
    ([[-360, 250, 190, 52, 120], [140, 420, 240, 64, 140], [430, 150, 170, 48, 130], [-440, -130, 190, 44, 150], [-90, -420, 250, 58, 140],
      [190, -330, 160, 46, 110], [320, -230, 150, 40, 100], [520, -60, 160, 40, 120], [-560, 60, 200, 46, 140], [60, -300, 120, 34, 90]] as const).forEach(([x, z, sx2, sy, sz2], i) =>
      b.add(hill, hm[i % 3], new THREE.Matrix4().compose(V(x, D0 - 2, z), new THREE.Quaternion(), V(sx2, sy, sz2))));
    const trees = ["tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree-high-round", "tree"];
    for (let i = 0; i < 260; i++) {
      const a = r() * Math.PI * 2, d = 120 + r() * 260, x = Math.cos(a) * d * 1.2, z = Math.sin(a) * d;
      if (x > 130 && x < 172 && z < -30 && z > -200) continue;
      if (x > 30 && x < 150 && z > -45 && z < -15) continue;
      prop(b, kit, pick(trees), x, D0, z, 8 + r() * 5, r() * 6);
    }
    // the chapel's grove and the roadside
    for (const [x, z, h] of [[142, -178, 10], [159, -180, 11], [137, -168, 8.5], [163, -166, 9], [155, -188, 12], [144, -190, 10.5], [168, -176, 9.5], [133, -180, 9]] as const)
      prop(b, kit, pick(trees), x, D0, z, h, x);
    for (let z = -150; z < -60; z += 13) { prop(b, kit, pick(trees), 144.5 - r() * 3, D0, z, 7.5 + r() * 3, z); if (z < -150 || z > -100) prop(b, kit, pick(trees), 157 + r() * 3, D0, z + 6, 7.5 + r() * 3, z); }
    for (let i = 0; i < 30; i++) { const bx = 130 + r() * 40, bz = -60 - r() * 120, bh = 1.2 + r(); if (Math.abs(bx - 150) > 9) prop(b, kit, pick(["plant_bushLarge", "plant_bushDetailed", "plant_bush"]), bx, D0, bz, bh, i); }
    b.build(R);
  }

  /** the dance stage on the grain market: pieces pop in one by one in shot 20 ("build a stage") */
  private buildStage(R: THREE.Object3D) {
    const { x0, x1, z0, z1, h } = STAGE, wood = lam("wood", () => ({ map: beamHD() })), pl = lam("planksHD", () => ({ map: planksHD() }));
    const add = (g: THREE.BufferGeometry, m: THREE.Material, base: THREE.Vector3, f: number) => {
      const mesh = new THREE.Mesh(g, m); mesh.position.copy(base); mesh.castShadow = true; mesh.receiveShadow = true;
      this.stage.add(mesh); this.stagePops.push({ o: mesh, f, base: base.clone() });
    };
    let k = 0;
    for (const x of [x0 + 0.3, 0, x1 - 0.3]) for (const z of [z0 + 0.3, z1 - 0.3]) add(new THREE.BoxGeometry(0.28, h, 0.28).translate(0, h / 2, 0), wood, V(x, D0, z), k++ * 0.5);
    const nb = 6, bw = (x1 - x0) / nb;
    for (let i = 0; i < nb; i++) add(new THREE.BoxGeometry(bw - 0.04, 0.16, z1 - z0).translate(0, -0.08, 0), pl, V(x0 + bw * (i + 0.5), D0 + h, (z0 + z1) / 2), 3 + i * 0.8);
    add(new THREE.BoxGeometry(x1 - x0, h - 0.16, 0.08).translate(0, (h - 0.16) / 2, 0), wood, V(0, D0, z0 + 0.02), 8);
    for (const [i, s] of [[0, -1], [1, 1]] as const) add(new THREE.BoxGeometry(0.06, h - 0.16, z1 - z0).translate(0, (h - 0.16) / 2, 0), wood, V(s > 0 ? x1 - 0.02 : x0 + 0.02, D0, (z0 + z1) / 2), 8.5 + i * 0.3);
    for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(1.6, 0.1, 0.4).translate(0, 0.05, 0), pl, V(x1 + 0.8, D0 + (h / 3) * i, z0 + 0.9 + i * 0.4), 9.5 + i * 0.4);
    // back poles + striped cloth
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.09, 0.1, 4.6, 10).translate(0, 2.3, 0), wood, V(s * 4.6, D0 + h, z1 - 0.3), 11 + (s > 0 ? 0.6 : 0));
    const cloth = new THREE.PlaneGeometry(9.0, 1.5, 16, 1);
    const p = cloth.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, 0.12 * Math.sin(p.getX(i) * 2.2));
    cloth.computeVertexNormals(); cloth.translate(0, -0.75, 0);
    add(cloth, lam("stageCloth", () => ({ map: clothTex(), side: THREE.DoubleSide })), V(0, D0 + h + 4.5, z1 - 0.28), 12.5);
    R.add(this.stage);
  }
  /** the grain market before it is cleared: stalls, sacks in heaps, carts */
  private buildMarket(R: THREE.Object3D, kit: Kit) {
    const sackM = lam("sackM", () => ({ map: sackTex() }));
    const g = new THREE.SphereGeometry(0.42, 16, 10); g.scale(1, 1.35, 0.8); g.translate(0, 0.5, 0);
    // a sack = lumpy body + gathered, tied neck on top
    const neck = new THREE.CylinderGeometry(0.07, 0.16, 0.22, 10); neck.translate(0, 1.02, 0);
    const tie = new THREE.TorusGeometry(0.1, 0.025, 6, 14); tie.rotateX(Math.PI / 2); tie.translate(0, 0.98, 0);
    for (const s of SACKS) {
      const grp = new THREE.Group();
      for (const [gg, mm] of [[g, sackM], [neck, sackM], [tie, lam("rope", () => ({ color: "#7a5a32" }))]] as const) {
        const m = new THREE.Mesh(gg, mm); m.castShadow = true; m.receiveShadow = true; grp.add(m);
      }
      grp.position.set(s[0], D0 + s[1], s[2]); grp.rotation.set(0, s[3], s[1] > 0 ? 1.3 : 0.08);
      this.market.add(grp); this.sacks.push(grp);
    }
    for (const [n, x, z, yaw] of [["stall-red", -14, 6, 0.2], ["stall-green", 13, 4, -0.3], ["stall-red", 18, -18, -0.1], ["stall-green", -15, -8, 0.15]] as const) {
      const o = kitClone(kit, n, 3.2); if (!o) continue;
      o.position.set(x, D0, z); o.rotation.y = yaw; this.market.add(o);
    }
    R.add(this.market);
  }

  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(SUN_SHOT[id]?.az ?? L.az), el = THREE.MathUtils.degToRad(SUN_SHOT[id]?.el ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.25; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 95);
    if (s.light === "golden") Rr = Math.max(Rr, 30);
    if (id === 12 || id === 2 || id === 26 || id === 35) Rr = 95;
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    su.stars.value = s.light === "night" ? 0.9 : 0;
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    if (s.light === "night") { this.fog.near = 40; this.fog.far = 420; }
    if (id === 2 || id === 12 || id === 26 || id === 35) { this.fog.near = 80; this.fog.far = 700; }
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden" || s.light === "night";
    this.sunDisc.visible = showSun; this.sunHalo.visible = s.light === "golden";
    if (showSun) {
      // golden: the real sun; night: a moon high in the sky toward screen left
      const md = s.light === "night" ? V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 2).multiplyScalar(-1).setY(0).normalize()
        .addScaledVector(V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0), -0.32).setY(0.42).normalize() : sunDir;
      this.sunDisc.position.copy(cam.position).addScaledVector(md, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(s.light === "night" ? 2.2 : 1.7)));
      (this.sunDisc.material as THREE.SpriteMaterial).color.set(s.light === "night" ? new THREE.Color(2.2, 2.3, 2.6) : new THREE.Color(6.0, 4.4, 2.4));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
    }
    const cityShadow = !(id === 25 || id === 26);
    if ((this.city as any)._cs !== cityShadow) { this.city.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = cityShadow; }); (this.city as any)._cs = cityShadow; }
    // ---- dynamic set pieces ----
    const build = stageBuild(id, t);  // -1 hidden, >= 0 seconds into the build, Infinity = standing
    this.stage.visible = build >= 0;
    for (const p of this.stagePops) {
      const u = build === Infinity ? 1 : clamp01((build * 14 - p.f) / 1.6); // one piece every ~0.07 s
      const k = u <= 0 ? 0 : u >= 1 ? 1 : 1 + 0.25 * Math.sin(u * Math.PI) - (1 - smooth(u)) * 1.0;
      p.o.visible = k > 0.01;
      p.o.scale.setScalar(Math.max(0.01, k));
    }
    this.nightWin.visible = s.light === "night";
    const inHome = id === 27 && f < 1496, inHall = id >= 16 && id <= 18;
    this.rooms.home.visible = inHome; this.rooms.hall.visible = inHall;
    this.rooms.hallDoor.forEach((g, k) => { g.rotation.y = -(k ? 1 : -1) * hallDoorAngle(id, t); });
    this.market.visible = id <= 19 && id !== 1;
    this.sacks.forEach((m, i) => { m.visible = !sackGone(id, t, i); });
    this.sign.visible = id === 31 ? t >= 63.5 : false;
    this.door.rotation.y = -doorAngle(id, t);
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stageCast(id, t, { pos: cam.position, right, sun: sunDir.clone() }, s.light);
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!NOCULL && !this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5 * sc2))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!NOCULL && !this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e2 = this.fx(fi++);
      e2.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e2.use(!!p.soft);
      e2.mesh.visible = true;
      e2.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e2.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e2.mesh.quaternion.copy(cam.quaternion); e2.mesh.rotateZ(p.rot ?? 0); }
      e2.mesh.scale.set(p.w, p.h, 1);
      fused.push(e2);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e3 of fused) e3.bind();
    return focus;
  }
}
