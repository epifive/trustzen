import type { Anonymize, ContentByType, EmbedEvent, EventKind, EmbedTestimonial, EmbedWidgetData, WidgetContent, WidgetType } from "@/widget/types";

/**
 * Data for the live preview. Real data from the server is filtered with the
 * current (unsaved) content settings; when nothing is left, realistic sample
 * data is used so the preview is never empty.
 */

const SAMPLE_EVENTS: EmbedEvent[] = [
  { kind: "purchase", name: "Emma Johnson", city: "Austin", country: "United States", product: "Pro plan", url: "", image: "", rating: 0, message: "", ago: 120 },
  { kind: "signup", name: "Lucas Martin", city: "Lyon", country: "France", product: "Free trial", url: "", image: "", rating: 0, message: "", ago: 540 },
  { kind: "purchase", name: "Aisha Khan", city: "Dubai", country: "United Arab Emirates", product: "Starter kit", url: "", image: "", rating: 0, message: "", ago: 1260 },
  { kind: "review", name: "Noah Williams", city: "Toronto", country: "Canada", product: "Pro plan", url: "", image: "", rating: 5, message: "Setup took five minutes and our signups went up the same week.", ago: 2400 },
  { kind: "signup", name: "Sofia Rossi", city: "Milan", country: "Italy", product: "Newsletter", url: "", image: "", rating: 0, message: "", ago: 3900 },
  { kind: "purchase", name: "Kenji Tanaka", city: "Osaka", country: "Japan", product: "Annual plan", url: "", image: "", rating: 0, message: "", ago: 7200 },
  { kind: "review", name: "Olivia Brown", city: "Leeds", country: "United Kingdom", product: "Starter kit", url: "", image: "", rating: 4, message: "Clean design and it matched our brand without any custom code.", ago: 10800 },
  { kind: "custom", name: "Mateo Garcia", city: "Madrid", country: "Spain", product: "Webinar seat", url: "", image: "", rating: 0, message: "", ago: 14400 },
];

const SAMPLE_TESTIMONIALS: EmbedTestimonial[] = [
  { name: "Hannah Lee", title: "Founder, Brightside Studio", avatar: "", rating: 5, body: "We added the reviews popup on a Friday and saw more trial signups by Monday. It looks like it was built for our site." },
  { name: "Daniel Okafor", title: "Head of Growth, Loopcart", avatar: "", rating: 5, body: "The easiest conversion win we have shipped this year. Our customers trust the real, live activity." },
  { name: "Marie Dubois", title: "Owner, Atelier Lumen", avatar: "", rating: 4, body: "Simple to set up, beautiful on mobile, and the analytics show exactly what works." },
];

function anonymize(name: string, mode: Anonymize): string {
  const value = name.trim();
  if (!value || mode === "none") return value;
  const parts = value.split(/\s+/);
  if (mode === "first_name") return parts[0];
  return parts.map((p) => `${p[0].toUpperCase()}.`).join(" ");
}

export function previewData(type: WidgetType, content: WidgetContent, real: EmbedWidgetData): { data: EmbedWidgetData; sample: boolean } {
  switch (type) {
    case "recent_activity": {
      const c = content as ContentByType["recent_activity"];
      const pick = (list: EmbedEvent[]) =>
        list
          .filter((e) => c.kinds.includes(e.kind) && (!c.maxAgeHours || e.ago <= c.maxAgeHours * 3600))
          .slice(0, c.limit)
          .map((e) => ({ ...e, name: anonymize(e.name, c.anonymize) }));
      const events = pick(real.events ?? []);
      if (events.length) return { data: { events }, sample: false };
      const kinds: EventKind[] = c.kinds.length ? c.kinds : ["purchase"];
      const sample = SAMPLE_EVENTS.filter((e) => kinds.includes(e.kind));
      return { data: { events: (sample.length ? sample : SAMPLE_EVENTS).map((e) => ({ ...e, name: anonymize(e.name, c.anonymize) })) }, sample: true };
    }
    case "live_visitors": {
      const c = content as ContentByType["live_visitors"];
      const count = real.count ?? 0;
      if (count >= Math.max(1, c.minCount)) return { data: { count }, sample: false };
      return { data: { count: Math.max(c.minCount, 18) }, sample: true };
    }
    case "conversion_counter": {
      const c = content as ContentByType["conversion_counter"];
      const count = real.count ?? 0;
      if (count >= Math.max(1, c.minCount)) return { data: { count }, sample: false };
      return { data: { count: Math.max(c.minCount, 47) }, sample: true };
    }
    case "review": {
      const c = content as ContentByType["review"];
      if (c.source === "testimonials") {
        const testimonials = (real.testimonials ?? []).filter((r) => r.rating >= c.minRating).slice(0, c.limit);
        if (testimonials.length) return { data: { testimonials }, sample: false };
        const sample = SAMPLE_TESTIMONIALS.filter((r) => r.rating >= c.minRating);
        return { data: { testimonials: sample.length ? sample : SAMPLE_TESTIMONIALS }, sample: true };
      }
      const events = (real.events ?? []).filter((e) => e.kind === "review" && e.rating >= c.minRating).slice(0, c.limit);
      if (events.length) return { data: { events }, sample: false };
      return { data: { events: SAMPLE_EVENTS.filter((e) => e.kind === "review") }, sample: true };
    }
    default:
      return { data: {}, sample: false };
  }
}
