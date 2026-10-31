import { after } from "next/server";
import { jsonResponse, preflight, resolvePublicSite } from "@/lib/cors";
import { getDb, now } from "@/lib/db";
import { countPresence } from "@/lib/embed";
import { BodyTooLargeError, isRecord, normalizePath, normalizeVisitor, parseJsonText, readBodyText } from "@/lib/public-api";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ key: string }> };

const MAX_BYTES = 2 * 1024;
/** Heartbeats older than this are deleted now and then. */
const STALE_MS = 10 * 60_000;

export async function OPTIONS(request: Request, { params }: Params) {
  return preflight(request, (await params).key);
}

async function touch(siteId: number, visitor: string, path: string) {
  const db = await getDb();
  const seenAt = now();
  const update = () =>
    db.updateTable("presence").set({ path, seen_at: seenAt }).where("site_id", "=", siteId).where("visitor", "=", visitor).executeTakeFirst();
  const updated = await update();
  if (Number(updated.numUpdatedRows) > 0) return;
  try {
    await db.insertInto("presence").values({ site_id: siteId, visitor, path, seen_at: seenAt }).execute();
  } catch {
    // Another request inserted the row first (or MySQL reported an unchanged row).
    await update();
  }
}

/**
 * POST /api/w/{key}/presence — body: PresencePayload (JSON or text/plain JSON).
 * Replies { site, page }: visitors online on the whole site and on this path.
 */
export async function POST(request: Request, { params }: Params) {
  const { key } = await params;
  const ip = await clientIp();
  if (!rateLimit(`wpre:${ip}:${key}`, 30, 60_000)) return jsonResponse({ error: "Too many requests." }, 429, {}, { "Retry-After": "60" });

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
  const visitor = isRecord(body) ? normalizeVisitor(body.v) : null;
  if (!isRecord(body) || !visitor) return jsonResponse({ error: "Invalid payload." }, 400, cors);
  const path = normalizePath(body.p);

  await touch(site.id, visitor, path);

  if (Math.random() < 1 / 50) {
    after(async () => {
      const db = await getDb();
      await db
        .deleteFrom("presence")
        .where("seen_at", "<", new Date(Date.now() - STALE_MS).toISOString())
        .execute()
        .catch(() => undefined);
    });
  }

  const [siteCount, pageCount] = await Promise.all([countPresence(site.id), countPresence(site.id, path)]);
  return jsonResponse({ site: siteCount, page: pageCount }, 200, cors);
}
