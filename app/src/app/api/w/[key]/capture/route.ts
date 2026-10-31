import { emptyResponse, jsonResponse, preflight, resolvePublicSite } from "@/lib/cors";
import { insertEvent } from "@/lib/events";
import { notifyOwner } from "@/lib/notify";
import { BodyTooLargeError, isRecord, parseJsonText, readBodyText } from "@/lib/public-api";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ key: string }> };

const MAX_BYTES = 4 * 1024;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function OPTIONS(request: Request, { params }: Params) {
  return preflight(request, (await params).key);
}

/**
 * POST /api/w/{key}/capture — body: CapturePayload as text/plain JSON.
 * Turns a form submission on the customer's site into an event (only the first name is kept).
 */
export async function POST(request: Request, { params }: Params) {
  const { key } = await params;
  const ip = await clientIp();
  if (!rateLimit(`wcap:${ip}:${key}`, 10, 60_000)) return jsonResponse({ error: "Too many requests." }, 429, {}, { "Retry-After": "60" });

  const ctx = await resolvePublicSite(request, key);
  if (ctx instanceof Response) return ctx;
  const { site, settings, cors } = ctx;
  if (!settings.captureForms) return jsonResponse({ error: "Form capture is turned off for this site." }, 403, cors);

  let body: unknown;
  try {
    body = parseJsonText(await readBodyText(request, MAX_BYTES));
  } catch (e) {
    if (e instanceof BodyTooLargeError) return jsonResponse({ error: "Payload too large." }, 413, cors);
    throw e;
  }
  if (!isRecord(body)) return jsonResponse({ error: "Invalid payload." }, 400, cors);

  // Privacy: never store more than the first name of a visitor.
  const firstName = text(body.name, 120).split(/\s+/)[0] ?? "";
  const event = {
    kind: settings.captureKind,
    name: firstName,
    city: text(body.city, 120),
    country: text(body.country, 120),
    product: text(body.product, 255),
  };
  const id = await insertEvent(site.id, { source: "form", ...event });
  notifyOwner(site, { type: "event", data: { events: [{ id, source: "form", ...event }] } });
  return emptyResponse(cors);
}
