import "server-only";
import { getDb, now } from "./db";
import type { EventsTable, ProofEvent } from "./db/schema";
import { safeUrl } from "@/widget/normalize";
import { EVENT_KINDS, type Anonymize, type EmbedEvent, type EventKind } from "@/widget/types";

export interface EventInput {
  source: EventsTable["source"];
  kind?: string;
  name?: unknown;
  city?: unknown;
  country?: unknown;
  product?: unknown;
  url?: unknown;
  image?: unknown;
  rating?: unknown;
  message?: unknown;
  /** ISO date; defaults to now. Future dates are clamped to now. */
  createdAt?: unknown;
}

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const s = String(v)
    .replace(/[\u0000-\u001F\u007F<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return s || null;
};

/** Validate and store one social-proof event. Returns the new id. */
export async function insertEvent(siteId: number, input: EventInput): Promise<number> {
  const kind: EventKind = (EVENT_KINDS as readonly string[]).includes(input.kind ?? "") ? (input.kind as EventKind) : "purchase";
  const rating = Number(input.rating);
  let createdAt = now();
  if (typeof input.createdAt === "string" && !Number.isNaN(Date.parse(input.createdAt))) {
    createdAt = new Date(Math.min(Date.parse(input.createdAt), Date.now())).toISOString();
  }
  const url = safeUrl(input.url);
  const image = safeUrl(input.image);
  const db = await getDb();
  const result = await db
    .insertInto("events")
    .values({
      site_id: siteId,
      source: input.source,
      kind,
      name: clean(input.name, 120),
      city: clean(input.city, 120),
      country: clean(input.country, 120),
      product: clean(input.product, 255),
      url: url || null,
      image: /^https?:\/\//.test(image) ? image : null,
      rating: Number.isFinite(rating) && rating >= 1 && rating <= 5 ? Math.round(rating) : null,
      message: clean(input.message, 500),
      is_hidden: 0,
      created_at: createdAt,
    })
    .executeTakeFirstOrThrow();
  return Number(result.insertId);
}

/** Apply a site's privacy setting to a person's name before it is shown publicly. */
export function anonymizeName(name: string | null, mode: Anonymize): string {
  const value = (name ?? "").trim();
  if (!value || mode === "none") return value;
  const parts = value.split(/\s+/);
  if (mode === "first_name") return parts[0];
  return parts.map((p) => `${p[0].toUpperCase()}.`).join(" ");
}

export function toEmbedEvent(e: ProofEvent, anonymize: Anonymize): EmbedEvent {
  return {
    kind: e.kind,
    name: anonymizeName(e.name, anonymize),
    city: e.city ?? "",
    country: e.country ?? "",
    product: e.product ?? "",
    url: e.url ?? "",
    image: e.image ?? "",
    rating: e.rating ?? 0,
    message: e.message ?? "",
    ago: Math.max(0, Math.round((Date.now() - Date.parse(e.created_at)) / 1000)),
  };
}

export async function countEvents(siteId: number, kinds: EventKind[], sinceIso: string): Promise<number> {
  if (!kinds.length) return 0;
  const db = await getDb();
  const row = await db
    .selectFrom("events")
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .where("site_id", "=", siteId)
    .where("is_hidden", "=", 0)
    .where("kind", "in", kinds)
    .where("created_at", ">=", sinceIso)
    .executeTakeFirst();
  return Number(row?.n ?? 0);
}

export async function recentEvents(siteId: number, kinds: EventKind[], options: { sinceIso?: string; limit: number; minRating?: number }): Promise<ProofEvent[]> {
  if (!kinds.length) return [];
  const db = await getDb();
  return db
    .selectFrom("events")
    .selectAll()
    .where("site_id", "=", siteId)
    .where("is_hidden", "=", 0)
    .where("kind", "in", kinds)
    .$if(Boolean(options.sinceIso), (qb) => qb.where("created_at", ">=", options.sinceIso!))
    .$if(Boolean(options.minRating), (qb) => qb.where("rating", ">=", options.minRating!))
    .orderBy("created_at", "desc")
    .limit(options.limit)
    .execute();
}
