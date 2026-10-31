import { TYPE_GROUPS, TYPE_META, typeName } from "@/components/dashboard/widget-editor/type-meta";
import { TypeMockup } from "@/components/dashboard/widget-editor/type-mockup";
import type { MessageKey, Translator } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";

const GROUP_TONE = {
  proof: "bg-primary-soft text-primary-text",
  promo: "bg-marker/25 text-[#7a5a00] dark:bg-marker/15 dark:text-marker",
  engage: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
} as const;

/** All ten widget types with a mini illustration and a one-line benefit. */
export function WidgetShowcase({ t }: { t: Translator }) {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-16 py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading id="features-title" eyebrow={t("home.featuresEyebrow")} title={t("home.featuresTitle")} text={t("home.featuresText")} />
        <ul className="mt-12 grid grid-cols-2 gap-3 sm:mt-14 sm:gap-4 lg:grid-cols-5">
          {TYPE_GROUPS.flatMap((group) =>
            group.types.map((type) => {
              const Icon = TYPE_META[type].icon;
              return (
                <li
                  key={type}
                  className="group flex flex-col rounded-2xl border border-line bg-surface p-2 sm:p-3 transition-all duration-300 hover:-translate-y-1 hover:border-primary-line hover:shadow-[0_24px_48px_-28px_color-mix(in_oklab,var(--primary)_55%,transparent)] motion-reduce:hover:translate-y-0"
                >
                  <TypeMockup type={type} className="rounded-xl transition-colors group-hover:border-primary-line" />
                  <div className="flex flex-1 flex-col px-1 pt-3 pb-1.5 sm:px-1.5 sm:pt-4 sm:pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-text" aria-hidden>
                        <Icon className="size-4" />
                      </span>
                      <span className={cn("hidden truncate rounded-full px-2 py-0.5 text-[11px] sm:block font-semibold", GROUP_TONE[group.id])}>
                        {t(`home.group.${group.id}`)}
                      </span>
                    </div>
                    <h3 className="mt-3 font-sans text-sm font-semibold sm:text-[15px] tracking-normal">{typeName(t, type)}</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted sm:text-sm">{t(`home.w.${type}` as MessageKey)}</p>
                  </div>
                </li>
              );
            }),
          )}
        </ul>
      </div>
    </section>
  );
}
