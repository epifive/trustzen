import { z } from "zod";
import { jsonResponse, preflight, resolvePublicSite } from "@/lib/cors";
import { getDb, now } from "@/lib/db";
import { notifyOwner } from "@/lib/notify";
import { BodyTooLargeError, normalizePath, parseJsonText, readBodyText } from "@/lib/public-api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { addWidgetStats } from "@/lib/usage";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ key: string }> };

const MAX_BYTES = 4 * 1024;

const schema = z.object({
  w: z.number().int().positive(),
  email: z.string().trim().toLowerCase().pipe(z.email().max(190)),
  name: z
    .string()
    .optional()
    .transform((v) => (v ?? "").replace(/[\u0000-\u001F\u007F<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120)),
  p: z.unknown().optional(),
});

export async function OPTIONS(request: Request, { params }: Params) {
  return preflight(request, (await params).key);
}

/**
 * POST /api/w/{key}/lead — body: LeadPayload (JSON).
 * Replies { ok: true } or { error } (422 invalid, 429 too many). Errors are shown to visitors.
 */
export async function POST(request: Request, { params }: Params) {
  const { key } = await params;
  const ctx = await resolvePublicSite(request, key);
  if (ctx instanceof Response) return ctx;
  const { site, cors } = ctx;

  const ip = await clientIp();
  if (!rateLimit(`wlead:${ip}:${key}`, 5, 60_000)) {
    return jsonResponse({ error: "Too many attempts. Please try again in a minute." }, 429, cors, { "Retry-After": "60" });
  }

  let body: unknown;
  try {
    body = parseJsonText(await readBodyText(request, MAX_BYTES));
  } catch (e) {
    if (e instanceof BodyTooLargeError) return jsonResponse({ error: "Request too large." }, 413, cors);
    throw e;
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const emailIssue = parsed.error.issues.some((i) => i.path[0] === "email");
    return jsonResponse({ error: emailIssue ? "Please enter a valid email address." : "Invalid request." }, 422, cors);
  }
  const { w: widgetId, email, name } = parsed.data;

  const db = await getDb();
  const widget = await db
    .selectFrom("widgets")
    .select("id")
    .where("id", "=", widgetId)
    .where("site_id", "=", site.id)
    .where("type", "=", "email_collector")
    .where("is_active", "=", 1)
    .executeTakeFirst();
  if (!widget) return jsonResponse({ error: "This form is no longer available." }, 422, cors);

  // The same address signing up twice is stored (and counted) once.
  const existing = await db.selectFrom("leads").select("id").where("site_id", "=", site.id).where("email", "=", email).executeTakeFirst();
  if (!existing) {
    const page = normalizePath(parsed.data.p);
    await db
      .insertInto("leads")
      .values({ site_id: site.id, widget_id: widget.id, email, name: name || null, data: null, page_url: page, created_at: now() })
      .execute();
    await addWidgetStats(new Map([[widget.id, { conversions: 1 }]]));
    notifyOwner(site, { type: "lead", data: { email, name, page, widgetId: widget.id } });
  }
  return jsonResponse({ ok: true }, 200, cors);
}
