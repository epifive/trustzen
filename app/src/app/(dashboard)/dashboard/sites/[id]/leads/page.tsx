import type { Metadata } from "next";
import Link from "next/link";
import { Download, Inbox, Search, Trash2 } from "lucide-react";
import { deleteLeadAction } from "@/app/actions/dashboard/leads";
import { ActionButton } from "@/components/dashboard/actions";
import { DashHeader, DTable, DTd, DTh, Empty, Pager, Panel } from "@/components/dashboard/ui";
import { Button, buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { formatDateTime, formatNumber, intParam, likePattern, loadSitePage } from "@/lib/dashboard-site";
import { getDb } from "@/lib/db";
import { getT } from "@/lib/i18n/server";

const PER_PAGE = 25;

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; page?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("dash.nav.leads") };
}

export default async function LeadsPage({ params, searchParams }: Props) {
  const [{ id }, query, t] = await Promise.all([params, searchParams, getT()]);
  const { site, locale } = await loadSitePage(id);
  const q = (query.q ?? "").trim().slice(0, 100);
  const pattern = likePattern(q);
  const db = await getDb();

  const countRow = await db
    .selectFrom("leads")
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .where("leads.site_id", "=", site.id)
    .$if(Boolean(q), (qb) => qb.where((eb) => eb.or([eb("leads.email", "like", pattern), eb("leads.name", "like", pattern)])))
    .executeTakeFirst();
  const total = Number(countRow?.n ?? 0);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(intParam(query.page, 1), pages);
  const leads = await db
    .selectFrom("leads")
    .leftJoin("widgets", "widgets.id", "leads.widget_id")
    .select(["leads.id", "leads.email", "leads.name", "leads.page_url", "leads.created_at", "widgets.name as widget_name", "widgets.id as widget_id"])
    .where("leads.site_id", "=", site.id)
    .$if(Boolean(q), (qb) => qb.where((eb) => eb.or([eb("leads.email", "like", pattern), eb("leads.name", "like", pattern)])))
    .orderBy("leads.created_at", "desc")
    .orderBy("leads.id", "desc")
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE)
    .execute();

  const base = `/dashboard/sites/${site.id}/leads`;
  const href = (p: number) => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `${base}?${s}` : base;
  };
  const pagePath = (url: string | null) => {
    if (!url) return "";
    try {
      const u = new URL(url);
      return `${u.pathname}${u.search}`;
    } catch {
      return url;
    }
  };

  return (
    <>
      <DashHeader
        title={t("dash.nav.leads")}
        description={t("dash.leads.subtitle")}
        actions={
          total > 0 ? (
            <a href={`${base}/export${q ? `?q=${encodeURIComponent(q)}` : ""}`} className={buttonClass("outline")} download>
              <Download aria-hidden />
              {t("dash.leads.export")}
            </a>
          ) : null
        }
      />

      <Panel padded={false}>
        <form role="search" action={base} className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <label htmlFor="lead-search" className="sr-only">
            {t("dash.leads.search")}
          </label>
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input id="lead-search" name="q" type="search" defaultValue={q} placeholder={t("dash.leads.searchPlaceholder")} className="ps-9" />
          </div>
          <Button type="submit" variant="outline">
            {t("dash.leads.search")}
          </Button>
          {q ? (
            <Link href={base} className="text-sm text-muted hover:text-ink">
              {t("ui.clear")}
            </Link>
          ) : null}
          <span className="ms-auto text-sm text-muted">{t("dash.leads.count", { count: formatNumber(total, locale) })}</span>
        </form>

        {leads.length ? (
          <>
            <DTable minWidth={760} label={t("dash.nav.leads")}>
              <thead>
                <tr>
                  <DTh>{t("dash.leads.email")}</DTh>
                  <DTh>{t("dash.leads.name")}</DTh>
                  <DTh>{t("dash.leads.widget")}</DTh>
                  <DTh>{t("dash.leads.page")}</DTh>
                  <DTh>{t("dash.leads.date")}</DTh>
                  <DTh>
                    <span className="sr-only">{t("dash.actions")}</span>
                  </DTh>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <DTd>
                      <a href={`mailto:${lead.email}`} className="font-medium hover:text-primary" dir="ltr">
                        {lead.email}
                      </a>
                    </DTd>
                    <DTd className="max-w-[10rem] truncate">{lead.name || <span className="text-muted">—</span>}</DTd>
                    <DTd className="max-w-[10rem] truncate">
                      {lead.widget_id ? (
                        <Link href={`/dashboard/widgets/${lead.widget_id}`} className="hover:text-primary">
                          {lead.widget_name}
                        </Link>
                      ) : (
                        <span className="text-muted">{t("dash.leads.deletedWidget")}</span>
                      )}
                    </DTd>
                    <DTd className="max-w-[14rem] truncate">
                      {lead.page_url ? (
                        <span className="font-mono text-xs" title={lead.page_url} dir="ltr">
                          {pagePath(lead.page_url)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </DTd>
                    <DTd className="whitespace-nowrap text-muted">
                      <time dateTime={lead.created_at}>{formatDateTime(lead.created_at, locale)}</time>
                    </DTd>
                    <DTd className="text-end">
                      <ActionButton
                        action={deleteLeadAction}
                        fields={{ lead_id: lead.id }}
                        variant="ghost"
                        label={t("dash.leads.delete", { email: lead.email })}
                        confirmText={t("dash.leads.deleteConfirm", { email: lead.email })}
                      >
                        <Trash2 aria-hidden />
                      </ActionButton>
                    </DTd>
                  </tr>
                ))}
              </tbody>
            </DTable>
            <Pager
              page={page}
              pages={pages}
              href={href}
              labels={{
                summary: t("dash.pager.summary", { page, pages, total: formatNumber(total, locale) }),
                previous: t("dash.pager.previous"),
                next: t("dash.pager.next"),
                nav: t("dash.pager.label"),
              }}
            />
          </>
        ) : (
          <Empty icon={<Inbox />} title={q ? t("dash.leads.noResults", { q }) : t("dash.leads.emptyTitle")}>
            {q ? null : t("dash.leads.emptyText")}
          </Empty>
        )}
      </Panel>
    </>
  );
}
