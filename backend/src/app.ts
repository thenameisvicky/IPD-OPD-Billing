import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { timed } from "./lib/requestContext";
import { errorHandler } from "./middleware/errorHandler";
import { latencyMiddleware } from "./middleware/latency";
import { authRouter } from "./modules/auth/routes";
import { hospitalRouter } from "./modules/hospital/routes";
import { patientsRouter } from "./modules/patients/routes";
import { admissionsRouter } from "./modules/admissions/routes";
import { bedsRouter } from "./modules/beds/routes";
import { catalogueRouter } from "./modules/catalogue/routes";
import { chargesRouter } from "./modules/billing/charges";
import { invoicesRouter } from "./modules/billing/invoices";
import { paymentsRouter } from "./modules/payments/routes";
import { refundsRouter } from "./modules/refunds/routes";
import { reportsRouter } from "./modules/reports/routes";
import { openApiDocument } from "./openapi";

export function createApp() {
  const app = express();

  // APIs compute fresh bodies; ETag still runs the handler and wastes Neon round-trips.
  app.set("etag", false);

  app.use(latencyMiddleware);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "healthcare-server" });
  });

  /** Bare DB round-trip probe — use this to isolate network vs query cost. */
  app.get("/health/db", async (_req, res, next) => {
    try {
      const started = performance.now();
      await timed("db.ping", async () => {
        await prisma.$queryRaw`SELECT 1 AS ok`;
      });
      const roundTripMs = Math.round(performance.now() - started);
      res.json({
        status: "ok",
        roundTripMs,
        note: "Single SELECT 1 against DATABASE_URL — primarily network + pool acquire.",
      });
    } catch (err) {
      next(err);
    }
  });

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get("/api/openapi.json", (_req, res) => res.json(openApiDocument));

  // Auth paths used by the client login flow
  app.use("/api/main", authRouter);

  // Healthcare API v1
  const v1 = express.Router();
  v1.use("/auth", authRouter);
  v1.use("/hospital", hospitalRouter);
  v1.use("/patients", patientsRouter);
  v1.use("/admissions", admissionsRouter);
  v1.use("/beds", bedsRouter);
  v1.use("/catalogue", catalogueRouter);
  v1.use("/charges", chargesRouter);
  v1.use("/invoices", invoicesRouter);
  v1.use("/payments", paymentsRouter);
  v1.use("/refunds", refundsRouter);
  v1.use("/reports", reportsRouter);
  app.use("/api/v1", v1);

  app.use(errorHandler);
  return app;
}
