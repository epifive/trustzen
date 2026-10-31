/**
 * Form capture: when a host-page form with a name field is submitted, report the
 * first name (plus optional city / country / product) as an event. Emails,
 * passwords, payment and all other fields are never read or sent.
 */

import type { CapturePayload } from "../types";
import { D, beacon, ctx, endpoint, on } from "./core";

type Field = HTMLInputElement & HTMLSelectElement;

const NAME = /^(name|first[_-]?name|firstname|fname|full[_-]?name|your[_-]?name)$/;
const SENSITIVE = /card|cvv|cvc|iban/;

/** "billing[first_name]" -> "first_name" */
const keyOf = (el: Field) => (el.name || el.id || "").toLowerCase().replace(/\]$/, "").replace(/^.*\[/, "");

export function captureForms(): void {
  on<SubmitEvent>(
    D,
    "submit",
    (e) => {
      const f = e.target as HTMLFormElement;
      if (!f || f.tagName !== "FORM" || f.getRootNode() !== D) return;
      if (f.getAttribute("role") === "search" || /search/i.test(f.getAttribute("action") || "")) return;
      const fields = Array.prototype.slice.call(f.elements) as Field[];
      let texts = 0;
      let searchy = 0;
      for (const el of fields) {
        const type = (el.type || "").toLowerCase();
        const raw = (el.name || el.id || "").toLowerCase();
        if (type === "password" || type === "search" || /^cc-/.test((el.getAttribute("autocomplete") || "").toLowerCase()) || SENSITIVE.test(raw)) return;
        if (type === "text") {
          texts++;
          if (/^(q|s|search|query|keywords?)$/.test(keyOf(el))) searchy++;
        }
      }
      if (searchy && texts === 1) return;

      const out: CapturePayload = { v: ctx.v, p: location.pathname, name: "", city: "", country: "", product: "" };
      for (const el of fields) {
        const type = (el.type || "").toLowerCase();
        if (type === "email" || type === "checkbox" || type === "radio" || type === "file") continue;
        const k = keyOf(el);
        let v = (el.value || "").trim();
        if (el.tagName === "SELECT" && el.selectedIndex > -1) v = (el.options[el.selectedIndex].text || v).trim();
        if (!v) continue;
        if (!out.name && type !== "hidden" && NAME.test(k)) out.name = v.split(/\s+/)[0].slice(0, 40);
        else if (!out.city && type !== "hidden" && /^(city|town)$/.test(k)) out.city = v.slice(0, 60);
        else if (!out.country && /^country$/.test(k)) out.country = v.slice(0, 60);
        else if (!out.product && /^(product|product[_-]?name|item|plan)$/.test(k)) out.product = v.slice(0, 100);
      }
      if (!out.name || /[@\d<>]/.test(out.name)) return;
      beacon(endpoint("capture"), out);
    },
    true,
  );
}
