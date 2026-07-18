export const PROGRESS_INTERVAL_MS = 15_000;

export interface ProgressSnapshot {
  position: number;
  duration: number;
}

export interface ProgressReporterOptions {
  intervalMs?: number;
  onReport: (snapshot: ProgressSnapshot, watched?: boolean) => void;
}

export interface ProgressReporter {
  start: (getSnapshot: () => ProgressSnapshot) => void;
  stop: () => void;
  flush: (snapshot: ProgressSnapshot, watched?: boolean) => void;
  maybeReport: (snapshot: ProgressSnapshot, watched?: boolean, force?: boolean) => void;
}

export function createProgressReporter(options: ProgressReporterOptions): ProgressReporter {
  const intervalMs = options.intervalMs ?? PROGRESS_INTERVAL_MS;
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastReportAt = 0;
  let getSnapshot: (() => ProgressSnapshot) | null = null;

  const maybeReport = (snapshot: ProgressSnapshot, watched?: boolean, force = false): void => {
    const now = Date.now();
    if (!force && now - lastReportAt < intervalMs) {
      return;
    }
    lastReportAt = now;
    options.onReport(snapshot, watched);
  };

  const start = (snapshotGetter: () => ProgressSnapshot): void => {
    getSnapshot = snapshotGetter;
    if (timer) {
      clearInterval(timer);
    }
    timer = setInterval(() => {
      if (!getSnapshot) {
        return;
      }
      maybeReport(getSnapshot(), undefined, false);
    }, intervalMs);
  };

  const stop = (): void => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const flush = (snapshot: ProgressSnapshot, watched?: boolean): void => {
    maybeReport(snapshot, watched, true);
  };

  return {
    start,
    stop,
    flush,
    maybeReport,
  };
}

export function isNearCompletion(position: number, duration: number): boolean {
  if (duration <= 0) {
    return false;
  }
  return position / duration >= 0.9;
}
