import "server-only";
import { getDb, now } from "./db";
import type { Site } from "./db/schema";
import { countEvents, recentEvents, toEmbedEvent } from "./events";
import { getLocale } from "./i18n/server";
import { atLimit, getEntitlements, type Entitlements } from "./plans";
import { getSettings, type Settings } from "./settings";
import { parseSiteSettings, type SiteSettings } from "./sites";
import { absoluteUrl, uploadUrl } from "./site";
import { getMonthlyViews } from "./usage";
import { getSiteWidgets, type WidgetRecord } from "./widgets";
import type { EmbedConfig, EmbedTestimonial, EmbedWidget, EmbedWidgetData } from "@/widget/types";

/** Live-visitor heartbeats older than this no longer count as "online". */
export const PRESENCE_WINDOW_MS = 90_000;

async function getOwner(site: Site) {
  const db = await getDb();
  return db.selectFrom("users").select(["id", "role", "status", "plan_id", "plan_expires_at"]).where("id", "=", site.user_id).executeTakeFirst();
}

export async function countPresence(siteId: number, path?: string): Promise<number> {
  const db = await getDb();
  const since = new Date(Date.now() - PRESENCE_WINDOW_MS).toISOString();
  const row = await db
    .selectFrom("presence")
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .where("site_id", "=", siteId)
    .where("seen_at", ">=", since)
    .$if(Boolean(path), (qb) => qb.where("path", "=", path!))
    .executeTakeFirst();
  return Number(row?.n ?? 0);
}

export async function approvedTestimonials(siteId: number, minRating: number, limit: number): Promise<EmbedTestimonial[]> {
  const db = await getDb();
  const rows = await db
    .selectFrom("testimonials")
    .select(["name", "title", "avatar", "rating", "body"])
    .where("site_id", "=", siteId)
    .where("status", "=", "approved")
    .where("rating", ">=", minRating)
    .orderBy("created_at", "desc")
    .limit(limit)
    .execute();
  // Widgets render on customers' sites, so avatars must be absolute URLs.
  const settings = await getSettings();
  const avatarUrl = (v: string | null) => (!v ? "" : /^https?:\/\//.test(v) ? v : absoluteUrl(settings, uploadUrl(v)));
  return rows.map((r) => ({ name: r.name, title: r.title ?? "", avatar: avatarUrl(r.avatar), rating: r.rating, body: r.body }));
}

/** The data one widget needs: events, testimonials or a count. `path` is the visitor's page (live visitors). */
export async function buildWidgetData(site: Site, siteSettings: SiteSettings, widget: WidgetRecord, path?: string): Promise<EmbedWidgetData> {
  switch (widget.type) {
    case "recent_activity": {
      const c = widget.content as WidgetRecord<"recent_activity">["content"];
      const sinceIso = c.maxAgeHours ? new Date(Date.now() - c.maxAgeHours * 3_600_000).toISOString() : undefined;
      const rows = await recentEvents(site.id, c.kinds, { sinceIso, limit: c.limit });
      const mode = c.anonymize ?? siteSettings.anonymize;
      return { events: rows.map((e) => toEmbedEvent(e, mode)) };
    }
    case "conversion_counter": {
      const c = widget.content as WidgetRecord<"conversion_counter">["content"];
      return { count: await countEvents(site.id, c.kinds, new Date(Date.now() - c.periodHours * 3_600_000).toISOString()) };
    }
    case "live_visitors": {
      const c = widget.content as WidgetRecord<"live_visitors">["content"];
      return { count: await countPresence(site.id, c.scope === "page" ? path : undefined) };
    }
    case "review": {
      const c = widget.content as WidgetRecord<"review">["content"];
      if (c.source === "testimonials") return { testimonials: await approvedTestimonials(site.id, c.minRating, c.limit) };
      const rows = await recentEvents(site.id, ["review"], { limit: c.limit, minRating: c.minRating });
      return { events: rows.map((e) => toEmbedEvent(e, siteSettings.anonymize)) };
    }
    default:
      return {};
  }
}

/** Widgets that are switched on and inside their schedule window right now. */
function isLive(widget: WidgetRecord): boolean {
  const t = now();
  if (!widget.isActive) return false;
  if (widget.rules.startAt && t < widget.rules.startAt) return false;
  if (widget.rules.endAt && t > widget.rules.endAt) return false;
  return true;
}

export function brandingFor(settings: Settings, entitlements: Pick<Entitlements, "removeBranding">): EmbedConfig["branding"] {
  if (entitlements.removeBranding || !settings.branding_text.trim()) return null;
  return { text: settings.branding_text.trim(), url: settings.branding_url || absoluteUrl(settings, "/") };
}

export interface EmbedResult {
  config: EmbedConfig;
  /** The owner has used up this month's views; widgets are withheld. */
  overQuota: boolean;
}

/**
 * Everything the embed script needs for one page view of `site`.
 * Banned owners and owners over their monthly view limit get an empty widget list.
 */
export async function buildEmbedConfig(site: Site, path?: string): Promise<EmbedResult> {
  const [settings, owner, locale] = await Promise.all([getSettings(), getOwner(site), getLocale()]);
  const siteSettings = parseSiteSettings(site.settings);
  const entitlements = await getEntitlements(owner ?? null);
  const lang = siteSettings.language || locale.code;
  const base: EmbedConfig = {
    lang,
    dir: siteSettings.language ? siteSettings.dir : locale.dir,
    branding: brandingFor(settings, entitlements),
    captureForms: siteSettings.captureForms,
    presence: false,
    widgets: [],
  };
  if (!owner || owner.status !== "active") return { config: base, overQuota: false };

  let allowedWidgetIds: Set<number> | null = null;
  const views = await getMonthlyViews(owner.id);
  if (atLimit(views, entitlements.maxMonthlyViews)) return { config: base, overQuota: true };

  // After a downgrade the account can be over its plan limits. Limits apply to the
  // whole account: the oldest websites and the first widgets (by website, then order) keep working.
  if (entitlements.maxSites > 0 || entitlements.maxWidgets > 0) {
    const db = await getDb();
    if (entitlements.maxSites > 0) {
      const allowedSites = await db.selectFrom("sites").select("id").where("user_id", "=", owner.id).orderBy("id").limit(entitlements.maxSites).execute();
      if (!allowedSites.some((s) => s.id === site.id)) return { config: base, overQuota: true };
    }
    if (entitlements.maxWidgets > 0) {
      const allowed = await db
        .selectFrom("widgets")
        .innerJoin("sites", "sites.id", "widgets.site_id")
        .select("widgets.id")
        .where("sites.user_id", "=", owner.id)
        .where("widgets.is_active", "=", 1)
        .orderBy("widgets.site_id")
        .orderBy("widgets.sort_order")
        .orderBy("widgets.id")
        .limit(entitlements.maxWidgets)
        .execute();
      allowedWidgetIds = new Set(allowed.map((w) => w.id));
    }
  }
  const widgets = (await getSiteWidgets(site.id, true)).filter((w) => isLive(w) && (!allowedWidgetIds || allowedWidgetIds.has(w.id)));

  const embedWidgets: EmbedWidget[] = await Promise.all(
    widgets.map(async (w) => ({
      id: w.id,
      type: w.type,
      content: w.content,
      design: w.design,
      rules: w.rules,
      data: await buildWidgetData(site, siteSettings, w, path),
    })),
  );
  return {
    config: { ...base, presence: widgets.some((w) => w.type === "live_visitors"), widgets: embedWidgets },
    overQuota: false,
  };
}
