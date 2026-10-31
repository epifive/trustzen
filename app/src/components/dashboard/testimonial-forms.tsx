"use client";

import { useActionState, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addTestimonialAction } from "@/app/actions/dashboard/testimonials";
import { initialFormState, type FormState } from "@/app/actions/types";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { useT } from "@/lib/i18n/client";
import { CopyField } from "./copy";

export function AddTestimonialForm({ siteId }: { siteId: number }) {
  const t = useT();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await addTestimonialAction(prev, formData);
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
        <Field label={t("dash.testimonials.name")} htmlFor="tm-name">
          <Input id="tm-name" name="name" required maxLength={120} autoComplete="off" />
        </Field>
        <Field label={t("dash.testimonials.titleField")} htmlFor="tm-title" hint={t("dash.testimonials.titleHint")}>
          <Input id="tm-title" name="title" maxLength={120} autoComplete="off" />
        </Field>
        <Field label={t("dash.testimonials.email")} htmlFor="tm-email" hint={t("dash.testimonials.emailHint")}>
          <Input id="tm-email" name="email" type="email" maxLength={190} autoComplete="off" dir="ltr" />
        </Field>
        <Field label={t("dash.testimonials.rating")} htmlFor="tm-rating">
          <Select id="tm-rating" name="rating" defaultValue="5">
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {t("dash.stars", { count: r })}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t("dash.testimonials.avatar")} htmlFor="tm-avatar" hint={t("dash.testimonials.avatarHint")}>
        <Input id="tm-avatar" name="avatar" type="url" maxLength={500} placeholder="https://" dir="ltr" autoComplete="off" />
      </Field>
      <Field label={t("dash.testimonials.body")} htmlFor="tm-body">
        <Textarea id="tm-body" name="body" required minLength={3} maxLength={2000} rows={4} />
      </Field>
      <SubmitButton pendingText={t("dash.saving")}>{t("dash.testimonials.add")}</SubmitButton>
    </form>
  );
}

/** Builds the iframe code for the testimonial wall. */
export function WallEmbed({ wallUrl, origin }: { wallUrl: string; origin: string }) {
  const t = useT();
  const id = useId();
  const [theme, setTheme] = useState<"light" | "dark" | "auto">("light");
  const [limit, setLimit] = useState(12);
  const src = `${wallUrl}?theme=${theme}&limit=${limit}`;
  const iframe = `<iframe id="trustzen-wall" src="${src}" title="Testimonials" loading="lazy" style="width:100%;min-height:420px;border:0;"></iframe>`;
  const resize = `<script>
window.addEventListener("message", function (e) {
  if (e.origin !== "${origin}" || !e.data || e.data.source !== "trustzen-wall") return;
  document.getElementById("trustzen-wall").style.height = e.data.height + "px";
});
</script>`;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("dash.wall.theme")} htmlFor={`${id}-theme`}>
          <Select id={`${id}-theme`} value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)}>
            <option value="light">{t("dash.wall.light")}</option>
            <option value="dark">{t("dash.wall.dark")}</option>
            <option value="auto">{t("dash.wall.auto")}</option>
          </Select>
        </Field>
        <Field label={t("dash.wall.limit")} htmlFor={`${id}-limit`}>
          <Select id={`${id}-limit`} value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {[6, 9, 12, 24, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium">{t("dash.wall.iframe")}</p>
        <CopyField value={iframe} label={t("dash.wall.iframe")} multiline />
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium">{t("dash.wall.resize")}</p>
        <p className="mb-2 text-xs text-muted">{t("dash.wall.resizeText")}</p>
        <CopyField value={resize} label={t("dash.wall.resize")} multiline />
      </div>
      <a href={src} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-medium text-primary hover:underline">
        {t("dash.wall.preview")}
      </a>
    </div>
  );
}
