"use client";

import { useId } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { Hint, Label, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { useT } from "@/lib/i18n/client";
import { ROTATING_TYPES, type WidgetRules, type WidgetType } from "@/widget/types";
import { ChipsField, ChoiceField, DateTimeField, NumberField, RangeField, Row, Section, SelectField } from "./controls";

type Patch = Partial<WidgetRules>;

export function RulesFields({ type, rules, onChange }: { type: WidgetType; rules: WidgetRules; onChange: (patch: Patch) => void }) {
  const t = useT();
  const pagesId = useId();
  const rotating = ROTATING_TYPES.includes(type);
  const sec = t("editor.unit.seconds");
  const scheduleBroken = rules.startAt !== "" && rules.endAt !== "" && rules.endAt <= rules.startAt;

  return (
    <>
      <Section title={t("editor.sec.where")}>
        <ChoiceField
          label={t("editor.f.pagesMode")}
          value={rules.pagesMode}
          onChange={(v) => onChange({ pagesMode: v })}
          options={[
            { value: "all", label: t("editor.pages.all") },
            { value: "include", label: t("editor.pages.include") },
            { value: "exclude", label: t("editor.pages.exclude") },
          ]}
        />
        {rules.pagesMode !== "all" ? (
          <div>
            <Label htmlFor={pagesId}>{rules.pagesMode === "include" ? t("editor.f.pagesInclude") : t("editor.f.pagesExclude")}</Label>
            <Textarea
              id={pagesId}
              dir="ltr"
              rows={4}
              spellCheck={false}
              placeholder={"/pricing\n/blog/*\n/products/*/reviews"}
              value={rules.pages.join("\n")}
              onChange={(e) => onChange({ pages: e.target.value.split("\n").slice(0, 50) })}
              aria-describedby={`${pagesId}-hint`}
              className="min-h-0 resize-y text-start font-mono text-[13px]"
            />
            <Hint id={`${pagesId}-hint`}>
              {t("editor.hint.pages")}{" "}
              <code className="rounded bg-paper px-1 font-mono ring-1 ring-line" dir="ltr">
                /blog/*
              </code>
            </Hint>
          </div>
        ) : null}
        <ChipsField
          label={t("editor.f.devices")}
          values={rules.devices}
          onChange={(v) => onChange({ devices: v })}
          options={[
            { value: "desktop", label: t("editor.device.desktop"), icon: <Monitor aria-hidden /> },
            { value: "mobile", label: t("editor.device.mobile"), icon: <Smartphone aria-hidden /> },
          ]}
          error={rules.devices.length ? undefined : t("editor.warn.noDevices")}
        />
      </Section>

      <Section title={t("editor.sec.when")}>
        <SelectField
          label={t("editor.f.trigger")}
          value={rules.trigger}
          onChange={(v) => onChange({ trigger: v })}
          options={[
            { value: "load", label: t("editor.trigger.load") },
            { value: "delay", label: t("editor.trigger.delay") },
            { value: "scroll", label: t("editor.trigger.scroll") },
            { value: "exit", label: t("editor.trigger.exit") },
          ]}
          hint={rules.trigger === "exit" ? t("editor.hint.exit") : undefined}
        />
        {rules.trigger === "delay" || rules.trigger === "exit" ? (
          <NumberField label={t("editor.f.delaySec")} value={rules.delaySec} onChange={(v) => onChange({ delaySec: v })} min={0} max={600} unit={sec} />
        ) : null}
        {rules.trigger === "scroll" ? (
          <RangeField
            label={t("editor.f.scrollPercent")}
            value={rules.scrollPercent}
            onChange={(v) => onChange({ scrollPercent: v })}
            min={1}
            max={100}
            format={(v) => `${v}%`}
          />
        ) : null}
        <Row>
          <NumberField label={t("editor.f.displaySec")} value={rules.displaySec} onChange={(v) => onChange({ displaySec: v })} min={0} max={600} unit={sec} hint={t("editor.hint.displaySec")} />
          {rotating ? (
            <NumberField label={t("editor.f.gapSec")} value={rules.gapSec} onChange={(v) => onChange({ gapSec: v })} min={0} max={600} unit={sec} hint={t("editor.hint.gapSec")} />
          ) : null}
          {rotating ? (
            <NumberField label={t("editor.f.maxPerPage")} value={rules.maxPerPage} onChange={(v) => onChange({ maxPerPage: v })} min={1} max={50} hint={t("editor.hint.maxPerPage")} />
          ) : null}
          <SelectField
            label={t("editor.f.afterClose")}
            value={rules.afterClose}
            onChange={(v) => onChange({ afterClose: v })}
            options={[
              { value: "always", label: t("editor.after.always") },
              { value: "session", label: t("editor.after.session") },
              { value: "day", label: t("editor.after.day") },
              { value: "never", label: t("editor.after.never") },
            ]}
            hint={t("editor.hint.afterClose")}
          />
        </Row>
      </Section>

      <Section title={t("editor.sec.schedule")} description={t("editor.hint.schedule")}>
        <Row>
          <DateTimeField label={t("editor.f.startAt")} value={rules.startAt} onChange={(v) => onChange({ startAt: v })} />
          <DateTimeField label={t("editor.f.endAtSchedule")} value={rules.endAt} onChange={(v) => onChange({ endAt: v })} />
        </Row>
        {scheduleBroken ? <Alert tone="warning">{t("editor.warn.schedule")}</Alert> : null}
      </Section>
    </>
  );
}
