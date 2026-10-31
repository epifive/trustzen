"use client";

import { useState } from "react";
import { CircleUserRound, MessageSquareQuote, ShoppingBag, Sparkles, Star, UserPlus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { useT } from "@/lib/i18n/client";
import { EVENT_KINDS, type ContentByType, type EventKind, type WidgetContent, type WidgetType } from "@/widget/types";
import { AreaField, ChipsField, ChoiceField, DateTimeField, NumberField, RangeField, Row, Section, SelectField, TemplateField, TextField, ToggleField, UrlField } from "./controls";

type Patch = Record<string, unknown>;

const KIND_ICONS: Record<EventKind, typeof ShoppingBag> = { purchase: ShoppingBag, signup: UserPlus, review: Star, custom: Sparkles };

function useKindOptions() {
  const t = useT();
  return EVENT_KINDS.map((k) => {
    const Icon = KIND_ICONS[k];
    return { value: k, label: t(`editor.kind.${k}`), icon: <Icon aria-hidden /> };
  });
}

function RecentActivity({ c, set }: { c: ContentByType["recent_activity"]; set: (p: Patch) => void }) {
  const t = useT();
  const kinds = useKindOptions();
  return (
    <>
      <Section title={t("editor.sec.message")} description={t("editor.sec.messageActivity")}>
        <ChipsField
          label={t("editor.f.kinds")}
          values={c.kinds}
          onChange={(v) => set({ kinds: v })}
          options={kinds}
          hint={t("editor.hint.kinds")}
          error={c.kinds.length ? undefined : t("editor.warn.noKinds")}
        />
        <TemplateField
          label={t("editor.f.template")}
          value={c.template}
          onChange={(v) => set({ template: v })}
          maxLength={200}
          placeholders={[
            { token: "{name}", label: t("editor.ph.name") },
            { token: "{location}", label: t("editor.ph.location") },
            { token: "{city}", label: t("editor.ph.city") },
            { token: "{country}", label: t("editor.ph.country") },
            { token: "{product}", label: t("editor.ph.product") },
          ]}
          hint={t("editor.hint.templateActivity")}
        />
        <Row>
          <TextField label={t("editor.f.fallbackName")} value={c.fallbackName} onChange={(v) => set({ fallbackName: v })} maxLength={60} hint={t("editor.hint.fallbackName")} />
          <SelectField
            label={t("editor.f.anonymize")}
            value={c.anonymize}
            onChange={(v) => set({ anonymize: v })}
            options={[
              { value: "first_name", label: t("editor.anon.first_name") },
              { value: "initials", label: t("editor.anon.initials") },
              { value: "none", label: t("editor.anon.none") },
            ]}
            hint={t("editor.hint.anonymize")}
          />
        </Row>
        <UrlField label={t("editor.f.linkUrl")} value={c.linkUrl} onChange={(v) => set({ linkUrl: v })} hint={t("editor.hint.linkUrl")} />
      </Section>
      <Section title={t("editor.sec.data")}>
        <Row>
          <NumberField label={t("editor.f.maxAgeHours")} value={c.maxAgeHours} onChange={(v) => set({ maxAgeHours: v })} min={0} max={24 * 365} unit={t("editor.unit.hours")} hint={t("editor.hint.zeroNoLimit")} />
          <NumberField label={t("editor.f.limit")} value={c.limit} onChange={(v) => set({ limit: v })} min={1} max={30} unit={t("editor.unit.events")} hint={t("editor.hint.limit")} />
        </Row>
        <ToggleField label={t("editor.f.showTime")} description={t("editor.hint.showTime")} checked={c.showTime} onChange={(v) => set({ showTime: v })} />
        <ToggleField label={t("editor.f.shuffle")} description={t("editor.hint.shuffle")} checked={c.shuffle} onChange={(v) => set({ shuffle: v })} />
      </Section>
    </>
  );
}

function LiveVisitors({ c, set }: { c: ContentByType["live_visitors"]; set: (p: Patch) => void }) {
  const t = useT();
  return (
    <Section title={t("editor.sec.message")}>
      <TemplateField
        label={t("editor.f.template")}
        value={c.template}
        onChange={(v) => set({ template: v })}
        maxLength={200}
        placeholders={[{ token: "{count}", label: t("editor.ph.visitors") }]}
      />
      <ChoiceField
        label={t("editor.f.scope")}
        value={c.scope}
        onChange={(v) => set({ scope: v })}
        options={[
          { value: "page", label: t("editor.scope.page") },
          { value: "site", label: t("editor.scope.site") },
        ]}
        hint={t("editor.hint.scope")}
      />
      <NumberField label={t("editor.f.minVisitors")} value={c.minCount} onChange={(v) => set({ minCount: v })} min={1} max={100000} unit={t("editor.unit.people")} hint={t("editor.hint.minVisitors")} />
    </Section>
  );
}

function ConversionCounter({ c, set }: { c: ContentByType["conversion_counter"]; set: (p: Patch) => void }) {
  const t = useT();
  const kinds = useKindOptions();
  return (
    <Section title={t("editor.sec.message")}>
      <TemplateField
        label={t("editor.f.template")}
        value={c.template}
        onChange={(v) => set({ template: v })}
        maxLength={200}
        placeholders={[
          { token: "{count}", label: t("editor.ph.count") },
          { token: "{hours}", label: t("editor.ph.hours") },
        ]}
      />
      <ChipsField
        label={t("editor.f.countKinds")}
        values={c.kinds}
        onChange={(v) => set({ kinds: v })}
        options={kinds}
        error={c.kinds.length ? undefined : t("editor.warn.noKinds")}
      />
      <Row>
        <NumberField label={t("editor.f.periodHours")} value={c.periodHours} onChange={(v) => set({ periodHours: v })} min={1} max={24 * 90} unit={t("editor.unit.hours")} hint={t("editor.hint.periodHours")} />
        <NumberField label={t("editor.f.minCount")} value={c.minCount} onChange={(v) => set({ minCount: v })} min={1} max={1000000} hint={t("editor.hint.minCount")} />
      </Row>
    </Section>
  );
}

function Review({ c, set }: { c: ContentByType["review"]; set: (p: Patch) => void }) {
  const t = useT();
  return (
    <Section title={t("editor.sec.reviews")}>
      <ChoiceField
        label={t("editor.f.source")}
        value={c.source}
        onChange={(v) => set({ source: v })}
        options={[
          {
            value: "testimonials",
            label: (
              <span className="inline-flex items-center gap-1.5">
                <MessageSquareQuote className="size-4" aria-hidden />
                {t("editor.source.testimonials")}
              </span>
            ),
          },
          {
            value: "events",
            label: (
              <span className="inline-flex items-center gap-1.5">
                <CircleUserRound className="size-4" aria-hidden />
                {t("editor.source.events")}
              </span>
            ),
          },
        ]}
        hint={c.source === "testimonials" ? t("editor.hint.sourceTestimonials") : t("editor.hint.sourceEvents")}
      />
      <ChoiceField
        label={t("editor.f.minRating")}
        value={String(c.minRating) as "1" | "2" | "3" | "4" | "5"}
        onChange={(v) => set({ minRating: Number(v) })}
        options={(["1", "2", "3", "4", "5"] as const).map((n) => ({
          value: n,
          label: (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
              <span aria-hidden>
                {n}
                {n === "5" ? "" : "+"}
              </span>
              <span className="sr-only">{t("editor.stars", { count: n })}</span>
            </span>
          ),
        }))}
      />
      <Row>
        <NumberField label={t("editor.f.reviewLimit")} value={c.limit} onChange={(v) => set({ limit: v })} min={1} max={30} unit={t("editor.unit.reviews")} />
        <div className="sm:pt-7">
          <ToggleField label={t("editor.f.shuffle")} checked={c.shuffle} onChange={(v) => set({ shuffle: v })} />
        </div>
      </Row>
      <RangeField
        label={t("editor.f.maxLength")}
        value={c.maxLength}
        onChange={(v) => set({ maxLength: v })}
        min={60}
        max={400}
        step={10}
        format={(v) => t("editor.unit.charsN", { count: v })}
        hint={t("editor.hint.maxLength")}
      />
    </Section>
  );
}

function Announcement({ c, set }: { c: ContentByType["announcement"]; set: (p: Patch) => void }) {
  const t = useT();
  return (
    <>
      <Section title={t("editor.sec.message")}>
        <TextField label={t("editor.f.badge")} value={c.badge} onChange={(v) => set({ badge: v })} maxLength={20} placeholder={t("editor.ph.badgeExample")} hint={t("editor.hint.badge")} />
        <AreaField label={t("editor.f.text")} value={c.text} onChange={(v) => set({ text: v })} maxLength={300} rows={2} />
      </Section>
      <Section title={t("editor.sec.button")} description={t("editor.hint.buttonOptional")}>
        <Row>
          <TextField label={t("editor.f.buttonText")} value={c.buttonText} onChange={(v) => set({ buttonText: v })} maxLength={40} />
          <UrlField label={t("editor.f.buttonUrl")} value={c.buttonUrl} onChange={(v) => set({ buttonUrl: v })} />
        </Row>
      </Section>
    </>
  );
}

function Coupon({ c, set }: { c: ContentByType["coupon"]; set: (p: Patch) => void }) {
  const t = useT();
  return (
    <>
      <Section title={t("editor.sec.message")}>
        <TextField label={t("editor.f.title")} value={c.title} onChange={(v) => set({ title: v })} maxLength={120} />
        <AreaField label={t("editor.f.text")} value={c.text} onChange={(v) => set({ text: v })} maxLength={300} rows={2} />
      </Section>
      <Section title={t("editor.sec.coupon")}>
        <TextField label={t("editor.f.code")} value={c.code} onChange={(v) => set({ code: v })} maxLength={40} mono ltr hint={t("editor.hint.code")} />
        <Row>
          <TextField label={t("editor.f.copyButton")} value={c.buttonText} onChange={(v) => set({ buttonText: v })} maxLength={40} />
          <TextField label={t("editor.f.copiedText")} value={c.copiedText} onChange={(v) => set({ copiedText: v })} maxLength={40} hint={t("editor.hint.copiedText")} />
        </Row>
      </Section>
    </>
  );
}

function Countdown({ c, set }: { c: ContentByType["countdown"]; set: (p: Patch) => void }) {
  const t = useT();
  const [openedAt] = useState(Date.now);
  const past = c.mode === "fixed" && c.endAt !== "" && Date.parse(c.endAt) < openedAt;
  return (
    <>
      <Section title={t("editor.sec.timer")}>
        <TextField label={t("editor.f.text")} value={c.text} onChange={(v) => set({ text: v })} maxLength={200} hint={t("editor.hint.countdownText")} />
        <ChoiceField
          label={t("editor.f.countdownMode")}
          value={c.mode}
          onChange={(v) => set({ mode: v })}
          options={[
            { value: "evergreen", label: t("editor.mode.evergreen") },
            { value: "fixed", label: t("editor.mode.fixed") },
          ]}
          hint={c.mode === "evergreen" ? t("editor.hint.evergreen") : t("editor.hint.fixed")}
        />
        {c.mode === "fixed" ? (
          <>
            <DateTimeField label={t("editor.f.endAt")} value={c.endAt} onChange={(v) => set({ endAt: v })} hint={t("editor.hint.localTime")} />
            {!c.endAt ? <Alert tone="warning">{t("editor.warn.noEndDate")}</Alert> : past ? <Alert tone="warning">{t("editor.warn.pastEndDate")}</Alert> : null}
          </>
        ) : (
          <NumberField label={t("editor.f.evergreenMinutes")} value={c.evergreenMinutes} onChange={(v) => set({ evergreenMinutes: v })} min={1} max={60 * 24 * 30} unit={t("editor.unit.minutes")} />
        )}
        <ChoiceField
          label={t("editor.f.onExpire")}
          value={c.onExpire}
          onChange={(v) => set({ onExpire: v })}
          options={[
            { value: "hide", label: t("editor.expire.hide") },
            { value: "message", label: t("editor.expire.message") },
          ]}
        />
        {c.onExpire === "message" ? <TextField label={t("editor.f.expiredText")} value={c.expiredText} onChange={(v) => set({ expiredText: v })} maxLength={200} /> : null}
      </Section>
      <Section title={t("editor.sec.button")} description={t("editor.hint.buttonOptional")}>
        <Row>
          <TextField label={t("editor.f.buttonText")} value={c.buttonText} onChange={(v) => set({ buttonText: v })} maxLength={40} />
          <UrlField label={t("editor.f.buttonUrl")} value={c.buttonUrl} onChange={(v) => set({ buttonUrl: v })} />
        </Row>
      </Section>
    </>
  );
}

function EmailCollector({ c, set }: { c: ContentByType["email_collector"]; set: (p: Patch) => void }) {
  const t = useT();
  return (
    <>
      <Section title={t("editor.sec.message")}>
        <TextField label={t("editor.f.title")} value={c.title} onChange={(v) => set({ title: v })} maxLength={120} />
        <AreaField label={t("editor.f.text")} value={c.text} onChange={(v) => set({ text: v })} maxLength={300} rows={2} />
      </Section>
      <Section title={t("editor.sec.form")} description={t("editor.hint.leads")}>
        <ToggleField label={t("editor.f.collectName")} description={t("editor.hint.collectName")} checked={c.collectName} onChange={(v) => set({ collectName: v })} />
        <Row>
          {c.collectName ? <TextField label={t("editor.f.namePlaceholder")} value={c.namePlaceholder} onChange={(v) => set({ namePlaceholder: v })} maxLength={60} /> : null}
          <TextField label={t("editor.f.emailPlaceholder")} value={c.emailPlaceholder} onChange={(v) => set({ emailPlaceholder: v })} maxLength={60} />
          <TextField label={t("editor.f.buttonText")} value={c.buttonText} onChange={(v) => set({ buttonText: v })} maxLength={40} />
        </Row>
        <AreaField label={t("editor.f.successText")} value={c.successText} onChange={(v) => set({ successText: v })} maxLength={200} rows={2} />
        <AreaField label={t("editor.f.consentText")} value={c.consentText} onChange={(v) => set({ consentText: v })} maxLength={300} rows={2} hint={t("editor.hint.consentText")} />
      </Section>
    </>
  );
}

function CookieNotice({ c, set }: { c: ContentByType["cookie_notice"]; set: (p: Patch) => void }) {
  const t = useT();
  return (
    <Section title={t("editor.sec.message")}>
      <AreaField label={t("editor.f.text")} value={c.text} onChange={(v) => set({ text: v })} maxLength={400} rows={3} />
      <TextField label={t("editor.f.acceptButton")} value={c.buttonText} onChange={(v) => set({ buttonText: v })} maxLength={40} />
      <Row>
        <TextField label={t("editor.f.policyText")} value={c.policyText} onChange={(v) => set({ policyText: v })} maxLength={60} />
        <UrlField label={t("editor.f.policyUrl")} value={c.policyUrl} onChange={(v) => set({ policyUrl: v })} placeholder="/privacy" />
      </Row>
    </Section>
  );
}

function CustomHtml({ c, set }: { c: ContentByType["custom_html"]; set: (p: Patch) => void }) {
  const t = useT();
  return (
    <Section title={t("editor.sec.html")}>
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <label htmlFor="tz-custom-html" className="text-sm font-medium text-ink">
            {t("editor.f.html")}
          </label>
          <span className="text-[11px] text-muted tabular-nums">{c.html.length}/5000</span>
        </div>
        <textarea
          id="tz-custom-html"
          dir="ltr"
          rows={10}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          maxLength={5000}
          value={c.html}
          onChange={(e) => set({ html: e.target.value })}
          aria-describedby="tz-custom-html-note"
          className="w-full resize-y rounded-lg border border-line bg-paper px-3 py-2.5 text-start font-mono text-[13px] leading-relaxed text-ink focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
        />
      </div>
      <Alert tone="info">
        <span id="tz-custom-html-note">{t("editor.hint.html")}</span>
      </Alert>
    </Section>
  );
}

/** Content tab: fields depend on the widget type. */
export function ContentFields({ type, content, onChange }: { type: WidgetType; content: WidgetContent; onChange: (patch: Patch) => void }) {
  switch (type) {
    case "recent_activity":
      return <RecentActivity c={content as ContentByType["recent_activity"]} set={onChange} />;
    case "live_visitors":
      return <LiveVisitors c={content as ContentByType["live_visitors"]} set={onChange} />;
    case "conversion_counter":
      return <ConversionCounter c={content as ContentByType["conversion_counter"]} set={onChange} />;
    case "review":
      return <Review c={content as ContentByType["review"]} set={onChange} />;
    case "announcement":
      return <Announcement c={content as ContentByType["announcement"]} set={onChange} />;
    case "coupon":
      return <Coupon c={content as ContentByType["coupon"]} set={onChange} />;
    case "countdown":
      return <Countdown c={content as ContentByType["countdown"]} set={onChange} />;
    case "email_collector":
      return <EmailCollector c={content as ContentByType["email_collector"]} set={onChange} />;
    case "cookie_notice":
      return <CookieNotice c={content as ContentByType["cookie_notice"]} set={onChange} />;
    case "custom_html":
      return <CustomHtml c={content as ContentByType["custom_html"]} set={onChange} />;
  }
}
