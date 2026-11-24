// Final render of a short on a Mac (or any machine with Chrome + a GPU).
//   npm install            (three, postprocessing, esbuild, puppeteer-core, ffmpeg-static)
//   npm run build          (bundles src/s_main.ts -> public/s_bundle.js)
//   node render.mjs --audio ../mix_final.wav --name my_short
//                          (1080 x 1920, 30 fps -> out/frames/*.jpg -> out/<name>.mp4, muxed with the master if given)
// Options: --scale 1 --from 0 --to <TOTAL from s_story.ts> --audio <wav> --name <file name>
//          --chrome "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"   (Windows/Linux: path to chrome)
// Resumable: frames that already exist are skipped.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import puppeteer from "puppeteer-core";
import ffmpegPath from "ffmpeg-static";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const SCALE = +arg("scale", "1"), FROM = +arg("from", "0");
const AUDIO = arg("audio", ""), NAME = arg("name", "short");
const CHROME = arg("chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
const ROOT = path.resolve("public"), OUT = path.resolve("out"), FR = path.join(OUT, "frames");
fs.mkdirSync(FR, { recursive: true });

const types = { ".html": "text/html", ".js": "text/javascript", ".glb": "model/gltf-binary", ".png": "image/png" };
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
}).listen(8899);

const W = Math.round(1080 * SCALE), H = Math.round(1920 * SCALE);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: false, defaultViewport: { width: W, height: H },
  args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization", `--window-size=${W},${H + 120}`] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
await page.goto(`http://127.0.0.1:8899/s_index.html?scale=${SCALE}`);
await page.waitForFunction("window.READY === true", { timeout: 600000 });
const TO = +arg("to", String(await page.evaluate("window.TOTAL")));     // default: every frame of the story
const t0 = Date.now();
for (let f = FROM; f < TO; f++) {
  const fn = path.join(FR, String(f).padStart(5, "0") + ".jpg");
  if (fs.existsSync(fn)) continue;
  let b64 = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    b64 = await page.evaluate((fr) => { window.renderFrame(fr); return document.getElementById("out").toDataURL("image/jpeg", 0.95).split(",")[1]; }, f);
    if (!(await page.evaluate("!!window.LOST"))) break;
    console.log("GPU context lost at frame", f, "- reloading");               // black frame: reload and render again
    await page.reload(); await page.waitForFunction("window.READY === true", { timeout: 600000 });
  }
  fs.writeFileSync(fn, Buffer.from(b64, "base64"));
  if (f % 30 === 0) console.log(`frame ${f}/${TO}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
await browser.close(); srv.close();
const mp4 = path.join(OUT, NAME + ".mp4");
const vin = ["-y", "-framerate", "30", "-i", path.join(FR, "%05d.jpg")];
const venc = ["-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
execFileSync(ffmpegPath, AUDIO && fs.existsSync(AUDIO)
  ? [...vin, "-i", AUDIO, ...venc, "-c:a", "aac", "-b:a", "256k", "-shortest", mp4]
  : [...vin, ...venc, mp4], { stdio: "inherit" });
console.log("done:", mp4);
