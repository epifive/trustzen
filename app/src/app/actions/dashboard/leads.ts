"use server";

import { guardDashboard } from "@/lib/dashboard";
import { getDb } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import type { FormState } from "../types";

export async function deleteLeadAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const id = Number(formData.get("lead_id"));
  if (!Number.isInteger(id) || id < 1) return { error: t("dash.err.leadNotFound") };
  const db = await getDb();
  const lead = await db
    .selectFrom("leads")
    .innerJoin("sites", "sites.id", "leads.site_id")
    .select("leads.id")
    .where("leads.id", "=", id)
    .where("sites.user_id", "=", guard.user.id)
    .executeTakeFirst();
  if (!lead) return { error: t("dash.err.leadNotFound") };
  await db.deleteFrom("leads").where("id", "=", lead.id).execute();
  return { success: t("dash.leads.deleted") };
}
