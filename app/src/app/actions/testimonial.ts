"use server";

import { z } from "zod";
import { saveUpload } from "@/lib/admin";
import { getDb, now } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { notifyOwner } from "@/lib/notify";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { baseUrl } from "@/lib/request";
import { getSiteByKey, parseSiteSettings } from "@/lib/sites";

export interface TestimonialValues {
  name: string;
  email: string;
  title: string;
  rating: number;
  body: string;
}

export interface TestimonialFormState {
  error?: string;
  /** What the visitor typed, so the form can be shown again after an error. */
  values?: TestimonialValues;
  /** Set after a successful submission. */
  status?: "approved" | "pending";
}

const MAX_PHOTO_BYTES = 1024 * 1024;
const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];

const cleanText = (v: string) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F<>]/g, " ");
const cleanLine = (v: string) => cleanText(v).replace(/\s+/g, " ").trim();

/** Check the file signature so the stored type matches the content. */
function sniffImage(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

const field = (formData: FormData, name: string, max: number) => {
  const v = formData.get(name);
  return typeof v === "string" ? v.slice(0, max) : "";
};

/**
 * Public testimonial form (/t/{key}). The site key comes from a hidden input:
 * never bind arguments to this action.
 */
export async function submitTestimonial(_prev: TestimonialFormState, formData: FormData): Promise<TestimonialFormState> {
  const t = await getT();
  const values: TestimonialValues = {
    name: field(formData, "name", 200),
    email: field(formData, "email", 254),
    title: field(formData, "title", 200),
    rating: Math.min(5, Math.max(1, Math.round(Number(formData.get("rating")) || 5))),
    body: field(formData, "body", 2000).replace(/\r\n?/g, "\n"),
  };
  const fail = (error: string): TestimonialFormState => ({ error, values });

  const key = formData.get("key");
  const site = typeof key === "string" ? await getSiteByKey(key) : undefined;
  if (!site) return fail(t("collect.unavailable"));

  // Honeypot: bots fill every field. Answer like a normal submission.
  if (formData.get("website")) return { status: "pending" };

  const parsed = z
    .object({
      name: z.string().transform(cleanLine).pipe(z.string().min(2, t("collect.err.name")).max(120, t("collect.err.name"))),
      email: z
        .string()
        .trim()
        .toLowerCase()
        .pipe(z.union([z.literal(""), z.email(t("collect.err.email")).max(190, t("collect.err.email"))])),
      title: z.string().transform(cleanLine).pipe(z.string().max(160, t("collect.err.title"))),
      rating: z.coerce.number({ error: t("collect.err.rating") }).int(t("collect.err.rating")).min(1, t("collect.err.rating")).max(5, t("collect.err.rating")),
      body: z
        .string()
        .transform((v) => cleanText(v).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim())
        .pipe(z.string().min(20, t("collect.err.text")).max(1000, t("collect.err.text"))),
    })
    .safeParse({
      name: values.name,
      email: values.email,
      title: values.title,
      rating: formData.get("rating") ?? "5",
      body: values.body,
    });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const photo = formData.get("photo");
  let file: File | null = null;
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES) return fail(t("collect.err.photoSize"));
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const type = sniffImage(bytes);
    if (!type || !PHOTO_TYPES.includes(type)) return fail(t("collect.err.photoType"));
    file = new File([bytes], `photo.${type.split("/")[1]}`, { type });
  }

  const db = await getDb();
  const owner = await db.selectFrom("users").select("status").where("id", "=", site.user_id).executeTakeFirst();
  if (owner?.status !== "active") return fail(t("collect.unavailable"));

  const ip = await clientIp();
  if (!rateLimit(`tcollect:${ip}:${site.id}`, 3, 3_600_000)) return fail(t("collect.err.tooMany"));

  try {
    // Stored as an absolute URL: widgets show the photo on the customer's own website.
    // A photo that can't be stored (e.g. read-only disk on serverless hosting) must not lose the testimonial.
    let avatar: string | null = null;
    if (file) {
      try {
        avatar = `${await baseUrl()}/uploads/${await saveUpload(file, "testimonial")}`;
      } catch {
        avatar = null;
      }
    }
    const status = parseSiteSettings(site.settings).autoApproveTestimonials ? "approved" : "pending";
    const { name, email, title, rating, body } = parsed.data;
    const result = await db
      .insertInto("testimonials")
      .values({
        site_id: site.id,
        name,
        email: email || null,
        title: title || null,
        avatar,
        rating,
        body,
        status,
        source: "form",
        created_at: now(),
      })
      .executeTakeFirstOrThrow();
    notifyOwner(site, { type: "testimonial", data: { id: Number(result.insertId), name, email, title, rating, body, avatar, status } });
    return { status };
  } catch {
    return fail(t("collect.err.generic"));
  }
}
