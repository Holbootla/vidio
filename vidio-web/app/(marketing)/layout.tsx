import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Clapperboard } from "lucide-react";

export const metadata: Metadata = {
  title: "Vidio — Your media, unified",
};

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("marketing");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold">
            <Clapperboard className="h-5 w-5 text-primary" aria-hidden />
            Vidio
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">{t("signIn")}</Link>
            </Button>
            <Button asChild>
              <Link href="/register">{t("getStarted")}</Link>
            </Button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
