import { AsyncLocalStorage } from "node:async_hooks";

export type QueryTiming = {
  durationMs: number;
  query: string;
  target?: string;
};

export type StepTiming = {
  label: string;
  durationMs: number;
};

export type RequestTimingStore = {
  requestId: string;
  startedAt: number;
  queries: QueryTiming[];
  steps: StepTiming[];
  dbMs: number;
};

export const requestContext = new AsyncLocalStorage<RequestTimingStore>();

export function getTimingStore(): RequestTimingStore | undefined {
  return requestContext.getStore();
}

export function recordQuery(timing: QueryTiming) {
  const store = getTimingStore();
  if (!store) return;
  store.queries.push(timing);
  store.dbMs += timing.durationMs;
}

export function recordStep(label: string, durationMs: number) {
  const store = getTimingStore();
  if (!store) return;
  store.steps.push({ label, durationMs });
}

/** Time a named handler step and record it on the active request. */
export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    recordStep(label, Math.round(performance.now() - start));
  }
}
