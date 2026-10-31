import { CodeXml, Cookie, Mail, Megaphone, ShoppingBag, Star, TicketPercent, Timer, TrendingUp, Users, type LucideIcon } from "lucide-react";
import type { MessageKey, Translator } from "@/lib/i18n/messages";
import type { WidgetType } from "@/widget/types";

/** Icon and English fallback texts for each widget type (translations live in `dash.type.*`). */
export const TYPE_META: Record<WidgetType, { icon: LucideIcon; name: string; description: string }> = {
  recent_activity: { icon: ShoppingBag, name: "Recent activity", description: "Real purchases and signups as they happen." },
  live_visitors: { icon: Users, name: "Live visitors", description: "How many people are browsing right now." },
  conversion_counter: { icon: TrendingUp, name: "Conversion counter", description: "Signups or sales in the last hours." },
  review: { icon: Star, name: "Reviews", description: "Rotating testimonials with star ratings." },
  announcement: { icon: Megaphone, name: "Announcement bar", description: "A slim bar for news, offers and launches." },
  coupon: { icon: TicketPercent, name: "Coupon", description: "A discount code visitors copy in one click." },
  countdown: { icon: Timer, name: "Countdown timer", description: "Urgency for sales and limited offers." },
  email_collector: { icon: Mail, name: "Email collector", description: "Turn visitors into subscribers and leads." },
  cookie_notice: { icon: Cookie, name: "Cookie notice", description: "A simple, friendly cookie consent bar." },
  custom_html: { icon: CodeXml, name: "Custom HTML", description: "Your own message or markup in a popup." },
};

/** Translated type name (falls back to English if the key is missing). */
export function typeName(t: Translator, type: WidgetType): string {
  return t(`dash.type.${type}` as MessageKey) || TYPE_META[type].name;
}

export function typeDescription(t: Translator, type: WidgetType): string {
  return t(`dash.typeDesc.${type}` as MessageKey) || TYPE_META[type].description;
}

/** Groups used by the type gallery. */
export const TYPE_GROUPS: Array<{ id: "proof" | "promo" | "engage"; types: WidgetType[] }> = [
  { id: "proof", types: ["recent_activity", "live_visitors", "conversion_counter", "review"] },
  { id: "promo", types: ["announcement", "coupon", "countdown"] },
  { id: "engage", types: ["email_collector", "cookie_notice", "custom_html"] },
];
