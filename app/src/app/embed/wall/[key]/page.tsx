import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { approvedTestimonials, brandingFor } from "@/lib/embed";
import { getLocale, getT } from "@/lib/i18n/server";
import { getEntitlements } from "@/lib/plans";
import { getSettings } from "@/lib/settings";
import { getSiteByKey } from "@/lib/sites";
import { uploadUrl } from "@/lib/site";
import { cn } from "@/lib/utils";
import type { EmbedTestimonial } from "@/widget/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Testimonials",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ key: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const intParam = (v: string, fallback: number, min: number, max: number) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/**
 * Posts the wall's height to the embedding page so it can size the iframe:
 *   window.addEventListener("message", (e) => {
 *     if (e.data && e.data.source === "trustzen-wall") iframe.style.height = e.data.height + "px";
 *   });
 */
const RESIZE_SCRIPT = `(function(){var el=document.getElementById("tz-wall");if(!el||window.parent===window)return;var last=0;function send(){var h=Math.ceil(el.getBoundingClientRect().height);if(h!==last){last=h;window.parent.postMessage({source:"trustzen-wall",height:h},"*");}}if(window.ResizeObserver){new ResizeObserver(send).observe(el);}window.addEventListener("load",send);window.addEventListener("resize",send);send();})();`;

function avatarSrc(avatar: string): string {
  const src = uploadUrl(avatar.trim());
  return /^https?:\/\/[^\s"'<>]+$/i.test(src) || /^\/(?!\/)[^\s"'<>]*$/.test(src) ? src : "";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase() || "?";
}

function Stars({ rating, label }: { rating: number; label: string }) {
  return (
    <div role="img" aria-label={label} className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 20 20" aria-hidden className={cn("size-4", i <= rating ? "fill-amber-400" : "fill-current text-line")}>
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </div>
  );
}

function Card({ item, ratingLabel }: { item: EmbedTestimonial; ratingLabel: string }) {
  const src = avatarSrc(item.avatar);
  return (
    <figure className="mb-4 break-inside-avoid rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <Stars rating={item.rating} label={ratingLabel} />
      <blockquote className="mt-3 text-[15px] leading-relaxed whitespace-pre-line text-ink">{item.body}</blockquote>
      <figcaption className="mt-4 flex items-center gap-3">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatars may live on other hosts
          <img src={src} alt="" loading="lazy" className="size-10 shrink-0 rounded-full object-cover ring-1 ring-line" />
        ) : (
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary-text">
            {initials(item.name)}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">{item.name}</span>
          {item.title ? <span className="block truncate text-xs text-muted">{item.title}</span> : null}
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * Embeddable testimonial wall: /embed/wall/{key}?theme=light|dark|auto&limit=1-50&minRating=1-5&bg=transparent&accent=0f766e
 * Embed with an <iframe>; see RESIZE_SCRIPT for automatic height.
 */
export default async function WallPage({ params, searchParams }: Props) {
  const [{ key }, query] = await Promise.all([params, searchParams]);
  const theme = one(query.theme) === "dark" ? "dark" : one(query.theme) === "auto" ? "auto" : "light";
  const transparent = one(query.bg) === "transparent";
  const limit = intParam(one(query.limit), 20, 1, 50);
  const minRating = intParam(one(query.minRating), 1, 1, 5);
  const accent = /^[0-9a-f]{6}$/i.test(one(query.accent)) ? `#${one(query.accent)}` : "";

  const [t, locale, settings, site] = await Promise.all([getT(), getLocale(), getSettings(), getSiteByKey(key)]);
  const primary = accent || (/^#[0-9a-fA-F]{3,8}$/.test(settings.primary_color) ? settings.primary_color : "#5b3fc4");
  let items: EmbedTestimonial[] = [];
  let branding: { text: string; url: string } | null = null;
  if (site) {
    const db = await getDb();
    const owner = await db.selectFrom("users").select(["id", "role", "status", "plan_id", "plan_expires_at"]).where("id", "=", site.user_id).executeTakeFirst();
    if (owner?.status === "active") {
      const [list, entitlements] = await Promise.all([approvedTestimonials(site.id, minRating, limit), getEntitlements(owner)]);
      items = list;
      branding = brandingFor(settings, entitlements);
    }
  }

  return (
    <>
      <style>{`html,body{background:transparent!important;min-height:0!important}#tz-wall{--primary:${primary}}`}</style>
      <div id="tz-wall" dir={locale.dir} lang={locale.code} className={cn(theme === "dark" && "dark", "text-ink")} style={{ colorScheme: theme === "auto" ? "light dark" : theme }}>
        <div className={cn("p-4", !transparent && "bg-paper")}>
          {items.length ? (
            <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
              {items.map((item, i) => (
                <Card key={i} item={item} ratingLabel={t("collect.wallRating", { rating: item.rating })} />
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted">{t("collect.wallEmpty")}</p>
          )}
          {branding ? (
            <p className="mt-1 text-center text-xs text-muted">
              <a href={branding.url} target="_blank" rel="noopener" className="hover:text-primary-text">
                {branding.text}
              </a>
            </p>
          ) : null}
        </div>
      </div>
      {theme === "auto" ? (
        <script dangerouslySetInnerHTML={{ __html: "if(matchMedia('(prefers-color-scheme: dark)').matches)document.getElementById('tz-wall').classList.add('dark')" }} />
      ) : null}
      <script dangerouslySetInnerHTML={{ __html: RESIZE_SCRIPT }} />
    </>
  );
}
