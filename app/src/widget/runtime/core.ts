/**
 * Shared state and tiny helpers of the embed runtime (public/w.js).
 * Everything here must stay dependency-free and must never throw into the host page.
 */

import type { EmbedConfig, TrackPayload } from "../types";

export const W = window;
export const D = document;

export interface Ctx {
  /** Origin w.js was loaded from, e.g. "https://app.example.com". */
  base: string;
  /** Public site key (data-site). */
  key: string;
  preview: boolean;
  lang: string;
  dir: "ltr" | "rtl";
  branding: EmbedConfig["branding"];
  /** Random visitor id. */
  v: string;
}

export const ctx: Ctx = { base: "", key: "", preview: false, lang: "en", dir: "ltr", branding: null, v: "" };

/** Wrap a callback so an exception never reaches the host page. */
export function guard<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
  return (...args: A) => {
    try {
      fn(...args);
    } catch {
      /* never break the host page */
    }
  };
}

export const later = (fn: () => void, ms: number) => setTimeout(guard(fn), ms);

export function on<E extends Event = Event>(target: EventTarget, type: string, fn: (e: E) => void, opts?: AddEventListenerOptions | boolean): void {
  target.addEventListener(type, guard(fn as (e: Event) => void), opts);
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string | null): HTMLElementTagNameMap[K] {
  const el = D.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
}

export function add<T extends Node>(parent: T, ...kids: Array<Node | null | undefined | false | "">): T {
  for (const k of kids) if (k) parent.appendChild(k);
  return parent;
}

export function attr<T extends Element>(el: T, attrs: Record<string, string>): T {
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

/** Inline SVG icon from a constant path string (never user data). */
export function icon(paths: string, cls = "tz-ic"): HTMLElement {
  const s = h("span", cls);
  s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + paths + "</svg>";
  return s;
}

export const mq = (q: string) => !!W.matchMedia && W.matchMedia(q).matches;

export const endpoint = (name: string) => ctx.base + "/api/w/" + encodeURIComponent(ctx.key) + "/" + name;

/* ---------- storage (silently unavailable in sandboxed iframes / private modes) ---------- */

function store(session?: boolean): Storage | null {
  if (ctx.preview) return null;
  try {
    return session ? W.sessionStorage : W.localStorage;
  } catch {
    return null;
  }
}

export function getItem(k: string, session?: boolean): string | null {
  try {
    return store(session)?.getItem(k) ?? null;
  } catch {
    return null;
  }
}

export function setItem(k: string, v: string, session?: boolean): void {
  try {
    store(session)?.setItem(k, v);
  } catch {
    /* quota or disabled */
  }
}

export function randomId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(16);
  if (W.crypto && W.crypto.getRandomValues) W.crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  let out = "";
  for (let i = 0; i < 16; i++) out += chars[bytes[i] % 36];
  return out;
}

export function visitorId(): string {
  let v = getItem("tz_v");
  if (!v || !/^[a-z0-9]{16}$/.test(v)) {
    v = randomId();
    setItem("tz_v", v);
  }
  return v;
}

/* ---------- network ---------- */

/**
 * Fire-and-forget POST of a text/plain JSON body (a "simple" CORS request, no preflight).
 * fetch keepalive survives page unloads and, unlike sendBeacon, always sends a real
 * Origin header (pages with Referrer-Policy: no-referrer make beacons arrive with
 * Origin: null). sendBeacon is only the fallback for browsers without keepalive.
 */
export function beacon(url: string, data: unknown): void {
  const body = JSON.stringify(data);
  try {
    fetch(url, { method: "POST", body, keepalive: true, mode: "cors", credentials: "omit", headers: { "Content-Type": "text/plain" } }).catch(() => {});
  } catch {
    try {
      if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }));
    } catch {
      /* ignore */
    }
  }
}

/** POST JSON and parse the JSON reply (also for 4xx replies carrying { error }). */
export function postJson<T>(url: string, data: unknown, type = "text/plain"): Promise<T> {
  return fetch(url, {
    method: "POST",
    body: JSON.stringify(data),
    mode: "cors",
    credentials: "omit",
    headers: { "Content-Type": type },
  }).then((r) => r.json() as Promise<T>);
}

/* ---------- tracking ---------- */

type TrackEvent = TrackPayload["e"][number];
const queue: TrackEvent[] = [];

export function track(w: number, t: TrackEvent["t"]): void {
  if (ctx.preview || !ctx.key) return;
  queue.push({ w, t });
  if (queue.length >= 40) flush();
}

export function flush(): void {
  if (!queue.length) return;
  const payload: TrackPayload = { v: ctx.v, p: location.pathname, e: queue.splice(0, queue.length) };
  beacon(endpoint("track"), payload);
}

/* ---------- formatting ---------- */

export function fmtNumber(n: number): string {
  try {
    return new Intl.NumberFormat(ctx.lang).format(n);
  } catch {
    return String(n);
  }
}

/** "5 minutes ago" in the site language. */
export function fmtAgo(sec: number): string {
  const s = Math.max(0, sec || 0);
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["minute", 60],
    ["hour", 3600],
    ["day", 86400],
    ["week", 604800],
    ["month", 2592000],
    ["year", 31536000],
  ];
  let unit: Intl.RelativeTimeFormatUnit = "minute";
  let value = 1;
  for (let i = 0; i < steps.length; i++) {
    const next = steps[i + 1];
    if (!next || s < next[1]) {
      unit = steps[i][0];
      value = Math.max(1, Math.floor(s / steps[i][1]));
      break;
    }
  }
  try {
    return new Intl.RelativeTimeFormat(ctx.lang, { numeric: "auto" }).format(-value, unit);
  } catch {
    return value + " " + unit + (value > 1 ? "s" : "") + " ago";
  }
}

export function shuffle<T>(list: T[]): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
