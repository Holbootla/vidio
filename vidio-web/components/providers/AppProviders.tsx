"use client";

import { NextIntlClientProvider } from "next-intl";
import { AuthBootstrap } from "@/components/providers/AuthBootstrap";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { SyncProvider } from "@/features/sync/SyncProvider";

export function AppProviders({
  children,
  messages,
  locale,
}: {
  children: React.ReactNode;
  messages: Record<string, unknown>;
  locale: string;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <QueryProvider>
        <AuthBootstrap>
          <SyncProvider>{children}</SyncProvider>
        </AuthBootstrap>
      </QueryProvider>
    </NextIntlClientProvider>
  );
}
