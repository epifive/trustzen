import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { DailyChart } from "@/components/dashboard/daily-chart";
import { DashHeader, DTable, DTd, DTh, Empty, LinkTabs, Panel, Stat } from "@/components/dashboard/ui";
import { WIDGET_TYPE_ICONS, widgetTypeLabel } from "@/components/dashboard/widget-types";
import { formatNumber, loadSitePage, percent } from "@/lib/dashboard-site";
import { getT } from "@/lib/i18n/server";
import { getDailyStats, getSiteWidgets, getWidgetTotals } from "@/lib/widgets";

const RANGES = [7, 30, 90] as const;

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ days?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("dash.nav.analytics") };
}

export default async function AnalyticsPage({ params, searchParams }: Props) {
  const [{ id }, query, t] = await Promise.all([params, searchParams, getT()]);
  const { site, locale } = await loadSitePage(id);
  const days = (RANGES as readonly number[]).includes(Number(query.days)) ? Number(query.days) : 30;
  const widgets = await getSiteWidgets(site.id);
  const ids = widgets.map((w) => w.id);
  const [daily, totals] = await Promise.all([getDailyStats(ids, days), getWidgetTotals(ids, days)]);

  const sum = { impressions: 0, hovers: 0, clicks: 0, conversions: 0 };
  for (const s of totals.values()) {
    sum.impressions += s.impressions;
    sum.hovers += s.hovers;
    sum.clicks += s.clicks;
    sum.conversions += s.conversions;
  }
  const num = (n: number) => formatNumber(n, locale);
  const base = `/dashboard/sites/${site.id}/analytics`;
  const rows = widgets
    .map((w) => ({ w, s: totals.get(w.id) ?? { impressions: 0, hovers: 0, clicks: 0, conversions: 0 } }))
    .sort((a, b) => b.s.impressions - a.s.impressions);

  return (
    <>
      <DashHeader
        title={t("dash.nav.analytics")}
        description={t("dash.analytics.subtitle")}
        actions={
          <LinkTabs
            label={t("dash.analytics.range")}
            items={RANGES.map((r) => ({ href: r === 30 ? base : `${base}?days=${r}`, label: t("dash.analytics.days", { days: r }), active: days === r }))}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label={t("dash.stat.views")} value={num(sum.impressions)} />
        <Stat label={t("dash.stat.hovers")} value={num(sum.hovers)} />
        <Stat label={t("dash.stat.clicks")} value={num(sum.clicks)} />
        <Stat label={t("dash.stat.conversions")} value={num(sum.conversions)} />
        <Stat label={t("dash.stat.ctr")} value={percent(sum.clicks, sum.impressions, locale)} />
        <Stat label={t("dash.stat.convRate")} value={percent(sum.conversions, sum.impressions, locale)} />
      </div>

      <Panel title={t("dash.analytics.daily")} description={t("dash.analytics.dailyText", { days })} className="mt-6">
        {sum.impressions > 0 ? (
          <>
            <DailyChart data={daily} locale={locale} labels={{ views: t("dash.stat.views"), clicks: t("dash.stat.clicks"), chart: t("dash.analytics.daily") }} />
            <details className="mt-5 text-sm">
              <summary className="cursor-pointer text-muted hover:text-ink">{t("dash.analytics.showTable")}</summary>
              <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-line">
                <DTable minWidth={420}>
                  <thead>
                    <tr>
                      <DTh>{t("dash.analytics.day")}</DTh>
                      <DTh className="text-end">{t("dash.stat.views")}</DTh>
                      <DTh className="text-end">{t("dash.stat.hovers")}</DTh>
                      <DTh className="text-end">{t("dash.stat.clicks")}</DTh>
                      <DTh className="text-end">{t("dash.stat.conversions")}</DTh>
                    </tr>
                  </thead>
                  <tbody>
                    {[...daily].reverse().map((d) => (
                      <tr key={d.day}>
                        <DTd className="py-2 font-mono text-xs">{d.day}</DTd>
                        <DTd className="py-2 text-end tabular-nums">{num(d.impressions)}</DTd>
                        <DTd className="py-2 text-end tabular-nums">{num(d.hovers)}</DTd>
                        <DTd className="py-2 text-end tabular-nums">{num(d.clicks)}</DTd>
                        <DTd className="py-2 text-end tabular-nums">{num(d.conversions)}</DTd>
                      </tr>
                    ))}
                  </tbody>
                </DTable>
              </div>
            </details>
          </>
        ) : (
          <Empty icon={<BarChart3 />} title={t("dash.analytics.emptyTitle")}>
            {widgets.length ? t("dash.analytics.emptyText") : t("dash.analytics.noWidgets")}
          </Empty>
        )}
      </Panel>

      <Panel title={t("dash.analytics.perWidget")} padded={false} className="mt-6">
        {rows.length ? (
          <DTable minWidth={760} label={t("dash.analytics.perWidget")}>
            <thead>
              <tr>
                <DTh>{t("dash.widgets.name")}</DTh>
                <DTh className="text-end">{t("dash.stat.views")}</DTh>
                <DTh className="text-end">{t("dash.stat.hovers")}</DTh>
                <DTh className="text-end">{t("dash.stat.clicks")}</DTh>
                <DTh className="text-end">{t("dash.stat.conversions")}</DTh>
                <DTh className="text-end">{t("dash.stat.ctr")}</DTh>
                <DTh className="text-end">{t("dash.stat.convRate")}</DTh>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ w, s }) => {
                const Icon = WIDGET_TYPE_ICONS[w.type];
                return (
                  <tr key={w.id}>
                    <DTd>
                      <div className="flex items-center gap-2.5">
                        <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                        <div className="min-w-0">
                          <Link href={`/dashboard/widgets/${w.id}`} className="block max-w-[14rem] truncate font-medium hover:text-primary">
                            {w.name}
                          </Link>
                          <span className="text-xs text-muted">{t(widgetTypeLabel(w.type))}</span>
                        </div>
                      </div>
                    </DTd>
                    <DTd className="text-end tabular-nums">{num(s.impressions)}</DTd>
                    <DTd className="text-end tabular-nums">{num(s.hovers)}</DTd>
                    <DTd className="text-end tabular-nums">{num(s.clicks)}</DTd>
                    <DTd className="text-end tabular-nums">{num(s.conversions)}</DTd>
                    <DTd className="text-end text-muted tabular-nums">{percent(s.clicks, s.impressions, locale)}</DTd>
                    <DTd className="text-end text-muted tabular-nums">{percent(s.conversions, s.impressions, locale)}</DTd>
                  </tr>
                );
              })}
            </tbody>
          </DTable>
        ) : (
          <Empty title={t("dash.analytics.noWidgets")} />
        )}
      </Panel>
      <p className="mt-4 text-xs text-muted">{t("dash.analytics.note")}</p>
    </>
  );
}
