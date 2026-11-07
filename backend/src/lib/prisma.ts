import { PrismaClient } from "@prisma/client";
import { recordQuery } from "./requestContext";

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>;
};

function createClient() {
  const base = new PrismaClient({
    log: [
      { emit: "stdout", level: "error" },
      { emit: "stdout", level: "warn" },
    ],
  });

  // $extends runs in the caller's AsyncLocalStorage context (unlike $on('query')).
  return base.$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        const started = performance.now();
        try {
          return await query(args);
        } finally {
          const durationMs = Math.round(performance.now() - started);
          recordQuery({
            durationMs,
            query: `${model ?? "raw"}.${operation}`,
            target: model ?? "raw",
          });
        }
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
