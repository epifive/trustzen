import { Plus } from "lucide-react";
import { JsonLd } from "@/components/site/json-ld";
import type { Translator } from "@/lib/i18n/messages";
import { SectionHeading } from "./section-heading";

const QUESTIONS = [
  ["home.faq1q", "home.faq1a"],
  ["home.faq2q", "home.faq2a"],
  ["home.faq3q", "home.faq3a"],
  ["home.faq4q", "home.faq4a"],
  ["home.faq5q", "home.faq5a"],
  ["home.faq6q", "home.faq6a"],
] as const;

/** FAQ with native <details> (no JavaScript) and FAQPage structured data. */
export function Faq({ t }: { t: Translator }) {
  const items = QUESTIONS.map(([q, a]) => ({ q: t(q), a: t(a) }));
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-16 py-24 sm:py-28">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
        }}
      />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading id="faq-title" eyebrow={t("home.faqEyebrow")} title={t("home.faqTitle")} />
        </div>
        <div className="divide-y divide-line border-y border-line">
          {items.map((item, i) => (
            <details key={i} className="group" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-start font-semibold transition-colors hover:text-primary-text [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-muted transition-all group-open:rotate-45 group-open:border-primary-line group-open:text-primary-text">
                  <Plus className="size-4" aria-hidden />
                </span>
              </summary>
              <p className="-mt-1 max-w-[65ch] pe-12 pb-6 leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
