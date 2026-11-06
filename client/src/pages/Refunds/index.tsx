import { FormEvent, useEffect, useState } from "react";
import { DataTable } from "../../components/common/dataTable";
import { formatDateTime, formatInr, healthcareApi } from "../../api/healthcare";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  Field,
  inputClass,
  PageShell,
  StatusPill,
} from "../../components/hospital/PageShell";

export default function RefundsPage() {
  const [refunds, setRefunds] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [form, setForm] = useState({ advanceId: "", amount: "", reason: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const [r, a] = await Promise.all([
      healthcareApi.listRefunds(),
      healthcareApi.listAdvances(),
    ]);
    if (r.ok) setRefunds(r.data || []);
    if (a.ok) setAdvances((a.data || []).filter((x: any) => Number(x.balance) > 0));
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    const advance = advances.find((a) => a.id === form.advanceId);
    if (!advance) return;
    const res = await healthcareApi.createRefund({
      patientId: advance.patientId,
      advanceId: advance.id,
      amount: form.amount,
      reason: form.reason,
    });
    if (!res.ok) {
      setError(res.message || "Refund request failed");
      return;
    }
    setMessage(`Refund ${res.data.number} requested`);
    setForm({ advanceId: "", amount: "", reason: "" });
    await load();
  };

  const approve = async (id: string) => {
    if (!confirm("Approve and pay this refund?")) return;
    const res = await healthcareApi.approveRefund(id);
    if (!res.ok) {
      setError(res.message || "Approval failed");
      return;
    }
    setMessage(`Refund ${res.data.number} paid`);
    await load();
  };

  return (
    <PageShell title="Refund Management" subtitle="Request and approve refunds against unallocated advances">
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
      <div className="grid gap-3 lg:grid-cols-[340px_1fr]">
        <form onSubmit={create} className="space-y-2 border border-slate-300 bg-white p-3">
          <Field label="Advance">
            <select
              required
              className={inputClass}
              value={form.advanceId}
              onChange={(e) => setForm({ ...form, advanceId: e.target.value })}
            >
              <option value="">Select</option>
              {advances.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.number} — bal {formatInr(a.balance)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount">
            <input
              required
              className={inputClass}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </Field>
          <Field label="Reason">
            <input
              required
              className={inputClass}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </Field>
          <button type="submit" className={buttonPrimaryClass}>
            Request refund
          </button>
        </form>

        <DataTable
          data={{
            columns: ["Refund No", "Patient", "Amount", "Status", "Reason", "Created", "Action"],
            rows: refunds.map((r) => [
              r.number,
              r.patientName,
              formatInr(r.amount),
              <StatusPill
                key={r.id}
                value={r.status}
                tone={r.status === "PAID" ? "emerald" : "amber"}
              />,
              r.reason,
              formatDateTime(r.createdAt),
              r.status === "REQUESTED" ? (
                <button
                  key={`a-${r.id}`}
                  type="button"
                  className={buttonSecondaryClass}
                  onClick={() => approve(r.id)}
                >
                  Approve
                </button>
              ) : (
                "—"
              ),
            ]),
          }}
        />
      </div>
    </PageShell>
  );
}
