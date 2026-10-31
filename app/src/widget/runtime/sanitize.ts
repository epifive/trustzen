/**
 * Browser-side allowlist sanitiser for the custom_html widget. The server already
 * sanitises on save; this is defence in depth. Builds fresh elements in our own
 * document from a DOMParser tree, copying only allowlisted tags and attributes.
 */

import { D } from "./core";

const TAGS = "p br strong b em i u span a ul ol li h3 h4 img small mark code".split(" ");
/** Dropped together with their content; other unknown tags are unwrapped. */
const DROP = /^(script|style|iframe|object|embed|template|noscript|textarea|select|svg|math|frame|frameset|link|meta|base|head|title|form|input|button|video|audio|canvas)$/;

/** Strip whitespace/control characters browsers ignore inside URL schemes. */
function squash(v: string): string {
  let out = "";
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i);
    if (c > 32 && (c < 127 || c > 159)) out += v[i];
  }
  return out;
}

export function safeHref(v: string): string | null {
  const s = squash(v);
  if (/^(https?:|mailto:)/i.test(s)) return v.trim();
  // Relative: no scheme before the first "/", "?" or "#".
  const head = s.split(/[/?#]/)[0];
  return head.indexOf(":") === -1 ? v.trim() : null;
}

const safeSrc = (v: string) => (/^https?:\/\//i.test(squash(v)) ? v.trim() : null);

function copy(src: Node, out: Node): void {
  src.childNodes.forEach((n) => {
    if (n.nodeType === 3) {
      out.appendChild(D.createTextNode(n.textContent || ""));
      return;
    }
    if (n.nodeType !== 1) return;
    const el = n as Element;
    const tag = el.tagName.toLowerCase();
    if (DROP.test(tag)) return;
    if (TAGS.indexOf(tag) === -1) {
      copy(el, out);
      return;
    }
    const c = D.createElement(tag);
    const alt = el.getAttribute("alt");
    const title = el.getAttribute("title");
    if (alt != null) c.setAttribute("alt", alt.slice(0, 300));
    if (title != null) c.setAttribute("title", title.slice(0, 300));
    if (tag === "a") {
      const href = safeHref(el.getAttribute("href") || "");
      if (href) c.setAttribute("href", href);
      if (el.getAttribute("target") === "_blank") {
        c.setAttribute("target", "_blank");
        c.setAttribute("rel", "noopener noreferrer");
      }
    }
    if (tag === "img") {
      const s = safeSrc(el.getAttribute("src") || "");
      if (!s) return;
      c.setAttribute("src", s);
      c.setAttribute("loading", "lazy");
    }
    copy(el, c);
    out.appendChild(c);
  });
}

export function sanitize(html: string): DocumentFragment {
  const frag = D.createDocumentFragment();
  try {
    const doc = new DOMParser().parseFromString("<!doctype html><body>" + html, "text/html");
    copy(doc.body, frag);
  } catch {
    frag.appendChild(D.createTextNode(""));
  }
  return frag;
}
