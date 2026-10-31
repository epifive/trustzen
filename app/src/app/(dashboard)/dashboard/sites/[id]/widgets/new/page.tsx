import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Crown } from "lucide-react";
import { TypeGallery } from "@/components/dashboard/widget-editor/type-gallery";
import { ButtonLink } from "@/components/ui/button";
import { formatNumber, loadSitePage } from "@/lib/dashboard-site";
import { getT } from "@/lib/i18n/server";
import { atLimit } from "@/lib/plans";
import { countUserWidgets } from "@/lib/widgets";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("editor.gallery.metaTitle") };
}

export default async function NewWidgetPage({ params }: Props) {
  const { id } = await params;
  const { user, site, entitlements, locale } = await loadSitePage(id);
  const [t, used] = await Promise.all([getT(), countUserWidgets(user.id)]);
  const locked = atLimit(used, entitlements.maxWidgets);

  return (
    <div>
      <Link href={`/dashboard/sites/${site.id}`} className="inline-flex max-w-full items-center gap-1.5 rounded-md text-sm text-muted transition-colors hover:text-primary">
        <ArrowLeft className="size-4 shrink-0 rtl:rotate-180" aria-hidden />
        <span className="truncate">{t("editor.backTo", { site: site.name })}</span>
      </Link>

      <div className="mt-3 mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{t("editor.gallery.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t("editor.gallery.text")}</p>
        </div>
        {entitlements.maxWidgets > 0 ? (
          <p className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted tabular-nums">
            {t("editor.gallery.usage", { used: formatNumber(used, locale), limit: formatNumber(entitlements.maxWidgets, locale) })}
          </p>
        ) : null}
      </div>

      {locked ? (
        <div className="mb-8 flex flex-col gap-4 rounded-xl border border-amber-300 bg-amber-50 p-5 sm:flex-row sm:items-center dark:border-amber-800 dark:bg-amber-950/40">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-marker text-[#3d2e00]" aria-hidden>
            <Crown className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-amber-950 dark:text-amber-100">{t("editor.gallery.limitTitle")}</p>
            <p className="mt-0.5 text-sm text-amber-900/80 dark:text-amber-200/80">
              {t("editor.gallery.limitText", { limit: formatNumber(entitlements.maxWidgets, locale) })}
            </p>
          </div>
          <ButtonLink href="/pricing" className="shrink-0">
            <Crown aria-hidden />
            {t("editor.gallery.upgrade")}
          </ButtonLink>
        </div>
      ) : null}

      <TypeGallery siteId={site.id} locked={locked} />
    </div>
  );
}
