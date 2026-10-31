"use server";

import { redirect } from "next/navigation";
import { guardDashboard } from "@/lib/dashboard";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/messages";
import { atLimit } from "@/lib/plans";
import { getOwnedSite } from "@/lib/sites";
import { countUserWidgets, createWidget, deleteWidget, duplicateWidget, getOwnedWidget, updateWidget } from "@/lib/widgets";
import { isWidgetType } from "@/widget/normalize";
import type { FormState } from "../types";

const idOf = (v: FormDataEntryValue | null) => Number(typeof v === "string" ? v : NaN);

/** JSON from a hidden input, or undefined when it is missing or malformed. */
function jsonField(formData: FormData, key: string): unknown {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.length > 100_000) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Custom HTML sanitiser. Every tag is re-built from its parsed attributes, so
// the output is well-formed and contains no scripts, event handlers, frames or
// javascript:/vbscript:/data: URLs, whatever tricks the input uses.
// ---------------------------------------------------------------------------

/** Removed together with everything inside them. */
const DROP_WITH_CONTENT = ["script", "style", "iframe", "object", "noscript", "template", "title", "xmp", "noembed", "noframes", "textarea", "select"];
/** Removed (the tag only). */
const DROP_TAG = new Set([...DROP_WITH_CONTENT, "embed", "applet", "frame", "frameset", "link", "meta", "base", "plaintext", "form", "html", "head", "body"]);
const URL_ATTRS = new Set(["href", "src", "action", "xlink:href", "poster", "background", "cite", "data", "srcset", "ping", "formaction", "longdesc", "lowsrc", "dynsrc"]);

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => String.fromCodePoint(Math.min(parseInt(hex, 16), 0x10ffff)))
    .replace(/&#(\d+);?/g, (_, dec: string) => String.fromCodePoint(Math.min(Number(dec), 0x10ffff)))
    .replace(/&colon;?/gi, ":")
    .replace(/&(tab|newline);?/gi, "")
    .replace(/&quot;?/gi, '"')
    .replace(/&apos;?/gi, "'")
    .replace(/&lt;?/gi, "<")
    .replace(/&gt;?/gi, ">")
    .replace(/&amp;?/gi, "&");
}

function isDangerousUrl(value: string): boolean {
  const v = decodeEntities(value).replace(/[\s\u0000-\u001F\u007F]+/g, "").toLowerCase();
  if (/(^|,)(javascript|vbscript|livescript):/.test(v) || v.includes("script:")) return true;
  if (v.startsWith("data:") && !/^data:image\/(png|gif|jpe?g|webp|avif);/.test(v)) return true;
  return false;
}

const escapeAttr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function rebuildTag(tag: string): string {
  const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([\s\S]*?)\/?>$/.exec(tag);
  if (!m) return "";
  const [, closing, rawName, rest] = m;
  const name = rawName.toLowerCase();
  if (DROP_TAG.has(name)) return "";
  if (closing) return `</${name}>`;
  const attrs: string[] = [];
  const attrRe = /([^\s"'>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;
  let a: RegExpExecArray | null;
  while ((a = attrRe.exec(rest))) {
    const attrName = a[1].toLowerCase();
    if (!/^[a-z_:][-a-z0-9_:.]*$/.test(attrName)) continue;
    if (attrName.startsWith("on") || attrName === "srcdoc" || attrName === "formaction" || attrName === "is") continue;
    let value = a[2] ?? "";
    if (/^["']/.test(value)) value = value.slice(1, -1);
    value = decodeEntities(value);
    if (URL_ATTRS.has(attrName) && isDangerousUrl(value)) continue;
    if (attrName === "style" && /expression\s*\(|javascript:|behavior\s*:|-moz-binding|@import/i.test(value)) continue;
    attrs.push(a[2] === undefined ? ` ${attrName}` : ` ${attrName}="${escapeAttr(value)}"`);
  }
  return `<${name}${attrs.join("")}>`;
}

function sanitizeHtml(input: string): string {
  let html = input.replace(/<!--[\s\S]*?(-->|$)/g, "");
  for (const tag of DROP_WITH_CONTENT) {
    html = html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?(<\\/${tag}\\s*>|$)`, "gi"), "");
  }
  // Rebuild real tags; any other "<" that could start markup is escaped.
  return html.replace(/<\/?[a-zA-Z](?:"[^"]*"|'[^']*'|[^'">])*>|<(?=[a-zA-Z/!?])/g, (match) => (match === "<" ? "&lt;" : rebuildTag(match)));
}

// ---------------------------------------------------------------------------

/** Create a widget from the type gallery, then open it in the editor. */
export async function createWidgetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const site = await getOwnedSite(idOf(formData.get("site_id")), guard.user.id);
  if (!site) return { error: t("editor.err.siteNotFound") };
  const type = formData.get("type");
  if (!isWidgetType(type)) return { error: t("editor.err.type") };
  if (atLimit(await countUserWidgets(guard.user.id), guard.entitlements.maxWidgets)) {
    return { error: t("editor.err.limit", { limit: guard.entitlements.maxWidgets }) };
  }
  const name = t(`dash.type.${type}` as MessageKey) || type.replace(/_/g, " ");
  const id = await createWidget(site.id, type, name);
  redirect(`/dashboard/widgets/${id}`);
}

/** Save the editor. content/design/rules arrive as JSON and are normalised by updateWidget. */
export async function saveWidgetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const widget = await getOwnedWidget(idOf(formData.get("widget_id")), guard.user.id);
  if (!widget) return { error: t("editor.err.notFound") };

  const content = jsonField(formData, "content");
  const design = jsonField(formData, "design");
  const rules = jsonField(formData, "rules");
  if (!content || !design || !rules) return { error: t("editor.err.invalid") };
  if (widget.type === "custom_html") {
    const html = (content as { html?: unknown }).html;
    (content as { html?: unknown }).html = typeof html === "string" ? sanitizeHtml(html.slice(0, 5000)) : "";
  }

  const rawName = formData.get("name");
  const name = typeof rawName === "string" ? rawName : undefined;
  await updateWidget(widget, { name, content, design, rules });
  return { success: t("editor.saved") };
}

/** Switch a widget on or off (called directly from the editor header). */
export async function setWidgetActiveAction(widgetId: number, active: boolean): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const widget = await getOwnedWidget(Number(widgetId), guard.user.id);
  if (!widget) return { error: t("editor.err.notFound") };
  await updateWidget(widget, { isActive: Boolean(active) });
  return { success: t(active ? "editor.activated" : "editor.deactivated") };
}

/** Copy a widget (inactive) and open the copy. */
export async function duplicateWidgetAction(widgetId: number): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const widget = await getOwnedWidget(Number(widgetId), guard.user.id);
  if (!widget) return { error: t("editor.err.notFound") };
  if (atLimit(await countUserWidgets(guard.user.id), guard.entitlements.maxWidgets)) {
    return { error: t("editor.err.limit", { limit: guard.entitlements.maxWidgets }) };
  }
  const id = await duplicateWidget(widget);
  redirect(`/dashboard/widgets/${id}`);
}

/** Delete a widget and go back to its site. */
export async function deleteWidgetAction(widgetId: number): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const widget = await getOwnedWidget(Number(widgetId), guard.user.id);
  if (!widget) return { error: t("editor.err.notFound") };
  await deleteWidget(widget.id);
  redirect(`/dashboard/sites/${widget.siteId}`);
}
