"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { createSiteAction, deleteSiteAction, updateSiteSettingsAction } from "@/app/actions/dashboard/sites";
import { initialFormState, type FormState } from "@/app/actions/types";
import { ProBadge } from "@/components/ui/badge";
import { Field, Hint, Input, Label, Select, Switch, Textarea } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { Segmented } from "@/components/ui/segmented";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import type { Anonymize, EventKind } from "@/widget/types";
import { CopyField } from "./copy";

export function NewSiteForm() {
  const t = useT();
  const [state, action] = useActionState(createSiteAction, initialFormState);
  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />
      <Field label={t("dash.site.name")} htmlFor="site-name" hint={t("dash.site.nameHint")}>
        <Input id="site-name" name="name" required maxLength={120} placeholder={t("dash.site.namePlaceholder")} autoComplete="off" />
      </Field>
      <Field label={t("dash.site.domain")} htmlFor="site-domain" hint={t("dash.site.domainHint")}>
        <Input id="site-domain" name="domain" required maxLength={255} placeholder="example.com" inputMode="url" autoComplete="off" spellCheck={false} dir="ltr" />
      </Field>
      <SubmitButton pendingText={t("dash.newSite.creating")}>{t("dash.newSite.submit")}</SubmitButton>
    </form>
  );
}

const PLATFORMS = ["html", "wordpress", "shopify", "wix", "squarespace", "gtm"] as const;
type Platform = (typeof PLATFORMS)[number];
const STEPS: Record<Platform, MessageKey[]> = {
  html: ["dash.install.html.1", "dash.install.html.2"],
  wordpress: ["dash.install.wordpress.1", "dash.install.wordpress.2", "dash.install.wordpress.3"],
  shopify: ["dash.install.shopify.1", "dash.install.shopify.2", "dash.install.shopify.3"],
  wix: ["dash.install.wix.1", "dash.install.wix.2", "dash.install.wix.3"],
  squarespace: ["dash.install.squarespace.1", "dash.install.squarespace.2", "dash.install.squarespace.3"],
  gtm: ["dash.install.gtm.1", "dash.install.gtm.2", "dash.install.gtm.3", "dash.install.gtm.4"],
};

/** The embed snippet with copy button and per-platform instructions. */
export function InstallGuide({ snippet }: { snippet: string }) {
  const t = useT();
  const [platform, setPlatform] = useState<Platform>("html");
  return (
    <div className="space-y-5">
      <CopyField value={snippet} label={t("dash.install.snippetLabel")} multiline />
      <div>
        <p className="mb-2 text-sm font-medium">{t("dash.install.where")}</p>
        <Segmented
          value={platform}
          onChange={setPlatform}
          label={t("dash.install.where")}
          options={PLATFORMS.map((p) => ({ value: p, label: t(`dash.install.p.${p}` as MessageKey) }))}
        />
        <ol className="mt-4 space-y-2.5 text-sm" aria-live="polite">
          {STEPS[platform].map((key, i) => (
            <li key={key} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary">{i + 1}</span>
              <span className="pt-0.5">{t(key)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export interface SettingsFormSite {
  id: number;
  name: string;
  domain: string;
  extraDomains: string[];
  captureForms: boolean;
  captureKind: EventKind;
  anonymize: Anonymize;
  language: string;
  dir: "ltr" | "rtl";
  notifyEmail: boolean;
  webhookUrl: string;
  autoApproveTestimonials: boolean;
  collectTitle: string;
  collectText: string;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-5 border-t border-line pt-6 first-of-type:border-t-0 first-of-type:pt-0 md:grid-cols-[220px_1fr]">
      <legend className="sr-only">{title}</legend>
      <div aria-hidden>
        <p className="text-sm font-semibold">{title}</p>
        {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
      </div>
      <div className="min-w-0 space-y-5">{children}</div>
    </fieldset>
  );
}

export function SiteSettingsForm({
  site,
  languages,
  isPremium,
  defaultLanguage,
}: {
  site: SettingsFormSite;
  languages: Array<{ code: string; name: string; dir: "ltr" | "rtl" }>;
  isPremium: boolean;
  defaultLanguage: string;
}) {
  const t = useT();
  const router = useRouter();
  const [state, action] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await updateSiteSettingsAction(prev, formData);
    if (result.success) router.refresh();
    return result;
  }, initialFormState);
  const [dir, setDir] = useState(site.dir);
  const knownLanguage = !site.language || languages.some((l) => l.code === site.language);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="site_id" value={site.id} />

      <Section title={t("dash.settings.general")} description={t("dash.settings.generalText")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("dash.site.name")} htmlFor="set-name">
            <Input id="set-name" name="name" defaultValue={site.name} required maxLength={120} />
          </Field>
          <Field label={t("dash.site.domain")} htmlFor="set-domain" hint={t("dash.settings.domainHint")}>
            <Input id="set-domain" name="domain" defaultValue={site.domain} required maxLength={255} dir="ltr" spellCheck={false} />
          </Field>
        </div>
        <Field label={t("dash.settings.extraDomains")} htmlFor="set-extra" hint={t("dash.settings.extraDomainsHint")}>
          <Textarea
            id="set-extra"
            name="extra_domains"
            defaultValue={site.extraDomains.join("\n")}
            rows={3}
            className="min-h-20 font-mono text-[13px]"
            placeholder={"staging.example.com\nshop.example.net"}
            dir="ltr"
            spellCheck={false}
          />
        </Field>
      </Section>

      <Section title={t("dash.settings.privacy")} description={t("dash.settings.privacyText")}>
        <Field label={t("dash.settings.anonymize")} htmlFor="set-anon" hint={t("dash.settings.anonymizeHint")}>
          <Select id="set-anon" name="anonymize" defaultValue={site.anonymize}>
            <option value="none">{t("dash.anon.none")}</option>
            <option value="first_name">{t("dash.anon.first_name")}</option>
            <option value="initials">{t("dash.anon.initials")}</option>
          </Select>
        </Field>
      </Section>

      <Section title={t("dash.settings.capture")} description={t("dash.settings.captureText")}>
        <Switch name="capture_forms" defaultChecked={site.captureForms} label={t("dash.settings.captureForms")} description={t("dash.settings.captureFormsHint")} />
        <Field label={t("dash.settings.captureKind")} htmlFor="set-kind">
          <Select id="set-kind" name="capture_kind" defaultValue={site.captureKind} className="sm:max-w-xs">
            {(["signup", "purchase", "review", "custom"] as const).map((k) => (
              <option key={k} value={k}>
                {t(`dash.kind.${k}` as MessageKey)}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section title={t("dash.settings.language")} description={t("dash.settings.languageText")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("dash.settings.widgetLanguage")} htmlFor="set-lang">
            <Select
              id="set-lang"
              name="language"
              defaultValue={site.language}
              onChange={(e) => {
                const lang = languages.find((l) => l.code === e.target.value);
                if (lang) setDir(lang.dir);
              }}
            >
              <option value="">{t("dash.settings.platformDefault", { language: defaultLanguage })}</option>
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name} ({l.code})
                </option>
              ))}
              {!knownLanguage ? <option value={site.language}>{site.language}</option> : null}
            </Select>
          </Field>
          <Field label={t("dash.settings.direction")} htmlFor="set-dir">
            <Select id="set-dir" name="dir" value={dir} onChange={(e) => setDir(e.target.value === "rtl" ? "rtl" : "ltr")}>
              <option value="ltr">{t("dash.settings.ltr")}</option>
              <option value="rtl">{t("dash.settings.rtl")}</option>
            </Select>
          </Field>
        </div>
      </Section>

      <Section title={t("dash.settings.notifications")} description={t("dash.settings.notificationsText")}>
        <Switch name="notify_email" defaultChecked={site.notifyEmail} label={t("dash.settings.notifyEmail")} description={t("dash.settings.notifyEmailHint")} />
        <div>
          <Label htmlFor="set-webhook" className="flex items-center gap-2">
            {t("dash.settings.webhookUrl")}
            {!isPremium ? <ProBadge /> : null}
          </Label>
          <Input
            id="set-webhook"
            name="webhook_url"
            type="url"
            defaultValue={site.webhookUrl}
            placeholder="https://hooks.zapier.com/…"
            maxLength={500}
            dir="ltr"
            disabled={!isPremium && !site.webhookUrl}
            aria-describedby="set-webhook-hint"
          />
          <Hint id="set-webhook-hint">{isPremium ? t("dash.settings.webhookUrlHint") : t("dash.settings.webhookUrlPro")}</Hint>
        </div>
      </Section>

      <Section title={t("dash.settings.testimonials")} description={t("dash.settings.testimonialsText")}>
        <Switch
          name="auto_approve"
          defaultChecked={site.autoApproveTestimonials}
          label={t("dash.settings.autoApprove")}
          description={t("dash.settings.autoApproveHint")}
        />
        <Field label={t("dash.settings.collectTitle")} htmlFor="set-ctitle">
          <Input id="set-ctitle" name="collect_title" defaultValue={site.collectTitle} maxLength={120} />
        </Field>
        <Field label={t("dash.settings.collectText")} htmlFor="set-ctext" hint={t("dash.settings.collectTextHint")}>
          <Textarea id="set-ctext" name="collect_text" defaultValue={site.collectText} maxLength={400} rows={3} className="min-h-20" />
        </Field>
      </Section>

      <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center justify-end gap-3 rounded-b-xl border-t border-line bg-surface/95 px-5 py-3 backdrop-blur">
        <div className="min-w-0 flex-1 basis-60">
          <FormMessage state={state} />
        </div>
        <SubmitButton pendingText={t("dash.saving")}>{t("dash.settings.save")}</SubmitButton>
      </div>
    </form>
  );
}

export function DeleteSiteForm({ siteId, domain }: { siteId: number; domain: string }) {
  const t = useT();
  const [state, action] = useActionState(deleteSiteAction, initialFormState);
  const [value, setValue] = useState("");
  const matches = value.trim().toLowerCase() === domain;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="site_id" value={siteId} />
      <FormMessage state={state} />
      <Field label={t("dash.delete.confirmLabel", { domain })} htmlFor="delete-confirm">
        <Input
          id="delete-confirm"
          name="confirm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          dir="ltr"
          className="sm:max-w-sm"
          placeholder={domain}
        />
      </Field>
      {matches ? (
        <SubmitButton variant="danger" pendingText={t("dash.delete.deleting")}>
          {t("dash.delete.submit")}
        </SubmitButton>
      ) : (
        <button type="button" disabled className="inline-flex h-10 items-center rounded-lg bg-red-600 px-4 text-sm font-medium text-white opacity-50">
          {t("dash.delete.submit")}
        </button>
      )}
    </form>
  );
}
