import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import type { Translator } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";
import { HeroMockup } from "./hero-mockup";

export function Hero({
  t,
  title,
  subtitle,
  signedIn,
  liveSiteName,
}: {
  t: Translator;
  title: string;
  subtitle: string;
  signedIn: boolean;
  /** Set when the platform's own widgets run on this page. */
  liveSiteName: string | null;
}) {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden border-b border-line">
      <div aria-hidden className="mat-grid mat-grid-fade absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-48 mx-auto h-[520px] max-w-4xl rounded-full bg-primary/20 blur-[120px] dark:bg-primary/25" />
      <div aria-hidden className="pointer-events-none absolute -end-40 top-40 h-[360px] w-[360px] rounded-full bg-marker/25 blur-[110px] dark:bg-marker/10" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-4 pt-14 pb-24 sm:px-6 sm:pt-20 lg:grid-cols-[1fr_1.08fr] lg:gap-12 lg:pt-24 lg:pb-32">
        <div className="text-center lg:text-start">
          <Link
            href="#features"
            className="group inline-flex max-w-full animate-tz-rise items-center gap-2 rounded-full border border-primary-line bg-surface/80 py-1 ps-1 pe-3 text-sm font-medium shadow-sm backdrop-blur transition-colors hover:border-primary motion-reduce:animate-none"
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-marker text-[#3d2e00]">
              <Sparkles className="size-3.5" aria-hidden />
            </span>
            <span className="truncate">{t("home.eyebrow")}</span>
            <ArrowRight className="size-3.5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary-text rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden />
          </Link>

          <h1
            id="hero-title"
            className="mx-auto mt-7 max-w-[16ch] animate-tz-rise bg-gradient-to-b from-ink from-40% to-ink/70 bg-clip-text text-[2.6rem] leading-[1.02] font-bold tracking-[-0.035em] text-balance text-transparent [animation-delay:80ms] motion-reduce:animate-none sm:text-6xl lg:mx-0 lg:text-[3.5rem] xl:text-[4.25rem]"
          >
            {title}
          </h1>
          <p className="mx-auto mt-6 max-w-[54ch] animate-tz-rise text-lg leading-relaxed text-muted [animation-delay:160ms] motion-reduce:animate-none lg:mx-0">
            {subtitle}
          </p>

          <div className="mt-9 flex animate-tz-rise flex-wrap justify-center gap-3 [animation-delay:240ms] motion-reduce:animate-none lg:justify-start">
            <Link href={signedIn ? "/dashboard" : "/register"} className={buttonClass("primary", "lg", "group shadow-lg shadow-primary/30")}>
              {signedIn ? t("nav.dashboard") : t("home.ctaStart")}
              <ArrowRight aria-hidden className="transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
            </Link>
            <Link href="/pricing" className={buttonClass("outline", "lg")}>
              {t("home.ctaPricing")}
            </Link>
          </div>

          <ul className="mt-7 flex animate-tz-rise flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted [animation-delay:320ms] motion-reduce:animate-none lg:justify-start">
            {(["home.trustFree", "home.trustFast", "home.trustCancel"] as const).map((key) => (
              <li key={key} className="flex items-center gap-1.5">
                <Check className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                {t(key)}
              </li>
            ))}
          </ul>

          {liveSiteName ? (
            <p
              className={cn(
                "mx-auto mt-8 inline-flex animate-tz-rise items-center gap-2 rounded-lg border border-dashed border-line px-3 py-1.5 text-xs text-muted [animation-delay:400ms] motion-reduce:animate-none lg:mx-0",
              )}
            >
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/60 motion-reduce:animate-none" />
                <span className="relative size-2 rounded-full bg-emerald-500" />
              </span>
              {t("home.liveHint", { site: liveSiteName })}
            </p>
          ) : null}
        </div>

        <div className="lg:ps-4">
          <HeroMockup t={t} />
        </div>
      </div>
    </section>
  );
}

const PLATFORMS = ["Shopify", "WooCommerce", "WordPress", "Stripe", "Wix", "Webflow", "Squarespace"];

/** Benefits strip (Admin → Settings → Home page) and the "works with" list. */
export function ProofStrip({ t, showStats }: { t: Translator; showStats: boolean }) {
  const stats = [
    ["home.stat1Value", "home.stat1Label"],
    ["home.stat2Value", "home.stat2Label"],
    ["home.stat3Value", "home.stat3Label"],
    ["home.stat4Value", "home.stat4Label"],
  ] as const;
  return (
    <section aria-label={t("home.worksWith")} className="border-b border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {showStats ? (
          <dl className="grid grid-cols-2 border-b border-line md:grid-cols-4">
            {stats.map(([value, label], i) => (
              <div
                key={value}
                className={cn(
                  "flex flex-col-reverse gap-1 px-2 py-7 text-center sm:py-9",
                  i % 2 === 1 && "border-s border-line",
                  i >= 2 && "border-t border-line md:border-t-0",
                  i === 2 && "md:border-s",
                )}
              >
                <dt className="text-sm text-muted">{t(label)}</dt>
                <dd className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t(value)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <div className="flex flex-col items-center gap-4 py-7 sm:flex-row sm:justify-center sm:gap-6">
          <p className="shrink-0 text-xs font-semibold tracking-[0.14em] text-muted uppercase">{t("home.worksWith")}</p>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {PLATFORMS.map((name) => (
              <li key={name} className="font-display text-[15px] font-semibold text-ink/55 dark:text-ink/60">
                {name}
              </li>
            ))}
            <li className="font-display text-[15px] font-semibold text-ink/55 dark:text-ink/60">+ {t("home.anySite")}</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
