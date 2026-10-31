import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BrandStyle } from "@/components/site/brand-style";
import { ThemeScript, type ThemeChoice } from "@/components/site/theme";
import { I18nProvider } from "@/lib/i18n/client";
import { getClientMessages, getLocale } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";

// Reads settings and the site from the database at request time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Minimal layout for public testimonial collection pages (/t/{key}): no site
 * header or footer. The root layout provides <html>, <body>, fonts and styles.
 */
export default async function CollectLayout({ children }: { children: ReactNode }) {
  const [settings, locale, messages] = await Promise.all([getSettings(), getLocale(), getClientMessages()]);
  const langScript = `document.documentElement.lang=${JSON.stringify(locale.code)};document.documentElement.dir=${JSON.stringify(locale.dir)};`;
  return (
    <I18nProvider messages={messages}>
      <ThemeScript defaultTheme={settings.default_theme as ThemeChoice} />
      <script dangerouslySetInnerHTML={{ __html: langScript }} />
      <BrandStyle color={settings.primary_color} />
      <div dir={locale.dir} lang={locale.code}>
        {children}
      </div>
    </I18nProvider>
  );
}
