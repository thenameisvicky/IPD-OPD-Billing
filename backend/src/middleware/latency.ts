import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { logger } from "../lib/logger";
import { requestContext, type RequestTimingStore } from "../lib/requestContext";
import { env } from "../config/env";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      timingStartedAt?: number;
    }
  }
}

function summarizeQueries(store: RequestTimingStore) {
  const byPrefix = new Map<string, { count: number; ms: number }>();
  for (const q of store.queries) {
    const key = q.query.split(" ").slice(0, 3).join(" ");
    const cur = byPrefix.get(key) || { count: 0, ms: 0 };
    cur.count += 1;
    cur.ms += q.durationMs;
    byPrefix.set(key, cur);
  }
  return [...byPrefix.entries()]
    .map(([prefix, v]) => ({ prefix, count: v.count, ms: v.ms }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 12);
}

export function latencyMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = randomUUID().slice(0, 8);
  const startedAt = performance.now();
  req.requestId = requestId;
  req.timingStartedAt = startedAt;

  const store: RequestTimingStore = {
    requestId,
    startedAt,
    queries: [],
    steps: [],
    dbMs: 0,
  };

  res.setHeader("X-Request-Id", requestId);

  const logBreakdown = () => {
    if (!env.LATENCY_LOG) return;
    if (req.path === "/health" || req.path.startsWith("/api/docs")) return;

    const totalMs = Math.round(performance.now() - startedAt);
    const dbMsSum = Math.round(store.dbMs);
    const dbMsMax = store.queries.reduce((m, q) => Math.max(m, q.durationMs), 0);
    // When queries run in parallel, dbMsSum can exceed totalMs — that is expected.
    const overlapped = dbMsSum > totalMs;
    const slowest = [...store.queries]
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 5)
      .map((q) => ({ ms: q.durationMs, sql: q.query }));

    logger.info(
      {
        type: "latency",
        requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        totalMs,
        dbMsSum,
        dbMsMax,
        overlapped,
        queryCount: store.queries.length,
        steps: store.steps,
        queryGroups: summarizeQueries(store),
        slowestQueries: slowest,
      },
      `${req.method} ${req.originalUrl} ${totalMs}ms (dbSum=${dbMsSum}ms dbMax=${dbMsMax}ms q=${store.queries.length}${overlapped ? " parallel" : ""})`,
    );
  };

  res.on("finish", logBreakdown);

  requestContext.run(store, () => next());
}
