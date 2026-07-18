"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useGlobalShortcuts } from "@/lib/hooks/use-global-shortcuts";

export function GlobalShortcuts() {
  const router = useRouter();
  const pathname = usePathname();

  const focusSearch = useCallback(() => {
    if (pathname === "/search") {
      const input = document.getElementById("search-input");
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      }
      return;
    }

    sessionStorage.setItem("vidio-focus-search", "1");
    router.push("/search");
  }, [pathname, router]);

  useGlobalShortcuts({
    onFocusSearch: focusSearch,
  });

  return null;
}
