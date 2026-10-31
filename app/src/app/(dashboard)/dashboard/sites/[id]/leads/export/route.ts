import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { toCsv } from "@/lib/dashboard-csv";
import { likePattern } from "@/lib/dashboard-site";
import { getDb } from "@/lib/db";
import { getOwnedSite } from "@/lib/sites";

export const dynamic = "force-dynamic";

const MAX_ROWS = 100_000;

/** CSV download of a site's leads (owner only). Honours the ?q= search of the leads page. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.status !== "active") {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(request.nextUrl.pathname)}`, request.url));
  }
  const site = await getOwnedSite(Number((await params).id), user.id);
  if (!site) return new NextResponse("Not found", { status: 404 });

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  const pattern = likePattern(q);
  const db = await getDb();
  const leads = await db
    .selectFrom("leads")
    .leftJoin("widgets", "widgets.id", "leads.widget_id")
    .select(["leads.email", "leads.name", "leads.page_url", "leads.data", "leads.created_at", "widgets.name as widget_name"])
    .where("leads.site_id", "=", site.id)
    .$if(Boolean(q), (qb) => qb.where((eb) => eb.or([eb("leads.email", "like", pattern), eb("leads.name", "like", pattern)])))
    .orderBy("leads.created_at", "desc")
    .limit(MAX_ROWS)
    .execute();

  const rows: unknown[][] = [["email", "name", "widget", "page_url", "extra", "created_at"]];
  for (const lead of leads) {
    rows.push([lead.email, lead.name ?? "", lead.widget_name ?? "", lead.page_url ?? "", lead.data ?? "", lead.created_at]);
  }
  const file = `leads-${site.domain.replace(/[^a-z0-9.-]/gi, "")}-${new Date().toISOString().slice(0, 10)}.csv`;
  // The BOM makes Excel read the file as UTF-8.
  return new NextResponse(String.fromCharCode(0xfeff) + toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
