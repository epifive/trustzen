import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { GATEWAY_LABELS } from "@/lib/payments";
import { getAllPlans, getEntitlements } from "@/lib/plans";
import { getMonthlyViews } from "@/lib/usage";
import { formatDate, formatMoney } from "@/lib/utils";
import { UserForm } from "../user-form";

export const metadata = { title: "Edit user" };

export default async function EditUserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  const db = await getDb();
  const user = await db.selectFrom("users").selectAll().where("id", "=", Number(id)).executeTakeFirst();
  if (!user) notFound();
  const [me, plans, payments, sites, entitlements, monthViews] = await Promise.all([
    getCurrentUser(),
    getAllPlans(),
    db.selectFrom("payments").selectAll().where("user_id", "=", user.id).orderBy("id", "desc").limit(20).execute(),
    db
      .selectFrom("sites")
      .select((eb) => [
        "sites.id",
        "sites.name",
        "sites.domain",
        "sites.verified_at",
        eb.selectFrom("widgets").select((sub) => sub.fn.countAll<number>().as("n")).whereRef("widgets.site_id", "=", "sites.id").as("widgets"),
      ])
      .where("sites.user_id", "=", user.id)
      .orderBy("sites.id")
      .execute(),
    getEntitlements(user),
    getMonthlyViews(user.id),
  ]);
  const widgetCount = sites.reduce((n, s) => n + Number(s.widgets ?? 0), 0);
  const usage = [
    { label: "Websites", used: sites.length, limit: entitlements.maxSites },
    { label: "Widgets", used: widgetCount, limit: entitlements.maxWidgets },
    { label: "Widget views this month", used: monthViews, limit: entitlements.maxMonthlyViews },
  ];

  return (
    <>
      <PageHeader
        title={user.name}
        description={
          <>
            Joined {formatDate(user.created_at)}.{" "}
            <Link href="/admin/users" className="text-primary hover:underline">
              Back to users
            </Link>
          </>
        }
      />
      {created ? <Alert tone="success" className="mb-4">User created.</Alert> : null}
      <Card
        title="Websites and usage"
        padded={false}
        className="mb-6 max-w-3xl"
        actions={<span className="text-xs text-muted">{entitlements.plan?.name ?? (user.role === "admin" ? "Admin (unlimited)" : "Free")}</span>}
      >
        <dl className="grid gap-4 p-5 sm:grid-cols-3">
          {usage.map((u) => {
            const pct = u.limit ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
            return (
              <div key={u.label}>
                <dt className="text-xs text-muted">{u.label}</dt>
                <dd className="mt-1 text-sm">
                  <span className="font-display text-xl font-bold tabular-nums">{u.used.toLocaleString()}</span>
                  <span className="text-muted"> / {u.limit ? u.limit.toLocaleString() : "Unlimited"}</span>
                </dd>
                {u.limit ? (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" role="presentation">
                    <div className={pct >= 90 ? "h-full bg-red-500" : pct >= 75 ? "h-full bg-amber-500" : "h-full bg-primary"} style={{ width: `${pct}%` }} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </dl>
        {sites.length ? (
          <Table minWidth={520}>
            <thead>
              <tr>
                <Th>Website</Th>
                <Th className="text-right">Widgets</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr key={s.id}>
                  <Td>
                    <Link href={`/admin/sites?${new URLSearchParams({ q: s.domain })}`} className="font-medium hover:text-primary">
                      {s.name}
                    </Link>
                    <p className="text-xs text-muted">{s.domain}</p>
                  </Td>
                  <Td className="text-right tabular-nums">{Number(s.widgets ?? 0).toLocaleString()}</Td>
                  <Td>
                    {s.verified_at ? <Badge tone="success">Installed</Badge> : <Badge tone="warning">Not installed</Badge>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="border-t border-line p-5 text-sm text-muted">No websites yet.</p>
        )}
      </Card>
      <UserForm
        isSelf={me?.id === user.id}
        plans={plans.filter((p) => !p.is_free).map((p) => ({ id: p.id, name: p.name }))}
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          planId: user.plan_id ?? 0,
          planExpires: user.plan_expires_at ? user.plan_expires_at.slice(0, 10) : "",
        }}
      />
      <Card title="Payments" padded={false} className="mt-6 max-w-3xl">
        {payments.length ? (
          <Table minWidth={520}>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Method</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <Td>{formatDate(p.created_at)}</Td>
                  <Td>{GATEWAY_LABELS[p.provider]}</Td>
                  <Td className="tabular-nums">{formatMoney(p.amount, p.currency)}</Td>
                  <Td>
                    <Badge tone={p.status === "paid" ? "success" : p.status === "pending" ? "warning" : "danger"} className="capitalize">
                      {p.status}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="p-5 text-sm text-muted">No payments.</p>
        )}
      </Card>
    </>
  );
}
