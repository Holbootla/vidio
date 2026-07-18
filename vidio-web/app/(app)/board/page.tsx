import { LayoutGrid } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function BoardPage() {
  const t = await getTranslations("board");

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          Your personalized home for catalog rows and continue watching.
        </p>
      </div>
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <LayoutGrid className="h-6 w-6 text-primary" aria-hidden />
        </div>
        <h2 className="text-xl font-medium">{t("emptyTitle")}</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          {t("emptyDescription")}
        </p>
      </div>
    </section>
  );
}
