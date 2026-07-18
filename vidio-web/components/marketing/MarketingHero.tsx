import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export async function MarketingHero() {
  const t = await getTranslations("marketing");

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(109,140,255,0.18),_transparent_55%)]" />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            Web client foundation
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            {t("title")}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">{t("subtitle")}</p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/register">{t("getStarted")}</Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/login">{t("signIn")}</Link>
            </Button>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="grid gap-4">
            <div className="h-28 rounded-xl bg-muted" />
            <div className="grid grid-cols-3 gap-3">
              <div className="h-24 rounded-lg bg-muted" />
              <div className="h-24 rounded-lg bg-muted" />
              <div className="h-24 rounded-lg bg-muted" />
            </div>
            <div className="h-10 rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    </section>
  );
}
