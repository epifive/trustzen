/**
 * Trustzen embed script entry (bundled to public/w.js by scripts/build-widget.mjs).
 *
 *   <script async src="https://PLATFORM/w.js" data-site="PUBLIC_KEY"></script>
 *
 * Normal mode fetches the site's widget config and schedules the widgets.
 * Preview mode (data-preview) renders whatever widget the dashboard editor posts.
 * The only global is window.__trustzen (double-init guard).
 */

import type { EmbedConfig, EmbedWidget, PreviewMessage } from "../types";
import { captureForms } from "./capture";
import { D, W, ctx, endpoint, flush, guard, on, visitorId } from "./core";
import { bump, eligible, fill, presence, start, trigger } from "./run";
import { clearAll, mount } from "./ui";

const VERSION = "1.0.0";

function applyLocale(lang: unknown, dir: unknown): void {
  ctx.lang = typeof lang === "string" && lang ? lang : D.documentElement.lang || "en";
  ctx.dir = dir === "rtl" ? "rtl" : "ltr";
}

function live(): void {
  if (!ctx.key) return;
  ctx.v = visitorId();
  fetch(endpoint("config") + "?p=" + encodeURIComponent(location.pathname), { credentials: "omit" })
    .then((r) => (r.ok ? (r.json() as Promise<EmbedConfig>) : null))
    .then(
      guard((cfg: EmbedConfig | null) => {
        if (!cfg || !Array.isArray(cfg.widgets)) return;
        applyLocale(cfg.lang, cfg.dir);
        ctx.branding = cfg.branding || null;
        if (cfg.captureForms) captureForms();

        setInterval(guard(flush), 10000);
        on(W, "pagehide", flush);
        on(D, "visibilitychange", () => D.visibilityState === "hidden" && flush());

        const widgets = cfg.widgets.map(fill).filter((w): w is EmbedWidget => !!w && eligible(w));
        if (!widgets.length || !mount()) return;
        if (cfg.presence) presence();
        widgets.forEach((w) => trigger(w, () => start(w)));
      }),
    )
    .catch(() => {});
}

function preview(): void {
  if (!mount()) return;
  const ready = () => {
    try {
      W.parent.postMessage({ source: "trustzen-preview-ready" }, "*");
    } catch {
      /* ignore */
    }
  };
  on<MessageEvent>(W, "message", (e) => {
    const d = e.data as PreviewMessage | null;
    if (e.origin !== ctx.base || e.source !== W.parent || !d || d.source !== "trustzen-preview") return;
    const w = fill(d.widget);
    if (!w) return;
    applyLocale(d.lang, d.dir);
    ctx.branding = d.branding || null;
    const html = D.documentElement;
    html.classList.toggle("dark", d.pageTheme === "dark");
    html.dir = ctx.dir;
    bump();
    clearAll();
    start(w);
    ready();
  });
  ready();
}

(() => {
  try {
    const g = W as unknown as { __trustzen?: unknown };
    if (g.__trustzen) return;
    const s = (D.currentScript as HTMLScriptElement | null) || D.querySelector<HTMLScriptElement>("script[data-site],script[data-preview]");
    if (!s || !s.src || !W.fetch || !W.Promise || !Element.prototype.attachShadow) return;
    g.__trustzen = { version: VERSION };
    ctx.base = new URL(s.src, location.href).origin;
    ctx.key = s.getAttribute("data-site") || "";
    ctx.preview = s.hasAttribute("data-preview");
    const go = guard(() => (ctx.preview ? preview() : live()));
    if (D.readyState === "loading" || !D.body) on(D, "DOMContentLoaded", go);
    else go();
  } catch {
    /* never break the host page */
  }
})();
