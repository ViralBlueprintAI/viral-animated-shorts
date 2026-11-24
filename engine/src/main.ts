// Standalone renderer for the MIT bridge template (see LICENSE), without React/Remotion.
// Same post chain as Bridge.tsx: Ink -> lens pre -> lens main -> [bloom + NEUTRAL tone map + grade], MSAA 4.
import * as THREE from "three";
import { EffectComposer, RenderPass, EffectPass, BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { World, loadKit } from "./world";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import { TOTAL, FLASH_AT, SHOTS, layersAt, dofAt } from "./story";

const Q = new URLSearchParams(location.search);
const SCALE = +(Q.get("scale") || "0.5");
const W = Math.round(1080 * SCALE), H = Math.round(1920 * SCALE);

const out = document.createElement("canvas"); out.width = W; out.height = H; out.id = "out";
document.body.appendChild(out); const octx = out.getContext("2d")!;

const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 } as any);
  const mip = (b as any).mipmapBlurPass; const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};

type View = { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; world: World; composer: EffectComposer; lens: LensBlur; grade: GradeEffect; target: THREE.Vector3 };
const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

function makeView(kit: any): View {
  const renderer = new THREE.WebGLRenderer({ antialias: false, stencil: false, powerPreference: "high-performance", preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.2, 1500);
  const world = new World(kit); scene.add(world.root);
  const composer = new EffectComposer(renderer, { multisampling: 4, frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new InkPass(scene, camera) as any);
  const lens = new LensBlur({ maxCoC: 24, nearScale: 1.2 });
  composer.addPass(new EffectPass(camera, lens.pre));
  composer.addPass(new EffectPass(camera, lens.main));
  const grade = new GradeEffect(GRADES.day, GRADE_STRENGTH.day);
  composer.addPass(new EffectPass(camera, makeBloom(), new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }), grade));
  composer.setSize(W, H);
  return { renderer, scene, camera, world, composer, lens, grade, target: new THREE.Vector3() };
}

function draw(v: View, id: number, f: number) {
  v.target.copy(v.world.update(id, f, v.camera, v.scene));
  noInkFallback(v.world.root);
  const d = dofAt(f);
  v.camera.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus(f)); else fpt.copy(v.target);
  v.lens.focus = Math.max(0.3, fpt.sub(v.camera.position).dot(fwd));
  v.lens.cInf = d.cInf;
  gradeFor(v.grade, SHOTS[id - 1].light);
  v.composer.render();
}

let views: View[] = [];
(window as any).TOTAL = TOTAL;
(window as any).renderFrame = (f: number) => {
  const layers = layersAt(f);
  octx.clearRect(0, 0, W, H);
  layers.forEach((l, i) => {
    draw(views[i], l.id, f);
    octx.globalAlpha = l.alpha; octx.drawImage(views[i].renderer.domElement, 0, 0); octx.globalAlpha = 1;
  });
  const flash = f >= FLASH_AT && f < FLASH_AT + 4 ? [1, 0.75, 0.45, 0.2][f - FLASH_AT] : 0;
  if (flash > 0) { octx.fillStyle = `rgba(255,255,255,${flash})`; octx.fillRect(0, 0, W, H); }
  return true;
};
loadKit().then((kit) => { views = [makeView(kit), makeView(kit)]; (window as any).READY = true; });
