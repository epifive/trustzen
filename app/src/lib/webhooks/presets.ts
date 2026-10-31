/**
 * Incoming webhook presets: turn payloads from Stripe, WooCommerce, Shopify and
 * generic senders (Zapier, Make, custom code) into social-proof events.
 *
 * Pure functions without imports so they can be unit-tested in isolation; the
 * route (src/app/api/hooks/[token]) validates and stores the result with
 * insertEvent(), which cleans every field again.
 *
 * Authentication: the secret token in the webhook URL identifies and
 * authenticates the site. Provider signatures (Stripe-Signature,
 * X-WC-Webhook-Signature, X-Shopify-Hmac-Sha256) are not checked because the
 * owner would have to copy each provider's signing secret into Trustzen; anyone
 * who knows the URL can create events, so keep it private and regenerate it in
 * the dashboard if it leaks.
 */

export const WEBHOOK_PRESETS = ["stripe", "woocommerce", "shopify", "generic"] as const;
export type WebhookPreset = (typeof WEBHOOK_PRESETS)[number];

type Kind = "purchase" | "signup" | "review" | "custom";

export interface MappedEvent {
  kind: Kind;
  name?: string;
  city?: string;
  country?: string;
  product?: string;
  url?: string;
  image?: string;
  rating?: number;
  message?: string;
  /** ISO date of the original event. */
  createdAt?: string;
}

export type MapResult =
  /** `dedupeKey` identifies the source object so retried deliveries can be skipped. */
  | { status: "ok"; events: MappedEvent[]; dedupeKey?: string }
  /** Valid request that creates no events (unsupported event type, unpaid order, ping). */
  | { status: "ignored"; reason: string }
  | { status: "error"; error: string };

export interface HeaderReader {
  get(name: string): string | null;
}

/** Most events accepted in one generic request. */
export const MAX_GENERIC_EVENTS = 50;

type Obj = Record<string, unknown>;

const rec = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const isObj = (v: unknown): v is Obj => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
const first = (...values: unknown[]): string => {
  for (const v of values) {
    const s = str(v);
    if (s) return s;
  }
  return "";
};
const fullName = (firstName: unknown, lastName: unknown): string => [str(firstName), str(lastName)].filter(Boolean).join(" ");

let regionNames: Intl.DisplayNames | null | undefined;

/** "US" → "United States". Other values are returned unchanged. */
export function countryName(value: unknown): string {
  const s = str(value);
  if (!/^[A-Za-z]{2}$/.test(s)) return s;
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
      regionNames = null;
    }
  }
  try {
    const name = regionNames?.of(s.toUpperCase());
    return name && name !== "Unknown Region" ? name : s.toUpperCase();
  } catch {
    return s.toUpperCase();
  }
}

/** Accepts ISO strings, "YYYY-MM-DDTHH:mm:ss" in UTC (WooCommerce *_gmt fields) and Unix seconds. */
function isoDate(v: unknown, assumeUtc = false): string | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return new Date(v < 1e12 ? v * 1000 : v).toISOString();
  const s = str(v);
  if (!s) return undefined;
  const value = assumeUtc && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s) ? `${s}Z` : s;
  const t = Date.parse(value);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

function compact(e: MappedEvent): MappedEvent {
  const out: MappedEvent = { kind: e.kind };
  for (const [k, v] of Object.entries(e) as Array<[keyof MappedEvent, MappedEvent[keyof MappedEvent]]>) {
    if (v !== undefined && v !== "" && k !== "kind") (out as unknown as Obj)[k] = v;
  }
  return out;
}

export function isWebhookPreset(v: unknown): v is WebhookPreset {
  return typeof v === "string" && (WEBHOOK_PRESETS as readonly string[]).includes(v);
}

/** Guess the sender from headers and body shape. Falls back to "generic". */
export function detectPreset(body: unknown, headers: HeaderReader): WebhookPreset {
  if (headers.get("x-shopify-topic") || headers.get("x-shopify-shop-domain")) return "shopify";
  if (headers.get("x-wc-webhook-topic") || headers.get("x-wc-webhook-source")) return "woocommerce";
  if (headers.get("stripe-signature")) return "stripe";
  if (!isObj(body)) return "generic";
  if (body.object === "event" && typeof body.type === "string" && isObj(rec(body.data).object)) return "stripe";
  if ("webhook_id" in body && Object.keys(body).length <= 2) return "woocommerce";
  if (Array.isArray(body.line_items)) {
    if (str(body.admin_graphql_api_id).startsWith("gid://shopify/") || "order_number" in body || "total_price" in body) return "shopify";
    if (isObj(body.billing) || "order_key" in body) return "woocommerce";
  }
  return "generic";
}

// ---------------------------------------------------------------- Stripe

function mapStripe(body: unknown): MapResult {
  if (!isObj(body) || body.object !== "event" || typeof body.type !== "string") {
    return { status: "error", error: "This is not a Stripe event. Send Stripe webhook events (JSON) to this URL." };
  }
  const obj = rec(rec(body.data).object);
  const createdAt = isoDate(obj.created) ?? isoDate(body.created);
  const metadata = rec(obj.metadata);
  const dedupeKey = str(body.id) ? `stripe:${str(body.id)}` : undefined;

  switch (body.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      if (body.type === "checkout.session.completed" && obj.payment_status === "unpaid") {
        return { status: "ignored", reason: "Checkout completed but not paid yet (delayed payment method)." };
      }
      const customer = rec(obj.customer_details);
      const address = rec(customer.address);
      return {
        status: "ok",
        dedupeKey,
        events: [
          compact({
            kind: "purchase",
            name: str(customer.name),
            city: str(address.city),
            country: countryName(address.country),
            product: first(metadata.product, metadata.product_name),
            createdAt,
          }),
        ],
      };
    }
    case "charge.succeeded": {
      const billing = rec(obj.billing_details);
      const address = rec(billing.address);
      return {
        status: "ok",
        dedupeKey,
        events: [
          compact({
            kind: "purchase",
            name: str(billing.name),
            city: str(address.city),
            country: countryName(address.country),
            product: first(metadata.product, metadata.product_name, obj.description),
            createdAt,
          }),
        ],
      };
    }
    case "payment_intent.succeeded": {
      const shipping = rec(obj.shipping);
      const charges = rec(obj.charges).data;
      const charge = Array.isArray(charges) && charges.length ? rec(charges[0]) : rec(obj.latest_charge);
      const billing = rec(charge.billing_details);
      const shipAddress = rec(shipping.address);
      const billAddress = rec(billing.address);
      return {
        status: "ok",
        dedupeKey,
        events: [
          compact({
            kind: "purchase",
            name: first(shipping.name, billing.name),
            city: first(shipAddress.city, billAddress.city),
            country: countryName(first(shipAddress.country, billAddress.country)),
            product: first(metadata.product, metadata.product_name, obj.description),
            createdAt,
          }),
        ],
      };
    }
    default:
      return { status: "ignored", reason: `Stripe event "${body.type.slice(0, 80)}" does not create events.` };
  }
}

// ---------------------------------------------------------------- WooCommerce

function mapWooCommerce(body: unknown, headers: HeaderReader): MapResult {
  if (!isObj(body)) return { status: "error", error: "Expected a WooCommerce order (JSON)." };
  // WooCommerce sends `webhook_id=<id>` once when the webhook is saved.
  if ("webhook_id" in body && !isObj(body.billing)) return { status: "ignored", reason: "WooCommerce ping received. The webhook is connected." };
  const topic = (headers.get("x-wc-webhook-topic") ?? "").toLowerCase();
  if (topic && !topic.startsWith("order.")) return { status: "ignored", reason: `WooCommerce topic "${topic.slice(0, 60)}" does not create events.` };
  if (!isObj(body.billing) || !Array.isArray(body.line_items)) {
    return { status: "error", error: "Expected a WooCommerce order with billing details and line items." };
  }
  const status = str(body.status);
  if (status !== "processing" && status !== "completed") {
    return { status: "ignored", reason: `Order status "${status.slice(0, 40) || "unknown"}" is not paid yet (only processing or completed orders create events).` };
  }
  const billing = body.billing;
  const shipping = rec(body.shipping);
  const item = rec(body.line_items[0]);
  return {
    status: "ok",
    dedupeKey: str(body.id) ? `woocommerce:${str(body.id)}` : undefined,
    events: [
      compact({
        kind: "purchase",
        name: fullName(first(billing.first_name, shipping.first_name), first(billing.last_name, shipping.last_name)),
        city: first(billing.city, shipping.city),
        country: countryName(first(billing.country, shipping.country)),
        product: str(item.name),
        image: str(rec(item.image).src),
        createdAt: isoDate(body.date_paid_gmt, true) ?? isoDate(body.date_created_gmt, true),
      }),
    ],
  };
}

// ---------------------------------------------------------------- Shopify

const SHOPIFY_TOPICS = new Set(["orders/create", "orders/paid"]);

function mapShopify(body: unknown, headers: HeaderReader): MapResult {
  const topic = (headers.get("x-shopify-topic") ?? "").toLowerCase();
  if (topic && !SHOPIFY_TOPICS.has(topic)) return { status: "ignored", reason: `Shopify topic "${topic.slice(0, 60)}" does not create events.` };
  if (!isObj(body) || !Array.isArray(body.line_items)) return { status: "error", error: "Expected a Shopify order (JSON) with line items." };
  const customer = rec(body.customer);
  const billing = rec(body.billing_address);
  const shipping = rec(body.shipping_address);
  const fallback = rec(customer.default_address);
  const item = rec(body.line_items[0]);
  return {
    status: "ok",
    dedupeKey: str(body.id) ? `shopify:${str(body.id)}` : undefined,
    events: [
      compact({
        kind: "purchase",
        name: str(customer.first_name)
          ? fullName(customer.first_name, customer.last_name)
          : str(billing.first_name)
            ? fullName(billing.first_name, billing.last_name)
            : fullName(shipping.first_name, shipping.last_name),
        city: first(billing.city, shipping.city, fallback.city),
        country: first(billing.country, shipping.country, fallback.country_name, countryName(first(billing.country_code, shipping.country_code))),
        product: first(item.title, item.name),
        createdAt: isoDate(body.processed_at) ?? isoDate(body.created_at),
      }),
    ],
  };
}

// ---------------------------------------------------------------- Generic

function mapGenericItem(o: Obj): MappedEvent {
  const kind = str(o.kind).toLowerCase();
  const rating = Number(o.rating);
  return compact({
    kind: kind === "signup" || kind === "review" || kind === "custom" ? kind : "purchase",
    name: first(o.name, fullName(o.first_name, o.last_name)),
    city: str(o.city),
    country: countryName(o.country),
    product: str(o.product),
    url: str(o.url),
    image: str(o.image),
    rating: Number.isFinite(rating) && rating >= 1 && rating <= 5 ? Math.round(rating) : undefined,
    message: str(o.message),
    createdAt: isoDate(o.created_at) ?? isoDate(o.createdAt),
  });
}

function mapGeneric(body: unknown): MapResult {
  const list: unknown[] | null = Array.isArray(body) ? body : isObj(body) && Array.isArray(body.events) ? body.events : isObj(body) ? [body] : null;
  if (!list) return { status: "error", error: "Send a JSON object, an array of objects, or { \"events\": [...] }." };
  if (list.length > MAX_GENERIC_EVENTS) return { status: "error", error: `Send at most ${MAX_GENERIC_EVENTS} events per request.` };
  const items = list.filter(isObj);
  if (!items.length) return { status: "error", error: "No events found in the request body." };
  const events = items.map(mapGenericItem).filter((e) => e.name || e.product || e.city || e.country || e.message);
  if (!events.length) return { status: "error", error: "Events need at least a name, product, location or message." };
  return { status: "ok", events };
}

/** Map a parsed request body to events using `preset`. */
export function mapWebhook(preset: WebhookPreset, body: unknown, headers: HeaderReader): MapResult {
  switch (preset) {
    case "stripe":
      return mapStripe(body);
    case "woocommerce":
      return mapWooCommerce(body, headers);
    case "shopify":
      return mapShopify(body, headers);
    default:
      return mapGeneric(body);
  }
}
