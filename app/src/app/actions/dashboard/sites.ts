"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { guardDashboard } from "@/lib/dashboard";
import { getDb } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { parsePublicUrl } from "@/lib/net/ssrf";
import { atLimit } from "@/lib/plans";
import {
  countUserSites,
  createSite,
  deleteSite,
  getOwnedSite,
  normalizeDomain,
  parseSiteSettings,
  regenerateWebhookToken,
  updateSite,
  type SiteSettings,
} from "@/lib/sites";
import { getOwnedWidget, updateWidget } from "@/lib/widgets";
import { EVENT_KINDS } from "@/widget/types";
import type { FormState } from "../types";

const idOf = (v: FormDataEntryValue | null) => Number(typeof v === "string" ? v : NaN);
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

async function domainTaken(userId: number, domain: string, exceptSiteId?: number): Promise<boolean> {
  const db = await getDb();
  const row = await db
    .selectFrom("sites")
    .select("id")
    .where("user_id", "=", userId)
    .where("domain", "=", domain)
    .$if(Boolean(exceptSiteId), (qb) => qb.where("id", "!=", exceptSiteId!))
    .executeTakeFirst();
  return Boolean(row);
}

export async function createSiteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const parsed = z
    .object({
      name: z.string().trim().min(1, t("dash.err.siteName")).max(120, t("dash.err.siteName")),
      domain: z.string().trim().min(1, t("dash.err.domain")).max(255, t("dash.err.domain")),
    })
    .safeParse({ name: formData.get("name"), domain: formData.get("domain") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const domain = normalizeDomain(parsed.data.domain);
  if (!domain) return { error: t("dash.err.domain") };

  const { user, entitlements } = guard;
  if (atLimit(await countUserSites(user.id), entitlements.maxSites)) {
    return { error: t("dash.err.siteLimit", { limit: entitlements.maxSites }) };
  }
  if (await domainTaken(user.id, domain)) return { error: t("dash.err.domainExists", { domain }) };

  const site = await createSite(user.id, parsed.data.name, domain);
  redirect(`/dashboard/sites/${site.id}?welcome=1`);
}

export async function updateSiteSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const site = await getOwnedSite(idOf(formData.get("site_id")), guard.user.id);
  if (!site) return { error: t("dash.err.siteNotFound") };
  const current = parseSiteSettings(site.settings);

  const name = str(formData.get("name")).trim();
  if (!name || name.length > 120) return { error: t("dash.err.siteName") };
  const domain = normalizeDomain(str(formData.get("domain")));
  if (!domain) return { error: t("dash.err.domain") };
  if (domain !== site.domain && (await domainTaken(guard.user.id, domain, site.id))) {
    return { error: t("dash.err.domainExists", { domain }) };
  }

  const extraDomains: string[] = [];
  for (const line of str(formData.get("extra_domains")).split(/[\r\n,]+/)) {
    if (!line.trim()) continue;
    const d = normalizeDomain(line);
    if (!d) return { error: t("dash.err.extraDomain", { domain: line.trim().slice(0, 80) }) };
    if (d !== domain && !extraDomains.includes(d)) extraDomains.push(d);
  }
  if (extraDomains.length > 20) return { error: t("dash.err.extraDomainsMax") };

  const captureKind = str(formData.get("capture_kind"));
  const anonymize = str(formData.get("anonymize"));
  const language = str(formData.get("language")).trim();
  if (language && !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(language)) return { error: t("dash.err.language") };

  let webhookUrl = str(formData.get("webhook_url")).trim();
  if (webhookUrl) {
    try {
      webhookUrl = parsePublicUrl(webhookUrl).toString();
    } catch {
      return { error: t("dash.err.webhookUrl") };
    }
    if (webhookUrl.length > 500) return { error: t("dash.err.webhookUrl") };
    if (!guard.entitlements.isPremium && webhookUrl !== current.webhookUrl) return { error: t("dash.err.webhookPlan") };
  }

  const collectTitle = str(formData.get("collect_title")).trim();
  const collectText = str(formData.get("collect_text")).trim();
  if (collectTitle.length > 120) return { error: t("dash.err.collectTitle") };
  if (collectText.length > 400) return { error: t("dash.err.collectText") };

  const next: SiteSettings = {
    ...current,
    captureForms: formData.get("capture_forms") === "on",
    captureKind: (EVENT_KINDS as readonly string[]).includes(captureKind) ? (captureKind as SiteSettings["captureKind"]) : current.captureKind,
    anonymize: anonymize === "none" || anonymize === "initials" || anonymize === "first_name" ? anonymize : current.anonymize,
    language,
    dir: formData.get("dir") === "rtl" ? "rtl" : "ltr",
    notifyEmail: formData.get("notify_email") === "on",
    webhookUrl,
    extraDomains,
    autoApproveTestimonials: formData.get("auto_approve") === "on",
    collectTitle: collectTitle || current.collectTitle,
    collectText,
  };

  await updateSite(site.id, { name, domain, settings: parseSiteSettings(JSON.stringify(next)) });
  return { success: t("dash.settings.saved") };
}

export async function deleteSiteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const site = await getOwnedSite(idOf(formData.get("site_id")), guard.user.id);
  if (!site) return { error: t("dash.err.siteNotFound") };
  if (str(formData.get("confirm")).trim().toLowerCase() !== site.domain) return { error: t("dash.err.deleteConfirm", { domain: site.domain }) };
  await deleteSite(site.id);
  redirect("/dashboard?deleted=1");
}

export async function regenerateWebhookTokenAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const site = await getOwnedSite(idOf(formData.get("site_id")), guard.user.id);
  if (!site) return { error: t("dash.err.siteNotFound") };
  await regenerateWebhookToken(site.id);
  return { success: t("dash.webhook.regenerated") };
}

export async function toggleWidgetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const widget = await getOwnedWidget(idOf(formData.get("widget_id")), guard.user.id);
  if (!widget) return { error: t("dash.err.widgetNotFound") };
  const active = formData.get("active") === "1";
  await updateWidget(widget, { isActive: active });
  return { success: active ? t("dash.widgets.activated", { name: widget.name }) : t("dash.widgets.deactivated", { name: widget.name }) };
}
