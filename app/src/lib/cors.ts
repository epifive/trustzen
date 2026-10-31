import "server-only";
import type { Site } from "./db/schema";
import { getSiteByKey, hostMatchesSite, parseSiteSettings, type SiteSettings } from "./sites";

/**
 * CORS for the public embed API (/api/w/{key}/*).
 *
 * The requesting page is identified by the Origin header, or the Referer when a
 * browser omits Origin. Only the site's own domain (and subdomains) plus the
 * site's extra domains are allowed; everything else gets a 403 without CORS
 * headers, so other websites can't read or use a site's widgets.
 */

export type CorsHeaders = Record<string, string>;

/** Hostname of the page that sent the request, or null when unknown. */
export function requestHost(request: Request): { host: string; origin: string } | null {
  const origin = request.headers.get("origin");
  if (origin && origin !== "null") {
    try {
      const url = new URL(origin);
      if (url.protocol === "http:" || url.protocol === "https:") return { host: url.hostname, origin: url.origin };
    } catch {
      return null;
    }
    return null;
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const url = new URL(referer);
      if (url.protocol === "http:" || url.protocol === "https:") return { host: url.hostname, origin: url.origin };
    } catch {
      return null;
    }
  }
  return null;
}

export function corsHeadersFor(origin: string): CorsHeaders {
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

/** CORS headers when the request comes from one of the site's domains, otherwise null. */
export function checkSiteOrigin(request: Request, site: Pick<Site, "domain">, settings: SiteSettings): CorsHeaders | null {
  const from = requestHost(request);
  if (!from || !hostMatchesSite(from.host, site, settings)) return null;
  return corsHeadersFor(from.origin);
}

/** JSON response with optional CORS headers. API responses are never cached by shared caches. */
export function jsonResponse(data: unknown, status = 200, headers: CorsHeaders = {}, extra: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers, ...extra } });
}

export function emptyResponse(headers: CorsHeaders = {}): Response {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store", ...headers } });
}

export interface PublicSiteContext {
  site: Site;
  settings: SiteSettings;
  cors: CorsHeaders;
}

/**
 * Loads the site for a public key and verifies the requesting page.
 * Returns a ready-made error Response (404 unknown key, 403 foreign origin) on failure.
 */
export async function resolvePublicSite(request: Request, key: string): Promise<PublicSiteContext | Response> {
  const site = await getSiteByKey(key);
  if (!site) return jsonResponse({ error: "Unknown site." }, 404);
  const settings = parseSiteSettings(site.settings);
  const cors = checkSiteOrigin(request, site, settings);
  if (!cors) return jsonResponse({ error: "This website is not allowed to use these widgets." }, 403);
  return { site, settings, cors };
}

/** OPTIONS handler shared by every /api/w/{key}/* route. */
export async function preflight(request: Request, key: string): Promise<Response> {
  const result = await resolvePublicSite(request, key);
  if (result instanceof Response) return result;
  return new Response(null, { status: 204, headers: result.cors });
}
