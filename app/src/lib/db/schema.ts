import type { Generated, Insertable, Selectable, Updateable } from "kysely";

/**
 * Database schema shared by the MySQL and SQLite drivers.
 *
 * Portability rules used across the project:
 * - booleans are stored as 0 / 1 integers
 * - timestamps are ISO-8601 strings (see `now()` in ./index.ts)
 * - money is stored in the smallest currency unit (cents)
 */

export interface SettingsTable {
  key: string;
  value: string | null;
}

export interface UsersTable {
  id: Generated<number>;
  name: string;
  email: string;
  password_hash: string;
  role: "user" | "admin";
  status: "active" | "banned";
  plan_id: number | null;
  plan_expires_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionsTable {
  id: string;
  user_id: number;
  expires_at: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface PasswordResetsTable {
  token_hash: string;
  user_id: number;
  expires_at: string;
  created_at: string;
}

export interface PlansTable {
  id: Generated<number>;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  features: string | null;
  /** 0 = unlimited. */
  max_sites: number;
  /** 0 = unlimited. */
  max_widgets: number;
  /** 0 = unlimited. */
  max_monthly_views: number;
  remove_branding: number;
  is_free: number;
  is_active: number;
  is_featured: number;
  sort_order: number;
  created_at: string;
}

export interface PaymentsTable {
  id: Generated<number>;
  user_id: number;
  plan_id: number;
  amount: number;
  currency: string;
  billing_cycle: "monthly" | "yearly";
  provider: "stripe" | "paypal" | "razorpay" | "offline";
  provider_ref: string;
  status: "pending" | "paid" | "rejected" | "refunded";
  note: string | null;
  created_at: string;
}

export interface PagesTable {
  id: Generated<number>;
  slug: string;
  title: string;
  content: string;
  meta_description: string | null;
  is_published: number;
  show_in_footer: number;
  created_at: string;
  updated_at: string;
}

export interface ContactMessagesTable {
  id: Generated<number>;
  name: string;
  email: string;
  subject: string;
  message: string;
  ip: string | null;
  is_read: number;
  created_at: string;
}

export interface LanguagesTable {
  code: string;
  name: string;
  native_name: string;
  direction: "ltr" | "rtl";
  is_active: number;
  sort_order: number;
}

export interface TranslationsTable {
  lang: string;
  key: string;
  value: string;
}

export interface PostsTable {
  id: Generated<number>;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  meta_description: string | null;
  status: "draft" | "published";
  published_at: string | null;
  views: number;
  created_at: string;
  updated_at: string;
}

export interface SitesTable {
  id: Generated<number>;
  user_id: number;
  name: string;
  domain: string;
  /** Public id used in the embed snippet. */
  public_key: string;
  /** Secret part of the incoming webhook URL. */
  webhook_token: string;
  /** JSON: SiteSettings (see lib/sites.ts). */
  settings: string;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WidgetsTable {
  id: Generated<number>;
  site_id: number;
  type: string;
  name: string;
  is_active: number;
  /** JSON objects; their shape depends on the widget type (see src/widget/types.ts). */
  content: string;
  design: string;
  rules: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface EventsTable {
  id: Generated<number>;
  site_id: number;
  source: "form" | "webhook" | "manual" | "import";
  kind: "purchase" | "signup" | "review" | "custom";
  name: string | null;
  city: string | null;
  country: string | null;
  product: string | null;
  url: string | null;
  image: string | null;
  rating: number | null;
  message: string | null;
  is_hidden: number;
  created_at: string;
}

export interface TestimonialsTable {
  id: Generated<number>;
  site_id: number;
  name: string;
  email: string | null;
  title: string | null;
  avatar: string | null;
  rating: number;
  body: string;
  status: "pending" | "approved" | "rejected";
  source: "form" | "manual" | "import";
  created_at: string;
}

export interface LeadsTable {
  id: Generated<number>;
  site_id: number;
  widget_id: number | null;
  email: string;
  name: string | null;
  /** JSON of extra fields. */
  data: string | null;
  page_url: string | null;
  created_at: string;
}

export interface WidgetStatsDailyTable {
  widget_id: number;
  day: string;
  impressions: number;
  hovers: number;
  clicks: number;
  conversions: number;
}

export interface PresenceTable {
  site_id: number;
  visitor: string;
  path: string;
  seen_at: string;
}

export interface UsageMonthlyTable {
  user_id: number;
  /** YYYY-MM */
  month: string;
  views: number;
}

export interface Database {
  settings: SettingsTable;
  users: UsersTable;
  sessions: SessionsTable;
  password_resets: PasswordResetsTable;
  plans: PlansTable;
  payments: PaymentsTable;
  pages: PagesTable;
  contact_messages: ContactMessagesTable;
  languages: LanguagesTable;
  translations: TranslationsTable;
  posts: PostsTable;
  sites: SitesTable;
  widgets: WidgetsTable;
  events: EventsTable;
  testimonials: TestimonialsTable;
  leads: LeadsTable;
  widget_stats_daily: WidgetStatsDailyTable;
  usage_monthly: UsageMonthlyTable;
  presence: PresenceTable;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;
export type Plan = Selectable<PlansTable>;
export type Payment = Selectable<PaymentsTable>;
export type Page = Selectable<PagesTable>;
export type ContactMessage = Selectable<ContactMessagesTable>;
export type Language = Selectable<LanguagesTable>;
export type Post = Selectable<PostsTable>;
export type Site = Selectable<SitesTable>;
export type Widget = Selectable<WidgetsTable>;
export type ProofEvent = Selectable<EventsTable>;
export type Testimonial = Selectable<TestimonialsTable>;
export type Lead = Selectable<LeadsTable>;
