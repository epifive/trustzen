import { BadgeCheck, Lock } from "lucide-react";
import type { Translator } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

/** Grey placeholder text line. */
function Line({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block h-2 rounded-full bg-line", className)} />;
}

function Stars({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("flex gap-0.5 text-amber-400", className)}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className="size-full fill-current">
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </span>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}\p{N}]/gu, "").charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** A linen tote bag, drawn so the mockup needs no image files. */
function ToteBag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 112" aria-hidden className={className}>
      <path d="M33 38V30a17 17 0 0 1 34 0v8" fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-[#b39a6b] dark:stroke-[#8d7a55]" />
      <path d="M16 36h68l5 66a7 7 0 0 1-7 7H18a7 7 0 0 1-7-7z" className="fill-[#f1e6cc] dark:fill-[#cdbd98]" />
      <path d="M16 36h68l1 12H15z" className="fill-[#e6d6b2] dark:fill-[#bba985]" />
      <rect x="36" y="62" width="28" height="20" rx="3" className="fill-primary" />
      <path d="M43 72h14" strokeWidth="2.5" strokeLinecap="round" className="stroke-white/80" />
    </svg>
  );
}

/**
 * The hero illustration: a store page with three real-looking Trustzen widgets
 * (recent purchase popup, live visitors pill and a review card). Pure HTML/CSS.
 */
export function HeroMockup({ t }: { t: Translator }) {
  return (
    <div role="img" aria-label={t("home.mock.label")} className="relative mx-auto w-full max-w-[600px] select-none lg:max-w-none">
      <div aria-hidden className="absolute -inset-8 -z-10 rounded-[3rem] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_28%,transparent),transparent)] blur-2xl" />

      <div className="animate-tz-rise overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_50px_100px_-40px_rgba(38,20,96,0.45)] motion-reduce:animate-none dark:shadow-[0_50px_100px_-40px_rgba(0,0,0,0.8)]">
        {/* Browser chrome */}
        <div className="flex h-10 items-center gap-3 border-b border-line bg-paper px-4">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-[#ff6159]" />
            <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </span>
          <span className="mx-auto flex h-6 max-w-[62%] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[11px] text-muted">
            <Lock className="size-3 shrink-0" />
            <span dir="ltr" className="truncate">
              {t("home.mock.url")}
            </span>
          </span>
          <span className="w-[42px]" />
        </div>

        {/* Countdown bar widget */}
        <div className="flex items-center justify-center gap-2 bg-ink px-3 py-1.5 text-[11px] font-medium text-paper">
          <span className="truncate">{t("home.mock.bar")}</span>
          <span dir="ltr" className="flex shrink-0 gap-1 font-mono tabular-nums">
            {["02", "14", "37"].map((v) => (
              <span key={v} className="rounded bg-paper/15 px-1 py-px">
                {v}
              </span>
            ))}
          </span>
        </div>

        {/* Product page */}
        <div className="relative grid grid-cols-[1.1fr_1fr] gap-4 p-4 pb-20 sm:gap-6 sm:p-6 sm:pb-24">
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-gradient-to-br from-[#f7ecd2] via-[#f1e1ef] to-[#ddd5f8] dark:from-[#3a3122] dark:via-[#382a45] dark:to-[#28234d]">
            <ToteBag className="absolute inset-x-[16%] top-[20%] w-[68%] drop-shadow-[0_18px_24px_rgba(70,40,10,0.18)]" />
          </div>

          <div className="flex min-w-0 flex-col pt-1">
            <Line className="h-1.5 w-1/3" />
            <p className="mt-3 font-display text-base leading-tight font-bold sm:text-xl">{t("home.mock.product")}</p>
            <span className="mt-2 flex items-center gap-1.5">
              <Stars className="h-3 w-[4.5rem]" />
              <span className="truncate text-[10.5px] text-muted sm:text-[11px]">{t("home.mock.reviews")}</span>
            </span>
            <p className="mt-3 font-display text-lg font-bold tabular-nums sm:text-2xl">{t("home.mock.price")}</p>
            <span aria-hidden className="mt-3 flex gap-1.5">
              <span className="size-5 rounded-full bg-[#e8dcc0] ring-2 ring-primary ring-offset-2 ring-offset-surface" />
              <span className="size-5 rounded-full bg-[#3c3a46]" />
              <span className="size-5 rounded-full bg-[#9db8a0]" />
            </span>
            <span aria-hidden className="mt-4 grid grid-cols-4 gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn("h-6 rounded-md border", i === 1 ? "border-primary bg-primary-soft" : "border-line")} />
              ))}
            </span>
            <span className="mt-4 grid h-9 place-items-center rounded-lg bg-primary text-[12px] font-semibold text-white shadow-md shadow-primary/30">
              {t("home.mock.addToCart")}
            </span>
            <span className="mt-4 space-y-2">
              <Line className="w-full" />
              <Line className="w-5/6" />
              <Line className="w-2/3" />
            </span>
          </div>

          {/* Live visitors widget */}
          <div className="absolute start-6 top-6 z-10 flex whitespace-nowrap animate-tz-pop items-center gap-2 rounded-full border border-line bg-surface/95 py-1.5 ps-2.5 pe-3 text-[10.5px] font-semibold shadow-lg shadow-black/10 backdrop-blur [animation-delay:1100ms] motion-reduce:animate-none sm:start-8 sm:top-8 sm:text-[11.5px]">
            <span className="relative flex size-2 shrink-0">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/60 motion-reduce:animate-none" />
              <span className="relative size-2 rounded-full bg-emerald-500" />
            </span>
            {t("home.mock.visitors", { count: 18 })}
          </div>

          {/* Recent purchase widget */}
          <div className="absolute start-3 bottom-3 flex w-[min(300px,calc(100%-1.5rem))] animate-tz-rise items-center gap-3 rounded-xl border border-line bg-surface p-2.5 pe-4 shadow-[0_20px_44px_-18px_rgba(30,18,80,0.45)] [animation-delay:600ms] motion-reduce:animate-none sm:start-5 sm:bottom-5 dark:shadow-[0_20px_44px_-18px_rgba(0,0,0,0.9)]">
            <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#f7ecd2] to-[#ddd5f8] dark:from-[#3a3122] dark:to-[#28234d]">
              <ToteBag className="w-8" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-semibold">{t("home.mock.buyer")}</span>
              <span className="block truncate text-[12px] text-muted">{t("home.mock.bought")}</span>
              <span className="mt-1 flex items-center gap-1.5 text-[10.5px] text-muted">
                <span className="truncate">{t("home.mock.ago")}</span>
                <span aria-hidden>·</span>
                <BadgeCheck className="size-3.5 shrink-0 text-primary-text" />
                <span className="font-medium text-primary-text">{t("home.mock.verified")}</span>
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Review widget, floating over the page edge */}
      <div className="absolute -end-3 -bottom-12 hidden w-[250px] animate-tz-pop [animation-delay:1600ms] motion-reduce:animate-none sm:block xl:-end-8">
        <div className="animate-tz-float rounded-2xl border border-line bg-surface p-4 shadow-[0_30px_60px_-24px_rgba(30,18,80,0.5)] motion-reduce:animate-none dark:shadow-[0_30px_60px_-24px_rgba(0,0,0,0.9)]">
          <Stars className="h-3.5 w-20" />
          <p className="mt-2.5 text-[13px] leading-snug">{t("home.mock.quote")}</p>
          <span className="mt-3 flex items-center gap-2.5">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-rose-400 text-[11px] font-bold text-white">
              {initials(t("home.mock.reviewer"))}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-semibold">{t("home.mock.reviewer")}</span>
              <span className="flex items-center gap-1 text-[10.5px] text-muted">
                <BadgeCheck className="size-3 shrink-0 text-emerald-500" />
                {t("home.mock.reviewerTitle")}
              </span>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
