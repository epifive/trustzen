"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CircleDot, Copy, FileText, LoaderCircle, Palette, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import { deleteWidgetAction, duplicateWidgetAction, saveWidgetAction, setWidgetActiveAction } from "@/app/actions/dashboard/widgets";
import { initialFormState } from "@/app/actions/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { normalizeContent, normalizeDesign, normalizeRules } from "@/widget/normalize";
import type { EmbedWidget, EmbedWidgetData, PreviewMessage, WidgetContent, WidgetDesign, WidgetRules, WidgetType } from "@/widget/types";
import { ContentFields } from "./content-fields";
import { SwitchButton } from "./controls";
import { DesignFields } from "./design-fields";
import { LivePreview } from "./preview";
import { previewData } from "./preview-data";
import { RulesFields } from "./rules-fields";
import { TYPE_META, typeName } from "./type-meta";

export interface EditorWidget {
  id: number;
  type: WidgetType;
  name: string;
  isActive: boolean;
  content: WidgetContent;
  design: WidgetDesign;
  rules: WidgetRules;
}

type Tab = "content" | "design" | "rules";
const TABS: Array<{ id: Tab; icon: typeof FileText }> = [
  { id: "content", icon: FileText },
  { id: "design", icon: Palette },
  { id: "rules", icon: SlidersHorizontal },
];

export function WidgetEditor({
  widget,
  site,
  data,
  lang,
  dir,
  branding,
  stats,
}: {
  widget: EditorWidget;
  site: { id: number; name: string };
  /** Real data from the server (events, testimonials, counts) for the preview. */
  data: EmbedWidgetData;
  lang: string;
  dir: "ltr" | "rtl";
  branding: PreviewMessage["branding"];
  /** Server-rendered 30-day stats strip. */
  stats: ReactNode;
}) {
  const t = useT();
  const uid = useId();
  const type = widget.type;
  const Icon = TYPE_META[type].icon;
  const formRef = useRef<HTMLFormElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);

  const [name, setName] = useState(widget.name);
  const [content, setContent] = useState<WidgetContent>(widget.content);
  const [design, setDesign] = useState<WidgetDesign>(widget.design);
  const [rules, setRules] = useState<WidgetRules>(widget.rules);
  const [tab, setTab] = useState<Tab>("content");
  const [active, setActive] = useState(widget.isActive);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const [busyAction, setBusyAction] = useState<"active" | "duplicate" | "delete" | null>(null);

  // Normalised settings: used for the preview and for change detection.
  const normalized = useMemo(
    () => ({ content: normalizeContent(type, content), design: normalizeDesign(design), rules: normalizeRules(rules) }),
    [type, content, design, rules],
  );
  const snapshot = useMemo(() => JSON.stringify({ name: name.trim(), ...normalized }), [name, normalized]);
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const [submittedSnapshot, setSubmittedSnapshot] = useState(snapshot);
  const dirty = snapshot !== savedSnapshot;

  const [state, formAction, saving] = useActionState(saveWidgetAction, initialFormState);
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    setError(state.error ?? null);
    if (state.success) setSavedSnapshot(submittedSnapshot);
  }

  const preview = useMemo(() => {
    const { data: previewItems, sample } = previewData(type, normalized.content, data);
    const embed: EmbedWidget = { id: widget.id, type, content: normalized.content, design: normalized.design, rules: normalized.rules, data: previewItems };
    return { embed, sample };
  }, [type, normalized, data, widget.id]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Ctrl/Cmd + S saves.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleActive = (next: boolean) => {
    setActive(next);
    setBusyAction("active");
    startBusy(async () => {
      const result = await setWidgetActiveAction(widget.id, next);
      if (result.error) {
        setActive(!next);
        setError(result.error);
      } else setError(null);
      setBusyAction(null);
    });
  };

  const duplicate = () => {
    if (dirty && !window.confirm(t("editor.duplicateUnsaved"))) return;
    setBusyAction("duplicate");
    startBusy(async () => {
      const result = await duplicateWidgetAction(widget.id);
      if (result?.error) setError(result.error);
      setBusyAction(null);
    });
  };

  const remove = () => {
    deleteDialog.current?.close();
    setBusyAction("delete");
    startBusy(async () => {
      const result = await deleteWidgetAction(widget.id);
      if (result?.error) setError(result.error);
      setBusyAction(null);
    });
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    let next = -1;
    if (e.key === "ArrowRight") next = index + (rtl ? -1 : 1);
    else if (e.key === "ArrowLeft") next = index + (rtl ? 1 : -1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    const target = TABS[(next + TABS.length) % TABS.length].id;
    setTab(target);
    document.getElementById(`${uid}-tab-${target}`)?.focus();
  };

  const status = (
    <span aria-live="polite" className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
      {saving ? (
        <>
          <LoaderCircle className="size-3.5 animate-spin text-muted motion-reduce:animate-none" aria-hidden />
          <span className="text-muted">{t("editor.saving")}</span>
        </>
      ) : dirty ? (
        <>
          <CircleDot className="size-3.5 text-amber-500" aria-hidden />
          <span className="font-medium text-amber-700 dark:text-amber-400">{t("editor.unsaved")}</span>
        </>
      ) : (
        <>
          <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <span className="text-muted">{t("editor.allSaved")}</span>
        </>
      )}
    </span>
  );

  const saveButton = (className: string) => (
    <Button type="submit" disabled={saving || !dirty} aria-busy={saving} className={className} aria-keyshortcuts="Control+S Meta+S">
      {saving ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Save aria-hidden />}
      {saving ? t("editor.saving") : t("editor.save")}
    </Button>
  );

  return (
    <>
      <form ref={formRef} action={formAction} onSubmit={() => setSubmittedSnapshot(snapshot)} className="pb-24 lg:pb-0">
        <input type="hidden" name="widget_id" value={widget.id} />
        <input type="hidden" name="content" value={JSON.stringify(content)} />
        <input type="hidden" name="design" value={JSON.stringify(design)} />
        <input type="hidden" name="rules" value={JSON.stringify(rules)} />

        <Link
          href={`/dashboard/sites/${site.id}`}
          onClick={(e) => {
            if (dirty && !window.confirm(t("editor.leaveUnsaved"))) e.preventDefault();
          }}
          className="inline-flex max-w-full items-center gap-1.5 rounded-md text-sm text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4 shrink-0 rtl:rotate-180" aria-hidden />
          <span className="truncate">{t("editor.backTo", { site: site.name })}</span>
        </Link>

        {/* Toolbar: sticks to the top on large screens. */}
        <div className="z-20 -mx-4 mt-2 bg-paper/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-paper/90 sm:-mx-8 sm:px-8 lg:sticky lg:top-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex min-w-0 flex-1 basis-72 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary" aria-hidden>
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <label htmlFor={`${uid}-name`} className="sr-only">
                  {t("editor.name")}
                </label>
                <input
                  id={`${uid}-name`}
                  name="name"
                  value={name}
                  required
                  maxLength={120}
                  onChange={(e) => setName(e.target.value)}
                  title={t("editor.rename")}
                  className="-ms-1.5 w-full max-w-lg truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 font-display text-xl font-bold tracking-tight text-ink transition-colors hover:border-line focus:border-primary focus:bg-surface focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
                <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted">
                  <span className="truncate">{typeName(t, type)}</span>
                  <span aria-hidden>·</span>
                  {status}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-10 items-center gap-2.5 rounded-lg border border-line bg-surface ps-3 pe-2">
                <span id={`${uid}-active`} className="text-sm font-medium">
                  {t("editor.active")}
                </span>
                <SwitchButton checked={active} onChange={toggleActive} labelledBy={`${uid}-active`} disabled={busyAction === "active"} />
              </div>
              <Button variant="outline" onClick={duplicate} disabled={busy} title={t("editor.duplicate")}>
                {busyAction === "duplicate" ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Copy aria-hidden />}
                <span className="max-sm:sr-only">{t("editor.duplicate")}</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => deleteDialog.current?.showModal()}
                disabled={busy}
                title={t("editor.delete")}
                className="hover:border-red-300 hover:text-red-600 dark:hover:border-red-900 dark:hover:text-red-400"
              >
                {busyAction === "delete" ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Trash2 aria-hidden />}
                <span className="max-sm:sr-only">{t("editor.delete")}</span>
              </Button>
              {saveButton("max-lg:hidden")}
            </div>
          </div>
        </div>

        {error ? (
          <Alert tone="error" className="mt-3">
            {error}
          </Alert>
        ) : null}

        <div className="mt-4">{stats}</div>

        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
          <div className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface">
            <div role="tablist" aria-label={t("editor.sections")} className="flex gap-1 border-b border-line px-2 sm:px-3">
              {TABS.map((item, i) => {
                const selected = tab === item.id;
                const TabIcon = item.icon;
                return (
                  <button
                    key={item.id}
                    id={`${uid}-tab-${item.id}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`${uid}-panel`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setTab(item.id)}
                    onKeyDown={(e) => onTabKey(e, i)}
                    className={cn(
                      "relative -mb-px inline-flex h-12 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-offset-[-4px] sm:px-4",
                      selected ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink",
                    )}
                  >
                    <TabIcon className="size-4" aria-hidden />
                    {t(`editor.tab.${item.id}`)}
                  </button>
                );
              })}
            </div>
            <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${tab}`}>
              {tab === "content" ? (
                <ContentFields type={type} content={content} onChange={(patch) => setContent((c) => ({ ...c, ...patch }) as WidgetContent)} />
              ) : tab === "design" ? (
                <DesignFields type={type} design={design} onChange={(patch) => setDesign((d) => ({ ...d, ...patch }))} />
              ) : (
                <RulesFields type={type} rules={rules} onChange={(patch) => setRules((r) => ({ ...r, ...patch }))} />
              )}
            </div>
          </div>

          <div className="min-w-0 xl:sticky xl:top-24">
            <LivePreview widget={preview.embed} lang={lang} dir={dir} branding={branding} sample={preview.sample} />
            <p className="mt-3 px-1 text-xs text-muted">{t("editor.previewHint")}</p>
          </div>
        </div>

        {/* Save bar for small screens. */}
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
          {status}
          {saveButton("min-w-28")}
        </div>
      </form>

      <dialog
        ref={deleteDialog}
        aria-labelledby={`${uid}-del-title`}
        aria-describedby={`${uid}-del-text`}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400" aria-hidden>
              <Trash2 className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 id={`${uid}-del-title`} className="font-sans text-base font-semibold tracking-normal">
                {t("editor.deleteTitle")}
              </h2>
              <p id={`${uid}-del-text`} className="mt-1 text-sm text-muted">
                {t("editor.deleteText", { name: name.trim() || typeName(t, type) })}
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => deleteDialog.current?.close()} autoFocus>
              {t("editor.cancel")}
            </Button>
            <Button variant="danger" onClick={remove}>
              <Trash2 aria-hidden />
              {t("editor.deleteConfirm")}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
