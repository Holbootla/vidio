"use client";

import { PosterImage } from "@/components/media/poster-image";
import type { Meta } from "@/lib/api/schemas";

interface MetaHeroProps {
  meta: Meta;
}

export function MetaHero({ meta }: MetaHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card">
      {meta.background ? (
        <div className="absolute inset-0">
          <PosterImage src={meta.background} alt="" className="opacity-30 blur-sm" sizes="100vw" />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/90 to-card/40" />
        </div>
      ) : null}
      <div className="relative grid gap-6 p-6 md:grid-cols-[180px_1fr] md:items-end">
        <div className="relative mx-auto aspect-[2/3] w-40 overflow-hidden rounded-xl bg-muted shadow-soft md:mx-0 md:w-full md:max-w-[180px]">
          <PosterImage src={meta.poster} alt="" sizes="180px" priority />
        </div>
        <div className="space-y-4 text-center md:text-left">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-wide text-muted-foreground">{meta.type}</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{meta.name}</h1>
          </div>
          <dl className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground md:justify-start">
            {meta.releaseInfo ? (
              <div>
                <dt className="sr-only">Release</dt>
                <dd>{meta.releaseInfo}</dd>
              </div>
            ) : null}
            {meta.runtime ? (
              <div>
                <dt className="sr-only">Runtime</dt>
                <dd>{meta.runtime}</dd>
              </div>
            ) : null}
            {meta.imdbRating ? (
              <div>
                <dt className="sr-only">Rating</dt>
                <dd>IMDb {meta.imdbRating}</dd>
              </div>
            ) : null}
          </dl>
          {meta.genres.length > 0 ? (
            <p className="text-sm text-muted-foreground">{meta.genres.join(" · ")}</p>
          ) : null}
          {meta.description ? (
            <p className="max-w-3xl text-sm leading-relaxed text-foreground/90">
              {meta.description}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
