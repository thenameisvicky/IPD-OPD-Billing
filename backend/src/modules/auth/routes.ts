import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { ok } from "../../lib/response";
import { requireAuth, signToken } from "../../middleware/auth";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const authRouter = Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: body.username }, { email: body.username }],
        status: "ACTIVE",
      },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw new AppError("INVALID_CREDENTIALS", "Invalid username or password", 401);
    }

    const permissions = Array.from(
      new Set(
        user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.code)),
      ),
    );

    const token = signToken({
      id: user.id,
      hospitalId: user.hospitalId,
      username: user.username,
      name: user.name,
      email: user.email,
      permissions,
    });

    // Compatibility with existing wAI-client login shape
    return res.json({
      status: "success",
      token,
      data: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        hospitalId: user.hospitalId,
        permissions,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { hospital: true },
    });
    if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
    return ok(res, {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      hospitalId: user.hospitalId,
      hospitalName: user.hospital.name,
      permissions: req.user!.permissions,
      tutorial_completed: true,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.patch("/me/tutorial", requireAuth, async (_req, res) => {
  return ok(res, { completed: true });
});
