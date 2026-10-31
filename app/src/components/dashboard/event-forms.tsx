"use client";

import { useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { addEventAction, importEventsAction } from "@/app/actions/dashboard/events";
import { initialFormState, type FormState } from "@/app/actions/types";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import { EVENT_KINDS } from "@/widget/types";

const TEMPLATE =
  "kind,name,city,country,product,url,image,rating,message,created_at\r\n" +
  "purchase,Anna Schmidt,Berlin,Germany,Pro plan,https://example.com/pro,,,,2026-10-16T10:00:00Z\r\n" +
  "signup,Liam,Toronto,Canada,,,,,,\r\n" +
  'review,Sofia R.,Madrid,Spain,Starter kit,,,5,"Fast delivery, great support!",\r\n';

export function AddEventForm({ siteId }: { siteId: number }) {
  const t = useT();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(async (prev: FormState, formData: FormData) => {
    // The browser's timezone, so the server reads the datetime-local value correctly.
    formData.set("tz_offset", String(new Date().getTimezoneOffset()));
    const result = await addEventAction(prev, formData);
    if (result.success) {
      formRef.current?.reset();
      router.refresh();
    }
    return result;
  }, initialFormState);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="site_id" value={siteId} />
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("dash.events.kind")} htmlFor="ev-kind">
          <Select id="ev-kind" name="kind" defaultValue="purchase">
            {EVENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`dash.kind.${k}` as MessageKey)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("dash.events.name")} htmlFor="ev-name">
          <Input id="ev-name" name="name" maxLength={120} placeholder="Anna Schmidt" autoComplete="off" />
        </Field>
        <Field label={t("dash.events.city")} htmlFor="ev-city">
          <Input id="ev-city" name="city" maxLength={120} placeholder="Berlin" autoComplete="off" />
        </Field>
        <Field label={t("dash.events.country")} htmlFor="ev-country">
          <Input id="ev-country" name="country" maxLength={120} placeholder="Germany" autoComplete="off" />
        </Field>
        <Field label={t("dash.events.product")} htmlFor="ev-product">
          <Input id="ev-product" name="product" maxLength={255} placeholder="Pro plan" autoComplete="off" />
        </Field>
        <Field label={t("dash.events.url")} htmlFor="ev-url" hint={t("dash.events.urlHint")}>
          <Input id="ev-url" name="url" maxLength={500} placeholder="https://" dir="ltr" autoComplete="off" />
        </Field>
        <Field label={t("dash.events.image")} htmlFor="ev-image">
          <Input id="ev-image" name="image" type="url" maxLength={500} placeholder="https://" dir="ltr" autoComplete="off" />
        </Field>
        <Field label={t("dash.events.rating")} htmlFor="ev-rating">
          <Select id="ev-rating" name="rating" defaultValue="">
            <option value="">{t("dash.events.noRating")}</option>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {t("dash.stars", { count: r })}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("dash.events.time")} htmlFor="ev-time" hint={t("dash.events.timeHint")}>
          <Input id="ev-time" name="created_at" type="datetime-local" />
        </Field>
      </div>
      <Field label={t("dash.events.message")} htmlFor="ev-message">
        <Textarea id="ev-message" name="message" maxLength={500} rows={2} className="min-h-16" />
      </Field>
      <SubmitButton pendingText={t("dash.saving")}>{t("dash.events.add")}</SubmitButton>
    </form>
  );
}

export function ImportEventsForm({ siteId }: { siteId: number }) {
  const t = useT();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await importEventsAction(prev, formData);
    if (result.success) {
      formRef.current?.reset();
      router.refresh();
    }
    return result;
  }, initialFormState);
  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="site_id" value={siteId} />
      <FormMessage state={state} />
      <p className="text-sm text-muted">{t("dash.import.text")}</p>
      <code dir="ltr" className="block overflow-x-auto rounded-lg border border-line bg-paper px-3 py-2 font-mono text-xs whitespace-nowrap">
        kind,name,city,country,product,url,image,rating,message,created_at
      </code>
      <ul className="list-disc space-y-1 ps-5 text-xs text-muted">
        <li>{t("dash.import.rule1")}</li>
        <li>{t("dash.import.rule2")}</li>
        <li>{t("dash.import.rule3")}</li>
      </ul>
      <a
        href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
        download="trustzen-events-template.csv"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <Download className="size-4" aria-hidden />
        {t("dash.import.template")}
      </a>
      <Field label={t("dash.import.file")} htmlFor="ev-file">
        <input
          id="ev-file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="block w-full rounded-lg border border-line bg-surface text-sm text-muted file:me-3 file:border-0 file:bg-primary-soft file:px-4 file:py-2.5 file:font-medium file:text-primary"
        />
      </Field>
      <SubmitButton pendingText={t("dash.import.importing")}>
        <Upload aria-hidden />
        {t("dash.import.submit")}
      </SubmitButton>
    </form>
  );
}
