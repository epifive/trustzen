import { getDb } from "@/lib/db";
import { insertEvent } from "@/lib/events";
import { notifyOwner } from "@/lib/notify";
import { getEntitlements } from "@/lib/plans";
import { BodyTooLargeError, parseJsonText, readBodyText } from "@/lib/public-api";
import { rateLimit } from "@/lib/rate-limit";
import { getSiteByWebhookToken } from "@/lib/sites";
import { detectPreset, isWebhookPreset, mapWebhook, WEBHOOK_PRESETS } from "@/lib/webhooks/presets";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

const MAX_BYTES = 512 * 1024;

/** Recently processed provider ids (Stripe event, Woo/Shopify order) so retries and repeated updates create one event. */
const DEDUPE_TTL_MS = 48 * 3_600_000;
const globalForHooks = globalThis as unknown as { __trustzenHookSeen?: Map<string, number> };
const seen = (globalForHooks.__trustzenHookSeen ??= new Map());

function alreadySeen(key: string): boolean {
  const nowMs = Date.now();
  const at = seen.get(key);
  if (at && nowMs - at < DEDUPE_TTL_MS) return true;
  if (seen.size >= 20_000) {
    for (const [k, t] of seen) if (nowMs - t >= DEDUPE_TTL_MS) seen.delete(k);
    if (seen.size >= 20_000) seen.clear();
  }
  seen.set(key, nowMs);
  return false;
}

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });

export function GET() {
  return json({ error: "This is a webhook URL. Send events to it with POST." }, 405, { Allow: "POST" });
}

/**
 * POST /api/hooks/{token}[?preset=stripe|woocommerce|shopify|generic]
 * Creates social-proof events from Stripe, WooCommerce, Shopify or generic JSON / form posts.
 * The secret token authenticates the request (see src/lib/webhooks/presets.ts).
 * Replies { ok: true, created: n } or { ok: true, created: 0, ignored: true, reason } or { error }.
 */
export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  if (!rateLimit(`hook:${token.slice(0, 64)}`, 120, 60_000)) {
    return json({ error: "Too many requests. The limit is 120 per minute." }, 429, { "Retry-After": "60" });
  }

  const site = await getSiteByWebhookToken(token);
  if (!site) return json({ error: "Unknown webhook URL. Copy the current URL from your dashboard." }, 404);

  const db = await getDb();
  const owner = await db.selectFrom("users").select(["id", "role", "status", "plan_id", "plan_expires_at"]).where("id", "=", site.user_id).executeTakeFirst();
  if (!owner || owner.status !== "active") return json({ error: "This account is not active." }, 403);
  if (!(await getEntitlements(owner)).isPremium) {
    return json(
      { error: "Incoming webhooks are available on paid plans. Upgrade your plan to create events from Stripe, WooCommerce, Shopify, Zapier or Make." },
      402,
    );
  }

  const presetParam = new URL(request.url).searchParams.get("preset");
  if (presetParam && !isWebhookPreset(presetParam)) {
    return json({ error: `Unknown preset. Use one of: ${WEBHOOK_PRESETS.join(", ")}.` }, 400);
  }

  let text: string;
  try {
    text = await readBodyText(request, MAX_BYTES);
  } catch (e) {
    if (e instanceof BodyTooLargeError) return json({ error: "Request body is larger than 512 KB." }, 413);
    throw e;
  }
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  let body: unknown;
  if (contentType.includes("application/x-www-form-urlencoded")) {
    body = Object.fromEntries(new URLSearchParams(text));
  } else {
    body = parseJsonText(text);
    if (body === undefined) return json({ error: "Send a JSON body (or application/x-www-form-urlencoded)." }, 400);
  }

  const preset = presetParam && isWebhookPreset(presetParam) ? presetParam : detectPreset(body, request.headers);
  const result = mapWebhook(preset, body, request.headers);
  if (result.status === "error") return json({ error: result.error, preset }, 422);
  if (result.status === "ignored") return json({ ok: true, created: 0, ignored: true, reason: result.reason, preset });
  const dedupeKey = result.dedupeKey ? `${site.id}:${result.dedupeKey}` : null;
  if (dedupeKey && alreadySeen(dedupeKey)) {
    return json({ ok: true, created: 0, ignored: true, reason: "Already received.", preset });
  }

  const created: Array<Record<string, unknown>> = [];
  try {
    for (const event of result.events) {
      const id = await insertEvent(site.id, { source: "webhook", ...event });
      created.push({ id, source: "webhook", ...event });
    }
  } catch (e) {
    // Let the provider's retry go through.
    if (dedupeKey && !created.length) seen.delete(dedupeKey);
    throw e;
  }
  if (created.length) notifyOwner(site, { type: "event", data: { events: created } });
  return json({ ok: true, created: created.length, preset });
}
