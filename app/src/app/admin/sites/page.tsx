import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";
import { Card, EmptyState, PageHeader, Pagination, StatCard, Table, Td, Th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/lib/db";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Websites" };

const PER_PAGE = 25;
const FILTERS = [
  { value: "all", label: "All" },
  { value: "installed", label: "Installed" },
  { value: "pending", label: "Not installed" },
] as const;

const since30 = () => new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);

export default async function AdminSitesPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const filter = FILTERS.some((f) => f.value === params.filter) ? params.filter! : "all";
  const page = Math.max(1, Number(params.page) || 1);
  const since = since30();
  const db = await getDb();

  let query = db.selectFrom("sites").innerJoin("users", "users.id", "sites.user_id");
  if (q) {
    query = query.where((eb) =>
      eb.or([eb("sites.domain", "like", `%${q}%`), eb("sites.name", "like", `%${q}%`), eb("users.email", "like", `%${q}%`)]),
    );
  }
  if (filter === "installed") query = query.where("sites.verified_at", "is not", null);
  if (filter === "pending") query = query.where("sites.verified_at", "is", null);

  const [total, rows, totals] = await Promise.all([
    query.select((eb) => eb.fn.countAll<number>().as("n")).executeTakeFirst(),
    query
      .select((eb) => [
        "sites.id",
        "sites.name",
        "sites.domain",
        "sites.verified_at",
        "sites.created_at",
        "users.id as user_id",
        "users.name as user_name",
        "users.email as user_email",
        eb.selectFrom("widgets").select((sub) => sub.fn.countAll<number>().as("n")).whereRef("widgets.site_id", "=", "sites.id").as("widgets"),
        eb
          .selectFrom("widget_stats_daily")
          .innerJoin("widgets", "widgets.id", "widget_stats_daily.widget_id")
          .select((sub) => sub.fn.sum<number>("widget_stats_daily.impressions").as("v"))
          .whereRef("widgets.site_id", "=", "sites.id")
          .where("widget_stats_daily.day", ">=", since)
          .as("views30"),
      ])
      .orderBy("sites.id", "desc")
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE)
      .execute(),
    Promise.all([
      db.selectFrom("sites").select((eb) => eb.fn.countAll<number>().as("n")).executeTakeFirst(),
      db.selectFrom("sites").select((eb) => eb.fn.countAll<number>().as("n")).where("verified_at", "is not", null).executeTakeFirst(),
      db.selectFrom("widgets").select((eb) => eb.fn.countAll<number>().as("n")).executeTakeFirst(),
      db.selectFrom("widget_stats_daily").select((eb) => eb.fn.sum<number>("impressions").as("n")).where("day", ">=", since).executeTakeFirst(),
    ]),
  ]);

  const count = Number(total?.n ?? 0);
  const pages = Math.max(1, Math.ceil(count / PER_PAGE));
  const href = (p: number) => `/admin/sites?${new URLSearchParams({ ...(q ? { q } : {}), filter, page: String(p) })}`;
  const [allSites, installed, widgets, views] = totals.map((r) => Number(r?.n ?? 0));

  return (
    <>
      <PageHeader title="Websites" description="Every website your customers have added, across all accounts." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Websites" value={allSites.toLocaleString()} />
        <StatCard label="Installed" value={installed.toLocaleString()} hint={allSites ? `${Math.round((installed / allSites) * 100)}% of all websites` : undefined} />
        <StatCard label="Widgets" value={widgets.toLocaleString()} />
        <StatCard label="Widget views, 30 days" value={views.toLocaleString()} />
      </div>

      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <form className="relative w-full sm:max-w-xs" action="/admin/sites">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input type="hidden" name="filter" value={filter} />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search domain, name or owner email"
              aria-label="Search websites"
              className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-sm focus:border-primary focus:outline-none"
            />
          </form>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <Link
                key={f.value}
                href={`/admin/sites?${new URLSearchParams({ ...(q ? { q } : {}), filter: f.value })}`}
                className={cn("rounded-md px-3 py-1.5 text-sm font-medium", filter === f.value ? "bg-primary-soft text-primary" : "text-muted hover:text-ink")}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>
        {rows.length ? (
          <Table minWidth={860}>
            <thead>
              <tr>
                <Th>Website</Th>
                <Th>Owner</Th>
                <Th className="text-right">Widgets</Th>
                <Th className="text-right">Views, 30 days</Th>
                <Th>Status</Th>
                <Th>Added</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const isHost = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(s.domain);
                return (
                  <tr key={s.id}>
                    <Td>
                      <p className="font-medium">{s.name}</p>
                      {isHost ? (
                        <a
                          href={`https://${s.domain}`}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="inline-flex items-center gap-1 text-xs text-muted hover:text-primary"
                        >
                          {s.domain}
                          <ExternalLink className="size-3" aria-hidden />
                        </a>
                      ) : (
                        <p className="text-xs text-muted">{s.domain}</p>
                      )}
                    </Td>
                    <Td>
                      <Link href={`/admin/users/${s.user_id}`} className="font-medium hover:text-primary">
                        {s.user_email}
                      </Link>
                      <p className="text-xs text-muted">{s.user_name}</p>
                    </Td>
                    <Td className="text-right tabular-nums">{Number(s.widgets ?? 0).toLocaleString()}</Td>
                    <Td className="text-right tabular-nums">{Number(s.views30 ?? 0).toLocaleString()}</Td>
                    <Td>
                      {s.verified_at ? (
                        <Badge tone="success" title={`Script detected ${formatDate(s.verified_at, true)}`}>
                          Installed
                        </Badge>
                      ) : (
                        <Badge tone="warning">Not installed</Badge>
                      )}
                    </Td>
                    <Td className="text-muted">{formatDate(s.created_at)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState title={q || filter !== "all" ? "No websites found" : "No websites yet"}>
            {q || filter !== "all" ? "Try a different search or filter." : "Websites appear here when customers add them in their dashboard."}
          </EmptyState>
        )}
        <Pagination page={page} pages={pages} href={href} />
      </Card>
    </>
  );
}
