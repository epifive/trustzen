import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Code2, Crown, Globe, LayoutGrid, Plus, Sparkles } from "lucide-react";
import { RefreshOnce } from "@/components/dashboard/actions";
import { DashHeader, Meter, Panel, Stat } from "@/components/dashboard/ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireDashboardUser } from "@/lib/dashboard";
import { formatNumber, formatRelative, percent } from "@/lib/dashboard-site";
import { getDb } from "@/lib/db";
import { getLocale, getT } from "@/lib/i18n/server";
import { atLimit, getEntitlements } from "@/lib/plans";
import { getUserSites } from "@/lib/sites";
import { getMonthlyViews } from "@/lib/usage";
import { getWidgetTotals } from "@/lib/widgets";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("dash.title") };
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const user = await requireDashboardUser();
  const [query, t, locale, entitlements, sites, monthlyViews] = await Promise.all([
    searchParams,
    getT(),
    getLocale(),
    getEntitlements(user),
    getUserSites(user.id),
    getMonthlyViews(user.id),
  ]);
  const lc = locale.code;
  const num = (n: number) => formatNumber(n, lc);
  const deletedNotice = query.deleted === "1" ? (
    <>
      <RefreshOnce cleanUrl="/dashboard" />
      <Alert tone="success" className="mb-6">
        {t("dash.sites.deleted")}
      </Alert>
    </>
  ) : null;

  if (!sites.length) {
    const steps = [
      { icon: Globe, title: t("dash.onboard.step1Title"), text: t("dash.onboard.step1Text") },
      { icon: Code2, title: t("dash.onboard.step2Title"), text: t("dash.onboard.step2Text") },
      { icon: LayoutGrid, title: t("dash.onboard.step3Title"), text: t("dash.onboard.step3Text") },
    ];
    return (
      <>
        {deletedNotice}
        <section className="mat-grid relative overflow-hidden rounded-2xl border border-line px-6 py-12 text-center sm:px-12 sm:py-16">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-white shadow-lg">
            <Sparkles className="size-7" aria-hidden />
          </span>
          <h1 className="mt-6 text-3xl font-bold sm:text-4xl">{t("dash.onboard.title", { name: user.name.split(/\s+/)[0] || user.name })}</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted">{t("dash.onboard.text")}</p>
          <ButtonLink href="/dashboard/sites/new" size="lg" className="mt-8">
            <Plus aria-hidden />
            {t("dash.onboard.cta")}
          </ButtonLink>
        </section>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-primary-soft font-display font-bold text-primary">{i + 1}</span>
                <step.icon className="size-5 text-muted" aria-hidden />
              </div>
              <h2 className="mt-4 font-sans text-base font-semibold tracking-normal">{step.title}</h2>
              <p className="mt-1 text-sm text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </>
    );
  }

  const db = await getDb();
  const widgetRows = await db
    .selectFrom("widgets")
    .select(["id", "site_id", "is_active"])
    .where(
      "site_id",
      "in",
      sites.map((s) => s.id),
    )
    .execute();
  const totals = await getWidgetTotals(
    widgetRows.map((w) => w.id),
    30,
  );
  const sum = { impressions: 0, clicks: 0, conversions: 0 };
  const perSite = new Map<number, { widgets: number; active: number; views: number }>();
  for (const w of widgetRows) {
    const s = totals.get(w.id);
    const entry = perSite.get(w.site_id) ?? { widgets: 0, active: 0, views: 0 };
    entry.widgets += 1;
    entry.active += w.is_active ? 1 : 0;
    entry.views += s?.impressions ?? 0;
    perSite.set(w.site_id, entry);
    sum.impressions += s?.impressions ?? 0;
    sum.clicks += s?.clicks ?? 0;
    sum.conversions += s?.conversions ?? 0;
  }

  const limitText = (n: number) => (n > 0 ? num(n) : t("pricing.unlimited"));
  const atAnyLimit =
    atLimit(sites.length, entitlements.maxSites) || atLimit(widgetRows.length, entitlements.maxWidgets) || atLimit(monthlyViews, entitlements.maxMonthlyViews);

  return (
    <>
      {deletedNotice}
      <DashHeader
        title={t("dash.overview.title")}
        description={t("dash.overview.subtitle")}
        actions={
          <ButtonLink href="/dashboard/sites/new" variant="outline">
            <Plus aria-hidden />
            {t("dash.switcher.add")}
          </ButtonLink>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section aria-label={t("dash.overview.last30")}>
            <h2 className="mb-3 font-sans text-sm font-semibold tracking-normal text-muted">{t("dash.overview.last30")}</h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <Stat label={t("dash.stat.views")} value={num(sum.impressions)} />
              <Stat label={t("dash.stat.clicks")} value={num(sum.clicks)} />
              <Stat label={t("dash.stat.conversions")} value={num(sum.conversions)} />
              <Stat label={t("dash.stat.ctr")} value={percent(sum.clicks, sum.impressions, lc)} />
            </div>
          </section>

          <section aria-labelledby="dash-sites-title">
            <h2 id="dash-sites-title" className="mb-3 font-sans text-sm font-semibold tracking-normal text-muted">
              {t("dash.overview.websites")}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {sites.map((site) => {
                const info = perSite.get(site.id) ?? { widgets: 0, active: 0, views: 0 };
                return (
                  <li key={site.id}>
                    <Link
                      href={`/dashboard/sites/${site.id}`}
                      className="group block h-full rounded-xl border border-line bg-surface p-5 transition-colors hover:border-primary-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{site.name}</p>
                          <p className="truncate text-sm text-muted" dir="ltr">
                            {site.domain}
                          </p>
                        </div>
                        {site.verified_at ? (
                          <Badge tone="success" title={formatRelative(site.verified_at, lc)}>
                            {t("dash.install.installed")}
                          </Badge>
                        ) : (
                          <Badge tone="warning">{t("dash.install.notInstalled")}</Badge>
                        )}
                      </div>
                      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-muted">{t("dash.nav.widgets")}</dt>
                          <dd className="mt-0.5 font-semibold tabular-nums">{t("dash.overview.widgetsActive", { active: num(info.active), total: num(info.widgets) })}</dd>
                        </div>
                        <div>
                          <dt className="text-muted">{t("dash.overview.views30")}</dt>
                          <dd className="mt-0.5 font-semibold tabular-nums">{num(info.views)}</dd>
                        </div>
                      </dl>
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                        {t("dash.overview.manage")}
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <Panel
          title={t("dash.usage.title")}
          description={entitlements.plan?.name ?? (user.role === "admin" ? t("dash.usage.adminPlan") : t("account.free"))}
          className="h-fit"
          actions={entitlements.isPremium ? <Badge tone="success">{t("account.active")}</Badge> : null}
        >
          <div className="space-y-5">
            <Meter label={t("dash.usage.websites")} used={sites.length} limit={entitlements.maxSites} usedText={num(sites.length)} limitText={limitText(entitlements.maxSites)} />
            <Meter
              label={t("dash.usage.widgets")}
              used={widgetRows.length}
              limit={entitlements.maxWidgets}
              usedText={num(widgetRows.length)}
              limitText={limitText(entitlements.maxWidgets)}
            />
            <Meter
              label={t("dash.usage.views")}
              used={monthlyViews}
              limit={entitlements.maxMonthlyViews}
              usedText={num(monthlyViews)}
              limitText={limitText(entitlements.maxMonthlyViews)}
              critical
            />
            <p className="text-xs text-muted">{t("dash.usage.resets")}</p>
          </div>
          {!entitlements.isPremium || atAnyLimit ? (
            <div className="mt-5 rounded-lg bg-primary-soft p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Crown className="size-4 text-amber-500" aria-hidden />
                {atAnyLimit ? t("dash.usage.limitReached") : t("dash.usage.upgradeTitle")}
              </p>
              <p className="mt-1 text-xs text-muted">{t("dash.usage.upgradeText")}</p>
              <ButtonLink href="/pricing" size="sm" className="mt-3 w-full">
                {t("dash.usage.upgradeCta")}
              </ButtonLink>
            </div>
          ) : null}
        </Panel>
      </div>
    </>
  );
}
