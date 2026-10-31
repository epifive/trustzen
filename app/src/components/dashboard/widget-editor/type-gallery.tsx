"use client";

import { useActionState, useState } from "react";
import { ArrowRight, LoaderCircle, Lock } from "lucide-react";
import { createWidgetAction } from "@/app/actions/dashboard/widgets";
import { initialFormState } from "@/app/actions/types";
import { Alert } from "@/components/ui/alert";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { WidgetType } from "@/widget/types";
import { TYPE_GROUPS, TYPE_META, typeDescription, typeName } from "./type-meta";
import { TypeMockup } from "./type-mockup";

/** Widget type cards. Picking one creates the widget with defaults and opens the editor. */
export function TypeGallery({ siteId, locked }: { siteId: number; locked: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState(createWidgetAction, initialFormState);
  const [chosen, setChosen] = useState<WidgetType | null>(null);

  return (
    <form action={action} className="space-y-10">
      <input type="hidden" name="site_id" value={siteId} />
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {TYPE_GROUPS.map((group) => (
        <section key={group.id} aria-labelledby={`tz-group-${group.id}`}>
          <div className="mb-4">
            <h2 id={`tz-group-${group.id}`} className="font-sans text-base font-semibold tracking-normal">
              {t(`editor.gallery.${group.id}`)}
            </h2>
            <p className="mt-0.5 text-sm text-muted">{t(`editor.gallery.${group.id}Text`)}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.types.map((type) => {
              const Icon = TYPE_META[type].icon;
              const busy = pending && chosen === type;
              return (
                <button
                  key={type}
                  type="submit"
                  name="type"
                  value={type}
                  disabled={locked || pending}
                  onClick={() => setChosen(type)}
                  aria-describedby={`tz-type-${type}-desc`}
                  className={cn(
                    "group flex flex-col rounded-xl border border-line bg-surface p-3 text-start transition-all",
                    "hover:-translate-y-0.5 hover:border-primary-line hover:shadow-lg hover:shadow-primary/5 motion-reduce:hover:translate-y-0",
                    "focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                    "disabled:pointer-events-none",
                    locked && "opacity-60",
                    pending && !busy && "opacity-50",
                    busy && "border-primary ring-2 ring-primary/20",
                  )}
                >
                  <TypeMockup type={type} className="transition-colors group-hover:border-primary-line" />
                  <span className="flex items-start gap-3 px-1 pt-4 pb-1">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary" aria-hidden>
                      {busy ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <Icon className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-medium text-ink">
                        {typeName(t, type)}
                        {locked ? (
                          <Lock className="size-3.5 text-muted" aria-hidden />
                        ) : (
                          <ArrowRight
                            className="size-4 text-primary opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                            aria-hidden
                          />
                        )}
                      </span>
                      <span id={`tz-type-${type}-desc`} className="mt-0.5 block text-sm leading-snug text-muted">
                        {typeDescription(t, type)}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </form>
  );
}
