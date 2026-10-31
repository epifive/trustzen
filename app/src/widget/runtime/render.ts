/**
 * One renderer per widget type. Renderers build DOM with textContent only (user,
 * event and testimonial text is never parsed as HTML) — except custom_html, which
 * goes through the allowlist sanitiser.
 */

import type { ContentByType, EmbedEvent, EmbedTestimonial, EmbedWidget } from "../types";
import { safeUrl } from "../normalize";
import { D, add, attr, ctx, endpoint, fmtAgo, fmtNumber, getItem, h, icon, later, on, postJson, setItem, track } from "./core";
import { sanitize } from "./sanitize";
import { dismiss, type Panel } from "./ui";

type C<T extends keyof ContentByType> = ContentByType[T];

const I = {
  check: '<path d="M20 6L9 17l-5-5"/>',
  verified: '<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="M22 4L12 14l-3-3"/>',
  bag: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  flame:
    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  gift: '<path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
};

const isBar = (w: EmbedWidget) => /-bar$/.test(w.design.position);

/* ---------- helpers ---------- */

/**
 * Fill a template's placeholders. Empty values collapse cleanly: a dangling
 * separator ("{city}, {country}") or a short connector word ("from {location}")
 * next to an empty value is removed, and spaces/punctuation are tidied.
 */
export function tpl(t: string, vals: Record<string, string>, bold: string[]): Node[] {
  const raw = (t || "").split(/\{(\w+)\}/);
  type Seg = { s: string; k?: string };
  let segs: Seg[] = raw.map((s, i) => {
    if (i % 2 === 0) return { s };
    const k = s.toLowerCase();
    return k in vals ? { s: (vals[k] || "").trim(), k } : { s: "{" + s + "}" };
  });
  for (let i = 1; i < segs.length - 1; ) {
    const seg = segs[i];
    if (!seg.k || seg.s) {
      i += 2;
      continue;
    }
    let prev = segs[i - 1].s;
    let next = segs[i + 1].s;
    if (/^\s*[,;:·|-]/.test(next)) next = next.replace(/^\s*[,;:·|-]\s*/, " ");
    else if (/[,;:·|-]\s*$/.test(prev)) prev = prev.replace(/\s*[,;:·|-]\s*$/, " ");
    else if (/(^|\s)[a-z]{1,5}\s+$/.test(prev) && (!next || /^[\s.!?]/.test(next))) prev = prev.replace(/(^|\s)[a-z]{1,5}\s+$/, "$1");
    segs = segs.slice(0, i - 1).concat([{ s: prev + next }], segs.slice(i + 2));
  }
  const out: Node[] = [];
  segs.forEach((seg, i) => {
    let s = seg.s;
    if (!seg.k) {
      s = s.replace(/\(\s*\)/g, "").replace(/\s{2,}/g, " ").replace(/\s+([,.!?;:])/g, "$1");
      if (i === 0) s = s.replace(/^[\s,;:.]+/, "");
      if (i === segs.length - 1) s = s.replace(/[\s,;:]+$/, "");
    }
    if (!s) return;
    out.push(seg.k && bold.indexOf(seg.k) > -1 ? h("b", "tz-b", s) : D.createTextNode(s));
  });
  return out;
}

const initial = (name: string) => (Array.from(name.trim())[0] || "").toUpperCase();

/** Image, initial circle or icon. */
function avatar(src: string, name: string, fallbackIcon: string, square?: boolean, small?: boolean): HTMLElement {
  const box = attr(h("div", "tz-av" + (small ? " tz-sm" : "")), { "aria-hidden": "true" });
  const letter = () => {
    box.classList.remove("tz-sq");
    box.textContent = "";
    const l = initial(name);
    if (l) box.textContent = l;
    else box.appendChild(icon(fallbackIcon));
  };
  const url = /^https?:\/\//i.test(src || "") ? src : "";
  if (url) {
    if (square) box.classList.add("tz-sq");
    const img = attr(h("img"), { alt: "", src: url, loading: "lazy", referrerpolicy: "no-referrer" });
    on(img, "error", letter);
    box.appendChild(img);
  } else letter();
  return box;
}

const softIcon = (paths: string) => add(attr(h("div", "tz-av tz-soft"), { "aria-hidden": "true" }), icon(paths));

function linkButton(w: EmbedWidget, text: string, url: string, block: boolean): HTMLElement | null {
  const href = safeUrl(url);
  if (!text || !href) return null;
  const a = attr(h("a", "tz-btn" + (block ? " tz-blk" : ""), text), { href });
  on(a, "click", () => track(w.id, "c"));
  return a;
}

function truncate(s: string, max: number): string {
  const t = (s || "").trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  let cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  if (sp > max * 0.7) cut = cut.slice(0, sp);
  return cut.replace(/[\s,.;:!?-]+$/, "") + "…";
}

function header(w: EmbedWidget, iconPaths: string, title: string, text: string): HTMLElement {
  const tx = add(h("div", "tz-tx"), title && h("div", "tz-h", title), text && h("div", "tz-p", text));
  return add(h("div", "tz-hd"), w.design.showImage && softIcon(iconPaths), tx);
}

/* ---------- rotating types ---------- */

export function activity(w: EmbedWidget, p: Panel, ev: EmbedEvent): HTMLElement {
  const c = w.content as C<"recent_activity">;
  const real = (ev.name || "").trim();
  const name = real || c.fallbackName || "Someone";
  const loc = [ev.city, ev.country].filter((x) => x && x.trim()).join(", ");
  const url = safeUrl(ev.url) || safeUrl(c.linkUrl);
  const row = h(url ? "a" : "div", "tz-row");
  if (url) {
    row.setAttribute("href", url);
    on(row, "click", () => track(w.id, "c"));
  }
  if (w.design.showImage) row.appendChild(avatar(ev.image, real, ev.kind === "purchase" ? I.bag : I.user, true));
  const text = add(h("div"), ...tpl(c.template, { name, city: ev.city, country: ev.country, product: ev.product, location: loc }, ["name", "product"]));
  const tx = add(h("div", "tz-tx"), text);
  if (c.showTime && ev.ago >= 0) tx.appendChild(add(h("div", "tz-m"), icon(I.verified), h("span", "", fmtAgo(ev.ago))));
  row.appendChild(tx);
  p.label = text.textContent || "";
  return row;
}

export function review(w: EmbedWidget, p: Panel, t: EmbedTestimonial): HTMLElement {
  const c = w.content as C<"review">;
  const box = h("div");
  const r = Math.max(0, Math.min(5, Math.round(t.rating || 0)));
  if (r) {
    const stars = attr(h("div", "tz-st"), { role: "img", "aria-label": r + " / 5" });
    for (let i = 1; i <= 5; i++) {
      const s = icon(I.star);
      if (i > r) s.classList.add("tz-e");
      stars.appendChild(s);
    }
    box.appendChild(stars);
  }
  box.appendChild(h("div", "tz-q", truncate(t.body, c.maxLength || 160)));
  const who = add(h("div", "tz-tx"), h("b", "tz-b", t.name || ""), t.title && h("span", "tz-t2", t.title));
  box.appendChild(add(h("div", "tz-by"), w.design.showImage && t.name && avatar(t.avatar, t.name, I.user, false, true), who));
  p.label = t.name || "";
  return box;
}

export const eventAsReview = (e: EmbedEvent): EmbedTestimonial => ({
  name: e.name,
  title: e.product || [e.city, e.country].filter(Boolean).join(", "),
  avatar: e.image,
  rating: e.rating,
  body: e.message,
});

/* ---------- single-panel types ---------- */

/** live_visitors / conversion_counter. Returns the body plus an updater for live counts. */
export function counter(w: EmbedWidget, p: Panel, count: number): { body: HTMLElement; set: (n: number) => void } {
  const live = w.type === "live_visitors";
  const text = h("div", "tz-tx");
  const set = (n: number) => {
    const vals: Record<string, string> = { count: fmtNumber(n) };
    if (!live) vals.hours = fmtNumber((w.content as C<"conversion_counter">).periodHours);
    text.textContent = "";
    add(text, ...tpl((w.content as { template: string }).template, vals, ["count"]));
    p.label = text.textContent || "";
  };
  set(count);
  const lead = live ? add(h("div", "tz-av tz-soft"), h("span", "tz-dot")) : softIcon(I.flame);
  const body = add(h("div", "tz-row"), (w.design.showImage || live) && lead, text);
  return { body, set };
}

export function announcement(w: EmbedWidget, p: Panel): HTMLElement {
  const c = w.content as C<"announcement">;
  const bar = isBar(w);
  p.label = c.text;
  const badge = c.badge && h("span", "tz-bdg", c.badge);
  if (bar) return add(h("div", "tz-in"), badge, h("span", "tz-b", c.text), linkButton(w, c.buttonText, c.buttonUrl, false));
  if (badge) badge.style.marginBottom = "8px";
  return add(h("div"), badge, h("div", "tz-q tz-b", c.text), linkButton(w, c.buttonText, c.buttonUrl, true));
}

function copyText(s: string): Promise<void> {
  const fallback = () => {
    const ta = h("textarea");
    ta.value = s;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    D.body.appendChild(ta);
    ta.select();
    try {
      D.execCommand("copy");
    } finally {
      ta.remove();
    }
  };
  const clip = navigator.clipboard;
  if (clip && clip.writeText) return clip.writeText(s).catch(fallback);
  return new Promise((resolve) => {
    fallback();
    resolve();
  });
}

export function coupon(w: EmbedWidget, p: Panel): HTMLElement {
  const c = w.content as C<"coupon">;
  const bar = isBar(w);
  p.label = c.title || c.code;
  const btn = add(attr(h("button", "tz-btn"), { type: "button" }), icon(I.copy), h("span", "", c.buttonText || "Copy"));
  let converted = false;
  on(btn, "click", () => {
    copyText(c.code)
      .catch(() => {})
      .then(() => {
        (btn.lastChild as HTMLElement).textContent = c.copiedText || c.buttonText;
        (btn.firstChild as HTMLElement).innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + I.check + "</svg>";
        if (!converted) track(w.id, "x");
        converted = true;
        later(() => {
          (btn.lastChild as HTMLElement).textContent = c.buttonText || "Copy";
          (btn.firstChild as HTMLElement).innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + I.copy + "</svg>";
        }, 2600);
      });
  });
  const code = add(h("div", "tz-code"), h("code", "", c.code), btn);
  if (bar) {
    code.style.margin = "0";
    return add(h("div", "tz-in"), c.title && h("span", "tz-b", c.title), c.text && h("span", "tz-p", c.text), code);
  }
  return add(h("div"), header(w, I.gift, c.title, c.text), code);
}

function unitLabel(unit: string, fallback: string): string {
  try {
    const parts = new Intl.NumberFormat(ctx.lang, { style: "unit", unit, unitDisplay: "narrow" }).formatToParts(1);
    const u = parts.filter((x) => x.type === "unit")[0];
    return u ? u.value.trim() : fallback;
  } catch {
    return fallback;
  }
}

/** null = already expired and set to hide. */
export function countdown(w: EmbedWidget, p: Panel): HTMLElement | null {
  const c = w.content as C<"countdown">;
  const bar = isBar(w);
  let end: number;
  if (c.mode === "fixed") {
    end = Date.parse(c.endAt);
    if (isNaN(end)) end = ctx.preview ? Date.now() + 2 * 86400000 + 5025000 : 0;
  } else {
    const k = "tz_cd_" + w.id;
    let first = Number(getItem(k));
    if (!first || first > Date.now()) {
      first = Date.now();
      setItem(k, String(first));
    }
    end = first + (c.evergreenMinutes || 30) * 60000;
  }
  const expired = () => end - Date.now() <= 0;
  if (expired() && c.onExpire === "hide" && !ctx.preview) return null;
  p.label = c.text;

  const units: Array<[number, string, string]> = [
    [86400, "day", "d"],
    [3600, "hour", "h"],
    [60, "minute", "m"],
    [1, "second", "s"],
  ];
  const showDays = end - Date.now() >= 86400000;
  const clock = attr(h("div", "tz-cd"), { role: "timer", "aria-live": "off" });
  const cells = units
    .filter((u) => showDays || u[0] < 86400)
    .map((u) => {
      const b = h("b", "", "00");
      clock.appendChild(add(h("div", "tz-u"), b, h("small", "", unitLabel(u[1], u[2]))));
      return [u[0], b] as [number, HTMLElement];
    });
  const text = h("span", "tz-b", c.text);
  const btn = linkButton(w, c.buttonText, c.buttonUrl, !bar);
  const body = bar ? add(h("div", "tz-in"), text, clock, btn) : add(h("div"), add(h("div", "tz-q"), text), clock, btn);

  let timer = 0;
  const tick = () => {
    let left = Math.max(0, Math.floor((end - Date.now()) / 1000));
    cells.forEach(([size, b]) => {
      const v = Math.floor(left / size);
      left -= v * size;
      b.textContent = v < 10 ? "0" + v : String(v);
    });
    if (!expired()) return;
    clearInterval(timer);
    if (ctx.preview && c.onExpire === "hide") return;
    if (c.onExpire === "hide") dismiss(p, false);
    else {
      body.textContent = "";
      body.appendChild(h("span", "tz-b", c.expiredText));
    }
  };
  tick();
  if (!expired()) {
    timer = window.setInterval(() => {
      try {
        tick();
      } catch {
        clearInterval(timer);
      }
    }, 1000);
    p.fx.push(() => clearInterval(timer));
  }
  return body;
}

export function emailCollector(w: EmbedWidget, p: Panel): HTMLElement {
  const c = w.content as C<"email_collector">;
  p.label = c.title;
  const box = add(h("div"), header(w, I.mail, c.title, c.text));
  const form = attr(h("form", "tz-f"), { novalidate: "" });
  const field = (type: string, name: string, ph: string, auto: string) => {
    const id = "tz-" + name + "-" + w.id;
    const input = attr(h("input"), { type, name, id, placeholder: ph, autocomplete: auto });
    form.appendChild(add(h("div"), attr(h("label", "tz-sr", ph), { for: id }), input));
    return input;
  };
  const nameIn = c.collectName ? field("text", "name", c.namePlaceholder || "Name", "given-name") : null;
  const email = field("email", "email", c.emailPlaceholder || "Email", "email");
  email.required = true;
  on(email, "input", () => {
    email.removeAttribute("aria-invalid");
    email.style.borderColor = "";
  });
  const btn = attr(h("button", "tz-btn", c.buttonText || "OK"), { type: "submit" });
  const err = attr(h("div", "tz-err"), { role: "alert" });
  add(form, btn, err);
  box.appendChild(form);
  if (c.consentText) box.appendChild(h("p", "tz-sub", c.consentText));

  const done = () => {
    form.replaceWith(add(h("div", "tz-done"), icon(I.verified), h("span", "", c.successText)));
    // No "x" track event here: the /lead endpoint records this conversion itself.
    setItem("tz_l_" + w.id, "1");
    later(() => dismiss(p, false), 6000);
  };
  on<SubmitEvent>(form, "submit", (e) => {
    e.preventDefault();
    e.stopPropagation();
    err.textContent = "";
    const value = email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      email.setAttribute("aria-invalid", "true");
      email.style.borderColor = "var(--er)";
      // Native, browser-localised message where the browser agrees the value is invalid.
      if (email.reportValidity) email.reportValidity();
      email.focus();
      return;
    }
    email.removeAttribute("aria-invalid");
    email.style.borderColor = "";
    if (ctx.preview) return done();
    btn.disabled = true;
    postJson<{ ok?: boolean; error?: string }>(endpoint("lead"), {
      v: ctx.v,
      p: location.pathname,
      w: w.id,
      email: value,
      name: nameIn ? nameIn.value.trim().slice(0, 80) : "",
    }, "application/json")
      .then((r) => {
        if (r && r.ok) done();
        else err.textContent = (r && r.error) || "Error";
      })
      .catch(() => {
        err.textContent = "Network error";
      })
      .then(() => {
        btn.disabled = false;
      });
  });
  return box;
}

export function cookieNotice(w: EmbedWidget, p: Panel): HTMLElement {
  const c = w.content as C<"cookie_notice">;
  const bar = isBar(w);
  p.label = c.text;
  const href = safeUrl(c.policyUrl);
  const link = href && c.policyText ? attr(h("a", "tz-lk", c.policyText), { href, target: "_blank", rel: "noopener" }) : null;
  const btn = attr(h("button", "tz-btn" + (bar ? "" : " tz-blk"), c.buttonText || "OK"), { type: "button" });
  on(btn, "click", () => {
    setItem("tz_ck_" + w.id, "1");
    track(w.id, "c");
    dismiss(p, false);
  });
  const text = add(h("span"), D.createTextNode(c.text + " "), link);
  return bar ? add(h("div", "tz-in"), text, btn) : add(h("div"), add(h("div", "tz-q"), text), btn);
}

export function customHtml(w: EmbedWidget, p: Panel): HTMLElement {
  const box = add(h("div", "tz-html"), sanitize((w.content as C<"custom_html">).html || ""));
  p.label = (box.textContent || "").slice(0, 80);
  return box;
}

export const accepted = (w: EmbedWidget) =>
  (w.type === "cookie_notice" && getItem("tz_ck_" + w.id) === "1") || (w.type === "email_collector" && getItem("tz_l_" + w.id) === "1");
