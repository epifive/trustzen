import type { Metadata } from "next";
import Link from "next/link";
import { Crown, Plus } from "lucide-react";
import { DashHeader, Panel } from "@/components/dashboard/ui";
import { WidgetList } from "@/components/dashboard/widget-list";
import { WIDGET_TYPE_ICONS, widgetTypeDescription, widgetTypeLabel } from "@/components/dashboard/widget-types";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { formatNumber, loadSitePage } from "@/lib/dashboard-site";
import { getT } from "@/lib/i18n/server";
import { atLimit } from "@/lib/plans";
import { countUserWidgets, getSiteWidgets, getWidgetTotals } from "@/lib/widgets";
import { WIDGET_TYPES } from "@/widget/types";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("dash.nav.widgets") };
}

export default async function SiteWidgetsPage({ params }: Props) {
  const [{ id }, t] = await Promise.all([params, getT()]);
  const { user, site, entitlements, locale } = await loadSitePage(id);
  const [widgets, widgetCount] = await Promise.all([getSiteWidgets(site.id), countUserWidgets(user.id)]);
  const totals = await getWidgetTotals(
    widgets.map((w) => w.id),
    30,
  );
  const canAdd = !atLimit(widgetCount, entitlements.maxWidgets);
  const base = `/dashboard/sites/${site.id}`;

  return (
    <>
      <DashHeader
        title={t("dash.nav.widgets")}
        description={t("dash.widgets.pageSubtitle", { site: site.name })}
        actions={
          canAdd ? (
            <ButtonLink href={`${base}/widgets/new`}>
              <Plus aria-hidden />
              {t("dash.widgets.add")}
            </ButtonLink>
          ) : null
        }
      />

      {!canAdd ? (
        <Alert tone="warning" className="mb-6" title={t("dash.widgets.limitReached", { limit: formatNumber(entitlements.maxWidgets, locale) })}>
          <ButtonLink href="/pricing" size="sm" className="mt-2">
            <Crown aria-hidden />
            {t("dash.usage.upgradeCta")}
          </ButtonLink>
        </Alert>
      ) : null}

      <div className="space-y-8">
        <Panel padded={false} title={t("dash.widgets.yours")} description={t("dash.widgets.subtitle")}>
          <WidgetList siteId={site.id} widgets={widgets} totals={totals} t={t} locale={locale} canAdd={canAdd} />
        </Panel>

        <section aria-labelledby="widget-library">
          <h2 id="widget-library" className="font-sans text-base font-semibold tracking-normal">
            {t("dash.widgets.library")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("dash.widgets.libraryText")}</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {WIDGET_TYPES.map((type) => {
              const Icon = WIDGET_TYPE_ICONS[type];
              const body = (
                <>
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{t(widgetTypeLabel(type))}</span>
                    <span className="mt-0.5 block text-sm text-muted">{t(widgetTypeDescription(type))}</span>
                  </span>
                </>
              );
              return (
                <li key={type}>
                  {canAdd ? (
                    <Link
                      href={`${base}/widgets/new?type=${type}`}
                      className="flex h-full gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-primary-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex h-full gap-3 rounded-xl border border-line bg-surface p-4 opacity-60">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}
