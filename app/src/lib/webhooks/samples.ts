/**
 * Example incoming webhook payloads, used in the dashboard docs and by the
 * preset self-check. Bodies are trimmed versions of what each provider sends
 * (unused fields removed); `creates` describes the resulting event.
 *
 * No imports: safe to use from client and server components.
 */

export interface WebhookSample {
  id: string;
  preset: "stripe" | "woocommerce" | "shopify" | "generic";
  title: string;
  description: string;
  /** Request headers the provider sends that matter for detection. */
  headers: Record<string, string>;
  contentType: "application/json" | "application/x-www-form-urlencoded";
  /** Parsed body (JSON) or a URL-encoded string for form posts. */
  body: unknown;
  /** The event(s) the sample creates (empty when the request is only acknowledged). */
  creates: Array<{ kind: string; name?: string; city?: string; country?: string; product?: string; rating?: number; message?: string }>;
}

export const STRIPE_CHECKOUT_SAMPLE: WebhookSample = {
  id: "stripe-checkout",
  preset: "stripe",
  title: "Stripe: checkout.session.completed",
  description:
    "Add a webhook endpoint in Stripe → Developers → Webhooks and select checkout.session.completed. Put the product name in the Checkout Session metadata as \"product\" (or \"product_name\").",
  headers: { "Stripe-Signature": "t=1792146000,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd" },
  contentType: "application/json",
  body: {
    id: "evt_1QabCdEfGhIjKlMn",
    object: "event",
    api_version: "2025-09-30.clover",
    created: 1792146000,
    type: "checkout.session.completed",
    livemode: false,
    data: {
      object: {
        id: "cs_test_a1B2c3D4e5F6",
        object: "checkout.session",
        amount_total: 4900,
        currency: "usd",
        created: 1792145950,
        customer_details: {
          email: "emma.johnson@example.com",
          name: "Emma Johnson",
          address: { city: "Austin", country: "US", line1: "500 Congress Ave", postal_code: "78701", state: "TX" },
        },
        metadata: { product: "Pro Plan (yearly)" },
        mode: "payment",
        payment_status: "paid",
        status: "complete",
      },
    },
  },
  creates: [{ kind: "purchase", name: "Emma Johnson", city: "Austin", country: "United States", product: "Pro Plan (yearly)" }],
};

export const STRIPE_CHARGE_SAMPLE: WebhookSample = {
  id: "stripe-charge",
  preset: "stripe",
  title: "Stripe: charge.succeeded",
  description: "For Payment Links, invoices or custom integrations. The charge description (or metadata.product) becomes the product.",
  headers: { "Stripe-Signature": "t=1792146000,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd" },
  contentType: "application/json",
  body: {
    id: "evt_3QxYzAbCdEfGhIjK",
    object: "event",
    created: 1792147200,
    type: "charge.succeeded",
    data: {
      object: {
        id: "ch_3QxYzAbCdEfGhIjK",
        object: "charge",
        amount: 1900,
        currency: "eur",
        created: 1792147195,
        description: "Photography Masterclass",
        billing_details: {
          email: "lukas@example.de",
          name: "Lukas Schneider",
          address: { city: "Berlin", country: "DE", line1: "Unter den Linden 1", postal_code: "10117" },
        },
        metadata: {},
        paid: true,
        status: "succeeded",
      },
    },
  },
  creates: [{ kind: "purchase", name: "Lukas Schneider", city: "Berlin", country: "Germany", product: "Photography Masterclass" }],
};

export const WOOCOMMERCE_ORDER_SAMPLE: WebhookSample = {
  id: "woocommerce-order",
  preset: "woocommerce",
  title: "WooCommerce: Order updated",
  description:
    "In WooCommerce → Settings → Advanced → Webhooks, add a webhook with topic \"Order updated\" (or \"Order created\"), API version WP REST API v3. Only orders with status processing or completed create events; each order is counted once.",
  headers: { "X-WC-Webhook-Topic": "order.updated", "X-WC-Webhook-Source": "https://shop.example.com/" },
  contentType: "application/json",
  body: {
    id: 1287,
    parent_id: 0,
    status: "processing",
    currency: "GBP",
    date_created_gmt: "2026-10-15T09:41:12",
    date_paid_gmt: "2026-10-15T09:41:30",
    total: "39.00",
    order_key: "wc_order_Xy7aB2cD3eF4g",
    number: "1287",
    billing: {
      first_name: "Olivia",
      last_name: "Brown",
      company: "",
      address_1: "12 King Street",
      city: "Manchester",
      postcode: "M2 4WU",
      country: "GB",
      email: "olivia.brown@example.co.uk",
    },
    shipping: { first_name: "Olivia", last_name: "Brown", city: "Manchester", country: "GB" },
    line_items: [
      {
        id: 315,
        name: "Organic Cotton Hoodie - Forest Green",
        product_id: 93,
        quantity: 1,
        total: "39.00",
        image: { id: 94, src: "https://shop.example.com/wp-content/uploads/2026/09/hoodie-green.jpg" },
      },
    ],
  },
  creates: [{ kind: "purchase", name: "Olivia Brown", city: "Manchester", country: "United Kingdom", product: "Organic Cotton Hoodie - Forest Green" }],
};

export const WOOCOMMERCE_PING_SAMPLE: WebhookSample = {
  id: "woocommerce-ping",
  preset: "woocommerce",
  title: "WooCommerce: connection test",
  description: "WooCommerce sends this once when the webhook is saved. Trustzen answers 200 so WooCommerce marks the webhook as active.",
  headers: {},
  contentType: "application/x-www-form-urlencoded",
  body: "webhook_id=14",
  creates: [],
};

export const SHOPIFY_ORDER_SAMPLE: WebhookSample = {
  id: "shopify-order",
  preset: "shopify",
  title: "Shopify: orders/create",
  description: "In Shopify admin → Settings → Notifications → Webhooks, create a webhook for \"Order creation\" in JSON format.",
  headers: { "X-Shopify-Topic": "orders/create", "X-Shopify-Shop-Domain": "example-store.myshopify.com" },
  contentType: "application/json",
  body: {
    id: 5893417238711,
    admin_graphql_api_id: "gid://shopify/Order/5893417238711",
    created_at: "2026-10-15T14:05:22-04:00",
    processed_at: "2026-10-15T14:05:21-04:00",
    currency: "CAD",
    financial_status: "paid",
    name: "#1043",
    order_number: 1043,
    total_price: "64.00",
    customer: { id: 7012345678901, first_name: "Noah", last_name: "Tremblay", email: "noah.t@example.ca" },
    billing_address: { first_name: "Noah", last_name: "Tremblay", city: "Montreal", province: "Quebec", country: "Canada", country_code: "CA", zip: "H2Y 1C6" },
    shipping_address: { first_name: "Noah", last_name: "Tremblay", city: "Montreal", country: "Canada", country_code: "CA" },
    line_items: [{ id: 14239876543210, title: "Ceramic Pour-Over Coffee Set", quantity: 1, price: "64.00", product_id: 8123456789012 }],
  },
  creates: [{ kind: "purchase", name: "Noah Tremblay", city: "Montreal", country: "Canada", product: "Ceramic Pour-Over Coffee Set" }],
};

export const GENERIC_EVENT_SAMPLE: WebhookSample = {
  id: "generic-event",
  preset: "generic",
  title: "Generic: one event (Zapier, Make, custom code)",
  description:
    "POST JSON (or a form) with any of: kind (purchase, signup, review, custom), name, city, country (name or 2-letter code), product, url, image, rating (1-5), message, created_at (ISO date).",
  headers: {},
  contentType: "application/json",
  body: { kind: "signup", name: "Sofia Rossi", city: "Milan", country: "IT", product: "Free trial", url: "https://example.com/signup" },
  creates: [{ kind: "signup", name: "Sofia Rossi", city: "Milan", country: "Italy", product: "Free trial" }],
};

export const GENERIC_BATCH_SAMPLE: WebhookSample = {
  id: "generic-batch",
  preset: "generic",
  title: "Generic: several events",
  description: "Send up to 50 events at once as { \"events\": [...] } or as a JSON array.",
  headers: {},
  contentType: "application/json",
  body: {
    events: [
      { kind: "purchase", name: "Liam Walsh", city: "Dublin", country: "Ireland", product: "Starter Kit", created_at: "2026-10-15T08:30:00Z" },
      { kind: "review", name: "Aisha Khan", rating: 5, message: "Setup took five minutes and sales went up.", product: "Starter Kit" },
    ],
  },
  creates: [
    { kind: "purchase", name: "Liam Walsh", city: "Dublin", country: "Ireland", product: "Starter Kit" },
    { kind: "review", name: "Aisha Khan", product: "Starter Kit", rating: 5, message: "Setup took five minutes and sales went up." },
  ],
};

export const WEBHOOK_SAMPLES: WebhookSample[] = [
  STRIPE_CHECKOUT_SAMPLE,
  STRIPE_CHARGE_SAMPLE,
  WOOCOMMERCE_ORDER_SAMPLE,
  WOOCOMMERCE_PING_SAMPLE,
  SHOPIFY_ORDER_SAMPLE,
  GENERIC_EVENT_SAMPLE,
  GENERIC_BATCH_SAMPLE,
];
