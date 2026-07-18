"use client";

import { useState } from "react";
import { Puzzle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryErrorState, QueryLoadingState } from "@/components/ui/query-status";
import { Skeleton } from "@/components/ui/skeleton";
import { AddonList } from "@/features/addons/addon-list";
import { InstallAddonForm, InstallAddonFormError } from "@/features/addons/install-addon-form";
import {
  buildReorderPayload,
  useAddonsQuery,
  useInstallAddonMutation,
  useRefreshAddonMutation,
  useRemoveAddonMutation,
  useReorderAddonsMutation,
  useToggleAddonMutation,
} from "@/features/addons/hooks";
import type { InstallAddonFormValues } from "@/features/addons/schemas";
import { ApiError } from "@/lib/api/errors";

interface AddonsViewProps {
  profileId: string;
}

export function AddonsView({ profileId }: AddonsViewProps) {
  const addonsQuery = useAddonsQuery(profileId);
  const installMutation = useInstallAddonMutation(profileId);
  const toggleMutation = useToggleAddonMutation(profileId);
  const refreshMutation = useRefreshAddonMutation(profileId);
  const removeMutation = useRemoveAddonMutation(profileId);
  const reorderMutation = useReorderAddonsMutation(profileId);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const pendingInstallationId =
    refreshMutation.isPending && refreshMutation.variables ? refreshMutation.variables : null;

  const handleInstall = (values: InstallAddonFormValues) => {
    setActionError(null);
    setStatusMessage(null);
    installMutation.mutate(values, {
      onSuccess: (addon) => {
        setStatusMessage(`Installed ${addon.name}.`);
      },
      onError: (error) => {
        setActionError(
          error instanceof ApiError ? (error.detail ?? error.title) : "Install failed.",
        );
      },
    });
  };

  const handleToggle = (installationId: string, enabled: boolean) => {
    setActionError(null);
    toggleMutation.mutate(
      { installationId, enabled },
      {
        onError: () => {
          setActionError("Could not update add-on status. Changes were rolled back.");
        },
      },
    );
  };

  const handleRefresh = (installationId: string) => {
    setActionError(null);
    refreshMutation.mutate(installationId, {
      onSuccess: (addon) => setStatusMessage(`Refreshed ${addon.name}.`),
      onError: (error) => {
        setActionError(
          error instanceof ApiError ? (error.detail ?? error.title) : "Refresh failed.",
        );
      },
    });
  };

  const handleRemove = (installationId: string) => {
    setActionError(null);
    removeMutation.mutate(installationId, {
      onSuccess: () => setStatusMessage("Add-on removed."),
      onError: () => {
        setActionError("Could not remove add-on. It was restored to your list.");
      },
    });
  };

  const handleReorder = (addons: Parameters<typeof buildReorderPayload>[0]) => {
    setActionError(null);
    reorderMutation.mutate(buildReorderPayload(addons), {
      onError: () => {
        setActionError("Could not save add-on order. Previous order was restored.");
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Add-ons</h1>
        <p className="text-muted-foreground">
          Install manifests, control priority, and refresh catalog sources.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Install add-on</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <InstallAddonForm isPending={installMutation.isPending} onSubmit={handleInstall} />
          {installMutation.isError ? <InstallAddonFormError error={installMutation.error} /> : null}
        </CardContent>
      </Card>

      {statusMessage ? (
        <p className="text-sm" role="status" aria-live="polite">
          {statusMessage}
        </p>
      ) : null}

      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      {addonsQuery.isLoading ? (
        <div className="space-y-3">
          <QueryLoadingState label="Loading add-ons…" />
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : null}

      {addonsQuery.isError ? (
        <QueryErrorState
          title="Could not load add-ons"
          message={addonsQuery.error instanceof Error ? addonsQuery.error.message : undefined}
        />
      ) : null}

      {!addonsQuery.isLoading && !addonsQuery.isError && (addonsQuery.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Puzzle}
          title="No add-ons installed"
          description="Install an HTTPS manifest URL to start browsing catalogs on your board."
        />
      ) : null}

      {addonsQuery.data && addonsQuery.data.length > 0 ? (
        <AddonList
          addons={addonsQuery.data}
          pendingInstallationId={pendingInstallationId}
          removingInstallationId={
            removeMutation.isPending && removeMutation.variables ? removeMutation.variables : null
          }
          reordering={reorderMutation.isPending}
          onToggle={handleToggle}
          onRefresh={handleRefresh}
          onRemove={handleRemove}
          onReorder={handleReorder}
        />
      ) : null}
    </div>
  );
}
