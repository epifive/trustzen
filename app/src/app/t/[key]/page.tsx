import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { brandingFor } from "@/lib/embed";
import { getT } from "@/lib/i18n/server";
import { getEntitlements } from "@/lib/plans";
import { getSettings } from "@/lib/settings";
import { getSiteByKey, parseSiteSettings } from "@/lib/sites";
import { CollectForm } from "./collect-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ key: string }> };

async function load(key: string) {
  const site = await getSiteByKey(key);
  if (!site) return null;
  const db = await getDb();
  const owner = await db.selectFrom("users").select(["id", "role", "status", "plan_id", "plan_expires_at"]).where("id", "=", site.user_id).executeTakeFirst();
  if (!owner || owner.status !== "active") return null;
  return { site, owner, siteSettings: parseSiteSettings(site.settings) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load((await params).key);
  return {
    title: data ? `${data.siteSettings.collectTitle} | ${data.site.name}` : "Not found",
    robots: { index: false, follow: false },
  };
}

export default async function CollectPage({ params }: Props) {
  const data = await load((await params).key);
  if (!data) notFound();
  const { site, owner, siteSettings } = data;
  const [settings, entitlements, t] = await Promise.all([getSettings(), getEntitlements(owner), getT()]);
  const branding = brandingFor(settings, entitlements);
  const initial = site.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="mat-grid min-h-dvh px-4 py-10 sm:py-16">
      <main className="mx-auto w-full max-w-xl">
        <header className="mb-8 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary font-display text-2xl font-bold text-white shadow-lg shadow-primary/25">
            {initial}
          </div>
          <p className="mt-4 text-sm font-medium text-muted">
            {site.name}
            <span className="mx-1.5 opacity-50">·</span>
            {site.domain}
          </p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{siteSettings.collectTitle}</h1>
          {siteSettings.collectText ? <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted">{siteSettings.collectText}</p> : null}
        </header>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-xl shadow-black/5 sm:p-8">
          <CollectForm siteKey={site.public_key} consent={t("collect.consent", { site: site.name })} />
        </div>

        {branding ? (
          <p className="mt-6 text-center text-xs text-muted">
            <a href={branding.url} target="_blank" rel="noopener" className="hover:text-primary">
              {branding.text}
            </a>
          </p>
        ) : null}
      </main>
    </div>
  );
}
