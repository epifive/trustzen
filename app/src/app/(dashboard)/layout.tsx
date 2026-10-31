import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { DashboardShell, type ShellBanner } from "@/components/dashboard/shell";
import { BrandStyle } from "@/components/site/brand-style";
import { ThemeScript, type ThemeChoice } from "@/components/site/theme";
import { isDemoMode } from "@/lib/config";
import { requireDashboardUser } from "@/lib/dashboard";
import { formatNumber } from "@/lib/dashboard-site";
import { I18nProvider } from "@/lib/i18n/client";
import { getClientMessages, getLocale, getT } from "@/lib/i18n/server";
import { atLimit, getEntitlements } from "@/lib/plans";
import { getSettings } from "@/lib/settings";
import { uploadUrl } from "@/lib/site";
import { getUserSites } from "@/lib/sites";
import { getMonthlyViews } from "@/lib/usage";
import { countUserWidgets } from "@/lib/widgets";

// Every dashboard page reads the signed-in user's data at request time.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, t] = await Promise.all([getSettings(), getT()]);
  const favicon = uploadUrl(settings.favicon);
  return {
    title: { default: t("dash.title"), template: `%s${settings.title_separator}${settings.site_name}` },
    robots: { index: false, follow: false },
    icons: favicon ? { icon: favicon, apple: favicon } : { icon: "/icon.svg" },
  };
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireDashboardUser();
  const [settings, locale, t, messages, entitlements, sites, widgets, views, jar] = await Promise.all([
    getSettings(),
    getLocale(),
    getT(),
    getClientMessages(),
    getEntitlements(user),
    getUserSites(user.id),
    countUserWidgets(user.id),
    getMonthlyViews(user.id),
    cookies(),
  ]);

  // Over a plan limit, or close to the monthly view quota.
  let banner: ShellBanner | null = null;
  const overSites = entitlements.maxSites > 0 && sites.length > entitlements.maxSites;
  const overWidgets = entitlements.maxWidgets > 0 && widgets > entitlements.maxWidgets;
  if (atLimit(views, entitlements.maxMonthlyViews)) {
    banner = { tone: "danger", text: t("dash.banner.viewsReached", { limit: formatNumber(entitlements.maxMonthlyViews, locale.code) }) };
  } else if (overSites || overWidgets) {
    banner = { tone: "danger", text: t("dash.banner.overLimit") };
  } else if (entitlements.maxMonthlyViews > 0 && views >= entitlements.maxMonthlyViews * 0.8) {
    banner = {
      tone: "warning",
      text: t("dash.banner.viewsNear", {
        percent: Math.floor((views / entitlements.maxMonthlyViews) * 100),
        limit: formatNumber(entitlements.maxMonthlyViews, locale.code),
      }),
    };
  }

  const remembered = Number(jar.get("tz_dash_site")?.value);
  const langScript = `document.documentElement.lang=${JSON.stringify(locale.code)};document.documentElement.dir=${JSON.stringify(locale.dir)};`;

  return (
    <I18nProvider messages={messages}>
      <ThemeScript defaultTheme={settings.default_theme as ThemeChoice} />
      <script dangerouslySetInnerHTML={{ __html: langScript }} />
      <BrandStyle color={settings.primary_color} />
      <div dir={locale.dir} lang={locale.code}>
        <DashboardShell
          siteName={settings.site_name}
          logo={uploadUrl(settings.logo)}
          logoDark={uploadUrl(settings.logo_dark)}
          user={{ name: user.name, email: user.email, isAdmin: user.role === "admin" }}
          sites={sites.map((s) => ({ id: s.id, name: s.name, domain: s.domain }))}
          initialSiteId={Number.isInteger(remembered) && remembered > 0 ? remembered : null}
          banner={banner}
          demo={isDemoMode()}
          defaultTheme={settings.default_theme as ThemeChoice}
          isPremium={entitlements.isPremium}
        >
          {children}
        </DashboardShell>
      </div>
    </I18nProvider>
  );
}
