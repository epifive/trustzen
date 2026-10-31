import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { WidgetType } from "@/widget/types";

/** Grey placeholder line. */
function Line({ className }: { className?: string }) {
  return <span className={cn("block h-1 rounded-full bg-line", className)} />;
}

function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("absolute flex items-center gap-1.5 rounded-md border border-line bg-surface p-1.5 shadow-md shadow-black/5", className)}>
      {children}
    </div>
  );
}

function Bar({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("absolute inset-x-0 flex h-4 items-center justify-center gap-1.5 px-2", className)}>{children}</div>;
}

const accent = "bg-primary";

function widget(type: WidgetType): ReactNode {
  switch (type) {
    case "recent_activity":
      return (
        <Card className="bottom-2 left-2 w-[52%]">
          <span className="grid size-4 shrink-0 place-items-center rounded bg-primary-soft">
            <span className="size-1.5 rounded-sm bg-primary" />
          </span>
          <span className="min-w-0 flex-1 space-y-1">
            <Line className="w-full bg-ink/25" />
            <Line className="w-2/3" />
          </span>
        </Card>
      );
    case "live_visitors":
      return (
        <Card className="bottom-2 left-2 w-[46%] rounded-full px-2">
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/60 motion-reduce:animate-none" />
            <span className="relative size-2 rounded-full bg-emerald-500" />
          </span>
          <Line className="flex-1 bg-ink/25" />
        </Card>
      );
    case "conversion_counter":
      return (
        <Card className="bottom-2 left-2 w-[50%]">
          <span className="shrink-0 rounded bg-primary-soft px-1 font-mono text-[7px] leading-3 font-bold text-primary">128</span>
          <span className="min-w-0 flex-1 space-y-1">
            <Line className="w-full bg-ink/25" />
            <Line className="w-1/2" />
          </span>
        </Card>
      );
    case "review":
      return (
        <Card className="bottom-2 left-2 w-[54%] items-start">
          <span className="size-4 shrink-0 rounded-full bg-gradient-to-br from-amber-300 to-rose-400" />
          <span className="min-w-0 flex-1 space-y-1">
            <span className="flex gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="size-1.5 rotate-45 rounded-[1px] bg-amber-400" />
              ))}
            </span>
            <Line className="w-full bg-ink/25" />
            <Line className="w-3/4" />
          </span>
        </Card>
      );
    case "announcement":
      return (
        <Bar className={cn("top-3", accent)}>
          <span className="rounded-sm bg-white/90 px-1 text-[6px] leading-[9px] font-bold text-primary">NEW</span>
          <Line className="w-1/3 bg-white/70" />
          <span className="h-2 w-6 rounded-sm bg-white" />
        </Bar>
      );
    case "coupon":
      return (
        <Card className="right-2 bottom-2 w-[48%] flex-col items-stretch gap-1">
          <Line className="w-3/4 bg-ink/25" />
          <span className="flex items-center gap-1">
            <span className="h-3 flex-1 rounded-sm border border-dashed border-primary bg-primary-soft" />
            <span className={cn("h-3 w-5 rounded-sm", accent)} />
          </span>
        </Card>
      );
    case "countdown":
      return (
        <Bar className="top-3 bg-ink">
          <Line className="w-1/5 bg-surface/60" />
          {[0, 1, 2].map((i) => (
            <span key={i} className="rounded-sm bg-surface/90 px-0.5 font-mono text-[6px] leading-[9px] font-bold text-ink">
              {["02", "14", "37"][i]}
            </span>
          ))}
          <span className={cn("h-2 w-5 rounded-sm", accent)} />
        </Bar>
      );
    case "email_collector":
      return (
        <Card className="right-2 bottom-2 w-[50%] flex-col items-stretch gap-1">
          <Line className="w-3/4 bg-ink/25" />
          <Line className="w-1/2" />
          <span className="flex items-center gap-1">
            <span className="h-3 flex-1 rounded-sm border border-line bg-paper" />
            <span className={cn("h-3 w-5 rounded-sm", accent)} />
          </span>
        </Card>
      );
    case "cookie_notice":
      return (
        <Bar className="bottom-0 h-5 border-t border-line bg-surface">
          <Line className="w-1/2 bg-ink/25" />
          <span className={cn("h-2.5 w-6 rounded-sm", accent)} />
        </Bar>
      );
    case "custom_html":
      return (
        <Card className="right-2 bottom-2 w-[48%] flex-col items-start gap-1 font-mono">
          <span className="text-[7px] leading-none font-bold text-primary">&lt;/&gt;</span>
          <Line className="w-full bg-ink/25" />
          <Line className="w-2/3" />
        </Card>
      );
  }
}

/** A tiny static drawing of a browser page showing where and how the widget appears. */
export function TypeMockup({ type, className }: { type: WidgetType; className?: string }) {
  return (
    <div dir="ltr" aria-hidden className={cn("relative aspect-[16/10] overflow-hidden rounded-lg border border-line bg-paper", className)}>
      <div className="flex h-3 items-center gap-0.5 border-b border-line bg-surface px-1.5">
        <span className="size-1 rounded-full bg-line" />
        <span className="size-1 rounded-full bg-line" />
        <span className="size-1 rounded-full bg-line" />
      </div>
      <div className="space-y-1.5 px-[12%] pt-[9%]">
        <Line className="h-1.5 w-1/2 bg-ink/15" />
        <Line className="w-5/6" />
        <Line className="w-2/3" />
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          <span className="h-5 rounded-sm bg-line/70" />
          <span className="h-5 rounded-sm bg-line/70" />
          <span className="h-5 rounded-sm bg-line/70" />
        </div>
      </div>
      {widget(type)}
    </div>
  );
}
