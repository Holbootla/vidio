"use client";

import { AppNav } from "@/components/shell/AppNav";
import { SkipLink } from "@/components/shell/SkipLink";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SkipLink />
      <AppNav />
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
