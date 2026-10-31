import type { Metadata } from "next";
import { Check, ExternalLink, MessageSquareQuote, Star, Trash2, Undo2, X } from "lucide-react";
import { deleteTestimonialAction, setTestimonialStatusAction } from "@/app/actions/dashboard/testimonials";
import { ActionButton } from "@/components/dashboard/actions";
import { CopyField } from "@/components/dashboard/copy";
import { AddTestimonialForm, WallEmbed } from "@/components/dashboard/testimonial-forms";
import { DashHeader, Empty, LinkTabs, Pager, Panel } from "@/components/dashboard/ui";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatNumber, intParam, loadSitePage } from "@/lib/dashboard-site";
import { getDb } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/messages";
import { absoluteUrl, uploadUrl } from "@/lib/site";

const PER_PAGE = 20;
const STATUSES = ["pending", "approved", "rejected"] as const;
type Status = (typeof STATUSES)[number];

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string; page?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("dash.nav.testimonials") };
}

function Stars({ rating, label }: { rating: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={i <= rating ? "size-3.5 fill-amber-400 text-amber-400" : "size-3.5 text-line"} aria-hidden />
      ))}
    </span>
  );
}

export default async function TestimonialsPage({ params, searchParams }: Props) {
  const [{ id }, query, t] = await Promise.all([params, searchParams, getT()]);
  const { site, siteSettings, settings, locale } = await loadSitePage(id);
  const db = await getDb();

  const counts = await db
    .selectFrom("testimonials")
    .select(["status", (eb) => eb.fn.countAll<number>().as("n")])
    .where("site_id", "=", site.id)
    .groupBy("status")
    .execute();
  const countBy = new Map(counts.map((c) => [c.status, Number(c.n)]));
  const fallback: Status = (countBy.get("pending") ?? 0) > 0 || !(countBy.get("approved") ?? 0) ? "pending" : "approved";
  const status: Status = (STATUSES as readonly string[]).includes(query.status ?? "") ? (query.status as Status) : fallback;
  const filtered = countBy.get(status) ?? 0;
  const pages = Math.max(1, Math.ceil(filtered / PER_PAGE));
  const page = Math.min(intParam(query.page, 1), pages);
  const items = await db
    .selectFrom("testimonials")
    .selectAll()
    .where("site_id", "=", site.id)
    .where("status", "=", status)
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE)
    .execute();

  const base = `/dashboard/sites/${site.id}/testimonials`;
  const href = (s: Status, p = 1) => `${base}?status=${s}${p > 1 ? `&page=${p}` : ""}`;
  const collectUrl = absoluteUrl(settings, `/t/${site.public_key}`);
  const wallUrl = absoluteUrl(settings, `/embed/wall/${site.public_key}`);
  const origin = new URL(absoluteUrl(settings)).origin;

  return (
    <>
      <DashHeader title={t("dash.nav.testimonials")} description={t("dash.testimonials.subtitle")} />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <LinkTabs
              label={t("dash.testimonials.tabs")}
              items={STATUSES.map((s) => ({ href: href(s), label: t(`dash.tstatus.${s}` as MessageKey), active: status === s, count: countBy.get(s) ?? 0 }))}
            />
            {siteSettings.autoApproveTestimonials ? <Badge tone="primary">{t("dash.testimonials.autoApproveOn")}</Badge> : null}
          </div>

          <Panel padded={false}>
            {items.length ? (
              <>
                <ul className="divide-y divide-line">
                  {items.map((item) => {
                    const avatar = item.avatar ? uploadUrl(item.avatar) : "";
                    return (
                      <li key={item.id} className="p-5">
                        <div className="flex items-start gap-3">
                          {avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element -- customer-provided avatar URL
                            <img src={avatar} alt="" className="size-10 shrink-0 rounded-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft font-semibold text-primary uppercase" aria-hidden>
                              {item.name.slice(0, 1)}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="font-semibold">{item.name}</p>
                              {item.title ? <span className="text-sm text-muted">· {item.title}</span> : null}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                              <Stars rating={item.rating} label={t("dash.stars", { count: item.rating })} />
                              <time dateTime={item.created_at}>{formatDateTime(item.created_at, locale, false)}</time>
                              <span>{t(`dash.tsource.${item.source}` as MessageKey)}</span>
                              {item.email ? (
                                <a href={`mailto:${item.email}`} className="hover:text-primary" dir="ltr">
                                  {item.email}
                                </a>
                              ) : null}
                            </div>
                            <p className="mt-3 text-sm leading-relaxed break-words whitespace-pre-line">{item.body}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {status !== "approved" ? (
                                <ActionButton action={setTestimonialStatusAction} fields={{ testimonial_id: item.id, status: "approved" }} variant="primary">
                                  <Check aria-hidden />
                                  {t("dash.testimonials.approve")}
                                </ActionButton>
                              ) : null}
                              {status !== "rejected" ? (
                                <ActionButton action={setTestimonialStatusAction} fields={{ testimonial_id: item.id, status: "rejected" }}>
                                  <X aria-hidden />
                                  {t("dash.testimonials.reject")}
                                </ActionButton>
                              ) : null}
                              {status !== "pending" ? (
                                <ActionButton action={setTestimonialStatusAction} fields={{ testimonial_id: item.id, status: "pending" }} variant="ghost">
                                  <Undo2 aria-hidden />
                                  {t("dash.testimonials.moveToPending")}
                                </ActionButton>
                              ) : null}
                              <ActionButton
                                action={deleteTestimonialAction}
                                fields={{ testimonial_id: item.id }}
                                variant="ghost"
                                confirmText={t("dash.testimonials.deleteConfirm")}
                              >
                                <Trash2 aria-hidden />
                                {t("dash.delete")}
                              </ActionButton>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <Pager
                  page={page}
                  pages={pages}
                  href={(p) => href(status, p)}
                  labels={{
                    summary: t("dash.pager.summary", { page, pages, total: formatNumber(filtered, locale) }),
                    previous: t("dash.pager.previous"),
                    next: t("dash.pager.next"),
                    nav: t("dash.pager.label"),
                  }}
                />
              </>
            ) : (
              <Empty icon={<MessageSquareQuote />} title={t(`dash.testimonials.empty.${status}` as MessageKey)}>
                {t("dash.testimonials.emptyText")}
              </Empty>
            )}
          </Panel>

          <Panel title={t("dash.testimonials.addTitle")} description={t("dash.testimonials.addText")}>
            <AddTestimonialForm siteId={site.id} />
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          <Panel
            title={t("dash.testimonials.collectTitle")}
            description={t("dash.testimonials.collectText")}
            actions={
              <a href={collectUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                {t("dash.open")}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            }
          >
            <CopyField value={collectUrl} label={t("dash.testimonials.collectTitle")} />
            <p className="mt-3 text-xs text-muted">{t("dash.testimonials.collectHint")}</p>
          </Panel>

          <Panel title={t("dash.wall.title")} description={t("dash.wall.subtitle")}>
            <WallEmbed wallUrl={wallUrl} origin={origin} />
          </Panel>
        </div>
      </div>
    </>
  );
}
