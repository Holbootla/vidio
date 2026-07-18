"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { installAddonFormSchema, type InstallAddonFormValues } from "@/features/addons/schemas";
import { ApiError } from "@/lib/api/errors";

interface InstallAddonFormProps {
  isPending: boolean;
  onSubmit: (values: InstallAddonFormValues) => void;
}

export function InstallAddonForm({ isPending, onSubmit }: InstallAddonFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setFocus,
  } = useForm<InstallAddonFormValues>({
    resolver: zodResolver(installAddonFormSchema),
    defaultValues: { transport_url: "" },
  });

  useEffect(() => {
    if (errors.transport_url) {
      setFocus("transport_url");
    }
  }, [errors.transport_url, setFocus]);

  const handleFormSubmit = (values: InstallAddonFormValues) => {
    onSubmit(values);
    reset({ transport_url: "" });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(handleFormSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="transport_url">HTTPS manifest URL</Label>
        <p className="text-sm text-muted-foreground">
          Paste the secret transport URL from your add-on provider. It is sent once during install
          and is never shown again in Vidio.
        </p>
        <Input
          id="transport_url"
          type="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://example.com/manifest.json"
          aria-invalid={Boolean(errors.transport_url)}
          aria-describedby={errors.transport_url ? "transport-url-error" : "transport-url-hint"}
          {...register("transport_url")}
        />
        <p id="transport-url-hint" className="sr-only">
          Secret transport URL for add-on installation
        </p>
        {errors.transport_url ? (
          <p id="transport-url-error" className="text-sm text-destructive" role="alert">
            {errors.transport_url.message}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={isPending || isSubmitting}>
        Install add-on
      </Button>
    </form>
  );
}

export function InstallAddonFormError({ error }: { error: unknown }) {
  if (!(error instanceof ApiError)) {
    return null;
  }
  return <Alert>{error.detail ?? error.title}</Alert>;
}
