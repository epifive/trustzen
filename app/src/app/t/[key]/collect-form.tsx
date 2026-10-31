"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CircleCheck, ImagePlus, Star, X } from "lucide-react";
import { submitTestimonial, type TestimonialFormState, type TestimonialValues } from "@/app/actions/testimonial";
import { Alert } from "@/components/ui/alert";
import { Field, Hint, Input, Label, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/form";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const initialState: TestimonialFormState = {};
const MAX_PHOTO_BYTES = 1024 * 1024;
const MAX_TEXT = 1000;

function StarRating({ initial }: { initial: number }) {
  const t = useT();
  const [rating, setRating] = useState(initial);
  const [hover, setHover] = useState(0);
  const shown = hover || rating;
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium text-ink">{t("collect.rating")}</legend>
      <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((value) => (
          <span key={value} className="relative">
            <input
              type="radio"
              id={`rating-${value}`}
              name="rating"
              value={value}
              defaultChecked={value === initial}
              onChange={() => setRating(value)}
              className="peer sr-only"
            />
            <label
              htmlFor={`rating-${value}`}
              onMouseEnter={() => setHover(value)}
              className="block cursor-pointer rounded-md p-0.5 transition-transform peer-focus-visible:ring-2 peer-focus-visible:ring-primary hover:scale-110"
            >
              <Star
                aria-hidden
                className={cn("size-8 transition-colors", value <= shown ? "fill-amber-400 text-amber-400" : "fill-transparent text-line")}
                strokeWidth={1.5}
              />
              <span className="sr-only">{value === 1 ? t("collect.starOne") : t("collect.stars", { count: value })}</span>
            </label>
          </span>
        ))}
      </div>
    </fieldset>
  );
}

function PhotoInput() {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);
    if (!file) return setPreview(null);
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError(t("collect.err.photoType"));
      e.target.value = "";
      return setPreview(null);
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError(t("collect.err.photoSize"));
      e.target.value = "";
      return setPreview(null);
    }
    setPreview(URL.createObjectURL(file));
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    setPreview(null);
    setError(null);
  }

  return (
    <div>
      <Label htmlFor="photo">{t("collect.photo")}</Label>
      <div className="flex items-center gap-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img src={preview} alt="" className="size-12 rounded-full object-cover ring-1 ring-line" />
        ) : (
          <span className="grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
            <ImagePlus className="size-5" aria-hidden />
          </span>
        )}
        <label
          htmlFor="photo"
          className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors hover:border-primary-line hover:text-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary"
        >
          {t("collect.photoChoose")}
          <input
            ref={inputRef}
            id="photo"
            name="photo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onChange}
            className="sr-only"
          />
        </label>
        {preview ? (
          <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
            <X className="size-4" aria-hidden />
            {t("collect.photoRemove")}
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : (
        <Hint>{t("collect.photoHint")}</Hint>
      )}
    </div>
  );
}

/** The fields; re-mounted with the submitted values after an error (React resets forms after an action). */
function Fields({ values, consent }: { values?: TestimonialValues; consent: string }) {
  const t = useT();
  const [length, setLength] = useState(values?.body.length ?? 0);
  return (
    <>
      <StarRating initial={values?.rating ?? 5} />

      <div>
        <Label htmlFor="body">{t("collect.text")}</Label>
        <Textarea
          id="body"
          name="body"
          required
          minLength={20}
          maxLength={MAX_TEXT}
          rows={5}
          defaultValue={values?.body}
          placeholder={t("collect.textPlaceholder")}
          onChange={(e) => setLength(e.target.value.length)}
          aria-describedby="body-count"
        />
        <p id="body-count" className="mt-1.5 text-end text-xs text-muted tabular-nums" aria-live="polite">
          {t("collect.charCount", { count: length, max: MAX_TEXT })}
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("collect.name")} htmlFor="name">
          <Input id="name" name="name" required minLength={2} maxLength={120} autoComplete="name" defaultValue={values?.name} />
        </Field>
        <Field label={t("collect.title")} htmlFor="title" hint={t("collect.titleHint")}>
          <Input id="title" name="title" maxLength={160} autoComplete="organization-title" defaultValue={values?.title} />
        </Field>
      </div>

      <Field label={t("collect.email")} htmlFor="email" hint={t("collect.emailHint")}>
        <Input id="email" name="email" type="email" maxLength={190} autoComplete="email" defaultValue={values?.email} />
      </Field>

      <PhotoInput />

      <div aria-hidden className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="space-y-3 pt-1">
        <SubmitButton size="lg" className="w-full" pendingText={t("collect.sending")}>
          {t("collect.submit")}
        </SubmitButton>
        <p className="text-center text-xs leading-relaxed text-muted">{consent}</p>
      </div>
    </>
  );
}

export function CollectForm({ siteKey, consent }: { siteKey: string; consent: string }) {
  const t = useT();
  const [state, action] = useActionState(submitTestimonial, initialState);

  if (state.status) {
    return (
      <div role="status" className="py-6 text-center">
        <CircleCheck className="mx-auto size-14 text-emerald-500" strokeWidth={1.5} aria-hidden />
        <h2 className="mt-4 text-2xl font-bold">{t("collect.thanksTitle")}</h2>
        <p className="mx-auto mt-2 max-w-sm text-muted">
          {state.status === "approved" ? t("collect.thanksApproved") : t("collect.thanksPending")}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="relative space-y-5">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <input type="hidden" name="key" value={siteKey} />
      <Fields key={state.values ? JSON.stringify(state.values) : "new"} values={state.values} consent={consent} />
    </form>
  );
}
