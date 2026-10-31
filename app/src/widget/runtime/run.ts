/**
 * Display rules, triggers, rotation and the presence heartbeat.
 */

import { DEFAULT_DESIGN, DEFAULT_RULES, ROTATING_TYPES, WIDGET_DEFAULTS, type ContentByType, type EmbedWidget } from "../types";
import { isWidgetType } from "../normalize";
import { D, W, ctx, endpoint, getItem, later, mq, on, postJson, setItem, shuffle } from "./core";
import { accepted, activity, announcement, cookieNotice, counter, countdown, coupon, customHtml, emailCollector, eventAsReview, review } from "./render";
import { present, type Panel } from "./ui";

/** Bumped on every preview re-render so timers of the previous widget stop. */
let gen = 0;
export const bump = () => ++gen;

/** Fill missing keys with defaults (defensive: older or partial configs). */
export function fill(w: EmbedWidget): EmbedWidget | null {
  if (!w || !isWidgetType(w.type)) return null;
  const d = WIDGET_DEFAULTS[w.type] as { content: object; design?: object; rules?: object };
  return {
    id: Number(w.id) || 0,
    type: w.type,
    content: { ...d.content, ...w.content } as EmbedWidget["content"],
    design: { ...DEFAULT_DESIGN, ...d.design, ...w.design },
    rules: { ...DEFAULT_RULES, ...d.rules, ...w.rules },
    data: w.data || {},
  };
}

/* ---------- rules ---------- */

function pathMatch(pattern: string, path: string): boolean {
  let p = pattern.trim();
  if (/^https?:\/\//i.test(p)) {
    try {
      p = new URL(p).pathname;
    } catch {
      return false;
    }
  }
  const norm = (s: string) => (s.length > 1 ? s.replace(/\/+$/, "") : s);
  const re = norm(p)
    .split("*")
    .map((x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp("^" + re + "$", "i").test(norm(path));
}

export const isMobileDevice = () => mq("(max-width: 767px)") || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const closeKey = (w: EmbedWidget) => "tz_c_" + w.id;

function closedBefore(w: EmbedWidget): boolean {
  const k = closeKey(w);
  switch (w.rules.afterClose) {
    case "session":
      return !!getItem(k, true);
    case "day":
      return Date.now() - Number(getItem(k) || 0) < 86400000;
    case "never":
      return !!getItem(k);
  }
  return false;
}

function rememberClose(w: EmbedWidget): void {
  const a = w.rules.afterClose;
  if (a === "session") setItem(closeKey(w), "1", true);
  else if (a === "day" || a === "never") setItem(closeKey(w), String(Date.now()));
}

export function eligible(w: EmbedWidget): boolean {
  const r = w.rules;
  const path = location.pathname;
  const pages = r.pages || [];
  if (r.pagesMode === "include" && !pages.some((x) => pathMatch(x, path))) return false;
  if (r.pagesMode === "exclude" && pages.some((x) => pathMatch(x, path))) return false;
  if (!(r.devices || []).includes(isMobileDevice() ? "mobile" : "desktop")) return false;
  const t = Date.now();
  if (r.startAt && t < Date.parse(r.startAt)) return false;
  if (r.endAt && t > Date.parse(r.endAt)) return false;
  return !closedBefore(w) && !accepted(w);
}

/** Call `fire` once when the widget's trigger happens. */
export function trigger(w: EmbedWidget, fire: () => void): void {
  const r = w.rules;
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    fire();
  };
  const delay = (sec: number) => later(go, Math.max(0, sec) * 1000);
  if (r.trigger === "load") go();
  else if (r.trigger === "scroll") {
    const check = () => {
      const max = D.documentElement.scrollHeight - W.innerHeight;
      if (max <= 0 || (W.scrollY / max) * 100 >= r.scrollPercent) go();
    };
    on(W, "scroll", check, { passive: true });
    later(check, 1500);
  } else if (r.trigger === "exit") {
    if (isMobileDevice()) delay(r.delaySec || 15);
    else
      on<MouseEvent>(D, "mouseout", (e) => {
        if (!e.relatedTarget && e.clientY <= 0) go();
      });
  } else delay(r.delaySec);
}

/* ---------- presence (live visitors) ---------- */

let pres: { site: number; page: number } | null = null;
const subs: Array<() => void> = [];

export function presence(): void {
  let last = 0;
  const send = () => {
    if (D.visibilityState === "hidden") return;
    last = Date.now();
    postJson<{ site: number; page: number }>(endpoint("presence"), { v: ctx.v, p: location.pathname })
      .then((r) => {
        if (r && typeof r.site === "number") {
          pres = { site: r.site, page: Number(r.page) || 0 };
          subs.slice().forEach((f) => f());
        }
      })
      .catch(() => {});
  };
  send();
  setInterval(() => {
    try {
      send();
    } catch {
      /* ignore */
    }
  }, 60000);
  on(D, "visibilitychange", () => {
    if (D.visibilityState === "visible" && Date.now() - last > 60000) send();
  });
}

function countOf(w: EmbedWidget): number {
  if (w.type === "live_visitors" && pres && !ctx.preview) return (w.content as ContentByType["live_visitors"]).scope === "site" ? pres.site : pres.page;
  return Number(w.data.count) || 0;
}

/* ---------- runners ---------- */

export function start(w: EmbedWidget): void {
  const g = gen;
  const alive = () => g === gen;
  const r = w.rules;
  const pv = ctx.preview;
  const panel = (sec: number): Panel => ({ w, sec, fx: [], body: D.createElement("div") });

  if (ROTATING_TYPES.indexOf(w.type) > -1) {
    const data = w.data;
    const isReview = w.type === "review";
    let list: unknown[] = isReview
      ? (data.testimonials && data.testimonials.length ? data.testimonials : (data.events || []).map(eventAsReview)).filter((t) => t && t.body)
      : data.events || [];
    if (!list.length) return;
    if ((w.content as { shuffle?: boolean }).shuffle) list = shuffle(list);
    const limit = pv ? Infinity : Math.min(r.maxPerPage || 1, list.length);
    const gap = (pv ? Math.min(r.gapSec, 2) : r.gapSec) * 1000;
    const next = (i: number) => {
      if (!alive() || i >= limit) return;
      const p = panel(r.displaySec);
      const item = list[i % list.length];
      p.body = isReview ? review(w, p, item as never) : activity(w, p, item as never);
      p.end = (closed) => {
        if (closed && !pv) return rememberClose(w);
        later(() => next(i + 1), closed ? 1500 : Math.max(gap, 400));
      };
      present(p);
    };
    next(0);
    return;
  }

  let shown = false;
  const single = () => {
    if (!alive() || shown) return;
    const p = panel(pv ? 0 : r.displaySec);
    let body: HTMLElement | null = null;
    switch (w.type) {
      case "live_visitors":
      case "conversion_counter": {
        const min = (w.content as { minCount: number }).minCount || 0;
        if (!pv && countOf(w) < min) return;
        const c = counter(w, p, countOf(w));
        body = c.body;
        if (w.type === "live_visitors" && !pv) subs.push(() => !p.gone && c.set(countOf(w)));
        break;
      }
      case "announcement":
        body = announcement(w, p);
        break;
      case "coupon":
        body = coupon(w, p);
        break;
      case "countdown":
        body = countdown(w, p);
        break;
      case "email_collector":
        body = emailCollector(w, p);
        break;
      case "cookie_notice":
        body = cookieNotice(w, p);
        break;
      case "custom_html":
        body = customHtml(w, p);
        break;
    }
    if (!body) return;
    shown = true;
    p.body = body;
    p.end = (closed) => {
      if (closed && !pv) rememberClose(w);
      if (pv) {
        shown = false;
        later(single, 1500);
      }
    };
    present(p);
  };
  // Live visitors below the threshold: show once a heartbeat reports enough people.
  if (w.type === "live_visitors" && !pv) subs.push(single);
  single();
}
