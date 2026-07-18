"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth/store";
import { countQueuedMutations } from "@/lib/sync/offlineQueue";
import { isBrowserOnline } from "@/lib/sync/online";
import { runSync } from "@/lib/sync/runSync";

export const SYNC_INTERVAL_MS = 5 * 60 * 1000;

export type SyncStatus = "idle" | "offline" | "queued" | "syncing" | "error";

interface SyncContextValue {
  status: SyncStatus;
  queuedCount: number;
  lastError: string | null;
  triggerSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

function deriveStatus(input: {
  online: boolean;
  queuedCount: number;
  syncing: boolean;
  lastError: string | null;
}): SyncStatus {
  if (input.syncing) {
    return "syncing";
  }
  if (!input.online) {
    return "offline";
  }
  if (input.lastError) {
    return "error";
  }
  if (input.queuedCount > 0) {
    return "queued";
  }
  return "idle";
}

function statusMessage(status: SyncStatus, queuedCount: number, lastError: string | null): string {
  switch (status) {
    case "offline":
      return queuedCount > 0
        ? `Offline — ${queuedCount} change${queuedCount === 1 ? "" : "s"} will sync when reconnected`
        : "Offline — changes will sync when reconnected";
    case "queued":
      return `${queuedCount} change${queuedCount === 1 ? "" : "s"} waiting to sync`;
    case "syncing":
      return "Syncing your library and progress";
    case "error":
      return lastError ?? "Sync failed — will retry automatically";
    case "idle":
      return "Synced";
  }
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const profileId = useAuthStore((state) => state.profile?.id ?? null);
  const accessToken = useAuthStore((state) => state.accessToken);
  const setProfile = useAuthStore((state) => state.setProfile);
  const getProfile = useCallback(() => useAuthStore.getState().profile, []);

  const [online, setOnline] = useState(() => isBrowserOnline());
  const [queuedCount, setQueuedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const syncInFlightRef = useRef(false);

  const refreshQueuedCount = useCallback(async (currentProfileId: string) => {
    const count = await countQueuedMutations(currentProfileId);
    setQueuedCount(count);
    return count;
  }, []);

  const performSync = useCallback(async () => {
    if (!profileId || !accessToken || syncInFlightRef.current) {
      return;
    }

    syncInFlightRef.current = true;
    setSyncing(true);
    setLastError(null);

    try {
      const result = await runSync({
        profileId,
        queryClient,
        setProfile,
        getProfile,
      });

      await refreshQueuedCount(profileId);

      if (result.halted && result.haltReason) {
        setLastError(result.haltReason);
      } else if (result.discarded.length > 0) {
        setLastError(
          `Discarded ${result.discarded.length} change${result.discarded.length === 1 ? "" : "s"} that could not be synced`,
        );
      } else {
        setLastError(null);
      }
    } catch (error) {
      setLastError(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setSyncing(false);
      syncInFlightRef.current = false;
    }
  }, [accessToken, getProfile, profileId, queryClient, refreshQueuedCount, setProfile]);

  const handleOnline = useCallback(() => {
    setOnline(true);
    void performSync();
  }, [performSync]);

  const handleOffline = useCallback(() => {
    setOnline(false);
  }, []);

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === "visible" && isBrowserOnline()) {
      void performSync();
    }
  }, [performSync]);

  useEffect(() => {
    if (!profileId || !accessToken) {
      setQueuedCount(0);
      return;
    }

    void refreshQueuedCount(profileId);
    void performSync();
  }, [accessToken, performSync, profileId, refreshQueuedCount]);

  useEffect(() => {
    if (!profileId || !accessToken) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void performSync();
      }
    }, SYNC_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [accessToken, performSync, profileId]);

  const handleQueueChanged = useCallback(
    (event: Event) => {
      const detail = (event as CustomEvent<{ profileId: string }>).detail;
      if (detail?.profileId === profileId) {
        void refreshQueuedCount(profileId);
      }
    },
    [profileId, refreshQueuedCount],
  );

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("vidio-sync-queue-changed", handleQueueChanged);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("vidio-sync-queue-changed", handleQueueChanged);
    };
  }, [handleOffline, handleOnline, handleQueueChanged, handleVisibilityChange]);

  const status = deriveStatus({ online, queuedCount, syncing, lastError });
  const message = statusMessage(status, queuedCount, lastError);

  const value = useMemo<SyncContextValue>(
    () => ({
      status,
      queuedCount,
      lastError,
      triggerSync: performSync,
    }),
    [lastError, performSync, queuedCount, status],
  );

  if (!profileId || !accessToken) {
    return <>{children}</>;
  }

  return (
    <SyncContext.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {message}
      </div>
    </SyncContext.Provider>
  );
}

export function useSyncContext(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    return {
      status: "idle",
      queuedCount: 0,
      lastError: null,
      triggerSync: async () => {},
    };
  }
  return context;
}
