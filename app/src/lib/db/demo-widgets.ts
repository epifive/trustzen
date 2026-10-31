import "server-only";
import crypto from "node:crypto";
import type { Kysely, Transaction } from "kysely";
import type { Database } from "./schema";
import { DEFAULT_SITE_SETTINGS } from "../sites";
import { normalizeContent, normalizeDesign, normalizeRules, widgetDefaults } from "@/widget/normalize";
import type { ContentByType, WidgetDesign, WidgetRules, WidgetType } from "@/widget/types";

/**
 * Demo content for the social-proof features: a sample store owned by the
 * administrator (its widgets run on the platform's own home page), a few customer
 * websites, events, testimonials, leads and 30 days of statistics.
 */

const DAY = 86_400_000;
const NAMES = ["Emma", "Liam", "Olivia", "Noah", "Ava", "Arjun", "Priya", "Lucas", "Mia", "Ethan", "Sofia", "Yuki", "Mateo", "Aisha", "Daniel", "Chloe", "Rahul", "Fatima", "Leo", "Hannah", "Omar", "Grace", "Kenji", "Isabella", "Samuel", "Zara", "Diego", "Nora", "Ravi", "Elena"];
const PLACES: Array<[string, string]> = [
  ["Berlin", "Germany"], ["London", "United Kingdom"], ["Austin", "United States"], ["Toronto", "Canada"], ["Mumbai", "India"],
  ["Sydney", "Australia"], ["Madrid", "Spain"], ["Dubai", "United Arab Emirates"], ["Lisbon", "Portugal"], ["Seoul", "South Korea"],
  ["Paris", "France"], ["Amsterdam", "Netherlands"], ["Singapore", "Singapore"], ["Bengaluru", "India"], ["Chicago", "United States"],
];
const PRODUCTS = ["Pro plan", "Starter kit", "Annual membership", "Design course", "Premium template", "Consulting call"];
const TESTIMONIALS: Array<[string, string, string]> = [
  ["Sarah Mitchell", "Founder, Bloom Studio", "Setting up took ten minutes and the recent-sales popup paid for itself in the first week. Our pricing page converts noticeably better."],
  ["Daniel Okafor", "Marketing lead, Fitly", "We collect testimonials after every onboarding call now. The wall on our homepage looks great and we didn't write a single line of code."],
  ["Priya Raman", "Owner, Saffron & Co.", "Customers mention the live visitor counter all the time. It makes a small shop feel busy and trustworthy."],
  ["Marco Rossi", "E-commerce manager", "The Shopify webhook just worked. Every real order shows up as a notification within seconds."],
  ["Yuki Tanaka", "Indie developer", "Clean, fast and it doesn't break my site's design. Exactly what I wanted from a social proof tool."],
  ["Hannah Weber", "Agency owner", "We manage 30 client sites from one dashboard. The analytics per widget make our monthly reports easy."],
  ["Omar Haddad", "CEO, Tripwise", "The countdown bar for our launch week was a hit. Simple to schedule and it disappeared on time."],
  ["Chloe Martin", "Course creator", "My email list grew faster with the collector popup than with any form I tried before."],
  ["Lucas Silva", "Growth consultant", "Honest social proof from real data. I recommend it to every client who asks how to improve conversions."],
  ["Aisha Khan", "Product designer", "The editor is a joy to use and the live preview shows exactly what visitors will see."],
  ["Ethan Brooks", "SaaS founder", "Signups went up the week we added the conversion counter. Small change, real impact."],
  ["Nora Lindqvist", "Shop owner", "Support answered within hours and helped me set up WooCommerce. Five stars."],
];

function key(length: number): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.randomBytes(length), (b) => alphabet[b % alphabet.length]).join("");
}

type Tx = Transaction<Database> | Kysely<Database>;

async function addWidget<T extends WidgetType>(
  trx: Tx,
  siteId: number,
  type: T,
  name: string,
  overrides: { content?: Partial<ContentByType[T]>; design?: Partial<WidgetDesign>; rules?: Partial<WidgetRules>; active?: boolean; order: number },
  createdAt: string,
): Promise<number> {
  const d = widgetDefaults(type);
  const result = await trx
    .insertInto("widgets")
    .values({
      site_id: siteId,
      type,
      name,
      is_active: overrides.active === false ? 0 : 1,
      content: JSON.stringify(normalizeContent(type, { ...d.content, ...overrides.content })),
      design: JSON.stringify(normalizeDesign({ ...d.design, ...overrides.design })),
      rules: JSON.stringify(normalizeRules({ ...d.rules, ...overrides.rules })),
      sort_order: overrides.order,
      created_at: createdAt,
      updated_at: createdAt,
    })
    .executeTakeFirstOrThrow();
  return Number(result.insertId);
}

/** The platform's own hostname, so the demo site's widgets are allowed on the home page. */
function platformHost(siteUrl: string): string {
  const raw = siteUrl || process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") || "http://localhost";
  try {
    return new URL(raw).hostname.replace(/^www\./, "") || "localhost";
  } catch {
    return "localhost";
  }
}

export async function seedDemoWidgets(
  trx: Tx,
  options: { adminId: number; customerIds: number[]; siteUrl: string; rand: () => number },
): Promise<string> {
  const { rand } = options;
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const now = Date.now();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  const created = iso(35 * DAY);

  const sites: Array<{ userId: number; name: string; domain: string }> = [
    { userId: options.adminId, name: "Northwind Store", domain: platformHost(options.siteUrl) },
    ...options.customerIds.slice(0, 4).map((userId, i) => ({
      userId,
      name: ["Bloom Studio", "Fitly App", "Saffron & Co.", "Tripwise"][i],
      domain: ["bloomstudio.example", "fitly.example", "saffron.example", "tripwise.example"][i],
    })),
  ];

  let demoKey = "";
  for (const [index, s] of sites.entries()) {
    const publicKey = key(12);
    if (index === 0) demoKey = publicKey;
    const site = await trx
      .insertInto("sites")
      .values({
        user_id: s.userId,
        name: s.name,
        domain: s.domain,
        public_key: publicKey,
        webhook_token: key(32),
        settings: JSON.stringify({ ...DEFAULT_SITE_SETTINGS, captureForms: index === 0, notifyEmail: false }),
        verified_at: iso(index * 3_600_000 + 600_000),
        created_at: created,
        updated_at: created,
      })
      .executeTakeFirstOrThrow();
    const siteId = Number(site.insertId);

    const widgetIds: number[] = [];
    widgetIds.push(
      await addWidget(trx, siteId, "recent_activity", "Recent purchases", { order: 1, rules: { delaySec: 4, displaySec: 6, gapSec: 10 } }, created),
      await addWidget(trx, siteId, "review", "Customer reviews", { order: 2, design: { position: "bottom-right" }, rules: { delaySec: 12, gapSec: 14 } }, created),
      await addWidget(trx, siteId, "live_visitors", "Live visitors", { order: 3, content: { minCount: 1, scope: "site" }, design: { position: "bottom-right" }, rules: { delaySec: 30 } }, created),
      await addWidget(trx, siteId, "conversion_counter", "Signups today", { order: 4, active: index !== 0 }, created),
      await addWidget(trx, siteId, "coupon", "Welcome coupon", { order: 5, active: false }, created),
      await addWidget(trx, siteId, "email_collector", "Newsletter", { order: 6, active: index !== 0 }, created),
      await addWidget(trx, siteId, "announcement", "Launch week bar", { order: 7, active: false, content: { text: "Launch week: 30% off every plan", buttonText: "See pricing", buttonUrl: "/pricing", badge: "New" } }, created),
    );

    // Events: purchases and signups over the last 10 days, denser recently.
    const events = Array.from({ length: index === 0 ? 70 : 30 }, () => {
      const [city, country] = pick(PLACES);
      const signup = rand() < 0.35;
      return {
        site_id: siteId,
        source: pick(["webhook", "webhook", "form", "manual"] as const),
        kind: signup ? ("signup" as const) : ("purchase" as const),
        name: `${pick(NAMES)} ${String.fromCharCode(65 + Math.floor(rand() * 26))}.`,
        city,
        country,
        product: signup ? null : pick(PRODUCTS),
        url: null,
        image: null,
        rating: null,
        message: null,
        is_hidden: 0,
        created_at: iso(Math.floor(Math.pow(rand(), 2) * 10 * DAY)),
      };
    });
    await trx.insertInto("events").values(events).execute();

    // Testimonials: approved ones for the widgets and wall, a few waiting for moderation.
    const testimonials = TESTIMONIALS.map(([name, title, body], i) => ({
      site_id: siteId,
      name,
      email: null,
      title,
      avatar: null,
      rating: i % 5 === 4 ? 4 : 5,
      body,
      status: (index === 0 && i >= 10 ? "pending" : "approved") as "pending" | "approved",
      source: "form" as const,
      created_at: iso((i + 1) * 2 * DAY),
    }));
    await trx.insertInto("testimonials").values(index === 0 ? testimonials : testimonials.slice(0, 6)).execute();

    // Leads from the email collector.
    const leads = Array.from({ length: index === 0 ? 28 : 12 }, (_, i) => ({
      site_id: siteId,
      widget_id: widgetIds[5],
      email: `${pick(NAMES).toLowerCase()}.${i}@example.com`,
      name: null,
      data: null,
      page_url: pick(["/", "/pricing", "/blog/what-is-social-proof", "/features"]),
      created_at: iso(Math.floor(rand() * 25 * DAY)),
    }));
    await trx.insertInto("leads").values(leads).execute();

    // 30 days of statistics with a gentle upward trend.
    const scale = index === 0 ? 1 : 0.4 + rand() * 0.5;
    const stats: Database["widget_stats_daily"][] = [];
    for (let d = 29; d >= 0; d--) {
      const day = new Date(now - d * DAY).toISOString().slice(0, 10);
      const trend = (1 + (29 - d) * 0.025) * (new Date(now - d * DAY).getUTCDay() % 6 === 0 ? 0.75 : 1);
      widgetIds.slice(0, 4).forEach((widgetId, w) => {
        const impressions = Math.round([420, 260, 180, 140][w] * scale * trend * (0.85 + rand() * 0.3));
        const clicks = Math.round(impressions * [0.045, 0.03, 0.012, 0.02][w] * (0.8 + rand() * 0.4));
        stats.push({ widget_id: widgetId, day, impressions, hovers: Math.round(impressions * 0.12), clicks, conversions: Math.round(clicks * 0.25) });
      });
      const leadsWidget = widgetIds[5];
      const imp = Math.round(90 * scale * trend);
      stats.push({ widget_id: leadsWidget, day, impressions: imp, hovers: Math.round(imp * 0.2), clicks: Math.round(imp * 0.06), conversions: Math.round(imp * 0.03) });
    }
    await trx.insertInto("widget_stats_daily").values(stats).execute();
    const monthViews = stats.filter((r) => r.day.slice(0, 7) === new Date(now).toISOString().slice(0, 7)).reduce((n, r) => n + r.impressions, 0);
    await trx.insertInto("usage_monthly").values({ user_id: s.userId, month: new Date(now).toISOString().slice(0, 7), views: monthViews }).execute();
  }
  return demoKey;
}
