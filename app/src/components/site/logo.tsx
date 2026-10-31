import Link from "next/link";
import { cn } from "@/lib/utils";

/** Default brand mark: a notification bubble with a highlighted badge. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <rect x="5.5" y="9.5" width="20" height="12.5" rx="3.5" fill="white" />
      <path d="M9.5 21.5v4.5l4.5-4.5z" fill="white" />
      <circle cx="10.5" cy="15.75" r="2.3" fill="var(--primary)" fillOpacity=".55" />
      <rect x="14.5" y="13.4" width="7.5" height="1.9" rx=".95" fill="var(--primary)" fillOpacity=".5" />
      <rect x="14.5" y="16.6" width="5" height="1.9" rx=".95" fill="var(--primary)" fillOpacity=".3" />
      <circle cx="25" cy="8.5" r="3.6" fill="var(--marker)" stroke="var(--primary)" strokeWidth="1.6" />
    </svg>
  );
}

export function Logo({
  siteName,
  logo,
  logoDark,
  href = "/",
  className,
}: {
  siteName: string;
  logo?: string;
  logoDark?: string;
  href?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)} aria-label={`${siteName} home`}>
      {logo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded logo of unknown size */}
          <img src={logo} alt={siteName} className={cn("h-8 w-auto", logoDark && "dark:hidden")} />
          {logoDark ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoDark} alt={siteName} className="hidden h-8 w-auto dark:block" />
          ) : null}
        </>
      ) : (
        <>
          <BrandMark />
          <span className="font-display text-xl font-bold tracking-tight text-ink">{siteName}</span>
        </>
      )}
    </Link>
  );
}
