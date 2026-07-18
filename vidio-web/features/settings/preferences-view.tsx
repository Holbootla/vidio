"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryErrorState, QueryLoadingState } from "@/components/ui/query-status";
import { PreferencesForm, PreferencesFormError } from "@/features/settings/preferences-form";
import { usePreferencesQuery, useUpdatePreferencesMutation } from "@/features/settings/hooks";
import type { PreferencesFormValues } from "@/features/settings/schemas";

interface PreferencesViewProps {
  profileId: string;
}

export function PreferencesView({ profileId }: PreferencesViewProps) {
  const searchParams = useSearchParams();
  const preferencesQuery = usePreferencesQuery(profileId);
  const updateMutation = useUpdatePreferencesMutation(profileId);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (searchParams.get("reset") === "1") {
      setResetSignal(Date.now());
    }
  }, [searchParams]);

  const handleSubmit = (values: PreferencesFormValues) => {
    setStatusMessage(null);
    updateMutation.mutate(values, {
      onSuccess: () => setStatusMessage("Preferences saved."),
      onError: () => setStatusMessage(null),
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Preferences</h1>
        <p className="text-muted-foreground">
          Locale, language priorities, stream quality, and P2P visibility for this profile.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Playback &amp; discovery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {preferencesQuery.isLoading ? <QueryLoadingState label="Loading preferences…" /> : null}

          {preferencesQuery.isError ? (
            <QueryErrorState
              title="Could not load preferences"
              message={
                preferencesQuery.error instanceof Error ? preferencesQuery.error.message : undefined
              }
            />
          ) : null}

          {preferencesQuery.data ? (
            <PreferencesForm
              initialValues={preferencesQuery.data}
              isPending={updateMutation.isPending}
              resetSignal={resetSignal}
              onSubmit={handleSubmit}
            />
          ) : null}

          {updateMutation.isError ? <PreferencesFormError error={updateMutation.error} /> : null}

          {statusMessage ? (
            <p className="text-sm" role="status" aria-live="polite">
              {statusMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
