import type { Metadata } from "next";
import { JetBrains_Mono, Sora } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import { defaultLocale } from "@/lib/i18n/config";
import "@/styles/globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vidio",
  description: "Browse, library, and playback for your media add-ons.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const messages = (await import(`../messages/${defaultLocale}.json`)).default;

  return (
    <html
      lang={defaultLocale}
      className={`${sora.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <AppProviders locale={defaultLocale} messages={messages}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
