import "server-only";
import { sql, type Kysely } from "kysely";
import type { Migration, MigrationProvider } from "kysely/migration";
import { DEFAULT_PAGES } from "./seed-pages";
import { DEFAULT_POSTS } from "./seed-posts";

/**
 * Versioned schema migrations. They run automatically on first database
 * access after an update, so operators only need to replace files and restart.
 * Never edit a released migration: add a new one instead.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = Kysely<any>;

const ts = () => new Date().toISOString();

const migrations: Record<string, Migration> = {
  "2026_10_16_000001_initial_schema": {
    async up(db: AnyDb) {
      await db.schema
        .createTable("settings")
        .addColumn("key", "varchar(100)", (c) => c.primaryKey())
        .addColumn("value", "text")
        .execute();

      await db.schema
        .createTable("users")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("name", "varchar(120)", (c) => c.notNull())
        .addColumn("email", "varchar(190)", (c) => c.notNull().unique())
        .addColumn("password_hash", "varchar(255)", (c) => c.notNull())
        .addColumn("role", "varchar(20)", (c) => c.notNull().defaultTo("user"))
        .addColumn("status", "varchar(20)", (c) => c.notNull().defaultTo("active"))
        .addColumn("plan_id", "integer")
        .addColumn("plan_expires_at", "varchar(32)")
        .addColumn("stripe_customer_id", "varchar(100)")
        .addColumn("stripe_subscription_id", "varchar(100)")
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .addColumn("updated_at", "varchar(32)", (c) => c.notNull())
        .execute();

      await db.schema
        .createTable("sessions")
        .addColumn("id", "varchar(64)", (c) => c.primaryKey())
        .addColumn("user_id", "integer", (c) => c.notNull())
        .addColumn("expires_at", "varchar(32)", (c) => c.notNull())
        .addColumn("ip", "varchar(64)")
        .addColumn("user_agent", "varchar(255)")
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("sessions_user_id_idx").on("sessions").column("user_id").execute();

      await db.schema
        .createTable("password_resets")
        .addColumn("token_hash", "varchar(64)", (c) => c.primaryKey())
        .addColumn("user_id", "integer", (c) => c.notNull())
        .addColumn("expires_at", "varchar(32)", (c) => c.notNull())
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .execute();

      await db.schema
        .createTable("plans")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("name", "varchar(100)", (c) => c.notNull())
        .addColumn("description", "varchar(255)")
        .addColumn("price_monthly", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("price_yearly", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("features", "text")
        // 0 means unlimited for the three limits below.
        .addColumn("max_sites", "integer", (c) => c.notNull().defaultTo(1))
        .addColumn("max_widgets", "integer", (c) => c.notNull().defaultTo(3))
        .addColumn("max_monthly_views", "integer", (c) => c.notNull().defaultTo(1000))
        .addColumn("remove_branding", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("is_free", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("is_active", "integer", (c) => c.notNull().defaultTo(1))
        .addColumn("is_featured", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("sort_order", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .execute();

      await db.schema
        .createTable("payments")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("user_id", "integer", (c) => c.notNull())
        .addColumn("plan_id", "integer", (c) => c.notNull())
        .addColumn("amount", "integer", (c) => c.notNull())
        .addColumn("currency", "varchar(10)", (c) => c.notNull())
        .addColumn("billing_cycle", "varchar(10)", (c) => c.notNull())
        .addColumn("provider", "varchar(20)", (c) => c.notNull())
        .addColumn("provider_ref", "varchar(190)", (c) => c.notNull().unique())
        .addColumn("status", "varchar(20)", (c) => c.notNull())
        .addColumn("note", "text")
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("payments_user_id_idx").on("payments").column("user_id").execute();

      await db.schema
        .createTable("pages")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("slug", "varchar(120)", (c) => c.notNull().unique())
        .addColumn("title", "varchar(255)", (c) => c.notNull())
        .addColumn("content", "text", (c) => c.notNull())
        .addColumn("meta_description", "varchar(255)")
        .addColumn("is_published", "integer", (c) => c.notNull().defaultTo(1))
        .addColumn("show_in_footer", "integer", (c) => c.notNull().defaultTo(1))
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .addColumn("updated_at", "varchar(32)", (c) => c.notNull())
        .execute();

      await db.schema
        .createTable("contact_messages")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("name", "varchar(120)", (c) => c.notNull())
        .addColumn("email", "varchar(190)", (c) => c.notNull())
        .addColumn("subject", "varchar(255)", (c) => c.notNull())
        .addColumn("message", "text", (c) => c.notNull())
        .addColumn("ip", "varchar(64)")
        .addColumn("is_read", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .execute();
      await db.schema
        .createTable("languages")
        .addColumn("code", "varchar(12)", (c) => c.primaryKey())
        .addColumn("name", "varchar(60)", (c) => c.notNull())
        .addColumn("native_name", "varchar(60)", (c) => c.notNull())
        .addColumn("direction", "varchar(3)", (c) => c.notNull().defaultTo("ltr"))
        .addColumn("is_active", "integer", (c) => c.notNull().defaultTo(1))
        .addColumn("sort_order", "integer", (c) => c.notNull().defaultTo(0))
        .execute();

      await db.schema
        .createTable("translations")
        .addColumn("lang", "varchar(12)", (c) => c.notNull())
        .addColumn("key", "varchar(190)", (c) => c.notNull())
        .addColumn("value", "text", (c) => c.notNull())
        .addPrimaryKeyConstraint("translations_pk", ["lang", "key"])
        .execute();

      await db.schema
        .createTable("posts")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("slug", "varchar(160)", (c) => c.notNull().unique())
        .addColumn("title", "varchar(255)", (c) => c.notNull())
        .addColumn("excerpt", "varchar(500)")
        .addColumn("content", "text", (c) => c.notNull())
        .addColumn("cover_image", "varchar(500)")
        .addColumn("meta_description", "varchar(255)")
        .addColumn("status", "varchar(12)", (c) => c.notNull().defaultTo("draft"))
        .addColumn("published_at", "varchar(32)")
        .addColumn("views", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .addColumn("updated_at", "varchar(32)", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("posts_status_published_idx").on("posts").columns(["status", "published_at"]).execute();

      // ── Social proof ──
      await db.schema
        .createTable("sites")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("user_id", "integer", (c) => c.notNull())
        .addColumn("name", "varchar(120)", (c) => c.notNull())
        .addColumn("domain", "varchar(190)", (c) => c.notNull())
        .addColumn("public_key", "varchar(32)", (c) => c.notNull().unique())
        .addColumn("webhook_token", "varchar(48)", (c) => c.notNull().unique())
        .addColumn("settings", "text", (c) => c.notNull())
        .addColumn("verified_at", "varchar(32)")
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .addColumn("updated_at", "varchar(32)", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("sites_user_id_idx").on("sites").column("user_id").execute();

      await db.schema
        .createTable("widgets")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("site_id", "integer", (c) => c.notNull())
        .addColumn("type", "varchar(30)", (c) => c.notNull())
        .addColumn("name", "varchar(120)", (c) => c.notNull())
        .addColumn("is_active", "integer", (c) => c.notNull().defaultTo(1))
        .addColumn("content", "text", (c) => c.notNull())
        .addColumn("design", "text", (c) => c.notNull())
        .addColumn("rules", "text", (c) => c.notNull())
        .addColumn("sort_order", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .addColumn("updated_at", "varchar(32)", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("widgets_site_id_idx").on("widgets").column("site_id").execute();

      await db.schema
        .createTable("events")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("site_id", "integer", (c) => c.notNull())
        .addColumn("source", "varchar(20)", (c) => c.notNull())
        .addColumn("kind", "varchar(20)", (c) => c.notNull())
        .addColumn("name", "varchar(120)")
        .addColumn("city", "varchar(120)")
        .addColumn("country", "varchar(120)")
        .addColumn("product", "varchar(255)")
        .addColumn("url", "varchar(500)")
        .addColumn("image", "varchar(500)")
        .addColumn("rating", "integer")
        .addColumn("message", "varchar(500)")
        .addColumn("is_hidden", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("events_site_created_idx").on("events").columns(["site_id", "created_at"]).execute();

      await db.schema
        .createTable("testimonials")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("site_id", "integer", (c) => c.notNull())
        .addColumn("name", "varchar(120)", (c) => c.notNull())
        .addColumn("email", "varchar(190)")
        .addColumn("title", "varchar(160)")
        .addColumn("avatar", "varchar(500)")
        .addColumn("rating", "integer", (c) => c.notNull().defaultTo(5))
        .addColumn("body", "text", (c) => c.notNull())
        .addColumn("status", "varchar(12)", (c) => c.notNull().defaultTo("pending"))
        .addColumn("source", "varchar(20)", (c) => c.notNull().defaultTo("form"))
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("testimonials_site_status_idx").on("testimonials").columns(["site_id", "status"]).execute();

      await db.schema
        .createTable("leads")
        .addColumn("id", "integer", (c) => c.primaryKey().autoIncrement())
        .addColumn("site_id", "integer", (c) => c.notNull())
        .addColumn("widget_id", "integer")
        .addColumn("email", "varchar(190)", (c) => c.notNull())
        .addColumn("name", "varchar(120)")
        .addColumn("data", "text")
        .addColumn("page_url", "varchar(500)")
        .addColumn("created_at", "varchar(32)", (c) => c.notNull())
        .execute();
      await db.schema.createIndex("leads_site_created_idx").on("leads").columns(["site_id", "created_at"]).execute();

      await db.schema
        .createTable("widget_stats_daily")
        .addColumn("widget_id", "integer", (c) => c.notNull())
        .addColumn("day", "varchar(10)", (c) => c.notNull())
        .addColumn("impressions", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("hovers", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("clicks", "integer", (c) => c.notNull().defaultTo(0))
        .addColumn("conversions", "integer", (c) => c.notNull().defaultTo(0))
        .addPrimaryKeyConstraint("widget_stats_daily_pk", ["widget_id", "day"])
        .execute();

      // Live visitor heartbeats (one row per visitor per site, refreshed every minute).
      await db.schema
        .createTable("presence")
        .addColumn("site_id", "integer", (c) => c.notNull())
        .addColumn("visitor", "varchar(32)", (c) => c.notNull())
        .addColumn("path", "varchar(255)", (c) => c.notNull())
        .addColumn("seen_at", "varchar(32)", (c) => c.notNull())
        .addPrimaryKeyConstraint("presence_pk", ["site_id", "visitor"])
        .execute();
      await db.schema.createIndex("presence_site_seen_idx").on("presence").columns(["site_id", "seen_at"]).execute();

      await db.schema
        .createTable("usage_monthly")
        .addColumn("user_id", "integer", (c) => c.notNull())
        .addColumn("month", "varchar(7)", (c) => c.notNull())
        .addColumn("views", "integer", (c) => c.notNull().defaultTo(0))
        .addPrimaryKeyConstraint("usage_monthly_pk", ["user_id", "month"])
        .execute();
    },
    async down(db: AnyDb) {
      for (const table of [
        "usage_monthly",
        "presence",
        "widget_stats_daily",
        "leads",
        "testimonials",
        "events",
        "widgets",
        "sites",
        "posts",
        "translations",
        "languages",
        "contact_messages",
        "pages",
        "payments",
        "plans",
        "password_resets",
        "sessions",
        "users",
        "settings",
      ]) {
        await db.schema.dropTable(table).ifExists().execute();
      }
    },
  },

  "2026_10_16_000002_seed_defaults": {
    async up(db: AnyDb) {
      const now = ts();
      await db
        .insertInto("plans")
        .values([
          {
            name: "Free",
            description: "Try social proof on one website.",
            price_monthly: 0,
            price_yearly: 0,
            features: ["1 website", "3 widgets", "1,000 widget views per month", "All widget types", "Testimonial collection page"].join("\n"),
            max_sites: 1,
            max_widgets: 3,
            max_monthly_views: 1000,
            remove_branding: 0,
            is_free: 1,
            is_active: 1,
            is_featured: 0,
            sort_order: 1,
            created_at: now,
          },
          {
            name: "Pro",
            description: "For growing businesses and stores.",
            price_monthly: 1900,
            price_yearly: 19000,
            features: [
              "5 websites",
              "30 widgets",
              "50,000 widget views per month",
              "Webhooks and integrations",
              "Priority support",
            ].join("\n"),
            max_sites: 5,
            max_widgets: 30,
            max_monthly_views: 50000,
            remove_branding: 1,
            is_free: 0,
            is_active: 1,
            is_featured: 1,
            sort_order: 2,
            created_at: now,
          },
          {
            name: "Agency",
            description: "For agencies managing many client websites.",
            price_monthly: 4900,
            price_yearly: 49000,
            features: [
              "50 websites",
              "Unlimited widgets",
              "500,000 widget views per month",
              "Webhooks and integrations",
              "Priority support",
            ].join("\n"),
            max_sites: 50,
            max_widgets: 0,
            max_monthly_views: 500000,
            remove_branding: 1,
            is_free: 0,
            is_active: 1,
            is_featured: 0,
            sort_order: 3,
            created_at: now,
          },
        ])
        .execute();

      await db
        .insertInto("pages")
        .values(
          DEFAULT_PAGES.map((p) => ({
            slug: p.slug,
            title: p.title,
            content: p.content,
            meta_description: p.metaDescription,
            is_published: 1,
            show_in_footer: 1,
            created_at: now,
            updated_at: now,
          })),
        )
        .execute();

      await db.insertInto("languages").values({ code: "en", name: "English", native_name: "English", direction: "ltr", is_active: 1, sort_order: 0 }).execute();
      await db
        .insertInto("posts")
        .values(
          DEFAULT_POSTS.map((p, i) => ({
            slug: p.slug,
            title: p.title,
            excerpt: p.excerpt,
            content: p.content,
            cover_image: null,
            meta_description: p.metaDescription,
            status: "published",
            published_at: new Date(Date.now() - (DEFAULT_POSTS.length - i) * 86_400_000).toISOString(),
            views: 0,
            created_at: now,
            updated_at: now,
          })),
        )
        .execute();
    },
    async down(db: AnyDb) {
      for (const table of ["posts", "languages", "pages", "plans"]) await sql`DELETE FROM ${sql.table(table)}`.execute(db);
    },
  },
};

export const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations;
  },
};
