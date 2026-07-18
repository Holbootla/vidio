"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TagListInput } from "@/features/settings/tag-list-input";
import {
  defaultPreferencesFormValues,
  preferencesFormSchema,
  type PreferencesFormValues,
} from "@/features/settings/schemas";
import { ApiError } from "@/lib/api/errors";

interface PreferencesFormProps {
  initialValues: PreferencesFormValues;
  isPending: boolean;
  resetSignal?: number;
  onSubmit: (values: PreferencesFormValues) => void;
}

export function PreferencesForm({
  initialValues,
  isPending,
  resetSignal,
  onSubmit,
}: PreferencesFormProps) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesFormSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  useEffect(() => {
    if (resetSignal !== undefined) {
      reset(defaultPreferencesFormValues);
    }
  }, [resetSignal, reset]);

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="locale">Locale</Label>
        <Input
          id="locale"
          autoComplete="language"
          aria-invalid={Boolean(errors.locale)}
          aria-describedby={errors.locale ? "locale-error" : undefined}
          {...register("locale")}
        />
        {errors.locale ? (
          <p id="locale-error" className="text-sm text-destructive" role="alert">
            {errors.locale.message}
          </p>
        ) : null}
      </div>

      <Controller
        control={control}
        name="subtitle_languages"
        render={({ field }) => (
          <TagListInput
            id="subtitle_languages"
            label="Subtitle languages"
            description="Most preferred languages first (for example en or es)."
            values={field.value}
            placeholder="en"
            disabled={isPending}
            onChange={field.onChange}
          />
        )}
      />

      <Controller
        control={control}
        name="audio_languages"
        render={({ field }) => (
          <TagListInput
            id="audio_languages"
            label="Audio languages"
            description="Preferred audio track languages, most preferred first."
            values={field.value}
            placeholder="en"
            disabled={isPending}
            onChange={field.onChange}
          />
        )}
      />

      <Controller
        control={control}
        name="preferred_qualities"
        render={({ field }) => (
          <TagListInput
            id="preferred_qualities"
            label="Preferred qualities"
            description="Stream quality preference order, such as 1080p or 720p."
            values={field.value}
            placeholder="1080p"
            disabled={isPending}
            onChange={field.onChange}
          />
        )}
      />

      <Controller
        control={control}
        name="hide_p2p_streams"
        render={({ field }) => (
          <div className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4">
            <div className="space-y-1">
              <Label htmlFor="hide_p2p_streams">Hide P2P streams</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, torrent and other peer-to-peer sources stay out of playback lists.
              </p>
            </div>
            <Switch
              id="hide_p2p_streams"
              checked={field.value}
              disabled={isPending}
              label="Hide P2P streams"
              onCheckedChange={field.onChange}
            />
          </div>
        )}
      />

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isPending || !isDirty}>
          Save preferences
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => reset(defaultPreferencesFormValues)}
        >
          Reset to defaults
        </Button>
      </div>
    </form>
  );
}

export function PreferencesFormError({ error }: { error: unknown }) {
  if (!(error instanceof ApiError)) {
    return null;
  }
  return <Alert>{error.detail ?? error.title}</Alert>;
}
