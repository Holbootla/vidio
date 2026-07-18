import { getTranslations } from "next-intl/server";

export default async function DiscoverPlaceholderPage() {
  const t = await getTranslations("nav");

  return (
    <section className="space-y-3">
      <h1 className="text-3xl font-semibold tracking-tight">{t("discover")}</h1>
      <p className="max-w-2xl text-muted-foreground">
        Catalog browsing arrives in Milestone 2. You can still explore the shell and authentication
        flow today.
      </p>
    </section>
  );
}
