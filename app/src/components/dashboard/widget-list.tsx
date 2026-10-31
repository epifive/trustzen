import Link from "next/link";
import { LayoutGrid, Pencil, Plus } from "lucide-react";
import { formatNumber, percent } from "@/lib/dashboard-site";
import type { Translator } from "@/lib/i18n/messages";
import type { WidgetRecord, WidgetStats } from "@/lib/widgets";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WidgetToggle } from "./actions";
import { DTable, DTd, DTh, Empty } from "./ui";
import { WIDGET_TYPE_ICONS, widgetTypeLabel } from "./widget-types";

/** Table of a site's widgets with an active switch and 30-day numbers. */
export function WidgetList({
  siteId,
  widgets,
  totals,
  t,
  locale,
  canAdd,
}: {
  siteId: number;
  widgets: WidgetRecord[];
  totals: Map<number, WidgetStats>;
  t: Translator;
  locale: string;
  canAdd: boolean;
}) {
  if (!widgets.length) {
    return (
      <Empty
        icon={<LayoutGrid />}
        title={t("dash.widgets.emptyTitle")}
        action={
          canAdd ? (
            <ButtonLink href={`/dashboard/sites/${siteId}/widgets/new`}>
              <Plus aria-hidden />
              {t("dash.widgets.add")}
            </ButtonLink>
          ) : null
        }
      >
        {t("dash.widgets.emptyText")}
      </Empty>
    );
  }
  return (
    <DTable minWidth={680} label={t("dash.nav.widgets")}>
      <thead>
        <tr>
          <DTh>{t("dash.widgets.name")}</DTh>
          <DTh>{t("dash.widgets.active")}</DTh>
          <DTh className="text-end">{t("dash.stat.views")}</DTh>
          <DTh className="text-end">{t("dash.stat.clicks")}</DTh>
          <DTh className="text-end">{t("dash.stat.ctr")}</DTh>
          <DTh>
            <span className="sr-only">{t("dash.actions")}</span>
          </DTh>
        </tr>
      </thead>
      <tbody>
        {widgets.map((w) => {
          const Icon = WIDGET_TYPE_ICONS[w.type];
          const s = totals.get(w.id);
          return (
            <tr key={w.id} className="hover:bg-paper/60">
              <DTd>
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <Link href={`/dashboard/widgets/${w.id}`} className="block max-w-[16rem] truncate font-medium hover:text-primary">
                      {w.name}
                    </Link>
                    <span className="text-xs text-muted">{t(widgetTypeLabel(w.type))}</span>
                  </div>
                </div>
              </DTd>
              <DTd>
                <div className="flex items-center gap-2">
                  <WidgetToggle widgetId={w.id} active={w.isActive} name={w.name} />
                  {w.isActive ? <Badge tone="success">{t("dash.widgets.live")}</Badge> : <Badge>{t("dash.widgets.paused")}</Badge>}
                </div>
              </DTd>
              <DTd className="text-end tabular-nums">{formatNumber(s?.impressions ?? 0, locale)}</DTd>
              <DTd className="text-end tabular-nums">{formatNumber(s?.clicks ?? 0, locale)}</DTd>
              <DTd className="text-end text-muted tabular-nums">{percent(s?.clicks ?? 0, s?.impressions ?? 0, locale)}</DTd>
              <DTd className="text-end">
                <ButtonLink href={`/dashboard/widgets/${w.id}`} variant="outline" size="sm">
                  <Pencil aria-hidden />
                  {t("dash.edit")}
                </ButtonLink>
              </DTd>
            </tr>
          );
        })}
      </tbody>
    </DTable>
  );
}
