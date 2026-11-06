import { useEffect, useMemo, useState } from "react";
import { formatDateTime, formatInr, healthcareApi } from "../../api/healthcare";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  PageShell,
} from "../../components/hospital/PageShell";

function sexLabel(sex?: string) {
  if (!sex) return "";
  return sex.charAt(0) + sex.slice(1).toLowerCase();
}

export default function InvoicePrintPage({
  invoiceId: invoiceIdProp,
  onClose,
}: {
  invoiceId?: string;
  onClose?: () => void;
} = {}) {
  const [invoiceId, setInvoiceId] = useState(invoiceIdProp || "");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError("");
    const res = await healthcareApi.getPrintableInvoice(id);
    setLoading(false);
    if (!res.ok) {
      setError(res.message || "Failed to load invoice");
      setData(null);
      return;
    }
    setData(res.data);
  };

  useEffect(() => {
    if (invoiceIdProp) {
      setInvoiceId(invoiceIdProp);
      load(invoiceIdProp);
    }
  }, [invoiceIdProp]);

  const hospital = data?.hospital;
  const patient = data?.patient;
  const admission = data?.admission;
  const lines = data?.lines || [];
  const totals = data?.totals;
  const payments = data?.payments || [];

  const roomBed = useMemo(() => {
    if (!admission) return "";
    const cat = admission.roomCategory || "";
    const room = admission.room ? ` (${admission.room}${admission.bed ? ` / ${admission.bed}` : ""})` : "";
    return `${cat}${room}`;
  }, [admission]);

  const handlePrint = () => window.print();

  const handlePdf = () => {
    // Browser print-to-PDF produces searchable text (not a screenshot).
    window.print();
  };

  return (
    <PageShell
      title="Invoice Print"
      subtitle="A4 final inpatient bill / tax invoice"
      actions={
        <div className="print:hidden flex flex-wrap gap-2">
          {!invoiceIdProp && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                load(invoiceId);
              }}
            >
              <input
                className="rounded border border-slate-300 px-3 py-2 text-[15px]"
                placeholder="Invoice ID"
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
              />
              <button type="submit" className={buttonSecondaryClass}>
                Load
              </button>
            </form>
          )}
          <button type="button" className={buttonSecondaryClass} onClick={() => load(invoiceId)}>
            Reprint
          </button>
          <button type="button" className={buttonSecondaryClass} onClick={handlePdf}>
            Download PDF
          </button>
          <button type="button" className={buttonPrimaryClass} onClick={handlePrint}>
            Print Bill
          </button>
          {onClose && (
            <button type="button" className={buttonSecondaryClass} onClick={onClose}>
              Close
            </button>
          )}
        </div>
      }
    >
      {error && (
        <div className="print:hidden mb-3 border border-rose-200 bg-rose-50 px-3 py-2 text-[15px] font-semibold text-rose-700">
          {error}
        </div>
      )}
      {loading && <div className="print:hidden text-[15px] font-semibold text-slate-600">Loading…</div>}

      {data && (
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
            <p className="mt-1">
              {[hospital?.phone ? `Phone: ${hospital.phone}` : null, hospital?.email ? `Email: ${hospital.email}` : null]
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
                <strong>Age / Gender:</strong> {patient?.ageYears != null ? `${patient.ageYears} Yrs` : "—"} /{" "}
                {sexLabel(patient?.sex)}
              </div>
              <div>
                <strong>Policyholder / Insured Name:</strong> {admission?.policyholderName || patient?.name}
              </div>
              <div>
                <strong>TPA / Insurer:</strong> {admission?.insurerName || "—"}
              </div>
              <div>
                <strong>Insurance TPA ID / Card No:</strong> {admission?.insuranceCardNo || "—"}
              </div>
              <div>
                <strong>Policy No:</strong> {admission?.policyNo || "—"}
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
                      {line.unitLabel === "As billed" || Number(line.rate) === 0
                        ? "Various"
                        : Number(line.rate).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                    </td>
                    <td className="text-right">{line.unitLabel || line.quantity}</td>
                    <td className="text-right">
                      {Number(line.lineTotal).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
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
            {Number(totals?.taxTotal || 0) > 0 && (
              <div className="flex justify-between gap-6">
                <span>Tax:</span>
                <strong>{formatInr(totals?.taxTotal)}</strong>
              </div>
            )}
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
                      {Number(p.amount).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
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
                <strong>Total Amount Paid in Words:</strong> {totals?.amountInWords}
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

          {hospital?.invoiceFooter && (
            <p className="mt-6 text-center text-[10px] text-slate-600">{hospital.invoiceFooter}</p>
          )}

          <div className="invoice-page-footer print:fixed print:bottom-2 print:left-0 print:right-0 print:text-center print:text-[10px]">
            <span className="page-number" />
          </div>
        </div>
      )}

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
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                box-shadow: none !important;
                padding: 0 !important;
              }
              .print\\:hidden { display: none !important; }
            }
          `,
        }}
      />
    </PageShell>
  );
}
