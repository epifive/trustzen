import "server-only";
import { getDb, now } from "./db";
import type { Widget } from "./db/schema";
import { parseSiteSettings } from "./sites";
import { isWidgetType, normalizeContent, normalizeDesign, normalizeRules, parseJson, widgetDefaults } from "@/widget/normalize";
import type { ContentByType, WidgetDesign, WidgetRules, WidgetType } from "@/widget/types";

/** A stored widget with its JSON columns parsed and validated. */
export interface WidgetRecord<T extends WidgetType = WidgetType> {
  id: number;
  siteId: number;
  type: T;
  name: string;
  isActive: boolean;
  content: ContentByType[T];
  design: WidgetDesign;
  rules: WidgetRules;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function toWidgetRecord(row: Widget): WidgetRecord | null {
  if (!isWidgetType(row.type)) return null;
  return {
    id: row.id,
    siteId: row.site_id,
    type: row.type,
    name: row.name,
    isActive: row.is_active === 1,
    content: normalizeContent(row.type, parseJson(row.content)),
    design: normalizeDesign(parseJson(row.design)),
    rules: normalizeRules(parseJson(row.rules)),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getSiteWidgets(siteId: number, onlyActive = false): Promise<WidgetRecord[]> {
  const db = await getDb();
  const rows = await db
    .selectFrom("widgets")
    .selectAll()
    .where("site_id", "=", siteId)
    .$if(onlyActive, (qb) => qb.where("is_active", "=", 1))
    .orderBy("sort_order")
    .orderBy("id")
    .execute();
  return rows.map(toWidgetRecord).filter((w): w is WidgetRecord => w !== null);
}

/** A widget that belongs to one of `userId`'s sites (prevents IDOR in the dashboard). */
export async function getOwnedWidget(widgetId: number, userId: number): Promise<WidgetRecord | undefined> {
  if (!Number.isInteger(widgetId) || widgetId < 1) return undefined;
  const db = await getDb();
  const row = await db
    .selectFrom("widgets")
    .innerJoin("sites", "sites.id", "widgets.site_id")
    .selectAll("widgets")
    .where("widgets.id", "=", widgetId)
    .where("sites.user_id", "=", userId)
    .executeTakeFirst();
  return row ? (toWidgetRecord(row) ?? undefined) : undefined;
}

export async function countUserWidgets(userId: number): Promise<number> {
  const db = await getDb();
  const row = await db
    .selectFrom("widgets")
    .innerJoin("sites", "sites.id", "widgets.site_id")
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .where("sites.user_id", "=", userId)
    .executeTakeFirst();
  return Number(row?.n ?? 0);
}

export async function createWidget<T extends WidgetType>(siteId: number, type: T, name: string): Promise<number> {
  const db = await getDb();
  const d = widgetDefaults(type);
  if (type === "recent_activity") {
    // New activity widgets start with the website's "Show names as" setting.
    const site = await db.selectFrom("sites").select("settings").where("id", "=", siteId).executeTakeFirst();
    (d.content as ContentByType["recent_activity"]).anonymize = parseSiteSettings(site?.settings).anonymize;
  }
  const ts = now();
  const max = await db.selectFrom("widgets").select((eb) => eb.fn.max<number>("sort_order").as("m")).where("site_id", "=", siteId).executeTakeFirst();
  const result = await db
    .insertInto("widgets")
    .values({
      site_id: siteId,
      type,
      name: name.trim().slice(0, 120) || type,
      is_active: 1,
      content: JSON.stringify(d.content),
      design: JSON.stringify(d.design),
      rules: JSON.stringify(d.rules),
      sort_order: Number(max?.m ?? 0) + 1,
      created_at: ts,
      updated_at: ts,
    })
    .executeTakeFirstOrThrow();
  return Number(result.insertId);
}

/** Save editor input; every part is normalised against the widget's type. */
export async function updateWidget(
  widget: Pick<WidgetRecord, "id" | "type">,
  input: { name?: string; isActive?: boolean; content?: unknown; design?: unknown; rules?: unknown },
): Promise<void> {
  const db = await getDb();
  await db
    .updateTable("widgets")
    .set({
      ...(input.name !== undefined ? { name: input.name.trim().slice(0, 120) || widget.type } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive ? 1 : 0 } : {}),
      ...(input.content !== undefined ? { content: JSON.stringify(normalizeContent(widget.type, input.content)) } : {}),
      ...(input.design !== undefined ? { design: JSON.stringify(normalizeDesign(input.design)) } : {}),
      ...(input.rules !== undefined ? { rules: JSON.stringify(normalizeRules(input.rules)) } : {}),
      updated_at: now(),
    })
    .where("id", "=", widget.id)
    .execute();
}

export async function duplicateWidget(widget: WidgetRecord): Promise<number> {
  const db = await getDb();
  const ts = now();
  const result = await db
    .insertInto("widgets")
    .values({
      site_id: widget.siteId,
      type: widget.type,
      name: `${widget.name} (copy)`.slice(0, 120),
      is_active: 0,
      content: JSON.stringify(widget.content),
      design: JSON.stringify(widget.design),
      rules: JSON.stringify(widget.rules),
      sort_order: widget.sortOrder + 1,
      created_at: ts,
      updated_at: ts,
    })
    .executeTakeFirstOrThrow();
  return Number(result.insertId);
}

export async function deleteWidget(widgetId: number): Promise<void> {
  const db = await getDb();
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom("widget_stats_daily").where("widget_id", "=", widgetId).execute();
    await trx.updateTable("leads").set({ widget_id: null }).where("widget_id", "=", widgetId).execute();
    await trx.deleteFrom("widgets").where("id", "=", widgetId).execute();
  });
}

export interface WidgetStats {
  impressions: number;
  hovers: number;
  clicks: number;
  conversions: number;
}

/** Totals per widget for the last `days` days (including today). */
export async function getWidgetTotals(widgetIds: number[], days: number): Promise<Map<number, WidgetStats>> {
  const out = new Map<number, WidgetStats>();
  if (!widgetIds.length) return out;
  const db = await getDb();
  const since = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .selectFrom("widget_stats_daily")
    .select([
      "widget_id",
      (eb) => eb.fn.sum<number>("impressions").as("impressions"),
      (eb) => eb.fn.sum<number>("hovers").as("hovers"),
      (eb) => eb.fn.sum<number>("clicks").as("clicks"),
      (eb) => eb.fn.sum<number>("conversions").as("conversions"),
    ])
    .where("widget_id", "in", widgetIds)
    .where("day", ">=", since)
    .groupBy("widget_id")
    .execute();
  for (const r of rows) {
    out.set(r.widget_id, { impressions: Number(r.impressions), hovers: Number(r.hovers), clicks: Number(r.clicks), conversions: Number(r.conversions) });
  }
  return out;
}

/** Daily series for one or more widgets, oldest first, with zero-filled gaps. */
export async function getDailyStats(widgetIds: number[], days: number): Promise<Array<{ day: string } & WidgetStats>> {
  const db = await getDb();
  const since = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const rows = widgetIds.length
    ? await db
        .selectFrom("widget_stats_daily")
        .select([
          "day",
          (eb) => eb.fn.sum<number>("impressions").as("impressions"),
          (eb) => eb.fn.sum<number>("hovers").as("hovers"),
          (eb) => eb.fn.sum<number>("clicks").as("clicks"),
          (eb) => eb.fn.sum<number>("conversions").as("conversions"),
        ])
        .where("widget_id", "in", widgetIds)
        .where("day", ">=", since)
        .groupBy("day")
        .execute()
    : [];
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(Date.now() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    const r = byDay.get(day);
    return {
      day,
      impressions: Number(r?.impressions ?? 0),
      hovers: Number(r?.hovers ?? 0),
      clicks: Number(r?.clicks ?? 0),
      conversions: Number(r?.conversions ?? 0),
    };
  });
}
