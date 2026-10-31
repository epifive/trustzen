import "server-only";
import { sql } from "kysely";
import { getDb } from "./db";

export const currentMonth = () => new Date().toISOString().slice(0, 7);
export const today = () => new Date().toISOString().slice(0, 10);

export async function getMonthlyViews(userId: number, month = currentMonth()): Promise<number> {
  const db = await getDb();
  const row = await db.selectFrom("usage_monthly").select("views").where("user_id", "=", userId).where("month", "=", month).executeTakeFirst();
  return Number(row?.views ?? 0);
}

/** Add widget views to the owner's monthly total (portable upsert for MySQL and SQLite). */
export async function addMonthlyViews(userId: number, views: number): Promise<void> {
  if (views <= 0) return;
  const db = await getDb();
  const month = currentMonth();
  const updated = await db
    .updateTable("usage_monthly")
    .set({ views: sql`views + ${views}` })
    .where("user_id", "=", userId)
    .where("month", "=", month)
    .executeTakeFirst();
  if (Number(updated.numUpdatedRows) > 0) return;
  try {
    await db.insertInto("usage_monthly").values({ user_id: userId, month, views }).execute();
  } catch {
    // Another request inserted the row first.
    await db.updateTable("usage_monthly").set({ views: sql`views + ${views}` }).where("user_id", "=", userId).where("month", "=", month).execute();
  }
}

type Counter = "impressions" | "hovers" | "clicks" | "conversions";

/** Add tracked interactions to today's row for each widget. */
export async function addWidgetStats(counts: Map<number, Partial<Record<Counter, number>>>): Promise<void> {
  if (!counts.size) return;
  const db = await getDb();
  const day = today();
  for (const [widgetId, c] of counts) {
    const values = {
      impressions: c.impressions ?? 0,
      hovers: c.hovers ?? 0,
      clicks: c.clicks ?? 0,
      conversions: c.conversions ?? 0,
    };
    const set = {
      impressions: sql<number>`impressions + ${values.impressions}`,
      hovers: sql<number>`hovers + ${values.hovers}`,
      clicks: sql<number>`clicks + ${values.clicks}`,
      conversions: sql<number>`conversions + ${values.conversions}`,
    };
    const updated = await db.updateTable("widget_stats_daily").set(set).where("widget_id", "=", widgetId).where("day", "=", day).executeTakeFirst();
    if (Number(updated.numUpdatedRows) > 0) continue;
    try {
      await db.insertInto("widget_stats_daily").values({ widget_id: widgetId, day, ...values }).execute();
    } catch {
      await db.updateTable("widget_stats_daily").set(set).where("widget_id", "=", widgetId).where("day", "=", day).execute();
    }
  }
}
