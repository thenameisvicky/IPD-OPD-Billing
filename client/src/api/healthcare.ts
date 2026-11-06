import axios from "../utils/axios";

export type ApiResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  message?: string;
  error?: { code?: string; message?: string };
};

async function unwrap<T>(promise: ReturnType<typeof axios.get>): Promise<ApiResult<T>> {
  const res = await promise;
  const body = res.data as any;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      data: null,
      message: body?.message || body?.error?.message || "Request failed",
      error: body?.error,
    };
  }
  return {
    ok: true,
    status: res.status,
    data: (body?.data ?? body) as T,
    message: body?.message,
  };
}

export const healthcareApi = {
  dashboard: () => unwrap<any>(axios.get("/api/v1/reports/dashboard")),
  searchPatients: (q: string) =>
    unwrap<any[]>(axios.get("/api/v1/patients", { params: { q, pageSize: 50 } })),
  createPatient: (payload: Record<string, unknown>) =>
    unwrap<any>(axios.post("/api/v1/patients", payload)),
  getPatient: (id: string) => unwrap<any>(axios.get(`/api/v1/patients/${id}`)),

  listAdmissions: (params?: Record<string, string | number>) =>
    unwrap<any[]>(axios.get("/api/v1/admissions", { params })),
  getAdmission: (id: string) => unwrap<any>(axios.get(`/api/v1/admissions/${id}`)),
  createAdmission: (payload: Record<string, unknown>) =>
    unwrap<any>(axios.post("/api/v1/admissions", payload)),
  dischargeAdmission: (id: string, dischargedAt?: string) =>
    unwrap<any>(axios.post(`/api/v1/admissions/${id}/discharge`, { dischargedAt })),

  listRooms: () => unwrap<any[]>(axios.get("/api/v1/beds/rooms")),
  listAvailableBeds: () => unwrap<any[]>(axios.get("/api/v1/beds/availability")),
  assignBed: (payload: { admissionId: string; bedId: string }) =>
    unwrap<any>(axios.post("/api/v1/beds/assign", payload)),
  transferBed: (payload: { admissionId: string; bedId: string }) =>
    unwrap<any>(axios.post("/api/v1/beds/transfer", payload)),

  listDepartments: () => unwrap<any[]>(axios.get("/api/v1/hospital/departments")),
  listPractitioners: () => unwrap<any[]>(axios.get("/api/v1/hospital/practitioners")),
  getHospitalSettings: () => unwrap<any>(axios.get("/api/v1/hospital/settings")),
  updateHospitalSettings: (payload: Record<string, unknown>) =>
    unwrap<any>(axios.put("/api/v1/hospital/settings", payload)),

  listServices: (category?: string) =>
    unwrap<any[]>(axios.get("/api/v1/catalogue/services", { params: { category } })),
  createService: (payload: Record<string, unknown>) =>
    unwrap<any>(axios.post("/api/v1/catalogue/services", payload)),
  createTariff: (serviceId: string, payload: Record<string, unknown>) =>
    unwrap<any>(axios.post(`/api/v1/catalogue/services/${serviceId}/tariffs`, payload)),
  listTariffs: (serviceId: string) =>
    unwrap<any[]>(axios.get(`/api/v1/catalogue/services/${serviceId}/tariffs`)),
  listTaxProfiles: () => unwrap<any[]>(axios.get("/api/v1/catalogue/tax-profiles")),

  listCharges: (admissionId: string) =>
    unwrap<any[]>(axios.get(`/api/v1/charges/admissions/${admissionId}/charges`)),
  addCharge: (payload: Record<string, unknown>) =>
    unwrap<any>(axios.post("/api/v1/charges", payload)),
  updateCharge: (id: string, payload: Record<string, unknown>) =>
    unwrap<any>(axios.patch(`/api/v1/charges/${id}`, payload)),
  removeCharge: (id: string) => unwrap<any>(axios.delete(`/api/v1/charges/${id}`)),

  previewBill: (admissionId: string) =>
    unwrap<any>(axios.get(`/api/v1/invoices/preview/${admissionId}`)),
  finalizeBill: (payload: Record<string, unknown>) =>
    unwrap<any>(axios.post("/api/v1/invoices/finalize", payload)),
  getInvoice: (id: string) => unwrap<any>(axios.get(`/api/v1/invoices/${id}`)),
  getPrintableInvoice: (id: string) =>
    unwrap<any>(axios.get(`/api/v1/invoices/${id}/print`)),
  cancelInvoice: (id: string, reason: string) =>
    unwrap<any>(axios.post(`/api/v1/invoices/${id}/cancel`, { reason })),

  collectAdvance: (payload: Record<string, unknown>) =>
    unwrap<any>(axios.post("/api/v1/payments/advances", payload)),
  collectPayment: (payload: Record<string, unknown>) =>
    unwrap<any>(axios.post("/api/v1/payments", payload)),
  paymentHistory: (params?: Record<string, string>) =>
    unwrap<any>(axios.get("/api/v1/payments/history", { params })),
  listAdvances: (admissionId?: string) =>
    unwrap<any[]>(
      axios.get("/api/v1/payments/advances", {
        params: admissionId ? { admissionId } : undefined,
      }),
    ),

  listRefunds: () => unwrap<any[]>(axios.get("/api/v1/refunds")),
  createRefund: (payload: Record<string, unknown>) =>
    unwrap<any>(axios.post("/api/v1/refunds", payload)),
  approveRefund: (id: string) => unwrap<any>(axios.post(`/api/v1/refunds/${id}/approve`)),

  dailyCollection: (date?: string) =>
    unwrap<any>(axios.get("/api/v1/reports/daily-collection", { params: { date } })),
};

export function formatInr(value: string | number | null | undefined) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(num);
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
