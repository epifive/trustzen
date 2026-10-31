import type { Metadata } from "next";
import { Crown } from "lucide-react";
import { NewSiteForm } from "@/components/dashboard/site-forms";
import { DashHeader, Panel } from "@/components/dashboard/ui";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { requireDashboardUser } from "@/lib/dashboard";
import { getT } from "@/lib/i18n/server";
import { atLimit, getEntitlements } from "@/lib/plans";
import { countUserSites } from "@/lib/sites";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("dash.newSite.title") };
}

export default async function NewSitePage() {
  const user = await requireDashboardUser();
  const [t, entitlements, count] = await Promise.all([getT(), getEntitlements(user), countUserSites(user.id)]);
  const blocked = atLimit(count, entitlements.maxSites);

  return (
    <div className="mx-auto max-w-2xl">
      <DashHeader title={t("dash.newSite.title")} description={t("dash.newSite.subtitle")} />
      {blocked ? (
        <Alert tone="warning" title={t("dash.newSite.limitTitle")}>
          <p>{t("dash.err.siteLimit", { limit: entitlements.maxSites })}</p>
          <ButtonLink href="/pricing" size="sm" className="mt-3">
            <Crown aria-hidden />
            {t("dash.usage.upgradeCta")}
          </ButtonLink>
        </Alert>
      ) : (
        <Panel>
          <NewSiteForm />
        </Panel>
      )}
      <p className="mt-4 text-sm text-muted">{t("dash.newSite.note")}</p>
    </div>
  );
}
