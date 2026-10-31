// Renders the HTML templates in ./templates to PNG with headless Chrome (CDP).
//
//   node render.mjs                                   renders every composition below into ./out
//   node render.mjs <template.html> <out.png> <width> <height> [transparent 0|1] ...
//
// Run `node shoot.mjs` first: the templates use the screenshots in ./raw.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TMP = process.env.SHOT_TMP ?? os.tmpdir();
const T = (f) => path.join(HERE, "templates", f);
const O = (f) => path.join(HERE, "out", f);

const DEFAULT_JOBS = [
  { template: T("features.html"), out: O("features.png"), width: 1440, height: 790 },
  { template: T("widgets.html"), out: O("widgets.png"), width: 1440, height: 1000 },
  { template: T("testimonials.html"), out: O("testimonials.png"), width: 1440, height: 900 },
  { template: T("mobile.html"), out: O("mobile.png"), width: 1440, height: 1000 },
  { template: T("preview.html"), out: O("preview-590x300.png"), width: 590, height: 300 },
  { template: T("thumbnail.html"), out: O("thumbnail-80x80.png"), width: 80, height: 80, transparent: true },
];

const args = process.argv.slice(2);
const jobs = [];
for (let i = 0; i + 3 < args.length; i += 5) {
  jobs.push({ template: path.resolve(args[i]), out: path.resolve(args[i + 1]), width: Number(args[i + 2]), height: Number(args[i + 3]), transparent: args[i + 4] === "1" });
}
if (!jobs.length) jobs.push(...DEFAULT_JOBS);
fs.mkdirSync(O(""), { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const PORT = 9400 + Math.floor(Math.random() * 500);
const profile = fs.mkdtempSync(path.join(TMP, "tz-chrome-"));
const chrome = spawn(process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--allow-file-access-from-files",
  "--hide-scrollbars",
  "--force-color-profile=srgb",
  "about:blank",
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl;
for (let i = 0; i < 150 && !wsUrl; i++) {
  try {
    wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl;
  } catch {}
  if (!wsUrl) await sleep(200);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id) pending.get(m.id)?.(m.result);
};
const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });

try {
  await send("Page.enable");
  for (const job of jobs) {
    await send("Emulation.setDeviceMetricsOverride", { width: job.width, height: job.height, deviceScaleFactor: 1, mobile: false });
    await send("Emulation.setDefaultBackgroundColorOverride", job.transparent ? { color: { r: 0, g: 0, b: 0, a: 0 } } : {});
    await send("Page.navigate", { url: pathToFileURL(job.template).href });
    await sleep(1500);
    await send("Runtime.evaluate", { expression: "Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => {}))])", awaitPromise: true });
    await sleep(300);
    const { data } = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: job.width, height: job.height, scale: 1 } });
    fs.writeFileSync(job.out, Buffer.from(data, "base64"));
    console.log("rendered", path.basename(job.out));
  }
} finally {
  await Promise.race([send("Browser.close"), sleep(2000)]);
  ws.close();
  chrome.kill();
  for (let i = 0; i < 10; i++) {
    try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch { await sleep(700); }
  }
}
process.exit(0);
