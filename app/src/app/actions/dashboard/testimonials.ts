"use server";

import { z } from "zod";
import { guardDashboard } from "@/lib/dashboard";
import { getDb, now } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { getOwnedSite } from "@/lib/sites";
import type { FormState } from "../types";

const idOf = (v: FormDataEntryValue | null) => Number(typeof v === "string" ? v : NaN);
const STATUSES = ["pending", "approved", "rejected"] as const;
/** Strip control characters and angle brackets from single-line text. */
const line = (v: string) => v.replace(/[\u0000-\u001F\u007F<>]/g, " ").replace(/\s+/g, " ").trim();

async function getOwnedTestimonial(id: number, userId: number) {
  if (!Number.isInteger(id) || id < 1) return undefined;
  const db = await getDb();
  return db
    .selectFrom("testimonials")
    .innerJoin("sites", "sites.id", "testimonials.site_id")
    .select(["testimonials.id", "testimonials.status"])
    .where("testimonials.id", "=", id)
    .where("sites.user_id", "=", userId)
    .executeTakeFirst();
}

export async function addTestimonialAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const site = await getOwnedSite(idOf(formData.get("site_id")), guard.user.id);
  if (!site) return { error: t("dash.err.siteNotFound") };

  const parsed = z
    .object({
      name: z.string().transform(line).pipe(z.string().min(1, t("dash.err.testimonialName")).max(120, t("dash.err.testimonialName"))),
      email: z.union([z.literal(""), z.email(t("dash.err.email")).max(190)]),
      title: z.string().transform(line).pipe(z.string().max(120)),
      avatar: z.union([z.literal(""), z.string().max(500).regex(/^https:\/\/[^\s"'<>]+$/i, t("dash.err.avatarUrl"))]),
      rating: z.coerce.number().int().min(1, t("dash.err.rating")).max(5, t("dash.err.rating")),
      body: z
        .string()
        .transform((v) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim())
        .pipe(z.string().min(3, t("dash.err.testimonialBody")).max(2000, t("dash.err.testimonialBody"))),
    })
    .safeParse({
      name: formData.get("name") ?? "",
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      title: formData.get("title") ?? "",
      avatar: String(formData.get("avatar") ?? "").trim(),
      rating: formData.get("rating") ?? "5",
      body: formData.get("body") ?? "",
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const db = await getDb();
  await db
    .insertInto("testimonials")
    .values({
      site_id: site.id,
      name: parsed.data.name,
      email: parsed.data.email || null,
      title: parsed.data.title || null,
      avatar: parsed.data.avatar || null,
      rating: parsed.data.rating,
      body: parsed.data.body,
      status: "approved",
      source: "manual",
      created_at: now(),
    })
    .execute();
  return { success: t("dash.testimonials.added") };
}

export async function setTestimonialStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const item = await getOwnedTestimonial(idOf(formData.get("testimonial_id")), guard.user.id);
  if (!item) return { error: t("dash.err.testimonialNotFound") };
  const status = String(formData.get("status") ?? "");
  if (!(STATUSES as readonly string[]).includes(status)) return { error: t("dash.err.status") };
  const db = await getDb();
  await db
    .updateTable("testimonials")
    .set({ status: status as (typeof STATUSES)[number] })
    .where("id", "=", item.id)
    .execute();
  return {
    success: status === "approved" ? t("dash.testimonials.approved") : status === "rejected" ? t("dash.testimonials.rejected") : t("dash.testimonials.pending"),
  };
}

export async function deleteTestimonialAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const item = await getOwnedTestimonial(idOf(formData.get("testimonial_id")), guard.user.id);
  if (!item) return { error: t("dash.err.testimonialNotFound") };
  const db = await getDb();
  await db.deleteFrom("testimonials").where("id", "=", item.id).execute();
  return { success: t("dash.testimonials.deleted") };
}
