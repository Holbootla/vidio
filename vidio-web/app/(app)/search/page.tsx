import { getTranslations } from "next-intl/server";

export default async function SearchPlaceholderPage() {
  const t = await getTranslations("nav");

  return (
    <section className="space-y-3">
      <h1 className="text-3xl font-semibold tracking-tight">{t("search")}</h1>
      <p className="max-w-2xl text-muted-foreground">
        Cross-catalog search will connect to aggregated discovery results in Milestone 2.
      </p>
    </section>
  );
}
