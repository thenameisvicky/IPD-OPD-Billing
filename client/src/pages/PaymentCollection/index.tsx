import { useEffect, useState } from "react";
import { DataTable } from "../../components/common/dataTable";
import { formatDateTime, formatInr, healthcareApi } from "../../api/healthcare";
import { PageShell, buttonSecondaryClass } from "../../components/hospital/PageShell";

export default function PaymentCollectionPage() {
  const [history, setHistory] = useState<any>({ payments: [], advances: [] });
  const [error, setError] = useState("");

  const load = async () => {
    const res = await healthcareApi.paymentHistory();
    if (!res.ok) {
      setError(res.message || "Failed to load history");
      return;
    }
    setHistory(res.data || { payments: [], advances: [] });
  };

  useEffect(() => {
    load();
  }, []);

  const rows = [
    ...(history.advances || []).map((a: any) => ({
      ...a,
      kind: "ADVANCE",
      balanceOrUnalloc: a.balance,
    })),
    ...(history.payments || []).map((p: any) => ({
      ...p,
      kind: p.kind || "PAYMENT",
      balanceOrUnalloc: p.unallocatedAmount,
    })),
  ].sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

  return (
    <PageShell
      title="Payment / Receipt History"
      subtitle="Advances and settlement payments"
      actions={
        <button type="button" className={buttonSecondaryClass} onClick={load}>
          Refresh
        </button>
      }
    >
      {error && (
        <div className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-[15px] font-bold text-rose-700">
          {error}
        </div>
      )}
      <DataTable
        data={{
          columns: ["Receipt", "Type", "Patient", "Amount", "Unallocated/Balance", "Mode", "When"],
          rows: rows.map((r) => [
            r.number,
            r.kind,
            r.patientName,
            formatInr(r.amount),
            formatInr(r.balanceOrUnalloc),
            r.method,
            formatDateTime(r.receivedAt),
          ]),
        }}
      />
    </PageShell>
  );
}
