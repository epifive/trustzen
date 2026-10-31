/**
 * The contract shared by the embed script (src/widget → public/w.js), the public
 * API (src/app/api/w) and the dashboard widget editor.
 *
 * Keep this file free of imports and runtime dependencies: it is bundled into the
 * embed script and into the Next.js app.
 */

export const WIDGET_TYPES = [
  "recent_activity",
  "live_visitors",
  "conversion_counter",
  "review",
  "announcement",
  "coupon",
  "countdown",
  "email_collector",
  "cookie_notice",
  "custom_html",
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

export const EVENT_KINDS = ["purchase", "signup", "review", "custom"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Popups float in a corner; bars span the top or bottom edge; center is a modal. */
export type WidgetPosition = "bottom-left" | "bottom-right" | "top-left" | "top-right" | "top-bar" | "bottom-bar" | "center";

export interface WidgetDesign {
  position: WidgetPosition;
  /** "auto" follows the visitor's prefers-color-scheme. */
  theme: "light" | "dark" | "auto";
  /** Hex colours, e.g. "#0f766e". Empty string = theme default. */
  accent: string;
  background: string;
  text: string;
  /** Corner radius in px (0–32). */
  radius: number;
  shadow: boolean;
  animation: "slide" | "fade" | "none";
  showClose: boolean;
  /** "inherit" uses the host page font, "system" a system font stack. */
  font: "inherit" | "system";
  /** Popup width in px (240–480). Ignored by bars. */
  width: number;
  /** Show the event image / avatar / icon when available. */
  showImage: boolean;
}

export interface WidgetRules {
  /** URL path patterns; "*" is a wildcard, e.g. "/blog/*". Matched against location.pathname. */
  pagesMode: "all" | "include" | "exclude";
  pages: string[];
  devices: Array<"desktop" | "mobile">;
  trigger: "load" | "delay" | "scroll" | "exit";
  /** For trigger "delay" and as the initial delay of rotating widgets. */
  delaySec: number;
  /** For trigger "scroll": percentage of the page scrolled (1–100). */
  scrollPercent: number;
  /** How long one item stays visible, 0 = until closed. */
  displaySec: number;
  /** Pause between rotating items (recent activity, reviews). */
  gapSec: number;
  /** Maximum items shown per page view (rotating widgets). */
  maxPerPage: number;
  /** After the visitor closes the widget: show again "always", next "session", next "day" or "never". */
  afterClose: "always" | "session" | "day" | "never";
  /** Optional ISO dates; outside the window the widget is not shown. */
  startAt: string;
  endAt: string;
}

export type Anonymize = "none" | "first_name" | "initials";

export interface ContentByType {
  recent_activity: {
    kinds: EventKind[];
    /** Placeholders: {name} {city} {country} {product} {location}. */
    template: string;
    /** Only events newer than this are shown (0 = no limit). */
    maxAgeHours: number;
    /** How many events the server sends (1–30). */
    limit: number;
    showTime: boolean;
    anonymize: Anonymize;
    /** Used when an event has no name. */
    fallbackName: string;
    /** Clicking the popup opens the event URL, or this URL when set. */
    linkUrl: string;
    shuffle: boolean;
  };
  live_visitors: {
    /** Placeholder: {count}. */
    template: string;
    /** "page" counts visitors on the same page, "site" on the whole site. */
    scope: "page" | "site";
    /** Hide the widget while fewer visitors than this are online. */
    minCount: number;
  };
  conversion_counter: {
    /** Placeholders: {count} {hours}. */
    template: string;
    kinds: EventKind[];
    periodHours: number;
    minCount: number;
  };
  review: {
    /** Approved testimonials, or review events (e.g. from webhooks). */
    source: "testimonials" | "events";
    minRating: number;
    limit: number;
    shuffle: boolean;
    /** Characters before the text is cut with "…" (60–400). */
    maxLength: number;
  };
  announcement: {
    text: string;
    buttonText: string;
    buttonUrl: string;
    /** Emoji-free short label shown before the text, e.g. "New". Empty = none. */
    badge: string;
  };
  coupon: {
    title: string;
    text: string;
    code: string;
    buttonText: string;
    copiedText: string;
  };
  countdown: {
    text: string;
    /** "fixed" counts down to endAt; "evergreen" gives each visitor N minutes from their first visit. */
    mode: "fixed" | "evergreen";
    endAt: string;
    evergreenMinutes: number;
    buttonText: string;
    buttonUrl: string;
    /** What happens at zero. */
    onExpire: "hide" | "message";
    expiredText: string;
  };
  email_collector: {
    title: string;
    text: string;
    collectName: boolean;
    namePlaceholder: string;
    emailPlaceholder: string;
    buttonText: string;
    successText: string;
    /** Optional consent line shown under the form. */
    consentText: string;
  };
  cookie_notice: {
    text: string;
    buttonText: string;
    policyText: string;
    policyUrl: string;
  };
  custom_html: {
    /** Sanitised on save: no scripts, event handlers or javascript: URLs. */
    html: string;
  };
}

export type WidgetContent<T extends WidgetType = WidgetType> = ContentByType[T];

/** Public event shape sent to the browser (already anonymised by the server). */
export interface EmbedEvent {
  kind: EventKind;
  name: string;
  city: string;
  country: string;
  product: string;
  url: string;
  image: string;
  rating: number;
  message: string;
  /** Seconds since the event happened. */
  ago: number;
}

export interface EmbedTestimonial {
  name: string;
  title: string;
  avatar: string;
  rating: number;
  body: string;
}

/** Server-computed data a widget needs to render. */
export interface EmbedWidgetData {
  events?: EmbedEvent[];
  testimonials?: EmbedTestimonial[];
  /** conversion_counter and live_visitors. */
  count?: number;
}

export interface EmbedWidget<T extends WidgetType = WidgetType> {
  id: number;
  type: T;
  content: ContentByType[T];
  design: WidgetDesign;
  rules: WidgetRules;
  data: EmbedWidgetData;
}

/** Response of GET /api/w/{key}/config. */
export interface EmbedConfig {
  /** BCP-47 language for dates and relative times, e.g. "en", "ar". */
  lang: string;
  dir: "ltr" | "rtl";
  /** When set, a small "Powered by …" link is shown in widgets. */
  branding: { text: string; url: string } | null;
  /** Capture submissions of the host page's forms as events. */
  captureForms: boolean;
  /** Send a presence heartbeat (a live_visitors widget is active). */
  presence: boolean;
  widgets: EmbedWidget[];
}

/** Body of POST /api/w/{key}/track (sent with navigator.sendBeacon as text/plain JSON). */
export interface TrackPayload {
  /** Random visitor id kept in localStorage (no personal data). */
  v: string;
  /** location.pathname */
  p: string;
  /** i = impression, h = hover, c = click, x = conversion */
  e: Array<{ w: number; t: "i" | "h" | "c" | "x" }>;
}

/** Body of POST /api/w/{key}/capture (form capture). */
export interface CapturePayload {
  v: string;
  p: string;
  name: string;
  city: string;
  country: string;
  product: string;
}

/** Body of POST /api/w/{key}/lead (email collector). */
export interface LeadPayload {
  v: string;
  p: string;
  w: number;
  email: string;
  name: string;
}

/** Body of POST /api/w/{key}/presence. Response: { site: number, page: number }. */
export interface PresencePayload {
  v: string;
  p: string;
}

export const DEFAULT_DESIGN: WidgetDesign = {
  position: "bottom-left",
  theme: "light",
  accent: "",
  background: "",
  text: "",
  radius: 14,
  shadow: true,
  animation: "slide",
  showClose: true,
  font: "inherit",
  width: 340,
  showImage: true,
};

export const DEFAULT_RULES: WidgetRules = {
  pagesMode: "all",
  pages: [],
  devices: ["desktop", "mobile"],
  trigger: "delay",
  delaySec: 3,
  scrollPercent: 30,
  displaySec: 6,
  gapSec: 8,
  maxPerPage: 5,
  afterClose: "session",
  startAt: "",
  endAt: "",
};

/** Defaults per type: content plus design/rule overrides that suit the type. */
export const WIDGET_DEFAULTS: { [T in WidgetType]: { content: ContentByType[T]; design?: Partial<WidgetDesign>; rules?: Partial<WidgetRules> } } = {
  recent_activity: {
    content: {
      kinds: ["purchase", "signup"],
      template: "{name} from {location} purchased {product}",
      maxAgeHours: 168,
      limit: 20,
      showTime: true,
      anonymize: "first_name",
      fallbackName: "Someone",
      linkUrl: "",
      shuffle: false,
    },
  },
  live_visitors: {
    content: { template: "{count} people are viewing this page right now", scope: "page", minCount: 2 },
    rules: { displaySec: 8, maxPerPage: 1 },
  },
  conversion_counter: {
    content: { template: "{count} people signed up in the last {hours} hours", kinds: ["signup", "purchase"], periodHours: 24, minCount: 3 },
    rules: { displaySec: 8, maxPerPage: 1 },
  },
  review: {
    content: { source: "testimonials", minRating: 4, limit: 10, shuffle: true, maxLength: 160 },
    design: { width: 360 },
  },
  announcement: {
    content: { text: "Free shipping on all orders this week", buttonText: "Shop now", buttonUrl: "/", badge: "New" },
    design: { position: "top-bar", radius: 0, shadow: false },
    rules: { trigger: "load", delaySec: 0, displaySec: 0, maxPerPage: 1 },
  },
  coupon: {
    content: { title: "10% off your first order", text: "Use this code at checkout.", code: "WELCOME10", buttonText: "Copy code", copiedText: "Copied!" },
    design: { position: "bottom-right" },
    rules: { trigger: "delay", delaySec: 10, displaySec: 0, maxPerPage: 1 },
  },
  countdown: {
    content: {
      text: "Sale ends in",
      mode: "evergreen",
      endAt: "",
      evergreenMinutes: 30,
      buttonText: "Get the deal",
      buttonUrl: "/",
      onExpire: "hide",
      expiredText: "The offer has ended.",
    },
    design: { position: "top-bar", radius: 0, shadow: false },
    rules: { trigger: "load", delaySec: 0, displaySec: 0, maxPerPage: 1 },
  },
  email_collector: {
    content: {
      title: "Get our best tips by email",
      text: "One useful email a week. Unsubscribe any time.",
      collectName: false,
      namePlaceholder: "Your name",
      emailPlaceholder: "you@example.com",
      buttonText: "Subscribe",
      successText: "Thanks! Please check your inbox.",
      consentText: "",
    },
    design: { position: "bottom-right" },
    rules: { trigger: "scroll", scrollPercent: 50, displaySec: 0, maxPerPage: 1, afterClose: "day" },
  },
  cookie_notice: {
    content: { text: "We use cookies to improve your experience.", buttonText: "Accept", policyText: "Privacy policy", policyUrl: "/privacy" },
    design: { position: "bottom-bar", radius: 0 },
    rules: { trigger: "load", delaySec: 0, displaySec: 0, maxPerPage: 1, afterClose: "never" },
  },
  custom_html: {
    content: { html: "<strong>Hello!</strong> Edit this message in the dashboard." },
    rules: { displaySec: 0, maxPerPage: 1 },
  },
};

/** Rotating widgets show a sequence of items; the others show a single panel. */
export const ROTATING_TYPES: readonly WidgetType[] = ["recent_activity", "review"];

/**
 * Live preview in the dashboard: the editor embeds an iframe pointing at
 * /widget-preview (sandbox="allow-scripts", no same-origin), which loads
 * `<script src="/w.js" data-preview="1">`. In preview mode the script fetches
 * nothing; it waits for this message from its parent window (accepting only
 * messages whose origin equals the origin w.js was loaded from) and renders the
 * single widget immediately: rules (delay, pages, devices, afterClose, schedule)
 * are ignored, rotating widgets loop, and nothing is tracked or stored.
 * The script posts `{ source: "trustzen-preview-ready" }` to the parent when it is
 * ready, and again after every render so the editor can resend on reload.
 */
export interface PreviewMessage {
  source: "trustzen-preview";
  widget: EmbedWidget;
  lang: string;
  dir: "ltr" | "rtl";
  branding: EmbedConfig["branding"];
  /** Colour scheme of the fake page drawn behind the widget. */
  pageTheme: "light" | "dark";
}
