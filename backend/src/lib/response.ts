import type { Response } from "express";

export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ status: "success", data });
}

export function created<T>(res: Response, data: T) {
  return ok(res, data, 201);
}

export function paginated<T>(
  res: Response,
  data: T[],
  meta: { page: number; pageSize: number; total: number },
) {
  return res.status(200).json({ status: "success", data, meta });
}

export function fail(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return res.status(status).json({
    status: "error",
    error: { code, message, details },
    message,
  });
}
