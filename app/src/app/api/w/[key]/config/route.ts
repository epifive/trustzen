import { after } from "next/server";
import { jsonResponse, preflight, resolvePublicSite } from "@/lib/cors";
import { buildEmbedConfig } from "@/lib/embed";
import { normalizePath } from "@/lib/public-api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { markSiteVerified } from "@/lib/sites";
import type { EmbedConfig } from "@/widget/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ key: string }> };

const TTL_MS = 30_000;
const MAX_ENTRIES = 5_000;

interface CachedConfig {
  config: EmbedConfig;
  expiresAt: number;
}

/**
 * Built configs are cached per site for 30 seconds. Only sites with a live-visitor
 * widget scoped to the current page need one entry per path; `pageScoped`
 * remembers which sites those are.
 */
const globalForConfig = globalThis as unknown as {
  __trustzenEmbedCache?: Map<string, CachedConfig>;
  __trustzenEmbedScope?: Map<number, { pageScoped: boolean; expiresAt: number }>;
};
const configCache = (globalForConfig.__trustzenEmbedCache ??= new Map());
const scopeCache = (globalForConfig.__trustzenEmbedScope ??= new Map());

function prune(map: Map<unknown, { expiresAt: number }>, nowMs: number) {
  if (map.size < MAX_ENTRIES) return;
  for (const [k, v] of map) if (v.expiresAt <= nowMs) map.delete(k);
  if (map.size >= MAX_ENTRIES) map.clear();
}

function isPageScoped(config: EmbedConfig): boolean {
  return config.widgets.some((w) => w.type === "live_visitors" && (w.content as { scope?: string }).scope === "page");
}

export async function OPTIONS(request: Request, { params }: Params) {
  return preflight(request, (await params).key);
}

/** GET /api/w/{key}/config?p=/current/path → EmbedConfig */
export async function GET(request: Request, { params }: Params) {
  const { key } = await params;
  const ip = await clientIp();
  if (!rateLimit(`wcfg:${ip}`, 120, 60_000)) return jsonResponse({ error: "Too many requests." }, 429, {}, { "Retry-After": "60" });

  const ctx = await resolvePublicSite(request, key);
  if (ctx instanceof Response) return ctx;
  const { site, cors } = ctx;
  const path = normalizePath(new URL(request.url).searchParams.get("p"));
  const nowMs = Date.now();

  const scope = scopeCache.get(site.id);
  const scopeFresh = scope && scope.expiresAt > nowMs;
  const cacheKey = (pageScoped: boolean) => `${site.id}|${pageScoped ? path : ""}`;

  let config: EmbedConfig | undefined;
  if (scopeFresh) {
    const hit = configCache.get(cacheKey(scope.pageScoped));
    if (hit && hit.expiresAt > nowMs) config = hit.config;
  }

  if (!config) {
    config = (await buildEmbedConfig(site, path)).config;
    const pageScoped = isPageScoped(config);
    prune(configCache, nowMs);
    prune(scopeCache, nowMs);
    configCache.set(cacheKey(pageScoped), { config, expiresAt: nowMs + TTL_MS });
    scopeCache.set(site.id, { pageScoped, expiresAt: nowMs + TTL_MS });
  }

  after(() => markSiteVerified(site).catch(() => undefined));
  return jsonResponse(config, 200, cors, { "Cache-Control": "private, max-age=30" });
}
