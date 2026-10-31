import type { Metadata } from "next";
import { RefreshCw } from "lucide-react";
import { regenerateWebhookTokenAction } from "@/app/actions/dashboard/sites";
import { ActionButton } from "@/components/dashboard/actions";
import { CopyField } from "@/components/dashboard/copy";
import { DeleteSiteForm, SiteSettingsForm } from "@/components/dashboard/site-forms";
import { DashHeader, Panel } from "@/components/dashboard/ui";
import { loadSitePage } from "@/lib/dashboard-site";
import { getActiveLanguages, getT } from "@/lib/i18n/server";
import { absoluteUrl } from "@/lib/site";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("dash.nav.settings") };
}

export default async function SiteSettingsPage({ params }: Props) {
  const [{ id }, t, languages] = await Promise.all([params, getT(), getActiveLanguages()]);
  const { site, siteSettings, entitlements, settings } = await loadSitePage(id);
  const platformLanguage = languages.find((l) => l.code === settings.default_language)?.native_name ?? settings.default_language;

  return (
    <>
      <DashHeader title={t("dash.nav.settings")} description={t("dash.settings.subtitle", { site: site.name })} />
      <div className="space-y-6">
        <Panel>
          <SiteSettingsForm
            site={{ id: site.id, name: site.name, domain: site.domain, ...siteSettings }}
            languages={languages.map((l) => ({ code: l.code, name: l.native_name, dir: l.direction }))}
            isPremium={entitlements.isPremium}
            defaultLanguage={platformLanguage}
          />
        </Panel>

        <Panel title={t("dash.settings.keysTitle")} description={t("dash.settings.keysText")}>
          <div className="space-y-5">
            <div>
              <p className="mb-1.5 text-sm font-medium">{t("dash.settings.publicKey")}</p>
              <CopyField value={site.public_key} label={t("dash.settings.publicKey")} />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium">{t("dash.int.yourUrl")}</p>
              <CopyField value={absoluteUrl(settings, `/api/hooks/${site.webhook_token}`)} label={t("dash.int.yourUrl")} />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted">{t("dash.int.secret")}</p>
                <ActionButton action={regenerateWebhookTokenAction} fields={{ site_id: site.id }} confirmText={t("dash.webhook.regenerateConfirm")}>
                  <RefreshCw aria-hidden />
                  {t("dash.webhook.regenerate")}
                </ActionButton>
              </div>
            </div>
          </div>
        </Panel>

        <section className="rounded-xl border border-red-300 bg-surface dark:border-red-900" aria-labelledby="danger-zone">
          <header className="border-b border-red-200 px-5 py-3.5 dark:border-red-900/60">
            <h2 id="danger-zone" className="font-sans text-sm font-semibold tracking-normal text-red-700 dark:text-red-400">
              {t("dash.delete.title")}
            </h2>
            <p className="mt-0.5 text-xs text-muted">{t("dash.delete.text")}</p>
          </header>
          <div className="p-5">
            <DeleteSiteForm siteId={site.id} domain={site.domain} />
          </div>
        </section>
      </div>
    </>
  );
}
