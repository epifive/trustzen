import "server-only";
import crypto from "node:crypto";
import { getDb, now } from "./db";
import type { Site } from "./db/schema";
import { EVENT_KINDS, type Anonymize, type EventKind } from "@/widget/types";

/** Per-site options stored as JSON in `sites.settings`. */
export interface SiteSettings {
  /** Turn submissions of the site's own forms into events. */
  captureForms: boolean;
  captureKind: EventKind;
  /** Applied to names when events are shown publicly. */
  anonymize: Anonymize;
  /** Language for dates and relative times in widgets ("" = the platform default language). */
  language: string;
  dir: "ltr" | "rtl";
  /** Email the owner about new leads and testimonials. */
  notifyEmail: boolean;
  /** POST new leads, events and testimonials to this URL ("" = off). */
  webhookUrl: string;
  /** Other hostnames allowed to load the widgets (staging, other domains). */
  extraDomains: string[];
  /** Publish testimonials without moderation. */
  autoApproveTestimonials: boolean;
  /** Texts of the public testimonial collection page. */
  collectTitle: string;
  collectText: string;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  captureForms: false,
  captureKind: "signup",
  anonymize: "first_name",
  language: "",
  dir: "ltr",
  notifyEmail: true,
  webhookUrl: "",
  extraDomains: [],
  autoApproveTestimonials: false,
  collectTitle: "Share your experience",
  collectText: "Your feedback helps others decide. It only takes a minute.",
};

export function parseSiteSettings(json: string | null | undefined): SiteSettings {
  let o: Record<string, unknown> = {};
  try {
    o = json ? (JSON.parse(json) as Record<string, unknown>) : {};
  } catch {
    o = {};
  }
  const d = DEFAULT_SITE_SETTINGS;
  const text = (v: unknown, fallback: string, max: number) => (typeof v === "string" ? v.slice(0, max) : fallback);
  return {
    captureForms: typeof o.captureForms === "boolean" ? o.captureForms : d.captureForms,
    captureKind: (EVENT_KINDS as readonly string[]).includes(o.captureKind as string) ? (o.captureKind as EventKind) : d.captureKind,
    anonymize: o.anonymize === "none" || o.anonymize === "initials" || o.anonymize === "first_name" ? o.anonymize : d.anonymize,
    language: typeof o.language === "string" && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(o.language) ? o.language : "",
    dir: o.dir === "rtl" ? "rtl" : "ltr",
    notifyEmail: typeof o.notifyEmail === "boolean" ? o.notifyEmail : d.notifyEmail,
    webhookUrl: typeof o.webhookUrl === "string" && /^https?:\/\/[^\s"'<>]+$/i.test(o.webhookUrl) ? o.webhookUrl.slice(0, 500) : "",
    extraDomains: Array.isArray(o.extraDomains)
      ? o.extraDomains.map((x) => normalizeDomain(String(x))).filter((x): x is string => Boolean(x)).slice(0, 20)
      : [],
    autoApproveTestimonials: typeof o.autoApproveTestimonials === "boolean" ? o.autoApproveTestimonials : d.autoApproveTestimonials,
    collectTitle: text(o.collectTitle, d.collectTitle, 120),
    collectText: text(o.collectText, d.collectText, 400),
  };
}

/** "https://www.Shop.com/path" → "shop.com". Returns null for invalid input. */
export function normalizeDomain(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(value)) value = `https://${value}`;
  let host: string;
  try {
    host = new URL(value).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "").replace(/\.$/, "");
  if (host === "localhost") return host;
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(host)) return null;
  return host;
}

/** True when `host` (from Origin/Referer) belongs to the site: same domain, www. or any subdomain. */
export function hostMatchesSite(host: string, site: Pick<Site, "domain">, settings: SiteSettings): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return [site.domain, ...settings.extraDomains].some((d) => h === d || h.endsWith(`.${d}`));
}

function randomKey(length: number): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export async function getUserSites(userId: number): Promise<Site[]> {
  const db = await getDb();
  return db.selectFrom("sites").selectAll().where("user_id", "=", userId).orderBy("id").execute();
}

export async function countUserSites(userId: number): Promise<number> {
  const db = await getDb();
  const row = await db.selectFrom("sites").select((eb) => eb.fn.countAll<number>().as("n")).where("user_id", "=", userId).executeTakeFirst();
  return Number(row?.n ?? 0);
}

/** A site owned by `userId`, or undefined. Always use this in dashboard code (prevents IDOR). */
export async function getOwnedSite(siteId: number, userId: number): Promise<Site | undefined> {
  if (!Number.isInteger(siteId) || siteId < 1) return undefined;
  const db = await getDb();
  return db.selectFrom("sites").selectAll().where("id", "=", siteId).where("user_id", "=", userId).executeTakeFirst();
}

export async function getSiteByKey(publicKey: string): Promise<Site | undefined> {
  if (!/^[A-Za-z0-9]{8,32}$/.test(publicKey)) return undefined;
  const db = await getDb();
  return db.selectFrom("sites").selectAll().where("public_key", "=", publicKey).executeTakeFirst();
}

export async function getSiteByWebhookToken(token: string): Promise<Site | undefined> {
  if (!/^[A-Za-z0-9]{16,48}$/.test(token)) return undefined;
  const db = await getDb();
  return db.selectFrom("sites").selectAll().where("webhook_token", "=", token).executeTakeFirst();
}

export async function createSite(userId: number, name: string, domain: string, settings: Partial<SiteSettings> = {}): Promise<Site> {
  const db = await getDb();
  const ts = now();
  const values = {
    user_id: userId,
    name: name.trim().slice(0, 120),
    domain,
    public_key: randomKey(12),
    webhook_token: randomKey(32),
    settings: JSON.stringify({ ...DEFAULT_SITE_SETTINGS, ...settings }),
    verified_at: null,
    created_at: ts,
    updated_at: ts,
  };
  const result = await db.insertInto("sites").values(values).executeTakeFirstOrThrow();
  return { ...values, id: Number(result.insertId) };
}

export async function updateSite(siteId: number, values: { name?: string; domain?: string; settings?: SiteSettings }): Promise<void> {
  const db = await getDb();
  await db
    .updateTable("sites")
    .set({
      ...(values.name !== undefined ? { name: values.name.trim().slice(0, 120) } : {}),
      ...(values.domain !== undefined ? { domain: values.domain } : {}),
      ...(values.settings !== undefined ? { settings: JSON.stringify(values.settings) } : {}),
      updated_at: now(),
    })
    .where("id", "=", siteId)
    .execute();
}

export async function regenerateWebhookToken(siteId: number): Promise<string> {
  const db = await getDb();
  const token = randomKey(32);
  await db.updateTable("sites").set({ webhook_token: token, updated_at: now() }).where("id", "=", siteId).execute();
  return token;
}

/** Remember that the embed script ran on the site (shown as "Installed" in the dashboard). */
export async function markSiteVerified(site: Pick<Site, "id" | "verified_at">): Promise<void> {
  // Refresh at most once an hour to avoid a write on every page view.
  if (site.verified_at && Date.now() - Date.parse(site.verified_at) < 3_600_000) return;
  const db = await getDb();
  await db.updateTable("sites").set({ verified_at: now() }).where("id", "=", site.id).execute();
}

/** Delete a site and everything that belongs to it. */
export async function deleteSite(siteId: number): Promise<void> {
  const db = await getDb();
  await db.transaction().execute(async (trx) => {
    const widgetIds = (await trx.selectFrom("widgets").select("id").where("site_id", "=", siteId).execute()).map((w) => w.id);
    if (widgetIds.length) await trx.deleteFrom("widget_stats_daily").where("widget_id", "in", widgetIds).execute();
    for (const table of ["widgets", "events", "testimonials", "leads", "presence"] as const) {
      await trx.deleteFrom(table).where("site_id", "=", siteId).execute();
    }
    await trx.deleteFrom("sites").where("id", "=", siteId).execute();
  });
}
