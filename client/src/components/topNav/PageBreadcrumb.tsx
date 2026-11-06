import { routeBreadcrumbs } from "./topNavData";

export function PageBreadcrumb({ activePage }: { activePage: string }) {
  const parts = routeBreadcrumbs[activePage] || [activePage];

  return (
    <div className="flex h-8 items-center gap-1 border-b border-slate-200 bg-white px-3 text-[16px] font-bold text-slate-700">
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 && <span className="text-slate-400">/</span>}
          <span className={index === parts.length - 1 ? "text-slate-900" : "text-slate-500"}>
            {part}
          </span>
        </span>
      ))}
    </div>
  );
}
