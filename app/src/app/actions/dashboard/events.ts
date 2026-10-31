"use server";

import { guardDashboard } from "@/lib/dashboard";
import { parseCsv } from "@/lib/dashboard-csv";
import { getDb } from "@/lib/db";
import { insertEvent } from "@/lib/events";
import { getT } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import { getOwnedSite } from "@/lib/sites";
import { EVENT_KINDS } from "@/widget/types";
import type { FormState } from "../types";

const MAX_IMPORT_BYTES = 1024 * 1024;
const MAX_IMPORT_ROWS = 2000;
const COLUMNS = ["kind", "name", "city", "country", "product", "url", "image", "rating", "message", "created_at"] as const;

const idOf = (v: FormDataEntryValue | null) => Number(typeof v === "string" ? v : NaN);
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const isHttpUrl = (v: string) => /^https?:\/\/[^\s"'<>]+$/i.test(v);

/** An event that belongs to one of the user's sites. */
async function getOwnedEvent(eventId: number, userId: number) {
  if (!Number.isInteger(eventId) || eventId < 1) return undefined;
  const db = await getDb();
  return db
    .selectFrom("events")
    .innerJoin("sites", "sites.id", "events.site_id")
    .select(["events.id", "events.site_id", "events.is_hidden"])
    .where("events.id", "=", eventId)
    .where("sites.user_id", "=", userId)
    .executeTakeFirst();
}

/** "2026-10-16T10:00" typed in the browser + its timezone offset → ISO string. */
function localToIso(value: string, offsetMinutes: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) + (Number.isFinite(offsetMinutes) ? offsetMinutes : 0) * 60_000;
  return Number.isNaN(utc) ? null : new Date(utc).toISOString();
}

export async function addEventAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const site = await getOwnedSite(idOf(formData.get("site_id")), guard.user.id);
  if (!site) return { error: t("dash.err.siteNotFound") };

  const kind = str(formData.get("kind"));
  if (!(EVENT_KINDS as readonly string[]).includes(kind)) return { error: t("dash.err.eventKind") };
  const name = str(formData.get("name"));
  const product = str(formData.get("product"));
  if (!name && !product) return { error: t("dash.err.eventEmpty") };
  const url = str(formData.get("url"));
  const image = str(formData.get("image"));
  if (url && !isHttpUrl(url) && !url.startsWith("/")) return { error: t("dash.err.url") };
  if (image && !isHttpUrl(image)) return { error: t("dash.err.imageUrl") };
  const rating = str(formData.get("rating"));
  if (rating && !/^[1-5]$/.test(rating)) return { error: t("dash.err.rating") };
  let createdAt: string | undefined;
  const when = str(formData.get("created_at"));
  if (when) {
    createdAt = localToIso(when, Number(str(formData.get("tz_offset")))) ?? undefined;
    if (!createdAt) return { error: t("dash.err.date") };
  }

  await insertEvent(site.id, {
    source: "manual",
    kind,
    name,
    city: str(formData.get("city")),
    country: str(formData.get("country")),
    product,
    url,
    image,
    rating: rating || undefined,
    message: str(formData.get("message")),
    createdAt,
  });
  return { success: t("dash.events.added") };
}

export async function importEventsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const site = await getOwnedSite(idOf(formData.get("site_id")), guard.user.id);
  if (!site) return { error: t("dash.err.siteNotFound") };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: t("dash.import.err.noFile") };
  if (file.size > MAX_IMPORT_BYTES) return { error: t("dash.import.err.tooLarge") };
  if (!/\.(csv|txt)$/i.test(file.name) && !/csv|text\/plain|excel/i.test(file.type)) return { error: t("dash.import.err.type") };
  if (!rateLimit(`events-import:${guard.user.id}`, 20, 60 * 60_000)) return { error: t("dash.import.err.tooMany") };

  const rows = parseCsv(await file.text()).filter((r) => r.some((cell) => cell.trim() !== ""));
  if (rows.length < 2) return { error: t("dash.import.err.empty") };
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const index = new Map<string, number>();
  for (const col of COLUMNS) {
    const i = header.indexOf(col);
    if (i >= 0) index.set(col, i);
  }
  if (!index.has("name") && !index.has("product")) return { error: t("dash.import.err.header") };
  const data = rows.slice(1);
  if (data.length > MAX_IMPORT_ROWS) return { error: t("dash.import.err.tooManyRows", { max: MAX_IMPORT_ROWS.toLocaleString("en") }) };

  let imported = 0;
  let skipped = 0;
  for (const row of data) {
    const get = (col: (typeof COLUMNS)[number]) => {
      const i = index.get(col);
      return i === undefined ? "" : (row[i] ?? "").trim();
    };
    const kind = get("kind").toLowerCase() || "purchase";
    const rating = get("rating");
    const createdAt = get("created_at");
    if (
      !(EVENT_KINDS as readonly string[]).includes(kind) ||
      (!get("name") && !get("product")) ||
      (rating && !/^[1-5](\.0)?$/.test(rating)) ||
      (createdAt && Number.isNaN(Date.parse(createdAt)))
    ) {
      skipped++;
      continue;
    }
    try {
      await insertEvent(site.id, {
        source: "import",
        kind,
        name: get("name"),
        city: get("city"),
        country: get("country"),
        product: get("product"),
        url: get("url"),
        image: get("image"),
        rating: rating || undefined,
        message: get("message"),
        createdAt: createdAt || undefined,
      });
      imported++;
    } catch {
      skipped++;
    }
  }
  if (!imported) return { error: t("dash.import.err.none", { skipped }) };
  return { success: t("dash.import.done", { imported, skipped }) };
}

export async function setEventHiddenAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const event = await getOwnedEvent(idOf(formData.get("event_id")), guard.user.id);
  if (!event) return { error: t("dash.err.eventNotFound") };
  const hidden = formData.get("hidden") === "1";
  const db = await getDb();
  await db.updateTable("events").set({ is_hidden: hidden ? 1 : 0 }).where("id", "=", event.id).execute();
  return { success: hidden ? t("dash.events.hidden") : t("dash.events.shown") };
}

export async function deleteEventAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const event = await getOwnedEvent(idOf(formData.get("event_id")), guard.user.id);
  if (!event) return { error: t("dash.err.eventNotFound") };
  const db = await getDb();
  await db.deleteFrom("events").where("id", "=", event.id).execute();
  return { success: t("dash.events.deleted") };
}
