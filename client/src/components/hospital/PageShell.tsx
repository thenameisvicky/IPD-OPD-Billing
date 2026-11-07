import type { ReactNode } from "react";

/** Content wrapper. Fills the workspace; never grows past the viewport. */
export function PageShell({
  leading,
  actions,
  children,
}: {
  title?: string;
  subtitle?: string;
  leading?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full max-h-full min-h-0 flex-col gap-2 overflow-hidden">
      {(leading || actions) && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border border-slate-300 bg-white px-2 py-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">{leading}</div>
          <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">{children}</div>
    </div>
  );
}

/** Fills remaining height; children (e.g. DataTable) scroll internally. */
export function Fill({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`min-h-0 flex-1 overflow-hidden ${className}`}>{children}</div>;
}

/** Fills remaining height with its own scroll when content is taller than the viewport. */
export function ScrollArea({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`min-h-0 flex-1 overflow-auto ${className}`}>{children}</div>;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[16px] font-bold uppercase tracking-[0.12em] text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded border border-slate-300 bg-slate-50 px-3 py-2.5 text-[16px] font-semibold text-slate-900 outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100";

export const buttonPrimaryClass =
  "inline-flex h-10 items-center justify-center rounded border border-slate-900 bg-slate-900 px-4 text-[16px] font-bold text-white hover:bg-emerald-700";

export const buttonSecondaryClass =
  "inline-flex h-10 items-center justify-center rounded border border-slate-300 bg-white px-4 text-[16px] font-bold text-slate-700 hover:bg-slate-50";

export function StatusPill({
  value,
  tone = "slate",
}: {
  value: string;
  tone?: "slate" | "emerald" | "amber" | "rose";
}) {
  const tones = {
    slate: "border-slate-300 bg-slate-50 text-slate-700",
    emerald: "border-emerald-300 bg-emerald-50 text-emerald-800",
    amber: "border-amber-300 bg-amber-50 text-amber-800",
    rose: "border-rose-300 bg-rose-50 text-rose-800",
  };
  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 text-[13px] font-bold uppercase tracking-[0.08em] ${tones[tone]}`}
    >
      {value}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="border border-slate-300 bg-white p-3">
      <p className="text-[16px] font-bold uppercase tracking-[0.14em] text-slate-600">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {detail && (
        <p className="mt-1 text-[16px] font-semibold text-slate-600">{detail}</p>
      )}
    </div>
  );
}
