import { useEffect, useState } from "react";
import { DataTable } from "../../components/common/dataTable";
import { formatInr, healthcareApi } from "../../api/healthcare";
import { MetricCard, PageShell, StatusPill } from "../../components/hospital/PageShell";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await healthcareApi.dashboard();
    setLoading(false);
    if (!res.ok) {
      setError(res.message || "Failed to load dashboard");
      return;
    }
    setError("");
    setData(res.data);
  };

  useEffect(() => {
    load();
  }, []);

  const m = data?.metrics || {};
  const admissions = data?.recentAdmissions || [];

  return (
    <PageShell
      title="IPD Billing Dashboard"
      subtitle="Active admissions, billing queue, advances and outstanding balances"
      actions={
        <button
          type="button"
          className="inline-flex h-10 items-center rounded border border-slate-300 bg-white px-4 text-[15px] font-bold"
          onClick={load}
        >
          Refresh
        </button>
      }
    >
      {error && (
        <div className="mb-3 border border-rose-200 bg-rose-50 px-3 py-2 text-[15px] font-semibold text-rose-700">
          {error}
        </div>
      )}
      {loading && !data ? (
        <div className="text-[15px] font-semibold text-slate-600">Loading dashboard…</div>
      ) : (
        <div className="flex h-full min-h-0 flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Active admissions" value={String(m.activeAdmissions ?? 0)} />
            <MetricCard label="Pending billing" value={String(m.dischargesPendingBilling ?? 0)} />
            <MetricCard label="Advance balance" value={formatInr(m.advanceBalance)} />
            <MetricCard label="Outstanding" value={formatInr(m.outstandingTotal)} />
          </div>

          <div className="min-h-0 flex-1">
            <DataTable
              data={{
                columns: [
                  "IP No",
                  "Patient",
                  "UHID",
                  "Consultant",
                  "Status",
                  "Advance bal.",
                  "Draft charges",
                ],
                rows: admissions.map((row: any) => [
                  row.ipNumber,
                  row.patientName,
                  row.uhid,
                  row.doctor || "—",
                  <StatusPill
                    key={row.id}
                    value={row.status}
                    tone={row.status === "BILLING" ? "amber" : "emerald"}
                  />,
                  formatInr(row.deposit),
                  formatInr(row.estimatedBill),
                ]),
                rawItems: admissions,
              }}
            />
          </div>
        </div>
      )}
    </PageShell>
  );
}
