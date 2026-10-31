/**
 * Turns untrusted JSON (dashboard forms, stored rows, imports) into complete,
 * valid widget settings. Unknown keys are dropped, missing keys get defaults and
 * numbers are clamped, so the rest of the code can trust the shapes in types.ts.
 *
 * Dependency-free: used by the server, the dashboard and the embed script.
 */

import {
  DEFAULT_DESIGN,
  DEFAULT_RULES,
  EVENT_KINDS,
  WIDGET_DEFAULTS,
  WIDGET_TYPES,
  type ContentByType,
  type EventKind,
  type WidgetDesign,
  type WidgetRules,
  type WidgetType,
} from "./types";

type Obj = Record<string, unknown>;

const asObj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});

export function isWidgetType(v: unknown): v is WidgetType {
  return typeof v === "string" && (WIDGET_TYPES as readonly string[]).includes(v);
}

function str(v: unknown, fallback: string, max = 500): string {
  if (typeof v !== "string") return fallback;
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max);
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function bool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "on" || v === 1 || v === "1") return true;
  if (v === "false" || v === "off" || v === 0 || v === "0") return false;
  return fallback;
}

function oneOf<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : fallback;
}

function color(v: unknown, fallback: string): string {
  if (v === "") return "";
  return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback;
}

/** http(s) URL, a site-relative path ("/pricing") or "" — never javascript: or data: URLs. */
export function safeUrl(v: unknown, fallback = ""): string {
  if (typeof v !== "string") return fallback;
  const value = v.trim().slice(0, 500);
  if (!value) return "";
  if (/^\/(?!\/)/.test(value) || /^#/.test(value)) return value;
  if (/^https?:\/\/[^\s"'<>]+$/i.test(value)) return value;
  return fallback;
}

/** ISO date string or "" when empty/invalid. */
function isoDate(v: unknown): string {
  if (typeof v !== "string" || !v.trim()) return "";
  const t = Date.parse(v);
  return Number.isNaN(t) ? "" : new Date(t).toISOString();
}

function kinds(v: unknown, fallback: EventKind[]): EventKind[] {
  if (!Array.isArray(v)) return fallback;
  const list = v.filter((k): k is EventKind => typeof k === "string" && (EVENT_KINDS as readonly string[]).includes(k));
  return [...new Set(list)];
}

function patterns(v: unknown): string[] {
  const list = Array.isArray(v) ? v : typeof v === "string" ? v.split(/\r?\n|,/) : [];
  return list
    .filter((p): p is string => typeof p === "string")
    .map((p) => p.trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 50);
}

export function normalizeDesign(input: unknown, base: WidgetDesign = DEFAULT_DESIGN): WidgetDesign {
  const o = asObj(input);
  return {
    position: oneOf(o.position, ["bottom-left", "bottom-right", "top-left", "top-right", "top-bar", "bottom-bar", "center"] as const, base.position),
    theme: oneOf(o.theme, ["light", "dark", "auto"] as const, base.theme),
    accent: color(o.accent, base.accent),
    background: color(o.background, base.background),
    text: color(o.text, base.text),
    radius: num(o.radius, base.radius, 0, 32),
    shadow: bool(o.shadow, base.shadow),
    animation: oneOf(o.animation, ["slide", "fade", "none"] as const, base.animation),
    showClose: bool(o.showClose, base.showClose),
    font: oneOf(o.font, ["inherit", "system"] as const, base.font),
    width: num(o.width, base.width, 240, 480),
    showImage: bool(o.showImage, base.showImage),
  };
}

export function normalizeRules(input: unknown, base: WidgetRules = DEFAULT_RULES): WidgetRules {
  const o = asObj(input);
  const devices = Array.isArray(o.devices)
    ? (o.devices.filter((d) => d === "desktop" || d === "mobile") as WidgetRules["devices"])
    : base.devices;
  return {
    pagesMode: oneOf(o.pagesMode, ["all", "include", "exclude"] as const, base.pagesMode),
    pages: o.pages === undefined ? base.pages : patterns(o.pages),
    devices: [...new Set(devices)],
    trigger: oneOf(o.trigger, ["load", "delay", "scroll", "exit"] as const, base.trigger),
    delaySec: num(o.delaySec, base.delaySec, 0, 600),
    scrollPercent: num(o.scrollPercent, base.scrollPercent, 1, 100),
    displaySec: num(o.displaySec, base.displaySec, 0, 600),
    gapSec: num(o.gapSec, base.gapSec, 0, 600),
    maxPerPage: num(o.maxPerPage, base.maxPerPage, 1, 50),
    afterClose: oneOf(o.afterClose, ["always", "session", "day", "never"] as const, base.afterClose),
    startAt: o.startAt === undefined ? base.startAt : isoDate(o.startAt),
    endAt: o.endAt === undefined ? base.endAt : isoDate(o.endAt),
  };
}

export function normalizeContent<T extends WidgetType>(type: T, input: unknown): ContentByType[T] {
  const o = asObj(input);
  const d = WIDGET_DEFAULTS[type].content as unknown as Obj;
  const s = (key: string, max = 300) => str(o[key], d[key] as string, max);
  let out: unknown;
  switch (type) {
    case "recent_activity": {
      const def = WIDGET_DEFAULTS.recent_activity.content;
      out = {
        kinds: kinds(o.kinds, def.kinds),
        template: s("template", 200),
        maxAgeHours: num(o.maxAgeHours, def.maxAgeHours, 0, 24 * 365),
        limit: num(o.limit, def.limit, 1, 30),
        showTime: bool(o.showTime, def.showTime),
        anonymize: oneOf(o.anonymize, ["none", "first_name", "initials"] as const, def.anonymize),
        fallbackName: s("fallbackName", 60),
        linkUrl: safeUrl(o.linkUrl, def.linkUrl),
        shuffle: bool(o.shuffle, def.shuffle),
      };
      break;
    }
    case "live_visitors": {
      const def = WIDGET_DEFAULTS.live_visitors.content;
      out = { template: s("template", 200), scope: oneOf(o.scope, ["page", "site"] as const, def.scope), minCount: num(o.minCount, def.minCount, 1, 100000) };
      break;
    }
    case "conversion_counter": {
      const def = WIDGET_DEFAULTS.conversion_counter.content;
      out = {
        template: s("template", 200),
        kinds: kinds(o.kinds, def.kinds),
        periodHours: num(o.periodHours, def.periodHours, 1, 24 * 90),
        minCount: num(o.minCount, def.minCount, 1, 1000000),
      };
      break;
    }
    case "review": {
      const def = WIDGET_DEFAULTS.review.content;
      out = {
        source: oneOf(o.source, ["testimonials", "events"] as const, def.source),
        minRating: num(o.minRating, def.minRating, 1, 5),
        limit: num(o.limit, def.limit, 1, 30),
        shuffle: bool(o.shuffle, def.shuffle),
        maxLength: num(o.maxLength, def.maxLength, 60, 400),
      };
      break;
    }
    case "announcement":
      out = { text: s("text", 300), buttonText: s("buttonText", 40), buttonUrl: safeUrl(o.buttonUrl, d.buttonUrl as string), badge: s("badge", 20) };
      break;
    case "coupon":
      out = { title: s("title", 120), text: s("text", 300), code: s("code", 40), buttonText: s("buttonText", 40), copiedText: s("copiedText", 40) };
      break;
    case "countdown": {
      const def = WIDGET_DEFAULTS.countdown.content;
      out = {
        text: s("text", 200),
        mode: oneOf(o.mode, ["fixed", "evergreen"] as const, def.mode),
        endAt: isoDate(o.endAt),
        evergreenMinutes: num(o.evergreenMinutes, def.evergreenMinutes, 1, 60 * 24 * 30),
        buttonText: s("buttonText", 40),
        buttonUrl: safeUrl(o.buttonUrl, def.buttonUrl),
        onExpire: oneOf(o.onExpire, ["hide", "message"] as const, def.onExpire),
        expiredText: s("expiredText", 200),
      };
      break;
    }
    case "email_collector": {
      const def = WIDGET_DEFAULTS.email_collector.content;
      out = {
        title: s("title", 120),
        text: s("text", 300),
        collectName: bool(o.collectName, def.collectName),
        namePlaceholder: s("namePlaceholder", 60),
        emailPlaceholder: s("emailPlaceholder", 60),
        buttonText: s("buttonText", 40),
        successText: s("successText", 200),
        consentText: s("consentText", 300),
      };
      break;
    }
    case "cookie_notice":
      out = { text: s("text", 400), buttonText: s("buttonText", 40), policyText: s("policyText", 60), policyUrl: safeUrl(o.policyUrl, d.policyUrl as string) };
      break;
    case "custom_html":
      out = { html: str(o.html, d.html as string, 5000) };
      break;
  }
  return out as ContentByType[T];
}

/** Complete settings for a new widget of `type`. */
export function widgetDefaults<T extends WidgetType>(type: T): { content: ContentByType[T]; design: WidgetDesign; rules: WidgetRules } {
  const d = WIDGET_DEFAULTS[type];
  return {
    content: normalizeContent(type, d.content),
    design: normalizeDesign(d.design ?? {}),
    rules: normalizeRules(d.rules ?? {}),
  };
}

/** Parse a stored JSON column safely. */
export function parseJson(text: string | null | undefined): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
