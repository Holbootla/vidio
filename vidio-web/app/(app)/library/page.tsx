import { getTranslations } from "next-intl/server";

export default async function LibraryPlaceholderPage() {
  const t = await getTranslations("nav");

  return (
    <section className="space-y-3">
      <h1 className="text-3xl font-semibold tracking-tight">{t("library")}</h1>
      <p className="max-w-2xl text-muted-foreground">
        Saved titles and library management will appear here in Milestone 2.
      </p>
    </section>
  );
}
