// Two interiors for "The Dancing Plague", built 200 m under the town so nothing of the city reaches their shots:
// the hungry family's room at night (shot 27) and the council chamber (shot 16). Shells do not cast shadows (the
// sun/moon lights them like a set); furniture does. Windows are emissive panes with additive light shafts.
import * as THREE from "three";
import { Batch, boxGeo, V, lam, Kit, quad, prop } from "./build";
import { ctex, planksHD, beamHD, stoneHD } from "./paint";
import { INK } from "./toon";
import { NOINK } from "./ink";
import { HOME, HALL, HALL_DOOR, V3 } from "./s_story";

const wrap = (t: THREE.Texture) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; return t; };
const plasterTex = (key: string, base: string) => wrap(ctex(key, 512, 512, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 240; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,250,235,0.10)" : "rgba(150,110,80,0.05)"; g.beginPath(); g.ellipse(r() * 512, r() * 512, 10 + r() * 50, 6 + r() * 30, r() * 3, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = "rgba(90,60,50,0.4)"; g.lineWidth = 2.5;
  for (let i = 0; i < 4; i++) { let x = r() * 512, y = r() * 300; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 40; y += r() * 30; g.lineTo(x, y); } g.stroke(); }
}));
const panelTex = () => wrap(ctex("woodPanel", 512, 256, (g, r) => { // wainscot: framed oak panels
  g.fillStyle = "#7a4a2c"; g.fillRect(0, 0, 512, 256);
  for (let x = 0; x < 512; x += 128) {
    g.fillStyle = "#8c5634"; g.fillRect(x + 14, 22, 100, 200);
    g.fillStyle = "rgba(255,220,180,0.14)"; g.fillRect(x + 14, 22, 100, 6); g.fillStyle = "rgba(30,15,10,0.35)"; g.fillRect(x + 14, 216, 100, 6);
    g.strokeStyle = "rgba(30,15,10,0.6)"; g.lineWidth = 3; g.strokeRect(x + 14, 22, 100, 200);
    for (let k = 0; k < 6; k++) { g.fillStyle = "rgba(40,20,10,0.12)"; g.fillRect(x + 20 + r() * 80, 30, 2, 180); }
  }
  g.fillStyle = "#5e3820"; g.fillRect(0, 0, 512, 12); g.fillRect(0, 244, 512, 12);
}));
const tileTex = () => wrap(ctex("hallTiles", 512, 512, (g) => { // red / cream chequer, 4 x 4 tiles of 0.5 m
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    g.fillStyle = (i + j) % 2 ? "#b8573e" : "#e8d8b8"; g.fillRect(i * 128, j * 128, 128, 128);
    g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(i * 128 + 8, j * 128 + 8, 112, 10);
  }
  g.strokeStyle = "rgba(60,40,30,0.55)"; g.lineWidth = 4; for (let k = 0; k <= 512; k += 128) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 512); g.moveTo(0, k); g.lineTo(512, k); g.stroke(); }
}));
const clothTex = (key: string, col: string, trim: string) => ctex(key, 256, 128, (g) => {
  g.fillStyle = col; g.fillRect(0, 0, 256, 128);
  for (let x = 0; x < 256; x += 16) { g.fillStyle = "rgba(0,0,0,0.08)"; g.fillRect(x, 0, 6, 128); }
  g.fillStyle = trim; g.fillRect(0, 0, 256, 10); g.fillRect(0, 108, 256, 8);
  for (let x = 8; x < 256; x += 24) { g.beginPath(); g.moveTo(x, 116); g.lineTo(x + 8, 128); g.lineTo(x + 16, 116); g.fill(); }
});
/** leaded glass in daylight (council) or a moonlit pane (home), drawn bright: the material colour pushes it past 1 */
const paneTex = (key: string, day: boolean, arched: boolean) => ctex(key, 200, arched ? 420 : 240, (g) => {
  const W = 200, H = arched ? 420 : 240;
  const path = () => { g.beginPath(); if (arched) { g.moveTo(0, H); g.lineTo(0, 100); g.arc(100, 100, 100, Math.PI, 0); g.lineTo(200, H); } else g.rect(0, 0, W, H); g.closePath(); };
  path(); const gr = g.createLinearGradient(0, 0, 0, H);
  if (day) { gr.addColorStop(0, "#fff8e0"); gr.addColorStop(1, "#ffe2a0"); } else { gr.addColorStop(0, "#c8dcff"); gr.addColorStop(1, "#7fa0e8"); }
  g.fillStyle = gr; g.fill();
  g.save(); path(); g.clip();
  g.strokeStyle = day ? "rgba(120,90,60,0.7)" : "rgba(30,40,80,0.8)"; g.lineWidth = day ? 4 : 10;
  if (day) for (let k = -H; k < W + H; k += 34) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + H, H); g.moveTo(k + H, 0); g.lineTo(k, H); g.stroke(); }
  else { g.beginPath(); g.moveTo(100, 0); g.lineTo(100, H); g.moveTo(0, 120); g.lineTo(200, 120); g.stroke(); }
  if (!day) { g.fillStyle = "#f4f6ff"; g.beginPath(); g.arc(140, 60, 22, 0, Math.PI * 2); g.fill(); } // the moon through the glass
  g.restore();
  path(); g.strokeStyle = INK; g.lineWidth = 10; g.stroke();
});
const shaftTex = (warm: boolean) => ctex(warm ? "shaftWarm" : "shaftCool", 64, 256, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 256);
  const c = warm ? "255,235,190" : "170,200,255";
  gr.addColorStop(0, `rgba(${c},0.32)`); gr.addColorStop(1, `rgba(${c},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  const sx = g.createLinearGradient(0, 0, 64, 0); sx.addColorStop(0, "rgba(0,0,0,1)"); sx.addColorStop(0.2, "rgba(0,0,0,0)"); sx.addColorStop(0.8, "rgba(0,0,0,0)"); sx.addColorStop(1, "rgba(0,0,0,1)");
  g.globalCompositeOperation = "destination-out"; g.fillStyle = sx; g.fillRect(0, 0, 64, 256);
});

const bannerTex = () => ctex("hallBannerTex", 180, 460, (g) => {
  g.fillStyle = "#b3302f"; g.beginPath(); g.moveTo(0, 0); g.lineTo(180, 0); g.lineTo(180, 400); g.lineTo(90, 460); g.lineTo(0, 400); g.closePath(); g.fill();
  g.strokeStyle = "#e2b33c"; g.lineWidth = 14; g.stroke();
  g.fillStyle = "rgba(0,0,0,0.12)"; for (let x = 20; x < 180; x += 40) g.fillRect(x, 0, 10, 420);
  g.fillStyle = "#f4efe2"; g.beginPath(); g.moveTo(45, 150); g.lineTo(135, 150); g.lineTo(135, 230); g.quadraticCurveTo(135, 290, 90, 310); g.quadraticCurveTo(45, 290, 45, 230); g.closePath(); g.fill();
  g.strokeStyle = INK; g.lineWidth = 6; g.stroke();
  g.strokeStyle = "#b3302f"; g.lineWidth = 16; g.beginPath(); g.moveTo(62, 165); g.lineTo(120, 270); g.stroke(); // Strasbourg's red bend
});
const pane = (grp: THREE.Group, tex: THREE.Texture, c: THREE.Vector3, w: number, h: number, hdr: number) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, color: new THREE.Color(hdr, hdr, hdr) }));
  m.position.copy(c); m.layers.set(NOINK); grp.add(m);
};
/** an additive slanted beam from a window to the floor */
const shaft = (grp: THREE.Group, warm: boolean, top: THREE.Vector3, foot: THREE.Vector3, w: number) => {
  const a = top.clone().add(V(-w / 2, 0, 0)), b = top.clone().add(V(w / 2, 0, 0)), c = foot.clone().add(V(w / 2, 0, 0)), d = foot.clone().add(V(-w / 2, 0, 0));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c, a, c, d].flatMap((v) => [v.x, v.y, v.z]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0], 2));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: shaftTex(warm), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  m.layers.set(NOINK); m.renderOrder = 3; grp.add(m);
};

/** floor, back wall, side walls running past the lens, ceiling with beams; the open side is the camera's */
const shell = (b: Batch, o: V3, w: number, d: number, h: number, wall: THREE.Material, floor: THREE.Material, floorTile: number, door?: { z: number; w: number; h: number }) => {
  const [x, y, z] = o, wood = lam("wood", () => ({ map: beamHD() }));
  b.add(boxGeo(V(x - w / 2, y - 0.1, z - d / 2), V(x + w / 2, y, z + d / 2 + 4), floorTile), floor);
  b.add(boxGeo(V(x - w / 2 - 0.25, y, z - d / 2 - 0.25), V(x + w / 2 + 0.25, y + h, z - d / 2), 2.5), wall);
  if (!door) b.add(boxGeo(V(x - w / 2 - 0.25, y, z - d / 2 - 0.25), V(x - w / 2, y + h, z + d / 2 + 4), 2.5), wall);
  else { // left wall around a doorway
    b.add(boxGeo(V(x - w / 2 - 0.25, y, z - d / 2 - 0.25), V(x - w / 2, y + h, door.z - door.w / 2), 2.5), wall);
    b.add(boxGeo(V(x - w / 2 - 0.25, y, door.z + door.w / 2), V(x - w / 2, y + h, z + d / 2 + 4), 2.5), wall);
    b.add(boxGeo(V(x - w / 2 - 0.25, y + door.h, door.z - door.w / 2), V(x - w / 2, y + h, door.z + door.w / 2), 2.5), wall);
  }
  b.add(boxGeo(V(x + w / 2, y, z - d / 2 - 0.25), V(x + w / 2 + 0.25, y + h, z + d / 2 + 4), 2.5), wall);
  b.add(boxGeo(V(x - w / 2 - 0.25, y + h, z - d / 2 - 0.25), V(x + w / 2 + 0.25, y + h + 0.25, z + d / 2 + 4), 2.5, true), lam("ceilWood", () => ({ map: beamHD(), color: "#9a7a5c" })));
  for (let k = -d / 2 + 0.6; k < d / 2 + 3; k += 1.4) b.add(boxGeo(V(x - w / 2, y + h - 0.24, z + k - 0.11), V(x + w / 2, y + h, z + k + 0.11), 0, true), wood); // ceiling beams
  for (const s of [-1, 1]) b.add(boxGeo(V(x + s * (w / 2) - 0.13, y, z - d / 2), V(x + s * (w / 2) + 0.13, y + h, z - d / 2 + 0.2)), wood); // corner posts
  b.add(boxGeo(V(x - w / 2, y + h - 0.5, z - d / 2), V(x + w / 2, y + h - 0.3, z - d / 2 + 0.16)), wood);                                     // wall plate
};
const table = (b: Batch, x: number, y: number, z: number, w: number, d: number, top: THREE.Material) => {
  const wood = lam("wood", () => ({ map: beamHD() }));
  b.add(boxGeo(V(x - w / 2, y + 0.74, z - d / 2), V(x + w / 2, y + 0.82, z + d / 2)), top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(boxGeo(V(x + sx * (w / 2 - 0.12) - 0.045, y, z + sz * (d / 2 - 0.1) - 0.045), V(x + sx * (w / 2 - 0.12) + 0.045, y + 0.74, z + sz * (d / 2 - 0.1) + 0.045)), wood);
};
const bench = (b: Batch, x: number, y: number, z: number, w: number) => {
  const wood = lam("wood", () => ({ map: beamHD() }));
  b.add(boxGeo(V(x - w / 2, y + 0.4, z - 0.17), V(x + w / 2, y + 0.46, z + 0.17)), wood);
  for (const sx of [-1, 1]) b.add(boxGeo(V(x + sx * (w / 2 - 0.15) - 0.04, y, z - 0.13), V(x + sx * (w / 2 - 0.15) + 0.04, y + 0.4, z + 0.13)), wood);
};

export type Rooms = { home: THREE.Group; hall: THREE.Group; hallDoor: THREE.Group[] };
export const buildRooms = (kit: Kit): Rooms => {
  // ---------- the hungry family's room (night) ----------
  const home = new THREE.Group(), hs = new Batch(), hf = new Batch();
  {
    const [x, y, z] = HOME, w = 6.4, d = 5.2, h = 2.9;
    shell(hs, HOME, w, d, h, lam("plasterHome", () => ({ map: plasterTex("plasterHome", "#d9c7a4") })), lam("planksFloor", () => ({ map: wrap(planksHD()) })), 2.2);
    const wood = lam("wood", () => ({ map: beamHD() }));
    // timber framing on the back wall
    for (const k of [-1.9, 0.9]) hs.add(boxGeo(V(x + k - 0.1, y, z - d / 2), V(x + k + 0.1, y + h, z - d / 2 + 0.12)), wood);
    hs.add(boxGeo(V(x - w / 2, y + 1.05, z - d / 2), V(x + w / 2, y + 1.17, z - d / 2 + 0.12)), wood);
    // small window (moonlight) with a sill and a cool shaft onto the floor
    const wx = x - 0.5, wy = y + 1.75;
    hs.add(boxGeo(V(wx - 0.62, wy - 0.62, z - d / 2), V(wx + 0.62, wy - 0.52, z - d / 2 + 0.2)), wood);
    hs.add(boxGeo(V(wx - 0.62, wy + 0.5, z - d / 2), V(wx + 0.62, wy + 0.6, z - d / 2 + 0.14)), wood);
    pane(home, paneTex("paneMoon", false, false), V(wx, wy, z - d / 2 + 0.13), 1.0, 1.0, 1.35);
    shaft(home, false, V(wx, wy + 0.4, z - d / 2 + 0.15), V(wx + 0.3, y + 0.01, z - d / 2 + 2.6), 1.0);
    // cold hearth on the right with an empty pot
    const st = lam("hearthStone", () => ({ map: stoneHD("hearthHD", ["#9a948c", "#8a847c", "#a49e96", "#7f7a72"], "#5e5a54") }));
    hs.add(boxGeo(V(x + 1.6, y, z - d / 2), V(x + 2.9, y + 1.25, z - d / 2 + 0.7)), st);
    hs.add(boxGeo(V(x + 1.45, y + 1.25, z - d / 2), V(x + 3.05, y + 1.42, z - d / 2 + 0.82)), st);
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.8), new THREE.MeshBasicMaterial({ color: "#141016" }));
    hole.position.set(x + 2.25, y + 0.42, z - d / 2 + 0.705); home.add(hole);
    prop(hf, kit, "food/pot", x + 2.25, y + 0.05, z - d / 2 + 0.45, 0.32, 0.4);
    // shelf with one jar and a mug on the left
    hs.add(boxGeo(V(x - 2.9, y + 1.5, z - d / 2), V(x - 1.6, y + 1.55, z - d / 2 + 0.3)), wood);
    prop(hf, kit, "food/mug", x - 2.5, y + 1.55, z - d / 2 + 0.15, 0.14, 0.5);
    prop(hf, kit, "dungeon/barrel", x - 2.6, y, z - 1.2, 0.8, 0.3);
    // the bare table, the bench, three empty bowls, the candle dish
    table(hf, x, y, z - 0.88, 2.3, 0.86, lam("tableTop", () => ({ map: beamHD() })));
    bench(hf, x, y, z - 1.62, 2.4);
    for (const [bx, bz] of [[-0.56, -0.7], [0.0, -0.64], [0.56, -0.7]] as const) prop(hf, kit, "food/bowl", x + bx, y + 0.82, z + bz, 0.07, bx);
    hf.add(new THREE.CylinderGeometry(0.075, 0.08, 0.02, 16).translate(0, 0.83, 0), lam("pewter", () => ({ color: "#8f8a96" })), new THREE.Matrix4().makeTranslation(x + 0.3, y, z - 0.98));
    hf.add(new THREE.CylinderGeometry(0.028, 0.03, 0.14, 12).translate(0, 0.91, 0), lam("candleWax", () => ({ color: "#f1e6cc" })), new THREE.Matrix4().makeTranslation(x + 0.3, y, z - 0.98));
  }
  hs.build(home, false); hf.build(home, true);
  // ---------- the council chamber (day) ----------
  const hall = new THREE.Group(), cs = new Batch(), cf = new Batch(), hallDoor: THREE.Group[] = [];
  {
    const [x, y, z] = HALL, w = 9, d = 7, h = 5.2;
    shell(cs, HALL, w, d, h, lam("plasterHall", () => ({ map: plasterTex("plasterHall", "#efe2c4") })), lam("hallTiles", () => ({ map: tileTex() })), 2.0, { z: HALL_DOOR[2], w: 1.8, h: 2.6 });
    const panel = lam("woodPanel", () => ({ map: panelTex() })), wood = lam("wood", () => ({ map: beamHD() }));
    // wainscot around the walls (1.3 m)
    cs.add(boxGeo(V(x - w / 2, y, z - d / 2), V(x + w / 2, y + 1.3, z - d / 2 + 0.06), 2.6), panel);
    cs.add(boxGeo(V(x + w / 2 - 0.06, y, z - d / 2), V(x + w / 2, y + 1.3, z + d / 2 + 4), 2.6), panel);
    for (const [z0, z1] of [[z - d / 2, HALL_DOOR[2] - 0.95], [HALL_DOOR[2] + 0.95, z + d / 2 + 4]]) cs.add(boxGeo(V(x - w / 2, y, z0), V(x - w / 2 + 0.06, y + 1.3, z1), 2.6), panel);
    // three tall arched windows with warm shafts
    for (const k of [-2.8, 0, 2.8]) {
      const c = V(x + k, y + 2.9, z - d / 2 + 0.03);
      cs.add(boxGeo(V(c.x - 0.75, y + 1.42, z - d / 2), V(c.x + 0.75, y + 1.55, z - d / 2 + 0.22)), wood);
      pane(hall, paneTex("paneDay", true, true), c, 1.3, 2.7, 1.25);
      shaft(hall, true, V(c.x, y + 3.6, z - d / 2 + 0.1), V(c.x + 0.9, y + 0.01, z - d / 2 + 3.4), 1.3);
    }
    // banners between the windows, the city's shield above the middle one
    for (const k of [-1.4, 1.4]) { // hanging banners: red with a gold border and the city's white shield
      const bn = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.3), lam("hallBanner", () => ({ map: bannerTex(), alphaTest: 0.5, side: THREE.DoubleSide })));
      bn.position.set(x + k, y + 3.2, z - d / 2 + 0.08); bn.castShadow = false; bn.receiveShadow = true; hall.add(bn);
      cs.add(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8).rotateZ(Math.PI / 2), wood, new THREE.Matrix4().makeTranslation(x + k, y + 4.37, z - d / 2 + 0.1));
    }
    prop(cf, kit, "dungeon/shield-round", x, y + 4.4, z - d / 2 + 0.05, 0.75, 0);
    // the long table with a red cloth, candlesticks, a scroll and the bell
    table(cf, x, y, z - 1.25, 4.4, 1.1, lam("clothTop", () => ({ map: clothTex("clothTop", "#b3302f", "#e2b33c") })));
    cf.add(boxGeo(V(x - 2.22, y + 0.28, z - 1.25 + 0.56), V(x + 2.22, y + 0.82, z - 1.25 + 0.58)), lam("clothFront", () => ({ map: clothTex("clothFront", "#b3302f", "#e2b33c") })));
    bench(cf, x, y, z - 2.05, 4.6);
    const gold = lam("gold", () => ({ color: "#c9a24e" })), wax = lam("candleWax", () => ({ color: "#f1e6cc" }));
    for (const k of [-1.75, 1.75]) {
      cf.add(new THREE.CylinderGeometry(0.03, 0.08, 0.32, 10).translate(0, 0.98, 0), gold, new THREE.Matrix4().makeTranslation(x + k, y, z - 1.0));
      cf.add(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 10).translate(0, 1.24, 0), wax, new THREE.Matrix4().makeTranslation(x + k, y, z - 1.0));
    }
    cf.add(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 12).rotateZ(Math.PI / 2).translate(0, 0.87, 0), lam("parchment", () => ({ color: "#efe1bc" })), new THREE.Matrix4().makeTranslation(x - 0.9, y, z - 0.95));
    prop(cf, kit, "food/mug", x + 0.8, y + 0.82, z - 1.0, 0.13, 0.2);
    prop(cf, kit, "dungeon/chest", x + 3.6, y, z - 3.0, 0.7, 0);
    // the double door in the left wall (leaves swing in, shot 16)
    const [dx, , dz] = HALL_DOOR;
    cs.add(boxGeo(V(dx, y + 2.6, dz - 0.95), V(dx + 0.12, y + 2.8, dz + 0.95)), wood);
    const way = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.35, 1.25, 1.05) }));
    way.position.set(dx - 0.2, y + 1.3, dz); way.rotation.y = Math.PI / 2; way.layers.set(NOINK); hall.add(way); // bright corridor behind
    const leafM = lam("doorLeaf2", () => ({ map: beamHD() }));
    for (const s of [-1, 1]) {
      const g = new THREE.Group(), leaf = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.55, 0.88).translate(0.04, 1.28, -s * 0.45), leafM);
      leaf.castShadow = true; leaf.receiveShadow = true; g.add(leaf);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 12).rotateY(Math.PI / 2).translate(0.1, 1.2, -s * 0.78), gold); g.add(ring);
      g.position.set(dx + 0.01, y, dz + s * 0.9); hall.add(g); hallDoor.push(g);
    }
  }
  cs.build(hall, false); cf.build(hall, true);
  return { home, hall, hallDoor };
};
/** the chamber doors fly open on "the doctors" (27.3 s) */
export const hallDoorAngle = (id: number, t: number) => {
  if (id === 17 || id === 18) return (Math.PI / 180) * 95;
  if (id !== 16) return 0;
  const u = Math.min(1, Math.max(0, (t - 27.28) / 0.22));
  return (Math.PI / 180) * 95 * (u >= 1 ? 1 : 1 - (1 - u) ** 3 + 0.1 * Math.sin(u * Math.PI));
};
