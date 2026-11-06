import { useEffect, useState } from "react";
import { DataTable } from "../../components/common/dataTable";
import { formatDateTime, formatInr, healthcareApi } from "../../api/healthcare";
import { MetricCard, PageShell, buttonSecondaryClass } from "../../components/hospital/PageShell";

export default function DailyCollectionPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  const load = async () => {
    const res = await healthcareApi.dailyCollection();
    if (!res.ok) {
      setError(res.message || "Failed to load");
      return;
    }
    setData(res.data);
  };

  useEffect(() => {
    load();
  }, []);

  const payments = data?.payments || [];
  const advances = data?.advances || [];
  const rows = [
    ...advances.map((a: any) => ({ ...a, type: "ADVANCE" })),
    ...payments.map((p: any) => ({ ...p, type: "PAYMENT" })),
  ];

  return (
    <PageShell
      title="Daily Collection"
      subtitle="Cashier collection for today"
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
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Payments" value={formatInr(data?.totals?.payments)} />
        <MetricCard label="Advances" value={formatInr(data?.totals?.advances)} />
        <MetricCard label="Refunds" value={formatInr(data?.totals?.refunds)} />
        <MetricCard label="Date" value={data?.date || "—"} />
      </div>
      <DataTable
        data={{
          columns: ["Type", "Receipt", "Patient", "Mode", "Amount", "When"],
          rows: rows.map((r) => [
            r.type,
            r.number,
            r.patientName,
            r.method,
            formatInr(r.amount),
            formatDateTime(r.receivedAt),
          ]),
        }}
      />
    </PageShell>
  );
}
