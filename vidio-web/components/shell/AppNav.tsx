"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Clapperboard, Compass, LayoutGrid, Library, Search, Settings } from "lucide-react";
import { SyncStatusBadge } from "@/components/shell/SyncStatusBadge";
import { cn } from "@/lib/utils/cn";
import { useAuthStore } from "@/lib/auth/store";

const navItems = [
  { href: "/board", labelKey: "board", icon: LayoutGrid },
  { href: "/discover", labelKey: "discover", icon: Compass },
  { href: "/search", labelKey: "search", icon: Search },
  { href: "/library", labelKey: "library", icon: Library },
  { href: "/settings/addons", labelKey: "settings", icon: Settings },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const profileName = useAuthStore((state) => state.profile?.name);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link
          href="/board"
          className="inline-flex items-center gap-2 font-semibold tracking-tight text-foreground"
        >
          <Clapperboard className="h-5 w-5 text-primary" aria-hidden />
          <span>Vidio</span>
        </Link>
        <nav aria-label="Primary" className="hidden flex-1 md:block">
          <ul className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {t(item.labelKey)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
          <SyncStatusBadge />
          {profileName ? (
            <span aria-label={`Active profile ${profileName}`}>{profileName}</span>
          ) : null}
        </div>
      </div>
      <nav aria-label="Mobile primary" className="border-t border-border/70 px-2 py-2 md:hidden">
        <ul className="grid grid-cols-5 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium",
                    active ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span>{t(item.labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
