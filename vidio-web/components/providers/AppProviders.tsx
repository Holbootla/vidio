"use client";

import { NextIntlClientProvider } from "next-intl";
import { AuthBootstrap } from "@/components/providers/AuthBootstrap";
import { QueryProvider } from "@/components/providers/QueryProvider";

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
        <AuthBootstrap>{children}</AuthBootstrap>
      </QueryProvider>
    </NextIntlClientProvider>
  );
}
