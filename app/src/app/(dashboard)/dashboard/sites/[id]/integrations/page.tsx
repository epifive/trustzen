import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, Crown, FormInput, RefreshCw, Send, Webhook } from "lucide-react";
import { regenerateWebhookTokenAction } from "@/app/actions/dashboard/sites";
import { ActionButton } from "@/components/dashboard/actions";
import { CopyButton, CopyField } from "@/components/dashboard/copy";
import { CodeBlock, DashHeader, Panel } from "@/components/dashboard/ui";
import { Alert } from "@/components/ui/alert";
import { Badge, ProBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { loadSitePage } from "@/lib/dashboard-site";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/messages";
import { absoluteUrl } from "@/lib/site";

type Props = { params: Promise<{ id: string }> };

const GENERIC_JSON = `{
  "kind": "purchase",
  "name": "Anna",
  "city": "Berlin",
  "country": "Germany",
  "product": "Pro plan",
  "url": "https://…",
  "image": "https://…",
  "rating": 5,
  "message": "",
  "created_at": "2026-10-16T10:00:00Z"
}`;

const GUIDES: Array<{ id: string; title: MessageKey; steps: MessageKey[] }> = [
  { id: "stripe", title: "dash.int.stripe", steps: ["dash.int.stripe.1", "dash.int.stripe.2", "dash.int.stripe.3", "dash.int.stripe.4"] },
  { id: "woo", title: "dash.int.woo", steps: ["dash.int.woo.1", "dash.int.woo.2", "dash.int.woo.3"] },
  { id: "shopify", title: "dash.int.shopify", steps: ["dash.int.shopify.1", "dash.int.shopify.2", "dash.int.shopify.3"] },
  { id: "zapier", title: "dash.int.zapier", steps: ["dash.int.zapier.1", "dash.int.zapier.2", "dash.int.zapier.3"] },
];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("dash.nav.integrations") };
}

export default async function IntegrationsPage({ params }: Props) {
  const [{ id }, t] = await Promise.all([params, getT()]);
  const { site, siteSettings, entitlements, settings } = await loadSitePage(id);
  const hookUrl = absoluteUrl(settings, `/api/hooks/${site.webhook_token}`);
  const curl = `curl -X POST "${hookUrl}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"kind":"signup","name":"Anna","city":"Berlin","country":"Germany"}'`;
  const settingsHref = `/dashboard/sites/${site.id}/settings`;
  const outgoingExample = `POST ${siteSettings.webhookUrl || "https://your-endpoint.example.com"}
X-Trustzen-Event: lead
X-Trustzen-Signature: sha256=…

{
  "type": "lead",
  "site": { "id": ${site.id}, "name": ${JSON.stringify(site.name)}, "domain": "${site.domain}" },
  "data": { "email": "anna@example.com", "name": "Anna" },
  "sent_at": "2026-10-16T10:00:00Z"
}`;

  return (
    <>
      <DashHeader title={t("dash.nav.integrations")} description={t("dash.int.subtitle")} />

      <div className="space-y-6">
        <Panel
          title={
            <span className="flex items-center gap-2">
              <Webhook className="size-4 text-primary" aria-hidden />
              {t("dash.int.incomingTitle")}
              {!entitlements.isPremium ? <ProBadge /> : null}
            </span>
          }
          description={t("dash.int.incomingText")}
        >
          {!entitlements.isPremium ? (
            <Alert tone="warning" title={t("dash.int.paidTitle")} className="mb-5">
              <p>{t("dash.int.paidText")}</p>
              <ButtonLink href="/pricing" size="sm" className="mt-3">
                <Crown aria-hidden />
                {t("dash.usage.upgradeCta")}
              </ButtonLink>
            </Alert>
          ) : null}

          <p className="mb-1.5 text-sm font-medium">{t("dash.int.yourUrl")}</p>
          <CopyField value={hookUrl} label={t("dash.int.yourUrl")} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">{t("dash.int.secret")}</p>
            <ActionButton action={regenerateWebhookTokenAction} fields={{ site_id: site.id }} confirmText={t("dash.webhook.regenerateConfirm")}>
              <RefreshCw aria-hidden />
              {t("dash.webhook.regenerate")}
            </ActionButton>
          </div>

          <div className="mt-6 space-y-3">
            <h3 className="font-sans text-sm font-semibold tracking-normal">{t("dash.int.guides")}</h3>
            {GUIDES.map((g) => (
              <details key={g.id} className="group rounded-lg border border-line bg-paper/50 open:bg-surface">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                  {t(g.title)}
                  <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="border-t border-line px-4 py-4">
                  <ol className="space-y-2.5 text-sm">
                    {g.steps.map((step, i) => (
                      <li key={step} className="flex gap-3">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary">{i + 1}</span>
                        <span className="pt-0.5">{t(step)}</span>
                      </li>
                    ))}
                  </ol>
                  {g.id === "zapier" ? (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{t("dash.int.format")}</p>
                        <CopyButton text={GENERIC_JSON} />
                      </div>
                      <CodeBlock>{GENERIC_JSON}</CodeBlock>
                      <ul className="list-disc space-y-1 ps-5 text-xs text-muted">
                        <li>{t("dash.int.formatKind")}</li>
                        <li>{t("dash.int.formatOptional")}</li>
                        <li>{t("dash.int.formatDate")}</li>
                        <li>{t("dash.int.formatBatch")}</li>
                      </ul>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{t("dash.int.curl")}</p>
                        <CopyButton text={curl} />
                      </div>
                      <CodeBlock>{curl}</CodeBlock>
                    </div>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel
            title={
              <span className="flex items-center gap-2">
                <FormInput className="size-4 text-primary" aria-hidden />
                {t("dash.int.captureTitle")}
              </span>
            }
            actions={siteSettings.captureForms ? <Badge tone="success">{t("dash.on")}</Badge> : <Badge>{t("dash.off")}</Badge>}
          >
            <p className="text-sm text-muted">{t("dash.int.captureText")}</p>
            <ul className="mt-3 list-disc space-y-1 ps-5 text-sm text-muted">
              <li>{t("dash.int.capture1")}</li>
              <li>{t("dash.int.capture2")}</li>
              <li>{t("dash.int.capture3")}</li>
            </ul>
            <Link href={settingsHref} className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
              {siteSettings.captureForms ? t("dash.int.captureManage") : t("dash.int.captureEnable")}
            </Link>
          </Panel>

          <Panel
            title={
              <span className="flex items-center gap-2">
                <Send className="size-4 text-primary rtl:-scale-x-100" aria-hidden />
                {t("dash.int.outgoingTitle")}
                {!entitlements.isPremium ? <ProBadge /> : null}
              </span>
            }
            actions={siteSettings.webhookUrl ? <Badge tone="success">{t("dash.on")}</Badge> : <Badge>{t("dash.off")}</Badge>}
          >
            <p className="text-sm text-muted">{t("dash.int.outgoingText")}</p>
            {siteSettings.webhookUrl ? (
              <p className="mt-3 truncate font-mono text-xs" dir="ltr" title={siteSettings.webhookUrl}>
                {siteSettings.webhookUrl}
              </p>
            ) : null}
            <p className="mt-4 mb-1.5 text-xs font-medium text-muted">{t("dash.int.outgoingExample")}</p>
            <CodeBlock className="text-xs">{outgoingExample}</CodeBlock>
            <p className="mt-2 text-xs text-muted">{t("dash.int.outgoingSignature")}</p>
            <Link href={settingsHref} className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
              {t("dash.int.outgoingManage")}
            </Link>
          </Panel>
        </div>
      </div>
    </>
  );
}
