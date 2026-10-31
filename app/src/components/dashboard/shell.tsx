"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Check,
  ChevronsUpDown,
  CircleUser,
  Crown,
  Globe,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquareQuote,
  Plus,
  Settings,
  Shield,
  Sparkles,
  TriangleAlert,
  Webhook,
  X,
  Zap,
} from "lucide-react";
import { logout } from "@/app/actions/auth";
import { Logo } from "@/components/site/logo";
import { ThemeToggle, type ThemeChoice } from "@/components/site/theme";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

export interface ShellSite {
  id: number;
  name: string;
  domain: string;
}

export interface ShellBanner {
  tone: "warning" | "danger";
  text: string;
}

const SITE_COOKIE = "tz_dash_site";

const SITE_NAV: Array<{ path: string; label: MessageKey; icon: typeof LayoutDashboard; exact?: boolean; also?: string }> = [
  { path: "", label: "dash.nav.overview", icon: Globe, exact: true },
  { path: "/widgets", label: "dash.nav.widgets", icon: LayoutGrid, also: "/dashboard/widgets/" },
  { path: "/events", label: "dash.nav.events", icon: Zap },
  { path: "/testimonials", label: "dash.nav.testimonials", icon: MessageSquareQuote },
  { path: "/leads", label: "dash.nav.leads", icon: Inbox },
  { path: "/integrations", label: "dash.nav.integrations", icon: Webhook },
  { path: "/analytics", label: "dash.nav.analytics", icon: BarChart3 },
  { path: "/settings", label: "dash.nav.settings", icon: Settings },
];

function siteIdFromPath(pathname: string): number | null {
  const m = /^\/dashboard\/sites\/(\d+)(?:\/|$)/.exec(pathname);
  return m ? Number(m[1]) : null;
}

const navLink = (active: boolean) =>
  cn(
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
    active ? "bg-primary-soft text-primary" : "text-muted hover:bg-paper hover:text-ink",
  );

function SiteSwitcher({ sites, current }: { sites: ShellSite[]; current: ShellSite | undefined }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    // Close after navigating.
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={t("dash.switcher.label")}
        className="flex w-full items-center gap-3 rounded-lg border border-line bg-paper px-3 py-2 text-start transition-colors hover:border-primary-line"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-sm font-semibold text-white uppercase" aria-hidden>
          {(current?.name || current?.domain || "+").slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{current ? current.name : t("dash.switcher.none")}</span>
          <span className="block truncate text-xs text-muted" dir="ltr">
            {current ? current.domain : t("dash.switcher.add")}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden />
      </button>
      {open ? (
        <div id={listId} className="absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-line bg-surface shadow-xl">
          {sites.length ? (
            <ul className="max-h-72 overflow-y-auto p-1" aria-label={t("dash.switcher.label")}>
              {sites.map((s) => {
                const active = s.id === current?.id;
                return (
                  <li key={s.id}>
                    <Link
                      href={`/dashboard/sites/${s.id}`}
                      aria-current={active ? "true" : undefined}
                      className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-primary-soft"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{s.name}</span>
                        <span className="block truncate text-xs text-muted" dir="ltr">
                          {s.domain}
                        </span>
                      </span>
                      {active ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <div className="border-t border-line p-1">
            <Link href="/dashboard/sites/new" className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-primary hover:bg-primary-soft">
              <Plus className="size-4" aria-hidden />
              {t("dash.switcher.add")}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DashboardShell({
  siteName,
  logo,
  logoDark,
  user,
  sites,
  initialSiteId,
  banner,
  demo,
  defaultTheme,
  isPremium,
  children,
}: {
  siteName: string;
  logo: string;
  logoDark: string;
  user: { name: string; email: string; isAdmin: boolean };
  sites: ShellSite[];
  initialSiteId: number | null;
  banner: ShellBanner | null;
  demo: boolean;
  defaultTheme: ThemeChoice;
  isPremium: boolean;
  children: ReactNode;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const pathSiteId = siteIdFromPath(pathname);
  const [rememberedId, setRememberedId] = useState<number | null>(initialSiteId);

  // Derived state updates during render (no effect needed): close the drawer and
  // remember the site after each navigation.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  if (pathSiteId !== null && pathSiteId !== rememberedId) setRememberedId(pathSiteId);

  const current = sites.find((s) => s.id === (pathSiteId ?? rememberedId)) ?? (pathSiteId === null ? sites[0] : undefined);

  useEffect(() => {
    if (current) document.cookie = `${SITE_COOKIE}=${current.id};path=/;max-age=31536000;samesite=lax`;
  }, [current]);

  // A site created or deleted by a Server Action redirect: reload the sidebar's site list once.
  const refreshed = useRef<number | null>(null);
  useEffect(() => {
    if (pathSiteId !== null && !sites.some((s) => s.id === pathSiteId) && refreshed.current !== pathSiteId) {
      refreshed.current = pathSiteId;
      router.refresh();
    }
  }, [pathSiteId, sites, router]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const base = current ? `/dashboard/sites/${current.id}` : null;

  const nav = (
    <nav aria-label={t("dash.nav.label")} className="flex-1 overflow-y-auto px-3 py-4">
      <Link href="/dashboard" aria-current={pathname === "/dashboard" ? "page" : undefined} className={navLink(pathname === "/dashboard")}>
        <LayoutDashboard className="size-[18px]" aria-hidden />
        {t("dash.nav.home")}
      </Link>

      <div className="mt-4">
        <p className="mb-2 px-1 text-[11px] font-semibold tracking-wider text-muted uppercase">{t("dash.nav.website")}</p>
        <SiteSwitcher sites={sites} current={current} />
      </div>

      {base ? (
        <ul className="mt-3 space-y-0.5" aria-label={t("dash.nav.siteLabel")}>
          {SITE_NAV.map((item) => {
            const href = `${base}${item.path}`;
            const active = item.exact
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`) || Boolean(item.also && pathname.startsWith(item.also));
            return (
              <li key={item.path}>
                <Link href={href} aria-current={active ? "page" : undefined} className={navLink(active)}>
                  <item.icon className="size-[18px]" aria-hidden />
                  {t(item.label)}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <Link href="/dashboard/sites/new" className={cn(navLink(pathname === "/dashboard/sites/new"), "mt-3")}>
          <Plus className="size-[18px]" aria-hidden />
          {t("dash.switcher.add")}
        </Link>
      )}
    </nav>
  );

  const footer = (
    <div className="space-y-0.5 border-t border-line p-3">
      <Link href="/account" className={navLink(false)}>
        <CircleUser className="size-[18px]" aria-hidden />
        {t("dash.nav.account")}
      </Link>
      <Link href="/pricing" className={navLink(false)}>
        {isPremium ? <Sparkles className="size-[18px]" aria-hidden /> : <Crown className="size-[18px] text-amber-500" aria-hidden />}
        {isPremium ? t("dash.nav.pricing") : t("dash.nav.upgrade")}
      </Link>
      {user.isAdmin ? (
        <Link href="/admin" className={navLink(false)}>
          <Shield className="size-[18px]" aria-hidden />
          {t("nav.admin")}
        </Link>
      ) : null}
      <div className="mt-2 flex items-center gap-2 border-t border-line px-1 pt-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
        <ThemeToggle defaultTheme={defaultTheme} />
        <form action={logout}>
          <button
            type="submit"
            aria-label={t("nav.signOut")}
            title={t("nav.signOut")}
            className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-primary-soft hover:text-ink"
          >
            <LogOut className="size-[18px] rtl:rotate-180" aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[264px_1fr]">
      <a
        href="#dash-main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
      >
        {t("nav.skipToContent")}
      </a>
      <aside className="sticky top-0 hidden h-dvh flex-col border-e border-line bg-surface lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-line px-5">
          <Logo siteName={siteName} logo={logo} logoDark={logoDark} href="/dashboard" />
        </div>
        {nav}
        {footer}
      </aside>

      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("nav.openMenu")}
          aria-expanded={open}
          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-primary-soft hover:text-ink"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <Logo siteName={siteName} logo={logo} logoDark={logoDark} href="/dashboard" />
        {current ? (
          <span className="ms-auto max-w-[40%] truncate text-xs text-muted" dir="ltr">
            {current.domain}
          </span>
        ) : null}
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("dash.nav.label")}>
          <button type="button" aria-label={t("nav.closeMenu")} onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 start-0 flex w-[min(20rem,88vw)] flex-col bg-surface shadow-2xl">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
              <Logo siteName={siteName} logo={logo} logoDark={logoDark} href="/dashboard" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("nav.closeMenu")}
                className="grid size-9 place-items-center rounded-lg text-muted hover:bg-primary-soft hover:text-ink"
                autoFocus
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      ) : null}

      <main id="dash-main" className="min-w-0">
        {demo ? <p className="bg-marker px-4 py-2 text-center text-sm font-medium text-[#3d2e00]">{t("dash.demo")}</p> : null}
        {banner ? (
          <div
            role="status"
            className={cn(
              "flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-4 py-2 text-center text-sm",
              banner.tone === "danger"
                ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
            )}
          >
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            <span>{banner.text}</span>
            <Link href="/pricing" className="font-semibold underline underline-offset-2">
              {t("dash.banner.cta")}
            </Link>
          </div>
        ) : null}
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
