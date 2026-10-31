import "server-only";
import type { Kysely } from "kysely";
import type { Database } from "./schema";

/** Translations of the default site texts, so the demo's home page is fully translated. */
const SITE_TEXTS: Record<string, Record<string, string>> = {
  ar: {
    "setting.site_tagline": "دليل اجتماعي يحوّل الزوار إلى عملاء",
    "setting.home_hero_title": "حوّل زوارك إلى عملاء بالدليل الاجتماعي",
    "setting.home_hero_subtitle":
      "اعرض المشتريات والتسجيلات والتقييمات الحقيقية وعدد الزوار الآن على موقعك. اجمع شهادات العملاء والتقط العملاء المحتملين وأضف عنصر الإلحاح بسطر واحد من الكود.",
    "setting.footer_text": "الدليل الاجتماعي وشهادات العملاء وودجات التحويل لأي موقع.",
    "setting.copyright_text": "© {year} {site_name}. جميع الحقوق محفوظة.",
  },
  hi: {
    "setting.site_tagline": "सोशल प्रूफ जो ग्राहक बनाए",
    "setting.home_hero_title": "सोशल प्रूफ से विज़िटर्स को ग्राहक बनाइए",
    "setting.home_hero_subtitle":
      "अपनी वेबसाइट पर असली खरीदारी, साइनअप, रिव्यू और अभी मौजूद विज़िटर्स दिखाइए। टेस्टिमोनियल जुटाइए, लीड पाइए और कोड की एक लाइन से अर्जेंसी जोड़िए।",
    "setting.footer_text": "किसी भी वेबसाइट के लिए सोशल प्रूफ, टेस्टिमोनियल और कन्वर्ज़न विजेट।",
    "setting.copyright_text": "© {year} {site_name}. सर्वाधिकार सुरक्षित।",
  },
};

interface LanguagePack {
  language: { code: string; name: string; native_name: string; direction: "ltr" | "rtl" };
  translations: Record<string, string>;
}

/** Install the bundled Hindi and Arabic packs on a demo site (once, guarded by a settings row). */
export async function seedDemoLanguages(db: Kysely<Database>): Promise<void> {
  try {
    await db.insertInto("settings").values({ key: "demo_languages_seeded_at", value: new Date().toISOString() }).execute();
  } catch {
    return;
  }
  const packs = [(await import("../../../languages/hi.json")).default, (await import("../../../languages/ar.json")).default] as LanguagePack[];
  for (const [index, pack] of packs.entries()) {
    const { code, name, native_name, direction } = pack.language;
    const exists = await db.selectFrom("languages").select("code").where("code", "=", code).executeTakeFirst();
    if (exists) continue;
    const rows = Object.entries({ ...pack.translations, ...SITE_TEXTS[code] }).map(([key, value]) => ({ lang: code, key, value }));
    await db.transaction().execute(async (trx) => {
      await trx.insertInto("languages").values({ code, name, native_name, direction, is_active: 1, sort_order: (index + 1) * 10 }).execute();
      for (let i = 0; i < rows.length; i += 200) await trx.insertInto("translations").values(rows.slice(i, i + 200)).execute();
    });
  }
}
