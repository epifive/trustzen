import { Code2, Cookie, Mail, Megaphone, ShoppingBag, Star, Ticket, Timer, TrendingUp, Users, type LucideIcon } from "lucide-react";
import type { MessageKey } from "@/lib/i18n/messages";
import type { WidgetType } from "@/widget/types";

/** Icon per widget type (shared by the dashboard lists and the widget editor). */
export const WIDGET_TYPE_ICONS: Record<WidgetType, LucideIcon> = {
  recent_activity: ShoppingBag,
  live_visitors: Users,
  conversion_counter: TrendingUp,
  review: Star,
  announcement: Megaphone,
  coupon: Ticket,
  countdown: Timer,
  email_collector: Mail,
  cookie_notice: Cookie,
  custom_html: Code2,
};

/** Translation key of a widget type's display name. */
export const widgetTypeLabel = (type: WidgetType): MessageKey => `dash.type.${type}` as MessageKey;

/** Translation key of a widget type's one-line description. */
export const widgetTypeDescription = (type: WidgetType): MessageKey => `dash.typeDesc.${type}` as MessageKey;
