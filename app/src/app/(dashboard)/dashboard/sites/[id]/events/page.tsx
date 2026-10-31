import type { Metadata } from "next";
import Link from "next/link";
import { Eye, EyeOff, FileSpreadsheet, FormInput, Plus, Trash2, Webhook, Zap } from "lucide-react";
import { deleteEventAction, setEventHiddenAction } from "@/app/actions/dashboard/events";
import { ActionButton } from "@/components/dashboard/actions";
import { AddEventForm, ImportEventsForm } from "@/components/dashboard/event-forms";
import { DashHeader, DTable, DTd, DTh, Empty, LinkTabs, Pager, Panel } from "@/components/dashboard/ui";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { formatDateTime, formatNumber, formatRelative, intParam, loadSitePage } from "@/lib/dashboard-site";
import { getDb } from "@/lib/db";
import { anonymizeName } from "@/lib/events";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/messages";
import { EVENT_KINDS, type EventKind } from "@/widget/types";

const PER_PAGE = 25;
const KIND_TONE = { purchase: "success", signup: "primary", review: "warning", custom: "neutral" } as const;

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string; kind?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("dash.nav.events") };
}

export default async function EventsPage({ params, searchParams }: Props) {
  const [{ id }, query, t] = await Promise.all([params, searchParams, getT()]);
  const { site, siteSettings, locale } = await loadSitePage(id);
  const kind = (EVENT_KINDS as readonly string[]).includes(query.kind ?? "") ? (query.kind as EventKind) : null;
  const db = await getDb();

  const counts = await db
    .selectFrom("events")
    .select(["kind", (eb) => eb.fn.countAll<number>().as("n")])
    .where("site_id", "=", site.id)
    .groupBy("kind")
    .execute();
  const countBy = new Map(counts.map((c) => [c.kind, Number(c.n)]));
  const total = [...countBy.values()].reduce((a, b) => a + b, 0);
  const filtered = kind ? (countBy.get(kind) ?? 0) : total;
  const pages = Math.max(1, Math.ceil(filtered / PER_PAGE));
  const page = Math.min(intParam(query.page, 1), pages);

  const events = await db
    .selectFrom("events")
    .selectAll()
    .where("site_id", "=", site.id)
    .$if(Boolean(kind), (qb) => qb.where("kind", "=", kind!))
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE)
    .execute();

  const base = `/dashboard/sites/${site.id}/events`;
  const href = (p: number, k: EventKind | null = kind) => {
    const qs = new URLSearchParams();
    if (k) qs.set("kind", k);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `${base}?${s}` : base;
  };
  const sources = [
    { icon: FormInput, title: t("dash.events.src.form"), text: t("dash.events.src.formText"), href: `/dashboard/sites/${site.id}/settings` },
    { icon: Webhook, title: t("dash.events.src.webhook"), text: t("dash.events.src.webhookText"), href: `/dashboard/sites/${site.id}/integrations` },
    { icon: FileSpreadsheet, title: t("dash.events.src.manual"), text: t("dash.events.src.manualText"), href: "#add-event" },
  ];

  return (
    <>
      <DashHeader
        title={t("dash.nav.events")}
        description={t("dash.events.subtitle")}
        actions={
          <a href="#add-event" className={buttonClass("primary")}>
            <Plus aria-hidden />
            {t("dash.events.add")}
          </a>
        }
      />

      <ul className="mb-6 grid gap-3 md:grid-cols-3">
        {sources.map((s) => (
          <li key={s.title}>
            <Link href={s.href} className="flex h-full gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-primary-line">
              <s.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="block text-sm font-semibold">{s.title}</span>
                <span className="mt-0.5 block text-xs text-muted">{s.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mb-4">
        <LinkTabs
          label={t("dash.events.filter")}
          items={[
            { href: href(1, null), label: t("dash.all"), active: !kind, count: total },
            ...EVENT_KINDS.map((k) => ({ href: href(1, k), label: t(`dash.kind.${k}` as MessageKey), active: kind === k, count: countBy.get(k) ?? 0 })),
          ]}
        />
      </div>

      <Panel padded={false}>
        {events.length ? (
          <>
            <DTable minWidth={900} label={t("dash.nav.events")}>
              <thead>
                <tr>
                  <DTh>{t("dash.events.kind")}</DTh>
                  <DTh>{t("dash.events.name")}</DTh>
                  <DTh>{t("dash.events.location")}</DTh>
                  <DTh>{t("dash.events.product")}</DTh>
                  <DTh>{t("dash.events.source")}</DTh>
                  <DTh>{t("dash.events.time")}</DTh>
                  <DTh>
                    <span className="sr-only">{t("dash.actions")}</span>
                  </DTh>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const shown = anonymizeName(e.name, siteSettings.anonymize);
                  const location = [e.city, e.country].filter(Boolean).join(", ");
                  return (
                    <tr key={e.id} className={e.is_hidden ? "bg-paper/60 text-muted" : undefined}>
                      <DTd>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={KIND_TONE[e.kind]}>{t(`dash.kind.${e.kind}` as MessageKey)}</Badge>
                          {e.is_hidden ? <Badge>{t("dash.events.hiddenBadge")}</Badge> : null}
                        </div>
                      </DTd>
                      <DTd>
                        {e.name ? (
                          <>
                            <span className="block max-w-[12rem] truncate font-medium">{e.name}</span>
                            {shown !== e.name ? <span className="block text-xs text-muted">{t("dash.events.shownAs", { name: shown })}</span> : null}
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                        {e.rating ? <span className="block text-xs text-amber-600 dark:text-amber-400">{t("dash.stars", { count: e.rating })}</span> : null}
                      </DTd>
                      <DTd className="max-w-[12rem] truncate">{location || <span className="text-muted">—</span>}</DTd>
                      <DTd className="max-w-[14rem]">
                        {e.product ? (
                          e.url && /^https?:\/\//.test(e.url) ? (
                            <a href={e.url} target="_blank" rel="noopener noreferrer nofollow" className="block truncate hover:text-primary hover:underline">
                              {e.product}
                            </a>
                          ) : (
                            <span className="block truncate">{e.product}</span>
                          )
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </DTd>
                      <DTd>
                        <span className="text-xs text-muted">{t(`dash.source.${e.source}` as MessageKey)}</span>
                      </DTd>
                      <DTd className="whitespace-nowrap">
                        <time dateTime={e.created_at} title={formatDateTime(e.created_at, locale)} className="text-sm">
                          {formatRelative(e.created_at, locale)}
                        </time>
                      </DTd>
                      <DTd>
                        <div className="flex justify-end gap-1.5">
                          <ActionButton
                            action={setEventHiddenAction}
                            fields={{ event_id: e.id, hidden: e.is_hidden ? "0" : "1" }}
                            variant="ghost"
                            label={e.is_hidden ? t("dash.events.show") : t("dash.events.hide")}
                          >
                            {e.is_hidden ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
                          </ActionButton>
                          <ActionButton
                            action={deleteEventAction}
                            fields={{ event_id: e.id }}
                            variant="ghost"
                            label={t("dash.delete")}
                            confirmText={t("dash.events.deleteConfirm")}
                          >
                            <Trash2 aria-hidden />
                          </ActionButton>
                        </div>
                      </DTd>
                    </tr>
                  );
                })}
              </tbody>
            </DTable>
            <Pager
              page={page}
              pages={pages}
              href={(p) => href(p)}
              labels={{
                summary: t("dash.pager.summary", { page, pages, total: formatNumber(filtered, locale) }),
                previous: t("dash.pager.previous"),
                next: t("dash.pager.next"),
                nav: t("dash.pager.label"),
              }}
            />
          </>
        ) : (
          <Empty icon={<Zap />} title={kind ? t("dash.events.emptyFiltered") : t("dash.events.emptyTitle")}>
            {t("dash.events.emptyText")}
          </Empty>
        )}
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel id="add-event" title={t("dash.events.addTitle")} description={t("dash.events.addText")} className="scroll-mt-20">
          <AddEventForm siteId={site.id} />
        </Panel>
        <Panel title={t("dash.import.title")} description={t("dash.import.subtitle")} className="h-fit">
          <ImportEventsForm siteId={site.id} />
        </Panel>
      </div>
    </>
  );
}
