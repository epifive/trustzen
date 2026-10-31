import { TrendingUp } from "lucide-react";
import type { Translator } from "@/lib/i18n/messages";
import { SectionHeading } from "./section-heading";

const STEPS = [
  ["home.step1Title", "home.step1"],
  ["home.step2Title", "home.step2"],
  ["home.step3Title", "home.step3"],
] as const;

/** Bar heights (%) of the illustrative 14-day chart. */
const BARS = [34, 42, 38, 51, 47, 58, 55, 63, 60, 71, 68, 79, 84, 92];

export function HowItWorks({ t, scriptUrl, locale }: { t: Translator; scriptUrl: string; locale: string }) {
  const n = (v: number) => v.toLocaleString(locale);
  const stats = [
    ["editor.stats.views", n(48210)],
    ["editor.stats.clicks", n(3912)],
    ["editor.stats.conversions", n(1204)],
  ] as const;

  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-16 border-y border-line bg-surface py-24 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:gap-20">
        <div>
          <SectionHeading id="how-title" eyebrow={t("home.stepsEyebrow")} title={t("home.stepsTitle")} text={t("home.stepsText")} />
          <ol className="relative mt-10 space-y-8">
            <span aria-hidden className="absolute start-[19px] top-10 bottom-10 w-px bg-gradient-to-b from-primary-line via-line to-transparent" />
            {STEPS.map(([title, text], i) => (
              <li key={title} className="relative flex gap-5">
                <span className="relative grid size-10 shrink-0 place-items-center rounded-full border border-primary-line bg-surface font-display text-base font-bold text-primary-text shadow-sm">
                  {n(i + 1)}
                </span>
                <div className="pt-1.5">
                  <h3 className="font-sans text-lg font-semibold tracking-normal">{t(title)}</h3>
                  <p className="mt-1 leading-relaxed text-muted">{t(text)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="relative">
          <div aria-hidden className="absolute -inset-6 -z-0 rounded-[2rem] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_18%,transparent),transparent)] blur-xl" />

          {/* The install snippet */}
          <figure className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#16131f] shadow-2xl shadow-black/20">
            <figcaption className="flex items-center gap-3 border-b border-white/10 px-4 py-3 text-xs text-white/60">
              <span aria-hidden className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-white/15" />
                <span className="size-2.5 rounded-full bg-white/15" />
                <span className="size-2.5 rounded-full bg-white/15" />
              </span>
              {t("home.snippetLabel")}
            </figcaption>
            <pre dir="ltr" className="overflow-x-auto p-5 pb-12 text-left font-mono text-[13px] leading-7 text-[#e8e4f4] [font-variant-ligatures:none] sm:text-sm">
              <code>
                <span className="text-white/40">{`<!-- ${t("home.snippetComment")} -->`}</span>
                {"\n"}
                <span className="text-[#ff8fb1]">{"<script"}</span> <span className="text-[#c4b5ff]">async</span>
                {"\n  "}
                <span className="text-[#c4b5ff]">src</span>=<span className="text-[#f2c94c]">{`"${scriptUrl}"`}</span>
                {"\n  "}
                <span className="text-[#c4b5ff]">data-site</span>=<span className="text-[#f2c94c]">&quot;YOUR_SITE_KEY&quot;</span>
                <span className="text-[#ff8fb1]">{"></script>"}</span>
              </code>
            </pre>
          </figure>

          {/* Illustrative analytics */}
          <div
            role="img"
            aria-label={t("home.statsTitle")}
            className="relative mt-5 rounded-2xl border border-line bg-paper p-5 shadow-xl shadow-black/5 sm:ms-12 sm:-mt-6 dark:shadow-black/30"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{t("home.statsTitle")}</p>
              <span className="text-xs text-muted">{t("editor.stats.period")}</span>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-3">
              {stats.map(([label, value], i) => (
                <div key={label} className="min-w-0 rounded-xl border border-line bg-surface p-3">
                  <dt className="truncate text-xs text-muted">{t(label)}</dt>
                  <dd className="mt-1 flex items-baseline gap-1.5">
                    <span className="font-display text-lg font-bold tabular-nums sm:text-xl">{value}</span>
                    {i === 2 ? <TrendingUp className="size-3.5 shrink-0 text-emerald-500" aria-hidden /> : null}
                  </dd>
                </div>
              ))}
            </dl>
            <div aria-hidden className="mt-4 flex h-20 items-end gap-1.5">
              {BARS.map((h, i) => (
                <span
                  key={i}
                  style={{ height: `${h}%` }}
                  className={i === BARS.length - 1 ? "flex-1 rounded-t-sm bg-primary" : "flex-1 rounded-t-sm bg-primary/25 dark:bg-primary/35"}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
