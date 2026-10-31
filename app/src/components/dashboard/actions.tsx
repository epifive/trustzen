"use client";

import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { initialFormState, type FormState } from "@/app/actions/types";
import { toggleWidgetAction } from "@/app/actions/dashboard/sites";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export type DashAction = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * A one-button form for row actions (hide, approve, delete…). Ids travel as hidden
 * inputs and are re-checked by the Server Action. Refreshes the page on success.
 */
export function ActionButton({
  action,
  fields,
  children,
  confirmText,
  variant = "outline",
  size = "sm",
  label,
  className,
}: {
  action: DashAction;
  fields: Record<string, string | number>;
  children: ReactNode;
  confirmText?: string;
  variant?: "outline" | "ghost" | "danger" | "secondary" | "primary";
  size?: "sm" | "md";
  /** Accessible name when the button only shows an icon. */
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await action(prev, formData);
    if (!result.error) router.refresh();
    return result;
  }, initialFormState);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
      className={cn("inline-flex flex-col items-start", className)}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={String(value)} />
      ))}
      <Button type="submit" variant={variant} size={size} disabled={pending} aria-busy={pending} aria-label={label} title={label}>
        {children}
      </Button>
      {state.error ? (
        <span role="alert" className="mt-1 max-w-56 text-xs text-red-600 dark:text-red-400">
          {state.error}
        </span>
      ) : null}
      <span className="sr-only" role="status">
        {state.success ?? ""}
      </span>
    </form>
  );
}

/** Active/inactive switch for a widget row. */
export function WidgetToggle({ widgetId, active, name }: { widgetId: number; active: boolean; name: string }) {
  const t = useT();
  const router = useRouter();
  const [optimistic, setOptimistic] = useOptimistic(active);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        role="switch"
        aria-checked={optimistic}
        aria-label={t("dash.widgets.toggle", { name })}
        disabled={pending}
        onClick={() => {
          const next = !optimistic;
          setError("");
          startTransition(async () => {
            setOptimistic(next);
            const fd = new FormData();
            fd.set("widget_id", String(widgetId));
            fd.set("active", next ? "1" : "0");
            const result = await toggleWidgetAction(initialFormState, fd);
            if (result.error) setError(result.error);
            router.refresh();
          });
        }}
        className={cn(
          "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-70",
          optimistic ? "bg-primary" : "bg-line",
        )}
      >
        <span
          className={cn(
            "absolute start-1 size-4 rounded-full bg-white shadow-sm transition-transform",
            optimistic ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0",
          )}
        />
      </button>
      {error ? (
        <span role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
    </span>
  );
}

/** Reloads server data once (e.g. the sidebar's site list after a site was deleted) and drops the query flag. */
export function RefreshOnce({ cleanUrl }: { cleanUrl: string }) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    router.replace(cleanUrl, { scroll: false });
    router.refresh();
  }, [router, cleanUrl]);
  return null;
}
