"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDefaultProfile, useLogoutMutation, useMeQuery } from "@/features/auth/use-auth";

export default function AccountSettingsPage() {
  const t = useTranslations("auth");
  const nav = useTranslations("nav");
  const meQuery = useMeQuery();
  const { profile } = useDefaultProfile();
  const logout = useLogoutMutation();

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{nav("settings")}</h1>
        <p className="text-muted-foreground">
          Account details and session management for your Vidio profile.
        </p>
      </div>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{meQuery.data?.email ?? "Loading…"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Active profile</p>
            <p className="font-medium">{profile?.name ?? "—"}</p>
          </div>
          <Button variant="destructive" onClick={() => logout.mutate()} disabled={logout.isPending}>
            {t("logout")}
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
