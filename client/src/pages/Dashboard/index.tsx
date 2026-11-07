import { useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DataTable } from "../../components/common/dataTable";
import { formatDateTime, formatInr, healthcareApi } from "../../api/healthcare";
import {
  buttonSecondaryClass,
  Fill,
  MetricCard,
  PageShell,
  StatusPill,
} from "../../components/hospital/PageShell";

type HomeTab = "overview" | "collection";

const tabClass = (active: boolean) =>
  `inline-flex h-9 items-center border px-3 text-[15px] font-bold ${
    active
      ? "border-slate-900 bg-slate-900 text-white"
      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
  }`;

function OverviewTab({
  data,
  loading,
}: {
  data: any;
  loading: boolean;
}) {
  if (loading && !data) {
    return <div className="text-[15px] font-semibold text-slate-600">Loading…</div>;
  }

  const m = data?.metrics || {};
  const chartData = (data?.weeklyIncoming || []).map((d: any) => ({
    day: d.dayLabel,
    date: d.date,
    amount: Number(d.amountNumber || d.amount || 0),
  }));
  const weekStart =
    chartData[0]?.date != null
      ? dayjs(chartData[0].date)
      : dayjs().startOf("week").add(1, "day");
  const weekEnd =
    chartData[6]?.date != null ? dayjs(chartData[6].date) : weekStart.add(6, "day");
  const weekLabel = `${weekStart.format("DD MMM")} – ${weekEnd.format("DD MMM")}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard label="Active admissions" value={String(m.activeAdmissions ?? 0)} />
        <MetricCard label="Pending billing" value={String(m.dischargesPendingBilling ?? 0)} />
        <MetricCard label="Advance balance" value={formatInr(m.advanceBalance)} />
        <MetricCard label="Outstanding" value={formatInr(m.outstandingTotal)} />
      </div>

      <div className="grid min-h-0 flex-1 gap-2 overflow-hidden xl:grid-cols-[1.4fr_1fr]">
        <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
          <div className="shrink-0 border border-slate-300 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[15px] font-bold uppercase tracking-[0.1em] text-slate-700">
                Incoming this week
              </h2>
              <span className="text-[13px] font-semibold text-slate-500">{weekLabel}</span>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fontWeight: 600 }} />
                  <YAxis
                    tick={{ fontSize: 12, fontWeight: 600 }}
                    tickFormatter={(v) =>
                      Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v)
                    }
                  />
                  <Tooltip
                    formatter={(value: any) => [formatInr(value), "Amount"]}
                    labelFormatter={(label, payload) =>
                      payload?.[0]?.payload?.date
                        ? dayjs(payload[0].payload.date).format("ddd, DD MMM")
                        : String(label)
                    }
                  />
                  <Bar dataKey="amount" fill="#059669" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <Fill className="flex flex-col gap-1">
            <h2 className="shrink-0 text-[15px] font-bold uppercase tracking-[0.1em] text-slate-700">
              Finalized invoices
            </h2>
            <Fill>
              <DataTable
                data={{
                  columns: [
                    "Invoice No",
                    "Patient",
                    "IP No",
                    "Amount",
                    "Outstanding",
                    "Status",
                  ],
                  rows: (data?.recentInvoices || []).map((row: any) => [
                    row.number,
                    row.patientName,
                    row.ipNumber || "—",
                    formatInr(row.grandTotal),
                    formatInr(row.outstanding),
                    <StatusPill
                      key={row.id}
                      value={row.status}
                      tone={row.status === "PAID" ? "emerald" : "amber"}
                    />,
                  ]),
                  rawItems: data?.recentInvoices || [],
                }}
              />
            </Fill>
          </Fill>
        </div>

        <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
          <Fill className="flex flex-col border border-slate-300 bg-white">
            <div className="shrink-0 border-b border-slate-200 px-3 py-2 text-[15px] font-bold uppercase tracking-[0.1em] text-slate-700">
              Activities
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {(data?.activities || []).length === 0 ? (
                <p className="p-3 text-[14px] font-semibold text-slate-500">No recent activity</p>
              ) : (
                (data?.activities || []).map((a: any) => (
                  <div
                    key={a.id}
                    className="border-b border-slate-100 px-3 py-2 last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-bold text-slate-900">{a.title}</span>
                      <StatusPill value={a.type} tone="slate" />
                    </div>
                    <p className="mt-1 text-[13px] font-semibold text-slate-600">{a.detail}</p>
                    <p className="mt-1 text-[12px] font-semibold text-slate-400">
                      {formatDateTime(a.at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Fill>

          <Fill className="flex min-h-0 flex-col gap-1">
            <h2 className="shrink-0 text-[15px] font-bold uppercase tracking-[0.1em] text-slate-700">
              Active admissions
            </h2>
            <Fill>
              <DataTable
                data={{
                  columns: ["IP No", "Patient", "Invoice", "Status"],
                  rows: (data?.recentAdmissions || []).map((row: any) => [
                    row.ipNumber,
                    row.patientName,
                    row.invoiceNumber || "—",
                    <StatusPill
                      key={row.id}
                      value={row.status}
                      tone={row.status === "BILLING" ? "amber" : "emerald"}
                    />,
                  ]),
                }}
              />
            </Fill>
          </Fill>
        </div>
      </div>
    </div>
  );
}

function DailyCollectionTab({
  data,
  loading,
}: {
  data: any;
  loading: boolean;
}) {
  if (loading && !data) {
    return <div className="text-[15px] font-semibold text-slate-600">Loading…</div>;
  }

  const payments = data?.payments || [];
  const advances = data?.advances || [];
  const rows = [
    ...advances.map((a: any) => ({ ...a, type: "ADVANCE" })),
    ...payments.map((p: any) => ({ ...p, type: "PAYMENT" })),
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard label="Payments" value={formatInr(data?.totals?.payments)} />
        <MetricCard label="Advances" value={formatInr(data?.totals?.advances)} />
        <MetricCard label="Refunds" value={formatInr(data?.totals?.refunds)} />
        <MetricCard label="Date" value={data?.date || "—"} />
      </div>
      <Fill>
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
      </Fill>
    </div>
  );
}

export default function DashboardPage() {
  const [tab, setTab] = useState<HomeTab>("overview");
  const [overview, setOverview] = useState<any>(null);
  const [collection, setCollection] = useState<any>(null);
  const [error, setError] = useState("");
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingCollection, setLoadingCollection] = useState(false);

  const loadOverview = async () => {
    setLoadingOverview(true);
    const res = await healthcareApi.dashboard();
    setLoadingOverview(false);
    if (!res.ok) {
      setError(res.message || "Failed to load overview");
      return;
    }
    setError("");
    setOverview(res.data);
  };

  const loadCollection = async () => {
    setLoadingCollection(true);
    const res = await healthcareApi.dailyCollection();
    setLoadingCollection(false);
    if (!res.ok) {
      setError(res.message || "Failed to load daily collection");
      return;
    }
    setError("");
    setCollection(res.data);
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    if (tab === "collection" && !collection) {
      loadCollection();
    }
  }, [tab]);

  const refresh = () => {
    if (tab === "overview") loadOverview();
    else loadCollection();
  };

  return (
    <PageShell
      leading={
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={tabClass(tab === "overview")}
            onClick={() => setTab("overview")}
          >
            Overview
          </button>
          <button
            type="button"
            className={tabClass(tab === "collection")}
            onClick={() => setTab("collection")}
          >
            Daily Collection
          </button>
        </div>
      }
      actions={
        <button type="button" className={buttonSecondaryClass} onClick={refresh}>
          Refresh
        </button>
      }
    >
      {error && (
        <div className="shrink-0 border border-rose-200 bg-rose-50 px-3 py-2 text-[15px] font-semibold text-rose-700">
          {error}
        </div>
      )}
      {tab === "overview" ? (
        <OverviewTab data={overview} loading={loadingOverview} />
      ) : (
        <DailyCollectionTab data={collection} loading={loadingCollection} />
      )}
    </PageShell>
  );
}
