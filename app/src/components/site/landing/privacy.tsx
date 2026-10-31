import { BadgeCheck, Cookie, ShieldCheck, UserRound } from "lucide-react";
import type { Translator } from "@/lib/i18n/messages";

const POINTS = [
  { icon: BadgeCheck, title: "home.privacy.realTitle", text: "home.privacy.real" },
  { icon: UserRound, title: "home.privacy.anonTitle", text: "home.privacy.anon" },
  { icon: Cookie, title: "home.privacy.cookieTitle", text: "home.privacy.cookie" },
  { icon: ShieldCheck, title: "home.privacy.gdprTitle", text: "home.privacy.gdpr" },
] as const;

/** "Honest by design": always rendered as a dark panel so it stands out in both themes. */
export function Privacy({ t }: { t: Translator }) {
  return (
    <section aria-labelledby="privacy-title" className="px-4 py-24 sm:px-6 sm:py-28">
      <div className="dark relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#110f17] [:root.dark_&]:border-primary-line [:root.dark_&]:bg-[#0b0a0f] px-6 py-14 text-ink shadow-2xl shadow-black/20 sm:px-12 sm:py-16 lg:px-16">
        <div aria-hidden className="mat-grid absolute inset-0 bg-transparent opacity-60 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_65%)] rtl:[mask-image:radial-gradient(ellipse_at_top_right,black,transparent_65%)]" />
        <div aria-hidden className="absolute -start-24 -top-32 size-[420px] rounded-full bg-primary/40 blur-[120px]" />
        <div aria-hidden className="absolute -end-20 -bottom-40 size-[360px] rounded-full bg-marker/10 blur-[120px]" />

        <div className="relative grid gap-12 lg:grid-cols-[1fr_1.25fr] lg:gap-16">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary-text">
              <span aria-hidden className="size-1.5 rounded-full bg-marker ring-4 ring-marker/25" />
              {t("home.privacyEyebrow")}
            </p>
            <h2 id="privacy-title" className="mt-3 text-3xl leading-[1.1] font-bold tracking-tight text-white sm:text-[2.6rem]">
              {t("home.privacyTitle")}
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">{t("home.privacyText")}</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {POINTS.map((p) => (
              <li key={p.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
                <span className="grid size-10 place-items-center rounded-xl bg-primary-text/10 text-primary-text ring-1 ring-primary-text/20" aria-hidden>
                  <p.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-sans text-base font-semibold tracking-normal text-white">{t(p.title)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(p.text)}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
