import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { isAppError } from "../lib/errors";
import { logger } from "../lib/logger";
import { fail } from "../lib/response";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return fail(res, 400, "VALIDATION_ERROR", "Request validation failed", err.flatten());
  }
  if (isAppError(err)) {
    return fail(res, err.status, err.code, err.message, err.details);
  }

  logger.error({ err }, "Unhandled error");
  return fail(res, 500, "INTERNAL_ERROR", "Internal server error");
}
