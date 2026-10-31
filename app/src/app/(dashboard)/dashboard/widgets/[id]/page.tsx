import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Eye, MousePointerClick, Percent, Target } from "lucide-react";
import { WidgetEditor } from "@/components/dashboard/widget-editor/editor";
import { requireDashboardUser } from "@/lib/dashboard";
import { formatNumber, percent } from "@/lib/dashboard-site";
import { brandingFor, buildWidgetData } from "@/lib/embed";
import { getLocale, getT } from "@/lib/i18n/server";
import { getEntitlements } from "@/lib/plans";
import { getSettings } from "@/lib/settings";
import { getOwnedSite, parseSiteSettings } from "@/lib/sites";
import { getOwnedWidget, getWidgetTotals, type WidgetRecord } from "@/lib/widgets";
import { EVENT_KINDS, type EmbedWidgetData } from "@/widget/types";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [user, t] = await Promise.all([requireDashboardUser(), getT()]);
  const widget = await getOwnedWidget(Number(id), user.id);
  return { title: widget ? t("editor.metaTitle", { name: widget.name }) : t("editor.err.notFound") };
}

export default async function WidgetEditorPage({ params }: Props) {
  const { id } = await params;
  const user = await requireDashboardUser();
  const widget = await getOwnedWidget(Number(id), user.id);
  if (!widget) notFound();
  const site = await getOwnedSite(widget.siteId, user.id);
  if (!site) notFound();

  const siteSettings = parseSiteSettings(site.settings);
  const [settings, entitlements, locale, t, totals] = await Promise.all([
    getSettings(),
    getEntitlements(user),
    getLocale(),
    getT(),
    getWidgetTotals([widget.id], 30),
  ]);

  // Real data for the preview, fetched a little wider than the saved settings so
  // the editor can filter it as the user changes kinds, ratings or limits.
  let data: EmbedWidgetData;
  if (widget.type === "recent_activity") {
    const c = widget.content as WidgetRecord<"recent_activity">["content"];
    data = await buildWidgetData(site, siteSettings, { ...widget, content: { ...c, kinds: [...EVENT_KINDS], limit: 30, maxAgeHours: 0, anonymize: "none" } });
  } else if (widget.type === "review") {
    const c = widget.content as WidgetRecord<"review">["content"];
    const [fromTestimonials, fromEvents] = await Promise.all([
      buildWidgetData(site, siteSettings, { ...widget, content: { ...c, source: "testimonials", minRating: 1, limit: 30 } }),
      buildWidgetData(site, siteSettings, { ...widget, content: { ...c, source: "events", minRating: 1, limit: 30 } }),
    ]);
    data = { testimonials: fromTestimonials.testimonials, events: fromEvents.events };
  } else {
    data = await buildWidgetData(site, siteSettings, widget);
  }

  const lang = siteSettings.language || locale.code;
  const dir = siteSettings.language ? siteSettings.dir : locale.dir;
  const s = totals.get(widget.id) ?? { impressions: 0, hovers: 0, clicks: 0, conversions: 0 };
  const items = [
    { icon: Eye, label: t("editor.stats.views"), value: formatNumber(s.impressions, locale.code) },
    { icon: MousePointerClick, label: t("editor.stats.clicks"), value: formatNumber(s.clicks, locale.code) },
    { icon: Percent, label: t("editor.stats.ctr"), value: percent(s.clicks, s.impressions, locale.code) },
    { icon: Target, label: t("editor.stats.conversions"), value: formatNumber(s.conversions, locale.code) },
  ];

  const stats = (
    <section aria-label={t("editor.stats.label")} className="rounded-xl border border-line bg-surface">
      <dl className="grid grid-cols-2 sm:grid-cols-4">
        {items.map((item, i) => (
          <div
            key={item.label}
            className={[
              "flex items-center gap-3 px-4 py-3",
              i % 2 === 1 ? "border-s border-line" : "",
              i >= 2 ? "border-t border-line sm:border-t-0" : "",
              i === 2 ? "sm:border-s" : "",
            ].join(" ")}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-paper text-muted ring-1 ring-line" aria-hidden>
              <item.icon className="size-4" />
            </span>
            <div className="min-w-0">
              <dt className="truncate text-xs text-muted">{item.label}</dt>
              <dd className="font-display text-lg leading-tight font-bold tabular-nums">{item.value}</dd>
            </div>
          </div>
        ))}
      </dl>
      <p className="border-t border-line px-4 py-1.5 text-[11px] text-muted">{t("editor.stats.period")}</p>
    </section>
  );

  return (
    <WidgetEditor
      widget={{ id: widget.id, type: widget.type, name: widget.name, isActive: widget.isActive, content: widget.content, design: widget.design, rules: widget.rules }}
      site={{ id: site.id, name: site.name }}
      data={data}
      lang={lang}
      dir={dir}
      branding={brandingFor(settings, entitlements)}
      stats={stats}
    />
  );
}
