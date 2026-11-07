import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { DataTable } from "../../components/common/dataTable";
import { formatDateTime, formatInr, healthcareApi } from "../../api/healthcare";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  Fill,
  PageShell,
  ScrollArea,
  StatusPill,
} from "../../components/hospital/PageShell";

function sexLabel(sex?: string) {
  if (!sex) return "";
  return sex.charAt(0) + sex.slice(1).toLowerCase();
}

function InvoicePreview({
  data,
  onBack,
}: {
  data: any;
  onBack: () => void;
}) {
  const hospital = data?.hospital;
  const patient = data?.patient;
  const admission = data?.admission;
  const lines = data?.lines || [];
  const totals = data?.totals;
  const payments = data?.payments || [];

  const roomBed = useMemo(() => {
    if (!admission) return "";
    const cat = admission.roomCategory || "";
    const room = admission.room
      ? ` (${admission.room}${admission.bed ? ` / ${admission.bed}` : ""})`
      : "";
    return `${cat}${room}`;
  }, [admission]);

  return (
    <PageShell
      actions={
        <div className="print:hidden flex flex-wrap gap-2">
          <button type="button" className={buttonSecondaryClass} onClick={onBack}>
            Back to list
          </button>
          <button type="button" className={buttonPrimaryClass} onClick={() => window.print()}>
            Print / Save PDF
          </button>
        </div>
      }
    >
      <ScrollArea>
      <div className="invoice-print-root mx-auto max-w-[210mm] bg-white p-6 text-[12px] text-slate-900 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-slate-800 pb-3 text-center">
          <h1 className="text-[20px] font-bold tracking-wide">{hospital?.name}</h1>
          <p className="mt-1">
            {[hospital?.addressLine1, hospital?.addressLine2, hospital?.city, hospital?.state, hospital?.pincode]
              .filter(Boolean)
              .join(", ")}
          </p>
          <p className="mt-1">
            {[
              hospital?.identifierLabel && hospital?.identifierValue
                ? `${hospital.identifierLabel}: ${hospital.identifierValue}`
                : null,
              hospital?.registrationNumber ? `Reg. No: ${hospital.registrationNumber}` : null,
              hospital?.gstin ? `GSTIN: ${hospital.gstin}` : null,
            ]
              .filter(Boolean)
              .join(" | ")}
          </p>
          <h2 className="mt-3 text-[16px] font-bold uppercase tracking-[0.08em]">
            Final Inpatient Bill / Tax Invoice
          </h2>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1">
          <div>
            <strong>Bill No:</strong> {data.number}
          </div>
          <div>
            <strong>Bill Date:</strong> {formatDateTime(data.billDate)}
          </div>
          <div>
            <strong>Admission No (IP No):</strong> {admission?.ipNumber}
          </div>
          <div>
            <strong>UHID / MR No:</strong> {patient?.uhid}
          </div>
          <div>
            <strong>Admission Date & Time:</strong> {formatDateTime(admission?.admittedAt)}
          </div>
          <div>
            <strong>Discharge Date & Time:</strong> {formatDateTime(admission?.dischargedAt)}
          </div>
          <div>
            <strong>Room / Bed Category:</strong> {roomBed}
          </div>
          <div>
            <strong>LOS:</strong> {admission?.lengthOfStayDays} Days
          </div>
          <div className="col-span-2">
            <strong>Treating Consultant:</strong> {admission?.practitioner || "—"}
          </div>
          <div>
            <strong>Department:</strong> {admission?.department || "—"}
          </div>
          <div>
            <strong>ICD-10:</strong> {admission?.diagnosisCode || "—"}
          </div>
          <div className="col-span-2">
            <strong>Primary Diagnosis:</strong> {admission?.primaryDiagnosis || "—"}
          </div>
          <div className="col-span-2">
            <strong>Procedure Performed:</strong> {admission?.procedureInfo || "—"}
          </div>
        </section>

        <section className="mt-4 border border-slate-300 p-3">
          <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide">Patient Details</h3>
          <div className="grid grid-cols-2 gap-1">
            <div>
              <strong>Patient Name:</strong> {patient?.name}
            </div>
            <div>
              <strong>Age / Gender:</strong>{" "}
              {patient?.ageYears != null ? `${patient.ageYears} Yrs` : "—"} / {sexLabel(patient?.sex)}
            </div>
            <div>
              <strong>Policyholder / Insured Name:</strong>{" "}
              {admission?.policyholderName || patient?.name}
            </div>
            <div>
              <strong>TPA / Insurer:</strong> {admission?.insurerName || "—"}
            </div>
          </div>
        </section>

        <section className="mt-4">
          <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide">Itemized Bill Breakup</h3>
          <table className="invoice-table w-full border-collapse">
            <thead>
              <tr>
                <th className="w-10">S.No</th>
                <th>Description / Service Head</th>
                <th className="w-24 text-right">Rate (₹)</th>
                <th className="w-28 text-right">Qty / Days</th>
                <th className="w-32 text-right">Total Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line: any, idx: number) => (
                <tr key={idx}>
                  <td className="text-center">{line.sno || idx + 1}</td>
                  <td>{line.description}</td>
                  <td className="text-right">
                    {line.unitLabel === "As billed"
                      ? "Various"
                      : Number(line.rate).toLocaleString("en-IN")}
                  </td>
                  <td className="text-right">{line.unitLabel || line.quantity}</td>
                  <td className="text-right">
                    {Number(line.lineTotal).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-3 ml-auto w-full max-w-sm space-y-1 text-right">
          <div className="flex justify-between gap-6">
            <span>Gross Total Amount:</span>
            <strong>{formatInr(totals?.subtotal)}</strong>
          </div>
          <div className="flex justify-between gap-6">
            <span>Discounts / Concessions:</span>
            <strong>{formatInr(totals?.discountTotal)}</strong>
          </div>
          <div className="flex justify-between gap-6 border-t border-slate-800 pt-1 text-[13px]">
            <span>Net Bill Amount:</span>
            <strong>{formatInr(totals?.grandTotal)}</strong>
          </div>
        </section>

        <section className="mt-4">
          <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide">
            Payment and Settlement Details
          </h3>
          <table className="invoice-table w-full border-collapse">
            <thead>
              <tr>
                <th>Receipt No.</th>
                <th>Date</th>
                <th>Mode of Payment</th>
                <th className="text-right">Paid Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p: any, idx: number) => (
                <tr key={idx}>
                  <td>{p.receiptNo}</td>
                  <td>{formatDateTime(p.date)}</td>
                  <td>{p.mode}</td>
                  <td className="text-right">
                    {Number(p.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 ml-auto w-full max-w-md space-y-1">
            <div className="flex justify-between">
              <span>Total Amount Paid:</span>
              <strong>{formatInr(totals?.paidTotal)}</strong>
            </div>
            <div>
              <strong>In Words:</strong> {totals?.amountInWords}
            </div>
            <div className="flex justify-between">
              <span>Outstanding Balance Due:</span>
              <strong>
                {formatInr(totals?.outstanding)}
                {Number(totals?.outstanding || 0) === 0 ? " (NIL)" : ""}
              </strong>
            </div>
          </div>
        </section>

        {(data.notes || hospital?.defaultNotes) && (
          <section className="mt-4">
            <h3 className="text-[13px] font-bold uppercase">Notes</h3>
            <p className="mt-1 whitespace-pre-wrap">{data.notes || hospital?.defaultNotes}</p>
          </section>
        )}

        <section className="mt-4">
          <h3 className="text-[13px] font-bold uppercase">Declaration</h3>
          <p className="mt-1">
            {hospital?.declarationText ||
              "Certified that the services and treatments billed above were administered to the patient during the inpatient stay."}
          </p>
        </section>

        <section className="mt-10 grid grid-cols-2 gap-8">
          <div>
            <p>Prepared By:</p>
            <p className="mt-8 font-semibold">{data.preparedBy || "Billing Clerk"}</p>
          </div>
          <div className="text-right">
            <p>{hospital?.authorizedSignatory || "Authorized Signatory & Hospital Seal"}</p>
            <div className="mt-8 border-t border-slate-400 pt-1 text-[11px]">Signature / Seal</div>
          </div>
        </section>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .invoice-table th, .invoice-table td {
              border: 1px solid #334155;
              padding: 6px 8px;
              vertical-align: top;
            }
            .invoice-table thead { display: table-header-group; }
            .invoice-table tr { page-break-inside: avoid; }
            @media print {
              @page { size: A4 portrait; margin: 12mm; }
              body * { visibility: hidden !important; }
              .invoice-print-root, .invoice-print-root * { visibility: visible !important; }
              .invoice-print-root {
                position: absolute; left: 0; top: 0; width: 100%;
                box-shadow: none !important; padding: 0 !important;
              }
              .print\\:hidden { display: none !important; }
            }
          `,
        }}
      />
      </ScrollArea>
    </PageShell>
  );
}

export default function InvoicePrintPage({
  invoiceId: invoiceIdProp,
  onClose,
}: {
  invoiceId?: string;
  onClose?: () => void;
} = {}) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadList = async () => {
    setLoading(true);
    const res = await healthcareApi.listInvoices();
    setLoading(false);
    if (!res.ok) {
      setError(res.message || "Failed to load invoices");
      return;
    }
    setInvoices(res.data?.items || []);
  };

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    if (invoiceIdProp) {
      openPrint(invoiceIdProp);
    }
  }, [invoiceIdProp]);

  const openPrint = async (id: string) => {
    setLoading(true);
    setError("");
    const res = await healthcareApi.getPrintableInvoice(id);
    setLoading(false);
    if (!res.ok) {
      setError(res.message || "Failed to load invoice");
      return;
    }
    setPreview(res.data);
  };

  if (preview) {
    return (
      <InvoicePreview
        data={preview}
        onBack={() => {
          setPreview(null);
          onClose?.();
        }}
      />
    );
  }

  return (
    <PageShell
      actions={
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonSecondaryClass} onClick={loadList}>
            Refresh
          </button>
          <button
            type="button"
            className={buttonPrimaryClass}
            disabled={!selected}
            title="Print selected invoice"
            onClick={() => selected && openPrint(selected.id)}
          >
            <span className="inline-flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9V2h12v7" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <path d="M6 14h12v8H6z" />
              </svg>
              Print
            </span>
          </button>
        </div>
      }
    >
      {error && (
        <div className="shrink-0 border border-rose-200 bg-rose-50 px-3 py-2 text-[15px] font-semibold text-rose-700">
          {error}
        </div>
      )}
      {selected && (
        <div className="shrink-0 border border-emerald-200 bg-emerald-50 px-3 py-2 text-[14px] font-semibold text-emerald-800">
          Selected: <strong>{selected.number}</strong> — {selected.patientName}. Click Print to preview.
        </div>
      )}
      <Fill>
        {loading && !invoices.length ? (
          <div className="text-[15px] font-semibold text-slate-600">Loading invoices…</div>
        ) : (
          <DataTable
            data={{
              columns: [
                "Invoice No",
                "Patient",
                "UHID",
                "IP No",
                "Bill date",
                "Amount",
                "Outstanding",
                "Status",
              ],
              rows: invoices.map((inv) => [
                inv.number,
                inv.patientName,
                inv.uhid,
                inv.ipNumber || "—",
                inv.billDate ? dayjs(inv.billDate).format("DD-MMM-YYYY") : "—",
                formatInr(inv.grandTotal),
                formatInr(inv.outstanding),
                <StatusPill
                  key={inv.id}
                  value={inv.status}
                  tone={inv.status === "PAID" ? "emerald" : "amber"}
                />,
              ]),
              rawItems: invoices,
            }}
            selectedId={selected?.id || null}
            showActions={false}
            onOpen={(item) => setSelected(item)}
          />
        )}
      </Fill>
    </PageShell>
  );
}
