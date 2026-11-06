import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { fail } from "../lib/response";

export type AuthUser = {
  id: string;
  hospitalId: string;
  username: string;
  name: string;
  email: string;
  permissions: string[];
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      hospitalId: user.hospitalId,
      username: user.username,
      name: user.name,
      email: user.email,
      permissions: user.permissions,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] },
  );
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return fail(res, 401, "UNAUTHORIZED", "Authentication required");
  }
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as jwt.JwtPayload;
    req.user = {
      id: String(payload.sub),
      hospitalId: String(payload.hospitalId),
      username: String(payload.username),
      name: String(payload.name),
      email: String(payload.email),
      permissions: (payload.permissions as string[]) || [],
    };
    return next();
  } catch {
    return fail(res, 401, "TOKEN_EXPIRED", "Invalid or expired token");
  }
}

export function requirePermission(...codes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return fail(res, 401, "UNAUTHORIZED", "Authentication required");
    }
    if (codes.length === 0) return next();
    const ok = codes.some((c) => req.user!.permissions.includes(c) || req.user!.permissions.includes("*"));
    if (!ok) {
      return fail(res, 403, "FORBIDDEN", "Insufficient permissions");
    }
    return next();
  };
}
