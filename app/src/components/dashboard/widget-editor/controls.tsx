"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { RotateCcw, X } from "lucide-react";
import { Hint, Input, Label, Select, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { safeUrl } from "@/widget/normalize";

/** A titled group of fields inside a tab. */
export function Section({ title, description, children, className }: { title: string; description?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("border-t border-line px-5 py-6 first:border-t-0 sm:px-6", className)}>
      <h3 id={id} className="font-sans text-sm font-semibold tracking-normal text-ink">
        {title}
      </h3>
      {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

/** Two columns from `sm` up. */
export function Row({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2">{children}</div>;
}

function Counter({ value, max }: { value: string; max: number }) {
  if (value.length < max * 0.8) return null;
  return (
    <span className={cn("ms-auto text-[11px] tabular-nums", value.length >= max ? "text-red-600 dark:text-red-400" : "text-muted")}>
      {value.length}/{max}
    </span>
  );
}

export function TextField({
  label,
  hint,
  value,
  onChange,
  maxLength,
  placeholder,
  mono,
  ltr,
  error,
}: {
  label: string;
  hint?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  placeholder?: string;
  mono?: boolean;
  ltr?: boolean;
  error?: string;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Counter value={value} max={maxLength} />
      </div>
      <Input
        id={id}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        dir={ltr ? "ltr" : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(mono && "font-mono", ltr && "text-start", error && "border-red-400 focus:border-red-500 focus:ring-red-500/20")}
      />
      {error ? (
        <Hint id={`${id}-hint`} className="text-red-600 dark:text-red-400">
          {error}
        </Hint>
      ) : hint ? (
        <Hint id={`${id}-hint`}>{hint}</Hint>
      ) : null}
    </div>
  );
}

/** A link field: full URL or a site path. Shows a warning when the value would be dropped on save. */
export function UrlField({ label, hint, value, onChange, placeholder = "https://" }: { label: string; hint?: ReactNode; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const t = useT();
  const invalid = value.trim() !== "" && safeUrl(value) === "";
  return (
    <TextField
      label={label}
      hint={hint ?? t("editor.hint.url")}
      value={value}
      onChange={onChange}
      maxLength={500}
      placeholder={placeholder}
      ltr
      error={invalid ? t("editor.err.url") : undefined}
    />
  );
}

export function AreaField({
  label,
  hint,
  value,
  onChange,
  maxLength,
  rows = 3,
  placeholder,
}: {
  label: string;
  hint?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  rows?: number;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Counter value={value} max={maxLength} />
      </div>
      <Textarea
        id={id}
        rows={rows}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-0 resize-y"
      />
      {hint ? <Hint id={`${id}-hint`}>{hint}</Hint> : null}
    </div>
  );
}

/** Message template with clickable placeholder chips that insert at the caret. */
export function TemplateField({
  label,
  hint,
  value,
  onChange,
  placeholders,
  maxLength,
}: {
  label: string;
  hint?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholders: Array<{ token: string; label: string }>;
  maxLength: number;
}) {
  const t = useT();
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);

  const insert = (token: string) => {
    const el = ref.current;
    const start = el ? el.selectionStart : value.length;
    const end = el ? el.selectionEnd : value.length;
    const before = value.slice(0, start);
    const pad = before && !/\s$/.test(before) ? " " : "";
    const next = (before + pad + token + value.slice(end)).slice(0, maxLength);
    onChange(next);
    const caret = Math.min(next.length, start + pad.length + token.length);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Counter value={value} max={maxLength} />
      </div>
      <Textarea
        ref={ref}
        id={id}
        rows={2}
        value={value}
        maxLength={maxLength}
        aria-describedby={`${id}-chips${hint ? ` ${id}-hint` : ""}`}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-0 resize-y"
      />
      <div id={`${id}-chips`} className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label={t("editor.placeholders")}>
        <span className="me-0.5 text-xs text-muted">{t("editor.insert")}</span>
        {placeholders.map((p) => (
          <button
            key={p.token}
            type="button"
            onClick={() => insert(p.token)}
            title={p.label}
            className="rounded-md border border-line bg-paper px-2 py-0.5 font-mono text-xs text-ink transition-colors hover:border-primary-line hover:bg-primary-soft hover:text-primary"
          >
            {p.token}
          </button>
        ))}
      </div>
      {hint ? <Hint id={`${id}-hint`}>{hint}</Hint> : null}
    </div>
  );
}

/** Number input with a unit; keeps a text draft so the field can be cleared while typing. */
export function NumberField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  unit,
  step = 1,
}: {
  label: string;
  hint?: ReactNode;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  unit?: string;
  step?: number;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={draft ?? String(value)}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value.trim() !== "" && Number.isFinite(n)) onChange(clamp(n));
          }}
          onBlur={() => setDraft(null)}
          className={cn("tabular-nums", unit && "pe-16")}
        />
        {unit ? <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted">{unit}</span> : null}
      </div>
      {hint ? <Hint id={`${id}-hint`}>{hint}</Hint> : null}
    </div>
  );
}

export function RangeField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
}: {
  label: string;
  hint?: ReactNode;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format: (value: number) => string;
}) {
  const id = useId();
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <Label htmlFor={id} className="mb-0">
          {label}
        </Label>
        <output htmlFor={id} className="rounded-md bg-paper px-1.5 py-0.5 font-mono text-xs text-ink tabular-nums ring-1 ring-line">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-describedby={hint ? `${id}-hint` : undefined}
        aria-valuetext={format(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-5 w-full cursor-pointer accent-[var(--primary)]"
      />
      {hint ? <Hint id={`${id}-hint`}>{hint}</Hint> : null}
    </div>
  );
}

/** RTL-safe on/off switch. */
export function ToggleField({
  label,
  description,
  checked,
  onChange,
  className,
}: {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <span id={id} className="block text-sm font-medium text-ink">
          {label}
        </span>
        {description ? (
          <span id={`${id}-d`} className="mt-0.5 block text-xs text-muted">
            {description}
          </span>
        ) : null}
      </div>
      <SwitchButton checked={checked} onChange={onChange} labelledBy={id} describedBy={description ? `${id}-d` : undefined} />
    </div>
  );
}

export function SwitchButton({
  checked,
  onChange,
  labelledBy,
  describedBy,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  labelledBy?: string;
  describedBy?: string;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
        checked ? "bg-primary" : "bg-line",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute start-1 size-4 rounded-full bg-white shadow-sm transition-transform",
          checked && "translate-x-4 rtl:-translate-x-4",
        )}
      />
    </button>
  );
}

export function ChoiceField<T extends string>({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint?: ReactNode;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: ReactNode }>;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <Segmented value={value} onChange={onChange} options={options} label={label} />
      {hint ? <Hint>{hint}</Hint> : null}
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint?: ReactNode;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} aria-describedby={hint ? `${id}-hint` : undefined}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      {hint ? <Hint id={`${id}-hint`}>{hint}</Hint> : null}
    </div>
  );
}

/** Multi-select shown as toggle chips. */
export function ChipsField<T extends string>({
  label,
  hint,
  values,
  onChange,
  options,
  error,
}: {
  label: string;
  hint?: ReactNode;
  values: T[];
  onChange: (values: T[]) => void;
  options: Array<{ value: T; label: string; icon?: ReactNode }>;
  error?: string;
}) {
  const id = useId();
  return (
    <div>
      <span id={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </span>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = values.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? values.filter((v) => v !== o.value) : options.map((x) => x.value).filter((v) => v === o.value || values.includes(v)))}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors [&_svg]:size-4",
                on ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface text-muted hover:border-primary-line hover:text-ink",
              )}
            >
              {o.icon}
              {o.label}
            </button>
          );
        })}
      </div>
      {error ? <Hint className="text-amber-700 dark:text-amber-400">{error}</Hint> : hint ? <Hint>{hint}</Hint> : null}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO → value for <input type="datetime-local"> in the browser's time zone. */
function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DateTimeField({ label, hint, value, onChange }: { label: string; hint?: ReactNode; value: string; onChange: (iso: string) => void }) {
  const t = useT();
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="datetime-local"
          value={toLocalInput(value)}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => {
            const v = e.target.value;
            const d = v ? new Date(v) : null;
            onChange(d && !Number.isNaN(d.getTime()) ? d.toISOString() : "");
          }}
          className="min-w-0 flex-1 tabular-nums"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={t("editor.clearDate", { field: label })}
            className="grid size-10 shrink-0 place-items-center rounded-lg border border-line text-muted transition-colors hover:border-primary-line hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
      {hint ? <Hint id={`${id}-hint`}>{hint}</Hint> : null}
    </div>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Colour picker + hex input; empty value = the theme's default colour. */
export function ColorField({ label, value, onChange, fallback }: { label: string; value: string; onChange: (value: string) => void; fallback: string }) {
  const t = useT();
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = value || fallback;
  return (
    <div>
      <Label htmlFor={`${id}-hex`}>{label}</Label>
      <div className="flex items-center gap-2">
        <label
          className="relative grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg border border-line bg-surface focus-within:ring-2 focus-within:ring-primary/40"
          title={t("editor.pickColor")}
        >
          <span className="size-6 rounded-md ring-1 ring-black/10 ring-inset" style={{ backgroundColor: shown }} />
          <input
            type="color"
            value={shown}
            aria-label={t("editor.pickColorFor", { field: label })}
            onChange={(e) => {
              setDraft(null);
              onChange(e.target.value.toLowerCase());
            }}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
        <Input
          id={`${id}-hex`}
          dir="ltr"
          value={draft ?? value}
          placeholder={t("editor.colorDefault")}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => {
            let v = e.target.value.trim();
            if (v && !v.startsWith("#")) v = `#${v}`;
            setDraft(v);
            if (v === "" || HEX.test(v)) onChange(v.toLowerCase());
          }}
          onBlur={() => setDraft(null)}
          className="min-w-0 flex-1 text-start font-mono uppercase placeholder:normal-case"
        />
        <button
          type="button"
          onClick={() => {
            setDraft(null);
            onChange("");
          }}
          disabled={!value}
          aria-label={t("editor.resetColor", { field: label })}
          title={t("editor.resetColor", { field: label })}
          className="grid size-10 shrink-0 place-items-center rounded-lg border border-line text-muted transition-colors hover:border-primary-line hover:text-ink disabled:pointer-events-none disabled:opacity-40"
        >
          <RotateCcw className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
