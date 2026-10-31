"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Info, LoaderCircle, Monitor, Moon, RotateCcw, Smartphone, Sun } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { EmbedWidget, PreviewMessage } from "@/widget/types";

const PREVIEW_URL = "/widget-preview";

/**
 * Live preview: a sandboxed iframe running the embed script in preview mode.
 * The widget is posted to the frame (debounced) on every change and whenever the
 * frame says it is ready. The frame also reports "ready" after each render; those
 * acknowledgements are counted so they don't trigger another send (no loops).
 */
export function LivePreview({
  widget,
  lang,
  dir,
  branding,
  sample,
}: {
  widget: EmbedWidget;
  lang: string;
  dir: "ltr" | "rtl";
  branding: PreviewMessage["branding"];
  sample: boolean;
}) {
  const t = useT();
  const frame = useRef<HTMLIFrameElement>(null);
  const pending = useRef(0);
  const ready = useRef(false);
  const message = useRef<PreviewMessage | null>(null);
  const [pageTheme, setPageTheme] = useState<"light" | "dark">("light");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  const send = useCallback(() => {
    const win = frame.current?.contentWindow;
    // Nothing is sent before the script in the frame has said it is listening.
    if (!win || !message.current || !ready.current) return;
    pending.current += 1;
    // The sandboxed frame has an opaque origin, so "*" is the only target that works.
    // The message holds nothing secret: it is the widget the user is editing.
    win.postMessage(message.current, "*");
  }, []);

  // Debounced send on every change.
  useEffect(() => {
    message.current = { source: "trustzen-preview", widget, lang, dir, branding, pageTheme };
    const timer = setTimeout(send, 150);
    return () => clearTimeout(timer);
  }, [widget, lang, dir, branding, pageTheme, send]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const data = e.data as { source?: unknown } | null;
      if (!data || data.source !== "trustzen-preview-ready") return;
      ready.current = true;
      setStatus("ready");
      if (pending.current > 0) {
        pending.current -= 1;
        return;
      }
      send();
    };
    window.addEventListener("message", onMessage);
    // Load the frame only once the listener exists, so its first "ready" can't be missed.
    if (frame.current && !frame.current.getAttribute("src")) frame.current.src = PREVIEW_URL;
    return () => window.removeEventListener("message", onMessage);
  }, [send]);

  // If the frame never answers (embed script missing), stop showing the spinner.
  useEffect(() => {
    if (status !== "loading") return;
    const timer = setTimeout(() => setStatus("unavailable"), 8000);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <section aria-labelledby="tz-preview-title" className="overflow-hidden rounded-xl border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h2 id="tz-preview-title" className="flex items-center gap-2 font-sans text-sm font-semibold tracking-normal">
          <span className="relative flex size-2" aria-hidden>
            <span className={cn("absolute inset-0 rounded-full bg-emerald-500/60", status === "ready" && "animate-ping motion-reduce:animate-none")} />
            <span className={cn("relative size-2 rounded-full", status === "ready" ? "bg-emerald-500" : "bg-line")} />
          </span>
          {t("editor.preview")}
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <Segmented
            label={t("editor.previewDevice")}
            value={device}
            onChange={setDevice}
            className="p-0.5"
            options={[
              { value: "desktop", label: <IconLabel icon={<Monitor />} text={t("editor.device.desktop")} /> },
              { value: "mobile", label: <IconLabel icon={<Smartphone />} text={t("editor.device.mobile")} /> },
            ]}
          />
          <Segmented
            label={t("editor.previewPage")}
            value={pageTheme}
            onChange={setPageTheme}
            className="p-0.5"
            options={[
              { value: "light", label: <IconLabel icon={<Sun />} text={t("editor.page.light")} /> },
              { value: "dark", label: <IconLabel icon={<Moon />} text={t("editor.page.dark")} /> },
            ]}
          />
          <button
            type="button"
            onClick={send}
            title={t("editor.replay")}
            aria-label={t("editor.replay")}
            className="grid size-8 place-items-center rounded-lg border border-line text-muted transition-colors hover:border-primary-line hover:text-primary"
          >
            <RotateCcw className="size-4" aria-hidden />
          </button>
        </div>
      </header>

      <div className={cn("grid place-items-center p-3 sm:p-4", pageTheme === "dark" ? "bg-[#0e0d13]" : "mat-grid")}>
        <div
          className={cn(
            "relative overflow-hidden shadow-sm ring-1 transition-[width] duration-300 motion-reduce:transition-none",
            device === "desktop" ? "aspect-[16/10] w-full rounded-lg" : "h-[34rem] w-[22.5rem] max-w-full rounded-[1.75rem] border-[6px] border-ink/85",
            pageTheme === "dark" ? "bg-[#121118] ring-white/10" : "bg-white ring-black/10",
          )}
        >
          <iframe
            ref={frame}
            sandbox="allow-scripts"
            title={t("editor.previewFrame")}
            onLoad={() => {
              pending.current = 0;
            }}
            className="absolute inset-0 size-full border-0"
          />
          {status === "loading" ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center" role="status">
              <LoaderCircle className="size-6 animate-spin text-muted motion-reduce:animate-none" aria-hidden />
              <span className="sr-only">{t("editor.previewLoading")}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-start gap-2 border-t border-line px-4 py-2.5 text-xs text-muted">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
        <p>
          {status === "unavailable" ? t("editor.previewUnavailable") : sample ? t("editor.sampleData") : t("editor.previewNote")}
        </p>
      </div>
    </section>
  );
}

function IconLabel({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs [&_svg]:size-3.5" title={text}>
      <span aria-hidden>{icon}</span>
      <span className="sr-only sm:not-sr-only">{text}</span>
    </span>
  );
}
