export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Healthcare Billing API",
    version: "1.0.0",
    description:
      "IPD billing modular monolith — patients, admissions, charges, invoices, payments, advances, refunds.",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/auth/login": {
      post: {
        security: [],
        summary: "Login",
        tags: ["Auth"],
      },
    },
    "/patients": {
      get: { summary: "Search patients", tags: ["Patients"] },
      post: { summary: "Register patient", tags: ["Patients"] },
    },
    "/admissions": {
      get: { summary: "List admissions", tags: ["Admissions"] },
      post: { summary: "Create admission", tags: ["Admissions"] },
    },
    "/invoices/preview/{admissionId}": {
      get: { summary: "Preview final bill", tags: ["Billing"] },
    },
    "/invoices/finalize": {
      post: { summary: "Finalize IPD invoice", tags: ["Billing"] },
    },
    "/invoices/{id}/print": {
      get: { summary: "Printable invoice snapshot", tags: ["Billing"] },
    },
    "/payments/advances": {
      post: { summary: "Collect advance", tags: ["Payments"] },
    },
    "/payments": {
      post: { summary: "Record payment / settlement", tags: ["Payments"] },
    },
  },
};
