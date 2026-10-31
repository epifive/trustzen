import "server-only";
import crypto from "node:crypto";
import { after } from "next/server";
import { getDb, now } from "./db";
import type { Site } from "./db/schema";
import { mailConfigured, sendMail } from "./mail";
import { postJson } from "./net/ssrf";
import { getSettings } from "./settings";
import { parseSiteSettings } from "./sites";
import { absoluteUrl } from "./site";
import { getEntitlements } from "./plans";

/**
 * Tells a site owner about new leads, testimonials and events:
 * - by email (leads and testimonials only) when SMTP is set up and the site's
 *   "notifyEmail" option is on;
 * - by POSTing JSON to the site's outgoing webhook URL ("webhookUrl"), for all types.
 *
 * Outgoing webhook request:
 *   POST <webhookUrl>
 *   Content-Type: application/json
 *   X-Trustzen-Event: lead | testimonial | event
 *   X-Trustzen-Signature: sha256=<hex HMAC-SHA256 of the raw body, keyed with the site's webhook token>
 *   { "type": "lead", "site": { "id", "name", "domain" }, "data": { ... }, "sent_at": "ISO date" }
 *
 * Delivery is best effort: 5 s timeout, no redirects, public addresses only,
 * failures are ignored. Work runs after the response has been sent.
 */

export type NotifyType = "lead" | "testimonial" | "event";

export interface Notification {
  type: NotifyType;
  data: Record<string, unknown>;
}

export function notifyOwner(site: Site, notification: Notification): void {
  const run = () => deliver(site, notification).catch(() => undefined);
  try {
    after(run);
  } catch {
    // Outside a request scope (scripts, tests): run detached.
    void run();
  }
}

const line = (v: unknown) => String(v ?? "").replace(/[\r\n]+/g, " ").trim();

function emailFor(site: Site, n: Notification, dashboardUrl: string): { subject: string; text: string } | null {
  const d = n.data;
  if (n.type === "lead") {
    return {
      subject: `New subscriber on ${line(site.name)}`,
      text: [
        `Someone joined your list on ${site.domain}.`,
        "",
        `Email: ${line(d.email)}`,
        d.name ? `Name: ${line(d.name)}` : "",
        d.page ? `Page: ${line(d.page)}` : "",
        "",
        `See all leads in your dashboard: ${dashboardUrl}`,
      ]
        .filter((l, i, all) => l !== "" || all[i - 1] !== "")
        .join("\n"),
    };
  }
  if (n.type === "testimonial") {
    const pending = d.status !== "approved";
    return {
      subject: `New ${Number(d.rating) || 5}-star testimonial on ${line(site.name)}`,
      text: [
        `${line(d.name)}${d.title ? ` (${line(d.title)})` : ""} left a testimonial:`,
        "",
        `Rating: ${Number(d.rating) || 5} / 5`,
        "",
        String(d.body ?? ""),
        "",
        pending ? `It is waiting for your approval: ${dashboardUrl}` : `It is already published on your widgets. Manage testimonials: ${dashboardUrl}`,
      ].join("\n"),
    };
  }
  return null;
}

async function deliver(site: Site, n: Notification): Promise<void> {
  const [settings, db] = await Promise.all([getSettings(), getDb()]);
  const siteSettings = parseSiteSettings(site.settings);
  const tasks: Promise<unknown>[] = [];

  if (n.type !== "event" && siteSettings.notifyEmail && mailConfigured(settings)) {
    const owner = await db.selectFrom("users").select(["email", "status"]).where("id", "=", site.user_id).executeTakeFirst();
    const message = emailFor(site, n, absoluteUrl(settings, `/dashboard/sites/${site.id}`));
    if (owner?.email && owner.status === "active" && message) {
      tasks.push(sendMail({ to: owner.email, ...message }).catch(() => undefined));
    }
  }

  // Outgoing webhooks are a paid feature: stop delivering after a downgrade.
  const webhookOwner = siteSettings.webhookUrl
    ? await db.selectFrom("users").select(["role", "status", "plan_id", "plan_expires_at"]).where("id", "=", site.user_id).executeTakeFirst()
    : undefined;
  const webhookAllowed = Boolean(webhookOwner && webhookOwner.status === "active" && (await getEntitlements(webhookOwner)).isPremium);

  if (siteSettings.webhookUrl && webhookAllowed) {
    const body = JSON.stringify({ type: n.type, site: { id: site.id, name: site.name, domain: site.domain }, data: n.data, sent_at: now() });
    const signature = crypto.createHmac("sha256", site.webhook_token).update(body).digest("hex");
    tasks.push(
      postJson(siteSettings.webhookUrl, body, {
        timeoutMs: 5_000,
        headers: { "X-Trustzen-Event": n.type, "X-Trustzen-Signature": `sha256=${signature}` },
      }).catch(() => undefined),
    );
  }

  await Promise.all(tasks);
}
