/**
 * Shadow-DOM host, position slots (one visible card per position, others queue),
 * colour palette and show/hide animation.
 */

import type { EmbedWidget, WidgetDesign } from "../types";
import { D, W, add, attr, ctx, guard, h, icon, later, mq, on, track } from "./core";

declare const __TZ_CSS__: string;

export const ICON_X = '<path d="M6 6l12 12M18 6L6 18"/>';

export interface Panel {
  w: EmbedWidget;
  body: HTMLElement;
  /** Seconds visible; 0 = until closed. */
  sec: number;
  /** Accessible name of a modal (center position). */
  label?: string;
  /** Called once when the panel goes away; closed = the visitor closed it. */
  end?: (closed: boolean) => void;
  /** Cleanups (intervals etc.) run when the panel goes away. */
  fx: Array<() => void>;
  card?: HTMLElement;
  slot?: Slot;
  timer?: ReturnType<typeof setTimeout>;
  until?: number;
  left?: number;
  gone?: boolean;
}

interface Slot {
  key: string;
  el: HTMLElement;
  cur: Panel | null;
  q: Panel[];
}

let root: HTMLElement | null = null;
let hostEl: HTMLElement | null = null;
const slots: Record<string, Slot> = {};
let lastFocus: Element | null = null;

const IMPORTANT_HOST =
  "display:block!important;position:fixed!important;top:0!important;left:0!important;width:0!important;height:0!important;" +
  "margin:0!important;padding:0!important;border:0!important;z-index:2147483000!important;transform:none!important;filter:none!important;" +
  "opacity:1!important;visibility:visible!important;overflow:visible!important;contain:none!important;pointer-events:auto!important";

/** Create the single host element + shadow root. Returns false when unsupported. */
export function mount(): boolean {
  if (root) return true;
  const host = D.createElement("trustzen-widgets");
  if (!host.attachShadow) return false;
  host.setAttribute("style", IMPORTANT_HOST);
  const shadow = host.attachShadow({ mode: "open" });
  root = h("div", "tz");
  // The same host rules as :host, so they still apply when the page's CSP blocks inline style attributes.
  const css: string = ":host{" + IMPORTANT_HOST.replace(/!important/g, " !important") + "}" + __TZ_CSS__;
  // Constructable stylesheets are not subject to the host page's CSP style-src.
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    shadow.adoptedStyleSheets = [sheet];
  } catch {
    shadow.appendChild(D.createElement("style")).textContent = css;
  }
  shadow.appendChild(root);
  D.body.appendChild(host);
  hostEl = host;
  on<KeyboardEvent>(D, "keydown", (e) => {
    const s = slots.ce;
    if (e.key === "Escape" && s && s.cur) dismiss(s.cur, true);
  });
  on(W, "resize", () => offsets());
  return true;
}

export const host = () => hostEl;

export const isMobileLayout = () => mq("(max-width: 519px)");

/* ---------- colours ---------- */

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lum(hex: string): number {
  const c = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

const contrast = (a: string, b: string) => {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const rgba = (hex: string, a: number) => "rgba(" + rgb(hex).join(",") + "," + a + ")";

function mix(hex: string, to: string, t: number): string {
  const a = rgb(hex);
  const b = rgb(to);
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);
const DARK_TEXT = "#16151d";

/** Readable text colour on top of `bg`. */
const onColor = (bg: string) => (contrast(bg, "#ffffff") >= 3 ? "#ffffff" : DARK_TEXT);

/** A variant of `c` with enough contrast against `bg` for text/borders. */
function readable(c: string, bg: string): string {
  let out = c;
  const toward = lum(bg) < 0.25 ? "#ffffff" : "#000000";
  for (let i = 0; i < 6 && contrast(out, bg) < 4.5; i++) out = mix(out, toward, 0.2);
  return out;
}

/** CSS custom properties for a card. `brandBar` = bar filled with the accent colour. */
export function palette(d: WidgetDesign, brandBar: boolean, bar: boolean): Record<string, string> {
  const dark = d.theme === "dark" || (d.theme === "auto" && mq("(prefers-color-scheme: dark)"));
  const a = isHex(d.accent) ? d.accent : "#5b3fc4";
  const filled = brandBar && !isHex(d.background);
  const bg = filled ? a : isHex(d.background) ? d.background : dark ? "#18171f" : "#ffffff";
  const darkBg = lum(bg) < 0.25;
  const fg = isHex(d.text) ? d.text : filled ? onColor(a) : darkBg ? "#f3f2f8" : DARK_TEXT;
  const on = onColor(a);
  const a2 = filled ? fg : readable(a, bg);
  const rb = bar ? (d.radius ? Math.min(d.radius, 20) : 6) : Math.min(12, Math.round(d.radius * 0.6));
  return {
    "--a": a,
    "--a2": a2,
    "--on": on,
    "--bg": bg,
    "--fg": fg,
    "--bd": darkBg ? "rgba(255,255,255,.1)" : "rgba(20,18,40,.08)",
    "--bd2": darkBg ? "rgba(255,255,255,.2)" : "rgba(20,18,40,.17)",
    "--at": filled ? rgba(fg, 0.16) : rgba(a, darkBg ? 0.24 : 0.09),
    "--lk": a2,
    "--fo": a2,
    "--ok": filled ? fg : darkBg ? "#4ade80" : "#16a34a",
    "--er": darkBg ? "#ff8a80" : "#d92d20",
    "--ib": darkBg ? "rgba(255,255,255,.06)" : "#ffffff",
    "--btb": filled ? fg : a,
    "--btf": filled ? bg : on,
    "--bdb": filled ? rgba(fg, 0.2) : a,
    "--bdf": filled ? fg : on,
    "--r": d.radius + "px",
    "--rb": rb + "px",
    "--w": d.width + "px",
    "--sh": darkBg
      ? "0 2px 6px rgba(0,0,0,.3),0 18px 44px -10px rgba(0,0,0,.65)"
      : "0 1px 3px rgba(22,18,52,.06),0 16px 40px -10px rgba(22,18,52,.28)",
  };
}

/* ---------- slots ---------- */

const CORNERS: Record<string, string> = { "top-left": "tl", "top-right": "tr", "bottom-left": "bl", "bottom-right": "br" };

function slotKey(w: EmbedWidget): string {
  const p = w.design.position;
  if (p === "top-bar") return "tb";
  if (p === "bottom-bar") return "bb";
  if (p === "center") return "ce";
  if (isMobileLayout()) return "m";
  let k = CORNERS[p] || "bl";
  if (ctx.dir === "rtl") k = k[0] + (k[1] === "l" ? "r" : "l");
  return k;
}

function getSlot(key: string): Slot {
  let s = slots[key];
  if (!s) {
    const cls = key === "tb" ? "tz-s-tb" : key === "bb" ? "tz-s-bb" : key === "ce" ? "tz-s-ce" : "tz-s-c tz-" + (key === "m" ? "bl" : key);
    const el = h("div", "tz-s " + cls);
    el.dir = ctx.dir;
    if (key !== "ce") attr(el, { role: "status", "aria-live": "polite" });
    else on<MouseEvent>(el, "click", (e) => e.target === el && s.cur && dismiss(s.cur, true));
    s = slots[key] = { key, el, cur: null, q: [] };
    root!.appendChild(el);
  }
  return s;
}

/** Keep corner cards clear of visible top/bottom bars. */
function offsets(): void {
  if (!root) return;
  const tb = slots.tb && slots.tb.cur ? slots.tb.el.offsetHeight : 0;
  const bb = slots.bb && slots.bb.cur ? slots.bb.el.offsetHeight : 0;
  root.style.setProperty("--tz-tb", tb + "px");
  root.style.setProperty("--tz-bb", bb + "px");
}

/** Remove everything immediately (preview re-render). */
export function clearAll(): void {
  for (const k in slots) {
    const s = slots[k];
    const all = s.cur ? [s.cur, ...s.q] : s.q;
    s.cur = null;
    s.q = [];
    for (const p of all) finish(p);
    s.el.remove();
    delete slots[k];
  }
  offsets();
}

function finish(p: Panel): void {
  if (p.gone) return;
  p.gone = true;
  clearTimeout(p.timer);
  for (const f of p.fx) guard(f)();
  p.fx = [];
}

/* ---------- show / hide ---------- */

export function present(p: Panel): void {
  if (!root) return;
  const s = getSlot(slotKey(p.w));
  p.slot = s;
  if (s.cur) {
    s.q.push(p);
    return;
  }
  show(s, p);
}

function startTimer(p: Panel, ms: number): void {
  clearTimeout(p.timer);
  p.until = Date.now() + ms;
  p.timer = later(() => dismiss(p, false), ms);
}

function show(s: Slot, p: Panel): void {
  s.cur = p;
  const d = p.w.design;
  const t = p.w.type;
  const key = s.key;
  const bar = key === "tb" || key === "bb";
  const center = key === "ce";
  const card = h("div", "tz-c");
  card.classList.add(...[bar ? "tz-bar" : "", center ? "tz-ce" : "", d.shadow && !bar ? "tz-sh" : "", d.font === "system" ? "tz-sys" : "", d.showClose && !bar ? "tz-hx" : ""].filter(Boolean));
  const vars = palette(d, bar && (t === "announcement" || t === "countdown"), bar);
  for (const k in vars) card.style.setProperty(k, vars[k]);
  if (d.shadow && bar) card.style.boxShadow = key === "tb" ? "0 6px 20px -8px rgba(20,18,40,.25)" : "0 -6px 20px -8px rgba(20,18,40,.25)";

  // Entrance: slide from the nearest edge, fade, or nothing.
  const anim = d.animation;
  if (anim === "none") card.classList.add("tz-na");
  else if (anim === "slide") {
    const t0 =
      key === "tb" ? "translateY(-100%)" : key === "bb" ? "translateY(100%)" : center ? "translateY(12px) scale(.96)" : key[0] === "t" ? "translateY(-14px)" : "translateY(16px)";
    card.style.setProperty("--t0", t0);
  }

  if (center) {
    attr(card, { role: "dialog", "aria-modal": "true", "aria-label": p.label || "Notification", tabindex: "-1" });
  }

  add(card, p.body);

  if (d.showClose) {
    const x = add(attr(h("button", "tz-x"), { type: "button", "aria-label": "Close", title: "Close" }), icon(ICON_X));
    on(x, "click", (e) => {
      e.stopPropagation();
      dismiss(p, true);
    });
    card.appendChild(x);
  }

  const b = ctx.branding;
  if (b && b.text) {
    const a = attr(h("a", "tz-brand", b.text), { href: /^https?:\/\//i.test(b.url) ? b.url : ctx.base || "#", target: "_blank", rel: "noopener" });
    card.appendChild(a);
  }

  // Hover: pause the hide timer, count the first hover.
  let hovered = false;
  on(card, "mouseenter", () => {
    if (!hovered) track(p.w.id, "h");
    hovered = true;
    if (p.until) {
      p.left = Math.max(1500, p.until - Date.now());
      clearTimeout(p.timer);
      p.until = 0;
    }
  });
  on(card, "mouseleave", () => {
    if (p.left && !p.gone) {
      startTimer(p, p.left);
      p.left = 0;
    }
  });

  p.card = card;
  s.el.appendChild(card);
  if (center) lastFocus = D.activeElement;
  // Force layout so the transition runs, then reveal.
  void card.offsetWidth;
  const reveal = () => {
    card.classList.add("tz-on");
    offsets();
    if (center) {
      s.el.classList.add("tz-on");
      try {
        card.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    }
  };
  if (W.requestAnimationFrame) W.requestAnimationFrame(guard(reveal));
  else reveal();
  track(p.w.id, "i");
  if (p.sec > 0) startTimer(p, p.sec * 1000);
}

/** Hide a panel (or drop it from its queue). */
export function dismiss(p: Panel, closed: boolean): void {
  const s = p.slot;
  if (!s || p.gone) return;
  if (s.cur !== p) {
    s.q = s.q.filter((x) => x !== p);
    finish(p);
    return;
  }
  finish(p);
  const card = p.card!;
  card.classList.remove("tz-on");
  if (s.key === "ce") {
    s.el.classList.remove("tz-on");
    const f = lastFocus as HTMLElement | null;
    if (f && f.focus) guard(() => f.focus({ preventScroll: true }))();
  }
  const ms = p.w.design.animation === "none" || mq("(prefers-reduced-motion: reduce)") ? 220 : 420;
  later(() => {
    card.remove();
    if (s.cur === p) s.cur = null;
    offsets();
    if (p.end) guard(p.end)(closed);
    const next = s.q.shift();
    if (next && !next.gone) show(s, next);
  }, ms);
}
