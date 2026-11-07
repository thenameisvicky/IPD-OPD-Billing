import { useEffect, useState } from "react";
import { DataTable } from "../../components/common/dataTable";
import { formatDateTime, formatInr, healthcareApi } from "../../api/healthcare";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  Field,
  Fill,
  inputClass,
  PageShell,
  ScrollArea,
  StatusPill,
} from "../../components/hospital/PageShell";
import InvoicePrintPage from "../InvoicePrint";

export default function DischargeBillPage() {
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [admissionId, setAdmissionId] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [printInvoiceId, setPrintInvoiceId] = useState<string | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleMethod, setSettleMethod] = useState("CREDIT_CARD");
  const [invoice, setInvoice] = useState<any>(null);

  const loadAdmissions = async () => {
    const res = await healthcareApi.listAdmissions({ pageSize: 100 });
    if (res.ok) {
      const rows = res.data || [];
      setAdmissions(rows);
      if (!admissionId && rows[0]) setAdmissionId(rows[0].id);
    }
  };

  useEffect(() => {
    loadAdmissions();
  }, []);

  const loadPreview = async (id = admissionId) => {
    if (!id) return;
    setBusy(true);
    setError("");
    const res = await healthcareApi.previewBill(id);
    setBusy(false);
    if (!res.ok) {
      setError(res.message || "Preview failed");
      setPreview(null);
      return;
    }
    setPreview(res.data);
    setSettleAmount(res.data.totals?.estimatedOutstanding || "");
    if (res.data.existingFinalInvoiceId) {
      const inv = await healthcareApi.getInvoice(res.data.existingFinalInvoiceId);
      if (inv.ok) {
        setInvoice(inv.data);
        setSettleAmount(inv.data.outstanding);
      }
    } else {
      setInvoice(null);
    }
  };

  useEffect(() => {
    if (admissionId) loadPreview(admissionId);
  }, [admissionId]);

  const finalize = async () => {
    if (!admissionId) return;
    if (!confirm("Finalize this inpatient bill? The invoice snapshot will become immutable.")) return;
    setBusy(true);
    const res = await healthcareApi.finalizeBill({
      admissionId,
      idempotencyKey: `ui-finalize-${admissionId}-${Date.now()}`,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message || "Finalize failed");
      return;
    }
    setMessage(`Finalized invoice ${res.data.number}`);
    setInvoice(res.data);
    setSettleAmount(res.data.outstanding);
    await loadPreview(admissionId);
    await loadAdmissions();
  };

  const collectSettlement = async () => {
    if (!invoice || !preview) return;
    const amount = settleAmount || invoice.outstanding;
    if (!confirm(`Record settlement of ${formatInr(amount)}?`)) return;
    setBusy(true);
    const res = await healthcareApi.collectPayment({
      patientId: preview.patient.id,
      admissionId,
      invoiceId: invoice.id,
      amount,
      method: settleMethod,
      kind: "SETTLEMENT",
      allocateToInvoice: true,
      idempotencyKey: `ui-settle-${invoice.id}-${Date.now()}`,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message || "Payment failed");
      return;
    }
    setMessage(`Payment ${res.data.number} recorded`);
    const inv = await healthcareApi.getInvoice(invoice.id);
    if (inv.ok) {
      setInvoice(inv.data);
      setSettleAmount(inv.data.outstanding);
    }
    await loadAdmissions();
  };

  if (printInvoiceId) {
    return (
      <InvoicePrintPage invoiceId={printInvoiceId} onClose={() => setPrintInvoiceId(null)} />
    );
  }

  return (
    <PageShell
      actions={
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonSecondaryClass} onClick={() => loadPreview()} disabled={busy}>
            Preview Bill
          </button>
          <button
            type="button"
            className={buttonPrimaryClass}
            onClick={finalize}
            disabled={busy || !!preview?.existingFinalInvoiceId}
          >
            Finalize Bill
          </button>
          {invoice && (
            <button
              type="button"
              className={buttonSecondaryClass}
              onClick={() => setPrintInvoiceId(invoice.id)}
            >
              Print / PDF
            </button>
          )}
        </div>
      }
    >
      {message && (
        <div className="shrink-0 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[15px] font-bold text-emerald-800">
          {message}
        </div>
      )}
      {error && (
        <div className="shrink-0 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-[15px] font-bold text-rose-700">
          {error}
        </div>
      )}

      <div className="grid shrink-0 grid-cols-1 gap-2 lg:grid-cols-4">
        <Field label="Admission">
          <select
            className={inputClass}
            value={admissionId}
            onChange={(e) => setAdmissionId(e.target.value)}
          >
            {admissions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.ipNumber} — {a.patientName} ({a.status})
              </option>
            ))}
          </select>
        </Field>
        {preview && (
          <>
            <div className="border border-slate-300 bg-white p-3">
              <div className="text-[12px] font-bold uppercase text-slate-500">Gross</div>
              <div className="text-[18px] font-bold">{formatInr(preview.totals.grandTotal)}</div>
            </div>
            <div className="border border-slate-300 bg-white p-3">
              <div className="text-[12px] font-bold uppercase text-slate-500">Advance bal.</div>
              <div className="text-[18px] font-bold">{formatInr(preview.totals.advanceBalance)}</div>
            </div>
            <div className="border border-slate-300 bg-white p-3">
              <div className="text-[12px] font-bold uppercase text-slate-500">
                {invoice ? "Outstanding" : "Est. outstanding"}
              </div>
              <div className="text-[18px] font-bold">
                {formatInr(invoice ? invoice.outstanding : preview.totals.estimatedOutstanding)}
              </div>
            </div>
          </>
        )}
      </div>

      {preview ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <div className="shrink-0 border border-slate-300 bg-white p-3 text-[14px]">
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <strong>{preview.patient.name}</strong> ({preview.patient.uhid})
              </div>
              <div>
                IP {preview.admission.ipNumber} · LOS {preview.admission.lengthOfStayDays} days
              </div>
              <div>Admitted: {formatDateTime(preview.admission.admittedAt)}</div>
              <div>Discharge: {formatDateTime(preview.admission.dischargedAt)}</div>
              <div>Consultant: {preview.admission.practitioner || "—"}</div>
              <div>Diagnosis: {preview.admission.primaryDiagnosis || "—"}</div>
            </div>
            {invoice && (
              <div className="mt-2 flex items-center gap-2">
                <StatusPill value={invoice.status} tone={invoice.status === "PAID" ? "emerald" : "amber"} />
                <span className="font-bold">Invoice {invoice.number}</span>
              </div>
            )}
          </div>

          <Fill>
            <DataTable
              data={{
                columns: ["#", "Description", "Rate", "Qty/Days", "Amount"],
                rows: (preview.lines || []).map((line: any, idx: number) => [
                  idx + 1,
                  line.description,
                  formatInr(line.rate),
                  line.unitLabel,
                  formatInr(line.lineTotal),
                ]),
              }}
            />
          </Fill>

          {invoice && Number(invoice.outstanding) > 0 && (
            <div className="flex shrink-0 flex-wrap items-end gap-3 border border-slate-300 bg-white p-3">
              <Field label="Settlement amount">
                <input
                  className={inputClass}
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                />
              </Field>
              <Field label="Mode">
                <select
                  className={inputClass}
                  value={settleMethod}
                  onChange={(e) => setSettleMethod(e.target.value)}
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CREDIT_CARD">Credit card</option>
                  <option value="DEBIT_CARD">Debit card</option>
                  <option value="NET_BANKING">Net banking</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                </select>
              </Field>
              <button type="button" className={buttonPrimaryClass} onClick={collectSettlement} disabled={busy}>
                Record settlement
              </button>
            </div>
          )}
        </div>
      ) : (
        <ScrollArea className="flex items-center justify-center text-[15px] font-semibold text-slate-500">
          Select an admission and click Preview Bill.
        </ScrollArea>
      )}
    </PageShell>
  );
}
