import { emptyResponse, jsonResponse, preflight, resolvePublicSite } from "@/lib/cors";
import { getDb } from "@/lib/db";
import { BodyTooLargeError, isRecord, parseJsonText, readBodyText } from "@/lib/public-api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { addMonthlyViews, addWidgetStats } from "@/lib/usage";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ key: string }> };

const MAX_BYTES = 16 * 1024;
const MAX_EVENTS = 200;

/** Upper bounds per request, so one page view can't inflate the statistics. */
const CAPS = { impressions: 50, hovers: 50, clicks: 20, conversions: 5 } as const;
type Counter = keyof typeof CAPS;
const COUNTER: Record<string, Counter> = { i: "impressions", h: "hovers", c: "clicks", x: "conversions" };

export async function OPTIONS(request: Request, { params }: Params) {
  return preflight(request, (await params).key);
}

/**
 * POST /api/w/{key}/track — body: TrackPayload as text/plain JSON (sendBeacon).
 * Responds 204. Unknown or inactive widget ids are ignored.
 */
export async function POST(request: Request, { params }: Params) {
  const { key } = await params;
  const ip = await clientIp();
  if (!rateLimit(`wtrk:${ip}:${key}`, 60, 60_000)) return jsonResponse({ error: "Too many requests." }, 429, {}, { "Retry-After": "60" });

  const ctx = await resolvePublicSite(request, key);
  if (ctx instanceof Response) return ctx;
  const { site, cors } = ctx;

  let body: unknown;
  try {
    body = parseJsonText(await readBodyText(request, MAX_BYTES));
  } catch (e) {
    if (e instanceof BodyTooLargeError) return jsonResponse({ error: "Payload too large." }, 413, cors);
    throw e;
  }
  if (!isRecord(body) || !Array.isArray(body.e)) return jsonResponse({ error: "Invalid payload." }, 400, cors);
  if (body.e.length > MAX_EVENTS) return jsonResponse({ error: "Too many events." }, 400, cors);
  if (!body.e.length) return emptyResponse(cors);

  // Only this site's active widgets are counted.
  const db = await getDb();
  const rows = await db.selectFrom("widgets").select(["id", "type"]).where("site_id", "=", site.id).where("is_active", "=", 1).execute();
  const types = new Map(rows.map((r) => [r.id, r.type]));

  const totals: Record<Counter, number> = { impressions: 0, hovers: 0, clicks: 0, conversions: 0 };
  const counts = new Map<number, Partial<Record<Counter, number>>>();
  for (const item of body.e) {
    if (!isRecord(item)) continue;
    const widgetId = item.w;
    const counter = typeof item.t === "string" ? COUNTER[item.t] : undefined;
    if (typeof widgetId !== "number" || !Number.isInteger(widgetId) || !counter) continue;
    const type = types.get(widgetId);
    if (!type) continue;
    // Email collector conversions are counted by /lead when the address is stored.
    if (counter === "conversions" && type === "email_collector") continue;
    if (totals[counter] >= CAPS[counter]) continue;
    totals[counter] += 1;
    const entry = counts.get(widgetId) ?? {};
    entry[counter] = (entry[counter] ?? 0) + 1;
    counts.set(widgetId, entry);
  }

  if (counts.size) {
    await addWidgetStats(counts);
    if (totals.impressions > 0) await addMonthlyViews(site.user_id, totals.impressions);
  }
  return emptyResponse(cors);
}
