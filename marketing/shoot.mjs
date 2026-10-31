// Captures marketing screenshots of a running Trustzen instance with headless Chrome (CDP).
//
//   node shoot.mjs [baseUrl] [outDir] [only]
//
// baseUrl  default http://localhost:3500 (a production build seeded with DEMO_SEED=true)
// outDir   default ./raw
// only     optional comma list of name prefixes, e.g. "l,d3" (l = landing, d = dashboard,
//          p = public pages, m = mobile, r = RTL / Hindi, a = admin, w = widget renders)
//
// Sign-in: SHOT_EMAIL / SHOT_PASSWORD (default owner@example.com / owner12345).
// The Chrome profile is created in the system temp folder (override with SHOT_TMP) and removed afterwards.
// Chrome path: CHROME_PATH (default: the standard Windows install location).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? "http://localhost:3500").replace(/\/$/, "");
const OUT = path.resolve(process.argv[3] ?? path.join(HERE, "raw"));
const ONLY = (process.argv[4] ?? "").split(",").filter(Boolean);
const EMAIL = process.env.SHOT_EMAIL ?? "owner@example.com";
const PASSWORD = process.env.SHOT_PASSWORD ?? "owner12345";
const TMP = process.env.SHOT_TMP ?? os.tmpdir();
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9400 + Math.floor(Math.random() * 500);
// What the screenshots show instead of the local demo addresses (display only, nothing is saved).
const PUBLIC_URL = "https://proof.example.com";
const STORE_DOMAIN = "northwindstore.com";

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });
const profile = fs.mkdtempSync(path.join(TMP, "tz-chrome-"));
const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--hide-scrollbars",
  "--force-color-profile=srgb",
  "--disable-features=IsolateSandboxedIframes",
  "about:blank",
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  for (let i = 0; i < 150; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error("Chrome did not start");
}

const ws = new WebSocket(await connect());
await new Promise((r) => (ws.onopen = r));
let nextId = 0;
const pending = new Map();
const listeners = [];
const errors = [];
const contexts = new Map(); // frameId -> isolated world context id
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    return;
  }
  if (msg.method === "Runtime.exceptionThrown") errors.push("EXC " + (msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text).split("\n")[0]);
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") errors.push("ERR " + msg.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 200));
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") errors.push("LOG " + `${msg.params.entry.text} ${msg.params.entry.url ?? ""}`.slice(0, 200));
  if (msg.method) for (const l of [...listeners]) l(msg);
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const waitFor = (method, timeout = 30000) =>
  new Promise((resolve) => {
    const l = (m) => {
      if (m.method === method) {
        listeners.splice(listeners.indexOf(l), 1);
        resolve(m.params);
      }
    };
    listeners.push(l);
    setTimeout(resolve, timeout);
  });

await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Network.enable");

let current = { width: 1440, height: 900, mobile: false, scale: 1 };
async function viewport(width, height, { mobile = false, scale = 1 } = {}) {
  current = { width, height, mobile, scale };
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile });
  await send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
}
async function scheme(dark) {
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: dark ? "dark" : "light" }, { name: "prefers-reduced-motion", value: "no-preference" }] });
}
async function evaluate(expression, contextId) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, ...(contextId ? { contextId } : {}) });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
}
async function lang(code) {
  await send("Network.setCookie", { name: "tz_lang", value: code, url: BASE + "/" });
}
async function go(url, settle = 2200) {
  const loaded = waitFor("Page.loadEventFired");
  await send("Page.navigate", { url: url.startsWith("http") ? url : BASE + url });
  await loaded;
  await evaluate("document.fonts.ready.then(() => true)");
  await sleep(settle);
  await prep();
}

// Hide scrollbars, the Next.js dev overlay and the platform's own cookie banner; swap the
// local demo addresses for public-looking ones (text only, nothing is saved).
async function prep() {
  await evaluate(`(() => {
    if (!document.getElementById('tz-shot')) {
      const s = document.createElement('style'); s.id = 'tz-shot';
      s.textContent = 'html{scrollbar-width:none} ::-webkit-scrollbar{display:none} nextjs-portal{display:none!important} [role=region][aria-label][class*="bottom-3"][class*="fixed"]{display:none!important} @media (max-width: 639px){ header a.hidden.inline-flex{display:none!important} html,body{overflow-x:clip!important} }';
      document.head.appendChild(s);
    }
    return true; })()`);
  await brandify();
}
async function brandify() {
  await evaluate(`(() => {
    const swap = (s) => s.replaceAll('http://localhost:3500', ${JSON.stringify(PUBLIC_URL)}).replace(/^localhost$/, ${JSON.stringify(STORE_DOMAIN)});
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode()); ) { const t = n.nodeValue; if (t && t.includes('localhost')) { const v = swap(t.trim()); if (v !== t.trim()) n.nodeValue = t.replace(t.trim(), v); } }
    document.querySelectorAll('input, textarea').forEach((el) => { if (el.value && el.value.includes('localhost')) el.value = swap(el.value); });
    return true; })()`);
}

async function shot(name, { full = false, clip } = {}) {
  await sleep(120);
  const params = { format: "png" };
  if (full) {
    const h = await evaluate("Math.ceil(document.documentElement.scrollHeight)");
    params.clip = { x: 0, y: 0, width: current.width, height: h, scale: 1 };
  } else if (clip) {
    params.clip = { ...clip, scale: 1 };
  }
  const { data } = await send("Page.captureScreenshot", params);
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, "base64"));
  console.log("saved", name);
}
const want = (name) => !ONLY.length || ONLY.some((p) => name.startsWith(p) || p.startsWith(name));

// Keeps live widgets on screen once they appeared: hide timers of 5-9 s are stretched.
// Injected before page scripts run, only while `holdWidgets` is on.
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `(() => { try { if (localStorage.getItem('tz-shot-hold') !== '1') return; const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { if (typeof ms === 'number' && ms >= 5000 && ms <= 9000) ms = 600000; return st.call(this, fn, ms, ...a); }; } catch {} })();`,
});
async function holdWidgets(on) {
  await evaluate(`localStorage.setItem('tz-shot-hold', '${on ? 1 : 0}'); true`);
}

// Number of fully shown live widgets on the page.
const SHOWN = `(() => { const r = document.querySelector('trustzen-widgets')?.shadowRoot; if (!r) return 0;
  const cards = [...r.querySelectorAll('.tz-c.tz-on')]; if (cards.some((c) => c.getAnimations().some((a) => a.playState === 'running'))) return -1; return cards.length; })()`;
async function waitWidgets(count, timeout = 30000) {
  const end = Date.now() + timeout;
  let n = 0;
  while (Date.now() < end) {
    n = await evaluate(SHOWN);
    if (n >= count) break;
    await sleep(250);
  }
  await sleep(700);
  return n;
}

// The editor's live preview is a sandboxed iframe: reach it through an isolated world.
async function previewContext() {
  const { frameTree } = await send("Page.getFrameTree");
  const frames = [];
  const walk = (t) => { frames.push(t.frame); (t.childFrames ?? []).forEach(walk); };
  walk(frameTree);
  const f = frames.find((x) => x.url.includes("/widget-preview"));
  if (!f) return null;
  const { executionContextId } = await send("Page.createIsolatedWorld", { frameId: f.id, worldName: "shot" + Date.now() });
  return executionContextId;
}
// Wait until the preview shows a widget, then pause its hide timer (hover) so it stays.
async function waitPreview(timeout = 15000) {
  const end = Date.now() + timeout;
  let ctxId = null;
  while (Date.now() < end) {
    try {
      ctxId = ctxId ?? (await previewContext());
      if (ctxId) {
        const ok = await evaluate(`(() => { const r = document.querySelector('trustzen-widgets')?.shadowRoot; if (!r) return false;
          const c = r.querySelector('.tz-c.tz-on'); if (!c || c.getAnimations().some((a) => a.playState === 'running')) return false;
          c.dispatchEvent(new MouseEvent('mouseenter')); return true; })()`, ctxId);
        if (ok) { await sleep(500); return true; }
      }
    } catch { ctxId = null; }
    await sleep(250);
  }
  console.log("  preview widget not found");
  return false;
}

// Switch the editor tab, preview device and preview page colour, then scroll.
async function editorView({ tab = 0, device = "desktop", page = "light", scroll = 0 } = {}) {
  await evaluate(`(() => {
    const tabs = document.querySelectorAll('[role=tab]'); if (tabs[${tab}]) tabs[${tab}].click();
    const pick = (i) => { const sec = document.getElementById('tz-preview-title')?.closest('section'); const r = sec ? [...sec.querySelectorAll('[role=radio]')] : []; r[i]?.click(); };
    pick(${device === "mobile" ? 1 : 0}); pick(${page === "dark" ? 3 : 2});
    return true; })()`);
  await sleep(900);
  if (scroll) await evaluate(`scrollTo(0, ${scroll}); true`);
  await sleep(400);
}

async function login() {
  await go("/login", 1200);
  await evaluate(`(() => { const set = (n, v) => { const el = document.querySelector('input[name=' + n + ']'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    set('email', ${JSON.stringify(EMAIL)}); set('password', ${JSON.stringify(PASSWORD)}); document.querySelector('form button[type=submit]').click(); return true; })()`);
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    const p = await evaluate("location.pathname");
    if (p !== "/login") return p;
  }
  throw new Error("login failed");
}

async function setup() {
  await go("/", 500);
  await evaluate("localStorage.setItem('tz-cookie-consent','1'); localStorage.setItem('tz-theme','light'); localStorage.setItem('tz-shot-hold','0'); true");
}

// A widget posted straight into /widget-preview (opened as a top-level page, so the
// script accepts our own window as its "parent"). Rendered on a transparent page and
// clipped to the widget with room for its shadow.
async function renderWidget(name, widget, { width = 640, height = 520, branding = null, dark = false, pad = 56 } = {}) {
  await viewport(width, height, { scale: 2 });
  await go("/widget-preview", 600);
  await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  await evaluate(`(() => { const s = document.createElement('style'); s.textContent = 'html,body{background:transparent!important} .top,main{visibility:hidden}'; document.head.appendChild(s);
    window.postMessage({ source: 'trustzen-preview', widget: ${JSON.stringify(widget)}, lang: 'en', dir: 'ltr', branding: ${JSON.stringify(branding)}, pageTheme: '${dark ? "dark" : "light"}' }, '*'); return true; })()`);
  await sleep(300);
  await evaluate(`new Promise((res) => { const t0 = Date.now(); const tick = () => { const r = document.querySelector('trustzen-widgets')?.shadowRoot; const c = r?.querySelector('.tz-c.tz-on');
    if (c && !c.getAnimations().some((a) => a.playState === 'running')) { c.dispatchEvent(new MouseEvent('mouseenter'));
      // Move corner popups away from the edges so their full shadow fits in the clip.
      const slot = c.parentElement; if (slot.classList.contains('tz-s-c')) slot.style.cssText += ';top:90px!important;left:90px!important;right:auto!important;bottom:auto!important';
      return res(true); } if (Date.now() - t0 > 8000) return res(false); setTimeout(tick, 100); }; tick(); })`);
  await sleep(900);
  const box = await evaluate(`(() => { const c = document.querySelector('trustzen-widgets').shadowRoot.querySelector('.tz-c.tz-on'); const b = c.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; })()`);
  const x = Math.max(0, Math.floor(box.x - pad));
  const y = Math.max(0, Math.floor(box.y - pad));
  const clip = { x, y, width: Math.min(width - x, Math.ceil(box.w + pad * 2)), height: Math.min(height - y, Math.ceil(box.h + pad * 2)) };
  await shot(name, { clip });
  await send("Emulation.setDefaultBackgroundColorOverride", {});
}

const SAMPLE_EVENTS = [
  { kind: "purchase", name: "Sarah", city: "Lisbon", country: "Portugal", product: "Linen Tote Bag", url: "", image: "", rating: 0, message: "", ago: 120 },
];

try {
  await viewport(1440, 900);
  await scheme(false);
  await setup();
  const siteKey = await evaluate("document.querySelector('script[data-site]')?.getAttribute('data-site') || ''");
  console.log("site key:", siteKey);

  // ── Landing ──
  if (want("l1") || want("l3")) {
    await holdWidgets(true);
    await viewport(1440, 1000);
    if (want("l1")) {
      await go("/", 500);
      console.log("  widgets shown:", await waitWidgets(2, 20000));
      await brandify();
      await shot("l1-home-hero");
    }
    if (want("l3")) {
      await evaluate("localStorage.setItem('tz-theme','dark'); true");
      await scheme(true);
      await go("/", 500);
      console.log("  widgets shown:", await waitWidgets(2, 20000));
      await shot("l3-home-dark");
      await evaluate("localStorage.setItem('tz-theme','light'); true");
      await scheme(false);
    }
    await holdWidgets(false);
    await viewport(1440, 900);
  }
  if (want("l2")) {
    await go("/", 1500);
    // Scroll through so lazy sections load, then drop the live widgets and finish animations.
    await evaluate(`(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 160)); } scrollTo(0, 0); return true; })()`);
    await sleep(2000);
    await evaluate(`(() => { document.querySelectorAll('trustzen-widgets').forEach((e) => e.remove()); document.getAnimations().forEach((a) => { try { a.finish(); } catch { a.cancel(); } }); return true; })()`);
    const h = await evaluate("document.documentElement.scrollHeight");
    await viewport(1440, h);
    await sleep(1500);
    await brandify();
    await shot("l2-home-full", { full: true });
    await viewport(1440, 900);
  }
  if (want("l4")) {
    await viewport(1440, 1000);
    await go("/pricing", 1500);
    await shot("l4-pricing");
    await viewport(1440, 900);
  }

  if (want("m1")) {
    // Signed out, with a live popup at the bottom (phones show corner popups there).
    await viewport(390, 844, { mobile: true, scale: 2 });
    await holdWidgets(true);
    await go("/", 500);
    console.log("  mobile widgets:", await waitWidgets(1, 20000));
    await shot("m1-home");
    await holdWidgets(false);
    await viewport(1440, 900);
  }

  // ── Public testimonial pages ──
  if (want("p")) {
    await go(`/t/${siteKey}`, 1500);
    // Fill in the form (not submitted) so the page shows what a customer writes.
    await evaluate(`(() => { const set = (el, v) => { if (!el) return; const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
      set(document.querySelector('form textarea'), 'Ordered the linen tote on Monday and it arrived on Wednesday, beautifully packed. The quality is even better than the photos. I already ordered a second one for my sister.');
      const inputs = [...document.querySelectorAll('form input[type=text], form input:not([type])')];
      set(inputs[0], 'Anna Schmidt'); set(inputs[1], 'Interior designer, Berlin');
      set(document.querySelector('form input[type=email]'), 'anna@example.com');
      return true; })()`);
    await sleep(500);
    await shot("p1-collect");
    // Narrow, 2x versions for the testimonials composition.
    await viewport(640, 640, { scale: 2 });
    await go(`/t/${siteKey}`, 1500);
    await evaluate(`(() => { const set = (el, v) => { if (!el) return; const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
      set(document.querySelector('form textarea'), 'Ordered the linen tote on Monday and it arrived on Wednesday, beautifully packed. The quality is even better than the photos.');
      const inputs = [...document.querySelectorAll('form input[type=text], form input:not([type])')];
      set(inputs[0], 'Anna Schmidt'); set(inputs[1], 'Interior designer, Berlin'); return true; })()`);
    await sleep(500);
    await shot("p4-collect-narrow");
    await viewport(820, 820, { scale: 2 });
    await go(`/embed/wall/${siteKey}?theme=light&limit=12`, 1500);
    await shot("p5-wall-narrow");
    await viewport(1440, 900);
    await go(`/embed/wall/${siteKey}?theme=light&limit=12`, 1500);
    await shot("p2-wall");
    await go(`/embed/wall/${siteKey}?theme=dark&limit=12`, 1500);
    await shot("p3-wall-dark");
  }

  // ── Customer dashboard ──
  let siteId = null;
  let widgets = [];
  const needLogin = ["d", "m", "r", "a"].some((p) => want(p));
  if (needLogin) {
    console.log("login ->", await login());
    await go("/dashboard", 1500);
    const href = await evaluate("document.querySelector('a[href^=\"/dashboard/sites/\"]:not([href$=\"/new\"])')?.getAttribute('href')");
    siteId = href?.match(/\/dashboard\/sites\/(\d+)/)?.[1];
    await go(`/dashboard/sites/${siteId}/widgets`, 1500);
    widgets = await evaluate(`[...document.querySelectorAll('a[href^="/dashboard/widgets/"]')].map((a) => ({ href: a.getAttribute('href'), text: (a.closest('tr,li,article,div[class*=border]')?.innerText || a.innerText).replace(/\\s+/g, ' ').slice(0, 120) }))`);
    const seen = new Set();
    widgets = widgets.filter((w) => !seen.has(w.href) && seen.add(w.href));
    console.log("site", siteId, "widgets:", widgets);
  }
  const widgetHref = (re) => widgets.find((w) => re.test(w.text))?.href;

  if (want("d")) {
    const pages = [
      ["d01-overview", "/dashboard"],
      ["d02-site", `/dashboard/sites/${siteId}`],
      ["d03-widgets", `/dashboard/sites/${siteId}/widgets`],
      ["d04-gallery", `/dashboard/sites/${siteId}/widgets/new`],
      ["d10-events", `/dashboard/sites/${siteId}/events`],
      ["d11-testimonials", `/dashboard/sites/${siteId}/testimonials`],
      ["d12-leads", `/dashboard/sites/${siteId}/leads`],
      ["d13-integrations", `/dashboard/sites/${siteId}/integrations`],
      ["d14-analytics", `/dashboard/sites/${siteId}/analytics`],
      ["d15-settings", `/dashboard/sites/${siteId}/settings`],
    ];
    for (const [name, url] of pages) {
      if (!want(name)) continue;
      await go(url, 2000);
      if (name === "d13-integrations") {
        await evaluate(`(() => { const b = [...document.querySelectorAll('summary, button')].find((x) => x.textContent.trim().startsWith('Stripe')); b?.click(); return !!b; })()`);
        await sleep(600);
      }
      if (name === "d04-gallery") {
        // The whole gallery: grow the viewport to the page height.
        const h = await evaluate("document.documentElement.scrollHeight");
        await viewport(1440, h);
        await sleep(900);
        await shot(name, { full: true });
        await viewport(1440, 900);
        continue;
      }
      await shot(name);
    }
    // [name, widget type label, { tab: 0 content | 1 design | 2 rules, device, page, scroll }]
    const editors = [
      ["d05-editor-activity", /Recent activity/i, {}],
      ["d06-editor-review", /Reviews/i, { tab: 1, page: "dark" }],
      ["d07-editor-coupon", /Coupon/i, { scroll: 252 }],
      ["d09-editor-email", /Email collector/i, { tab: 2, device: "mobile", scroll: 196 }],
      ["d16-editor-announcement", /Announcement/i, { tab: 1, scroll: 252 }],
      ["d18-editor-counter", /Conversion counter/i, { page: "dark" }],
    ];
    for (const [name, re, opt] of editors) {
      if (!want(name)) continue;
      const href = widgetHref(re);
      if (!href) { console.log("  no widget for", name); continue; }
      await go(href, 2500);
      await editorView(opt);
      await waitPreview();
      await brandify();
      await shot(name);
    }
  }

  // ── Mobile ──
  if (want("m")) {
    await viewport(390, 844, { mobile: true, scale: 2 });
    await go(`/dashboard/sites/${siteId}`, 2000);
    await shot("m2-dashboard");
    const href = widgetHref(/Recent activity/i);
    if (href) {
      await go(href, 2500);
      // Scroll down to the live preview (below the form on phones).
      await evaluate(`(() => { const el = document.getElementById('tz-preview-title'); if (el) { const y = el.closest('section').getBoundingClientRect().top + scrollY - 70; scrollTo(0, y); } return true; })()`);
      await waitPreview();
      await shot("m3-editor");
    }
    await go(`/dashboard/sites/${siteId}/analytics`, 2000);
    await shot("m4-analytics");
    await viewport(1440, 900);
  }

  // ── Arabic RTL and Hindi ──
  if (want("r")) {
    await lang("ar");
    await holdWidgets(true);
    await go("/", 500);
    await waitWidgets(2, 20000);
    await shot("r1-home-ar");
    await holdWidgets(false);
    await go(`/dashboard/sites/${siteId}`, 2000);
    await shot("r2-site-ar");
    await go(`/dashboard/sites/${siteId}/analytics`, 2000);
    await shot("r3-analytics-ar");
    const href = widgetHref(/Recent activity|النشاط/i);
    if (href) { await go(href, 2500); await waitPreview(); await brandify(); await shot("r4-editor-ar"); }
    await lang("hi");
    await go("/pricing", 1500);
    await shot("r5-pricing-hi");
    await go(`/dashboard/sites/${siteId}`, 2000);
    await shot("r6-site-hi");
    await lang("en");
  }

  // ── Admin ──
  if (want("a")) {
    for (const [name, url] of [
      ["a1-admin-dashboard", "/admin"],
      ["a2-admin-websites", "/admin/sites"],
      ["a3-admin-users", "/admin/users"],
      ["a4-admin-plans", "/admin/plans"],
      ["a5-admin-payments", "/admin/payments"],
      ["a6-admin-settings-widgets", "/admin/settings/widgets"],
      ["a7-admin-settings-payments", "/admin/settings/payments"],
      ["a8-admin-languages", "/admin/languages"],
    ]) {
      if (!want(name)) continue;
      await go(url, 2000);
      await shot(name);
    }
  }

  // ── Single widgets on a transparent background (for the widget gallery image) ──
  if (want("w")) {
    const D = { position: "bottom-left", theme: "light", accent: "", background: "", text: "", radius: 14, shadow: true, animation: "none", showClose: true, font: "system", width: 340, showImage: true };
    const R = { pagesMode: "all", pages: [], devices: ["desktop", "mobile"], trigger: "load", delaySec: 0, scrollPercent: 30, displaySec: 0, gapSec: 8, maxPerPage: 5, afterClose: "session", startAt: "", endAt: "" };
    const W = (id, type, content, design = {}, data = {}) => ({ id, type, content, design: { ...D, ...design }, rules: R, data });
    const list = [
      ["w01-recent", W(1, "recent_activity", { kinds: ["purchase"], template: "{name} from {location} purchased {product}", maxAgeHours: 168, limit: 20, showTime: true, anonymize: "first_name", fallbackName: "Someone", linkUrl: "", shuffle: false },
        {}, { events: [{ kind: "purchase", name: "Emma", city: "Austin", country: "United States", product: "Pro plan", url: "", image: "", rating: 0, message: "", ago: 120 }] })],
      ["w02-live", W(2, "live_visitors", { template: "{count} people are viewing this page right now", scope: "page", minCount: 2 }, {}, { count: 18 })],
      ["w03-counter", W(3, "conversion_counter", { template: "{count} people signed up in the last {hours} hours", kinds: ["signup"], periodHours: 24, minCount: 3 }, {}, { count: 47 })],
      ["w04-review", W(4, "review", { source: "testimonials", minRating: 4, limit: 10, shuffle: false, maxLength: 160 }, { width: 360 },
        { testimonials: [{ name: "Hannah Lee", title: "Founder, Brightside Studio", avatar: "", rating: 5, body: "We added the reviews popup on a Friday and saw more trial signups by Monday. It looks like it was built for our site." }] })],
      ["w05-coupon", W(5, "coupon", { title: "10% off your first order", text: "Use this code at checkout.", code: "WELCOME10", buttonText: "Copy code", copiedText: "Copied!" })],
      ["w06-email", W(6, "email_collector", { title: "Get our best tips by email", text: "One useful email a week. Unsubscribe any time.", collectName: false, namePlaceholder: "Your name", emailPlaceholder: "you@example.com", buttonText: "Subscribe", successText: "Thanks! Please check your inbox.", consentText: "" })],
      ["w07-custom", W(7, "custom_html", { html: "<strong>Free shipping over $50</strong><br>Orders placed before 2 pm ship the same day." })],
      ["w08-dark-recent", W(8, "recent_activity", { kinds: ["signup"], template: "{name} from {location} just signed up", maxAgeHours: 168, limit: 20, showTime: true, anonymize: "first_name", fallbackName: "Someone", linkUrl: "", shuffle: false },
        { theme: "dark" }, { events: [{ kind: "signup", name: "Lucas", city: "Lyon", country: "France", product: "", url: "", image: "", rating: 0, message: "", ago: 540 }] })],
    ];
    for (const [name, widget] of list) if (want(name)) await renderWidget(name, widget);
    const bars = [
      ["w11-announcement", W(11, "announcement", { text: "Free shipping on all orders this week", buttonText: "Shop now", buttonUrl: "/", badge: "New" }, { position: "top-bar", radius: 0, shadow: false })],
      ["w12-countdown", W(12, "countdown", { text: "Summer sale ends in", mode: "evergreen", endAt: "", evergreenMinutes: 1000, buttonText: "Get the deal", buttonUrl: "/", onExpire: "hide", expiredText: "The offer has ended." }, { position: "top-bar", radius: 0, shadow: false })],
      ["w13-cookie", W(13, "cookie_notice", { text: "We use cookies to improve your experience.", buttonText: "Accept", policyText: "Privacy policy", policyUrl: "/privacy" }, { position: "bottom-bar", radius: 0 })],
    ];
    for (const [name, widget] of bars) if (want(name)) await renderWidget(name, widget, { width: 1248, height: 300, pad: 0 });
    await viewport(1440, 900);
  }

  console.log("errors:", errors.length ? [...new Set(errors)].slice(0, 25) : "none");
} finally {
  await Promise.race([send("Browser.close").catch(() => {}), sleep(2000)]);
  ws.close();
  chrome.kill();
  for (let i = 0; i < 10; i++) {
    try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch { await sleep(700); }
  }
}
process.exit(0);
