import { CreditCard, FileSpreadsheet, MessageSquareQuote, ShoppingBag, ShoppingCart, TextCursorInput, Webhook, Zap, type LucideIcon } from "lucide-react";
import type { MessageKey, Translator } from "@/lib/i18n/messages";
import { SectionHeading } from "./section-heading";

type Item = { icon: LucideIcon; tile: string } & ({ name: string } | { nameKey: MessageKey }) & { text: MessageKey };

// Brand names stay as written; their colours tint the icon tiles (no third-party logos are used).
const ITEMS: Item[] = [
  { icon: CreditCard, tile: "bg-[#635bff] text-white", name: "Stripe", text: "home.int.stripe" },
  { icon: ShoppingCart, tile: "bg-[#7f54b3] text-white", name: "WooCommerce", text: "home.int.woo" },
  { icon: ShoppingBag, tile: "bg-[#5e8e3e] text-white", name: "Shopify", text: "home.int.shopify" },
  { icon: Zap, tile: "bg-[#ff4f00] text-white", nameKey: "home.int.zapierName", text: "home.int.zapier" },
  { icon: Webhook, tile: "bg-ink text-paper", nameKey: "home.int.webhookName", text: "home.int.webhook" },
  { icon: TextCursorInput, tile: "bg-primary text-white", nameKey: "home.int.formsName", text: "home.int.forms" },
  { icon: FileSpreadsheet, tile: "bg-[#1f8a5b] text-white", nameKey: "home.int.csvName", text: "home.int.csv" },
  { icon: MessageSquareQuote, tile: "bg-[#d4881c] text-white", nameKey: "home.int.collectName", text: "home.int.collect" },
];

export function Integrations({ t }: { t: Translator }) {
  return (
    <section id="integrations" aria-labelledby="int-title" className="scroll-mt-16 py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading id="int-title" align="center" eyebrow={t("home.intEyebrow")} title={t("home.intTitle")} text={t("home.intText")} />
        <ul className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map((item) => (
            <li key={item.text} className="group flex gap-4 bg-surface p-5 transition-colors hover:bg-paper sm:block sm:p-6">
              <span className={`grid size-11 shrink-0 place-items-center rounded-xl shadow-sm ${item.tile}`} aria-hidden>
                <item.icon className="size-5" />
              </span>
              <div className="min-w-0">
                <h3 className="font-sans text-base font-semibold tracking-normal sm:mt-5">{"name" in item ? item.name : t(item.nameKey)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{t(item.text)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
