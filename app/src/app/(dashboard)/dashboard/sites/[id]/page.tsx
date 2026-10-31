import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleCheck, Clock, ExternalLink, Inbox, MessageSquareQuote, Plus, Webhook } from "lucide-react";
import { InstallGuide } from "@/components/dashboard/site-forms";
import { DashHeader, Panel, Stat } from "@/components/dashboard/ui";
import { WidgetList } from "@/components/dashboard/widget-list";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { formatDateTime, formatNumber, formatRelative, loadSitePage, percent } from "@/lib/dashboard-site";
import { getT } from "@/lib/i18n/server";
import { atLimit } from "@/lib/plans";
import { absoluteUrl } from "@/lib/site";
import { countUserWidgets, getSiteWidgets, getWidgetTotals } from "@/lib/widgets";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ welcome?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { site } = await loadSitePage((await params).id);
  return { title: site.name };
}

export default async function SiteOverviewPage({ params, searchParams }: Props) {
  const [{ id }, query, t] = await Promise.all([params, searchParams, getT()]);
  const { user, site, entitlements, settings, locale } = await loadSitePage(id);
  const [widgets, widgetCount] = await Promise.all([getSiteWidgets(site.id), countUserWidgets(user.id)]);
  const totals = await getWidgetTotals(
    widgets.map((w) => w.id),
    30,
  );
  const sum = { impressions: 0, clicks: 0, conversions: 0 };
  for (const s of totals.values()) {
    sum.impressions += s.impressions;
    sum.clicks += s.clicks;
    sum.conversions += s.conversions;
  }
  const canAdd = !atLimit(widgetCount, entitlements.maxWidgets);
  const snippet = `<script async src="${absoluteUrl(settings, "/w.js")}" data-site="${site.public_key}"></script>`;
  const num = (n: number) => formatNumber(n, locale);
  const base = `/dashboard/sites/${site.id}`;

  const shortcuts = [
    { href: `${base}/testimonials`, icon: MessageSquareQuote, title: t("dash.shortcut.testimonials"), text: t("dash.shortcut.testimonialsText") },
    { href: `${base}/integrations`, icon: Webhook, title: t("dash.shortcut.integrations"), text: t("dash.shortcut.integrationsText") },
    { href: `${base}/leads`, icon: Inbox, title: t("dash.shortcut.leads"), text: t("dash.shortcut.leadsText") },
  ];

  return (
    <>
      <DashHeader
        title={site.name}
        description={
          <a href={`https://${site.domain}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-primary" dir="ltr">
            {site.domain}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        }
        actions={
          canAdd ? (
            <ButtonLink href={`${base}/widgets/new`}>
              <Plus aria-hidden />
              {t("dash.widgets.add")}
            </ButtonLink>
          ) : (
            <ButtonLink href="/pricing" variant="outline">
              {t("dash.widgets.limitCta")}
            </ButtonLink>
          )
        }
      />

      {query.welcome === "1" ? (
        <Alert tone="success" title={t("dash.welcome.title")} className="mb-6">
          {t("dash.welcome.text")}
        </Alert>
      ) : null}

      <div className="space-y-6">
        <Panel
          title={t("dash.install.title")}
          description={t("dash.install.subtitle")}
          actions={
            site.verified_at ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400" title={formatDateTime(site.verified_at, locale)}>
                <CircleCheck className="size-4" aria-hidden />
                {t("dash.install.lastSeen", { time: formatRelative(site.verified_at, locale) })}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
                <Clock className="size-4" aria-hidden />
                {t("dash.install.waiting")}
              </span>
            )
          }
        >
          <InstallGuide snippet={snippet} />
          {!site.verified_at ? <p className="mt-5 border-t border-line pt-4 text-xs text-muted">{t("dash.install.waitingHint", { domain: site.domain })}</p> : null}
        </Panel>

        <section aria-label={t("dash.overview.last30")}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat label={t("dash.stat.views")} value={num(sum.impressions)} hint={t("dash.overview.last30")} />
            <Stat label={t("dash.stat.clicks")} value={num(sum.clicks)} hint={t("dash.overview.last30")} />
            <Stat label={t("dash.stat.conversions")} value={num(sum.conversions)} hint={t("dash.overview.last30")} />
            <Stat label={t("dash.stat.ctr")} value={percent(sum.clicks, sum.impressions, locale)} hint={t("dash.overview.last30")} />
          </div>
        </section>

        <Panel
          title={t("dash.nav.widgets")}
          description={t("dash.widgets.subtitle")}
          padded={false}
          actions={
            widgets.length ? (
              <Link href={`${base}/analytics`} className="text-sm font-medium text-primary hover:underline">
                {t("dash.widgets.viewAnalytics")}
              </Link>
            ) : null
          }
        >
          <WidgetList siteId={site.id} widgets={widgets} totals={totals} t={t} locale={locale} canAdd={canAdd} />
          {!canAdd ? <p className="border-t border-line px-5 py-3 text-xs text-muted">{t("dash.widgets.limitReached", { limit: entitlements.maxWidgets })}</p> : null}
        </Panel>

        <ul className="grid gap-4 md:grid-cols-3">
          {shortcuts.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="group flex h-full flex-col rounded-xl border border-line bg-surface p-5 transition-colors hover:border-primary-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <s.icon className="size-5 text-primary" aria-hidden />
                <span className="mt-3 font-semibold">{s.title}</span>
                <span className="mt-1 flex-1 text-sm text-muted">{s.text}</span>
                <ArrowRight className="mt-3 size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
