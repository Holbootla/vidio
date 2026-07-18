"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryErrorState, QueryLoadingState } from "@/components/ui/query-status";
import { useLogoutMutation, useMeQuery } from "@/features/auth/use-auth";

const STATUS_LABELS: Record<string, string> = {
  pending_verification: "Pending verification",
  active: "Active",
  disabled: "Disabled",
};

interface AccountViewProps {
  profileName?: string | null;
}

export function AccountView({ profileName }: AccountViewProps) {
  const meQuery = useMeQuery();
  const logout = useLogoutMutation();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Account</h1>
        <p className="text-muted-foreground">
          Your Vidio account details. Device and session management is not available in web v1.
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {meQuery.isLoading ? <QueryLoadingState label="Loading account…" /> : null}

          {meQuery.isError ? (
            <QueryErrorState
              title="Could not load account"
              message={meQuery.error instanceof Error ? meQuery.error.message : undefined}
            />
          ) : null}

          {meQuery.data ? (
            <>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{meQuery.data.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="font-medium">
                  {STATUS_LABELS[meQuery.data.status] ?? meQuery.data.status}
                </p>
              </div>
            </>
          ) : null}

          {profileName ? (
            <div>
              <p className="text-sm text-muted-foreground">Active profile</p>
              <p className="font-medium">{profileName}</p>
            </div>
          ) : null}

          <Button variant="destructive" onClick={() => logout.mutate()} disabled={logout.isPending}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
