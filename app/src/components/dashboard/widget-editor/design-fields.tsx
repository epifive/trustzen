"use client";

import { useRef, type KeyboardEvent } from "react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { WidgetDesign, WidgetPosition, WidgetType } from "@/widget/types";
import { ChoiceField, ColorField, RangeField, Row, Section, ToggleField } from "./controls";

type Patch = Partial<WidgetDesign>;

const POSITIONS: Array<{ value: WidgetPosition; box: string }> = [
  { value: "top-bar", box: "inset-x-2 top-2 h-5" },
  { value: "top-left", box: "left-2 top-9 h-9 w-[30%]" },
  { value: "top-right", box: "right-2 top-9 h-9 w-[30%]" },
  { value: "center", box: "left-1/2 top-1/2 h-11 w-[34%] -translate-x-1/2 -translate-y-1/2" },
  { value: "bottom-left", box: "left-2 bottom-9 h-9 w-[30%]" },
  { value: "bottom-right", box: "right-2 bottom-9 h-9 w-[30%]" },
  { value: "bottom-bar", box: "inset-x-2 bottom-2 h-5" },
];

/** Visual chooser: a page outline with the seven places a widget can appear. */
function PositionPicker({ value, onChange }: { value: WidgetPosition; onChange: (value: WidgetPosition) => void }) {
  const t = useT();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const label = (p: WidgetPosition) => t(`editor.pos.${p}`);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + POSITIONS.length) % POSITIONS.length;
    onChange(POSITIONS[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div>
      <span id="tz-pos-label" className="mb-1.5 block text-sm font-medium text-ink">
        {t("editor.f.position")}
      </span>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          role="radiogroup"
          aria-labelledby="tz-pos-label"
          dir="ltr"
          className="relative aspect-[16/10] w-full max-w-xs shrink-0 overflow-hidden rounded-xl border border-line bg-paper"
        >
          <div aria-hidden className="absolute inset-x-[22%] top-[38%] space-y-1.5 opacity-60">
            <span className="block h-1 rounded-full bg-line" />
            <span className="block h-1 w-4/5 rounded-full bg-line" />
          </div>
          {POSITIONS.map((p, i) => {
            const on = p.value === value;
            return (
              <button
                key={p.value}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={label(p.value)}
                title={label(p.value)}
                tabIndex={on ? 0 : -1}
                onClick={() => onChange(p.value)}
                onKeyDown={(e) => onKey(e, i)}
                className={cn(
                  "absolute rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  p.box,
                  on
                    ? "border-primary bg-primary shadow-md shadow-primary/30"
                    : "border-dashed border-muted/40 bg-surface/70 hover:border-primary hover:bg-primary-soft",
                )}
              />
            );
          })}
        </div>
        <div className="min-w-0 text-sm">
          <p className="font-medium text-ink">{label(value)}</p>
          <p className="mt-0.5 text-xs text-muted">{value.endsWith("bar") ? t("editor.hint.posBar") : value === "center" ? t("editor.hint.posCenter") : t("editor.hint.posCorner")}</p>
        </div>
      </div>
    </div>
  );
}

export function DesignFields({ type, design, onChange }: { type: WidgetType; design: WidgetDesign; onChange: (patch: Patch) => void }) {
  const t = useT();
  const dark = design.theme === "dark";
  const isBar = design.position === "top-bar" || design.position === "bottom-bar";
  const px = (v: number) => t("editor.unit.px", { value: v });
  return (
    <>
      <Section title={t("editor.sec.placement")}>
        <PositionPicker value={design.position} onChange={(v) => onChange({ position: v })} />
        {!isBar ? (
          <RangeField label={t("editor.f.width")} value={design.width} onChange={(v) => onChange({ width: v })} min={240} max={480} step={10} format={px} hint={t("editor.hint.width")} />
        ) : null}
      </Section>

      <Section title={t("editor.sec.colors")}>
        <ChoiceField
          label={t("editor.f.theme")}
          value={design.theme}
          onChange={(v) => onChange({ theme: v })}
          options={[
            { value: "light", label: t("editor.theme.light") },
            { value: "dark", label: t("editor.theme.dark") },
            { value: "auto", label: t("editor.theme.auto") },
          ]}
          hint={design.theme === "auto" ? t("editor.hint.themeAuto") : undefined}
        />
        <div className="grid gap-5 sm:grid-cols-3">
          <ColorField label={t("editor.f.accent")} value={design.accent} onChange={(v) => onChange({ accent: v })} fallback="#5b3fc4" />
          <ColorField label={t("editor.f.background")} value={design.background} onChange={(v) => onChange({ background: v })} fallback={dark ? "#18171f" : "#ffffff"} />
          <ColorField label={t("editor.f.textColor")} value={design.text} onChange={(v) => onChange({ text: v })} fallback={dark ? "#f3f2f8" : "#16151d"} />
        </div>
        <p className="-mt-2 text-xs text-muted">{t("editor.hint.colors")}</p>
      </Section>

      <Section title={t("editor.sec.style")}>
        <RangeField label={t("editor.f.radius")} value={design.radius} onChange={(v) => onChange({ radius: v })} min={0} max={32} format={px} />
        <Row>
          <ChoiceField
            label={t("editor.f.animation")}
            value={design.animation}
            onChange={(v) => onChange({ animation: v })}
            options={[
              { value: "slide", label: t("editor.anim.slide") },
              { value: "fade", label: t("editor.anim.fade") },
              { value: "none", label: t("editor.anim.none") },
            ]}
          />
          <ChoiceField
            label={t("editor.f.font")}
            value={design.font}
            onChange={(v) => onChange({ font: v })}
            options={[
              { value: "inherit", label: t("editor.font.inherit") },
              { value: "system", label: t("editor.font.system") },
            ]}
          />
        </Row>
        <div className="space-y-4 rounded-lg border border-line bg-paper/60 p-4">
          <ToggleField label={t("editor.f.shadow")} checked={design.shadow} onChange={(v) => onChange({ shadow: v })} />
          <ToggleField label={t("editor.f.showClose")} description={t("editor.hint.showClose")} checked={design.showClose} onChange={(v) => onChange({ showClose: v })} />
          {type !== "custom_html" && type !== "cookie_notice" ? (
            <ToggleField label={t("editor.f.showImage")} description={t("editor.hint.showImage")} checked={design.showImage} onChange={(v) => onChange({ showImage: v })} />
          ) : null}
        </div>
      </Section>
    </>
  );
}
