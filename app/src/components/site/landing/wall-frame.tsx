"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "pending";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
const getTheme = (): Theme => (document.documentElement.classList.contains("dark") ? "dark" : "light");
const getServerTheme = (): Theme => "pending";

/**
 * The platform's own testimonial wall (/embed/wall/{key}) in an auto-sized iframe.
 * Follows the site's theme toggle rather than the OS setting.
 */
export function WallFrame({ siteKey, limit, title }: { siteKey: string; limit: number; title: string }) {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(560);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      const data = e.data as { source?: unknown; height?: unknown } | null;
      if (data?.source === "trustzen-wall" && typeof data.height === "number" && Number.isFinite(data.height)) {
        setHeight(Math.min(8000, Math.max(120, Math.ceil(data.height))));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (theme === "pending") return <div style={{ height }} aria-hidden />;
  return (
    <iframe
      ref={frame}
      title={title}
      src={`/embed/wall/${encodeURIComponent(siteKey)}?theme=${theme}&limit=${limit}&bg=transparent`}
      loading="lazy"
      // The wall document is light by default; matching it keeps the transparent background transparent.
      style={{ height, colorScheme: "light" }}
      className="block w-full border-0 transition-[height] duration-300"
    />
  );
}
