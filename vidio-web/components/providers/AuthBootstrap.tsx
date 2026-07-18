"use client";

import { useEffect } from "react";
import { clientAuthSessionSchema } from "@/lib/api/schemas";
import { useAuthStore } from "@/lib/auth/store";

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setBootstrapped = useAuthStore((state) => state.setBootstrapped);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const response = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "same-origin",
        });

        if (!response.ok) {
          if (!cancelled) {
            clearSession();
          }
          return;
        }

        const json: unknown = await response.json();
        const session = clientAuthSessionSchema.parse(json);
        if (!cancelled) {
          setSession(session);
        }
      } catch {
        if (!cancelled) {
          clearSession();
        }
      } finally {
        if (!cancelled) {
          setBootstrapped(true);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [clearSession, setBootstrapped, setSession]);

  return <>{children}</>;
}
