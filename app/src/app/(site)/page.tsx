import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Faq } from "@/components/site/landing/faq";
import { FinalCta } from "@/components/site/landing/final-cta";
import { Hero, ProofStrip } from "@/components/site/landing/hero";
import { HowItWorks } from "@/components/site/landing/how-it-works";
import { Integrations } from "@/components/site/landing/integrations";
import { PricingTeaser, type TeaserPlan } from "@/components/site/landing/pricing-teaser";
import { Privacy } from "@/components/site/landing/privacy";
import { SectionHeading } from "@/components/site/landing/section-heading";
import { WallFrame } from "@/components/site/landing/wall-frame";
import { WidgetShowcase } from "@/components/site/landing/widget-showcase";
import { PostCard } from "@/components/site/post-card";
import { getLatestPosts } from "@/lib/blog";
import { getDb } from "@/lib/db";
import { getT, localSetting } from "@/lib/i18n/server";
import { getActivePlans } from "@/lib/plans";
import { absoluteUrl, getSiteContext } from "@/lib/site";
import { getSiteByKey } from "@/lib/sites";

const WALL_LIMIT = 6;

/** The platform's own site (Admin → Settings) when it has approved testimonials to show. */
async function ownWallKey(key: string): Promise<string | null> {
  if (!/^[A-Za-z0-9]{8,32}$/.test(key)) return null;
  const site = await getSiteByKey(key);
  if (!site) return null;
  const db = await getDb();
  const [owner, approved] = await Promise.all([
    db.selectFrom("users").select("status").where("id", "=", site.user_id).executeTakeFirst(),
    db.selectFrom("testimonials").select("id").where("site_id", "=", site.id).where("status", "=", "approved").limit(1).executeTakeFirst(),
  ]);
  return owner?.status === "active" && approved ? site.public_key : null;
}

export default async function HomePage() {
  const { settings, user, blogVisible, locale } = await getSiteContext();
  const [t, heroTitle, heroSubtitle, posts, plans, wallKey] = await Promise.all([
    getT(),
    localSetting(settings, "home_hero_title"),
    localSetting(settings, "home_hero_subtitle"),
    blogVisible ? getLatestPosts(3) : Promise.resolve([]),
    getActivePlans(),
    ownWallKey(settings.own_site_key),
  ]);
  const ownWidgetsLive = /^[A-Za-z0-9]{8,32}$/.test(settings.own_site_key);
  const teaserPlans: TeaserPlan[] = plans.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    priceMonthly: p.price_monthly,
    isFree: p.is_free === 1,
    isFeatured: p.is_featured === 1,
    maxSites: p.max_sites,
    maxWidgets: p.max_widgets,
    maxMonthlyViews: p.max_monthly_views,
  }));

  return (
    <>
      <Hero t={t} title={heroTitle} subtitle={heroSubtitle} signedIn={Boolean(user)} liveSiteName={ownWidgetsLive ? settings.site_name : null} />
      <ProofStrip t={t} showStats={settings.show_stats_on_home} />
      <WidgetShowcase t={t} />
      <HowItWorks t={t} scriptUrl={absoluteUrl(settings, "/w.js")} locale={locale.code} />
      <Integrations t={t} />

      {wallKey ? (
        <section aria-labelledby="wall-title" className="border-t border-line bg-surface py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHeading id="wall-title" align="center" eyebrow={t("home.wallEyebrow")} title={t("home.wallTitle")} text={t("home.wallText")} />
            <div className="-mx-4 mt-12">
              <WallFrame siteKey={wallKey} limit={WALL_LIMIT} title={t("home.wallFrame")} />
            </div>
          </div>
        </section>
      ) : null}

      <Privacy t={t} />
      <PricingTeaser t={t} plans={teaserPlans} currency={settings.currency} locale={locale.code} />
      <Faq t={t} />

      {posts.length ? (
        <section aria-labelledby="posts-title" className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="posts-title" className="text-3xl font-bold tracking-tight">
              {t("home.latestPosts")}
            </h2>
            <Link href="/blog" className="group inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
              {t("home.allPosts")}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden />
            </Link>
          </div>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard post={post} readMore={t("blog.readMore")} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <FinalCta t={t} signedIn={Boolean(user)} />
    </>
  );
}
