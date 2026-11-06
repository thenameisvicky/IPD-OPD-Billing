import { FormEvent, useEffect, useState } from "react";
import { DataTable } from "../../components/common/dataTable";
import { formatDateTime, formatInr, healthcareApi } from "../../api/healthcare";
import {
  buttonPrimaryClass,
  Field,
  inputClass,
  PageShell,
} from "../../components/hospital/PageShell";

export default function AdvancePaymentPage() {
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [admissionId, setAdmissionId] = useState("");
  const [amount, setAmount] = useState("30000");
  const [method, setMethod] = useState("UPI");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const [adm, adv] = await Promise.all([
      healthcareApi.listAdmissions({ pageSize: 100 }),
      healthcareApi.listAdvances(),
    ]);
    if (adm.ok) {
      setAdmissions(adm.data || []);
      if (!admissionId && adm.data?.[0]) setAdmissionId(adm.data[0].id);
    }
    if (adv.ok) setAdvances(adv.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const collect = async (event: FormEvent) => {
    event.preventDefault();
    const admission = admissions.find((a) => a.id === admissionId);
    if (!admission) return;
    const res = await healthcareApi.collectAdvance({
      patientId: admission.patientId,
      admissionId,
      amount,
      method,
      idempotencyKey: `ui-adv-${admissionId}-${Date.now()}`,
    });
    if (!res.ok) {
      setError(res.message || "Advance collection failed");
      return;
    }
    setMessage(`Advance receipt ${res.data.number} for ${formatInr(res.data.amount)}`);
    setError("");
    await load();
  };

  return (
    <PageShell title="Advance Collection" subtitle="Collect and track unallocated patient advances">
      {message && (
        <div className="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[15px] font-bold text-emerald-800">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-[15px] font-bold text-rose-700">
          {error}
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-[360px_1fr]">
        <form onSubmit={collect} className="space-y-3 border border-slate-300 bg-white p-3">
          <Field label="Admission">
            <select
              required
              className={inputClass}
              value={admissionId}
              onChange={(e) => setAdmissionId(e.target.value)}
            >
              {admissions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.ipNumber} — {a.patientName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount (₹)">
            <input
              required
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Mode">
            <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CREDIT_CARD">Credit card</option>
              <option value="DEBIT_CARD">Debit card</option>
              <option value="NET_BANKING">Net banking</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
            </select>
          </Field>
          <button type="submit" className={buttonPrimaryClass}>
            Collect advance
          </button>
        </form>
        <DataTable
          data={{
            columns: ["Receipt", "Patient", "Amount", "Balance", "Mode", "Received"],
            rows: advances.map((a) => [
              a.number,
              a.patientName,
              formatInr(a.amount),
              formatInr(a.balance),
              a.method,
              formatDateTime(a.receivedAt),
            ]),
          }}
        />
      </div>
    </PageShell>
  );
}
