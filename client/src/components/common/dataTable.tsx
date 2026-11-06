interface DataTableProps {
  data: {
    columns: string[];
    rows: any[][];
    rawItems?: any[];
  };
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
  onOpen?: (item: any) => void;
  actionVariant?: "icons" | "buttons";
}

export function DataTable({ data, onEdit, onDelete, onOpen, actionVariant = "icons" }: DataTableProps) {
  const hasActions = onEdit || onDelete || onOpen;
  const columnSpan = data.columns.length + (hasActions ? 1 : 0);
  const actionButtonClass =
    actionVariant === "buttons"
      ? "inline-flex h-8 items-center justify-center rounded border border-slate-300 bg-white px-3 text-[16px] font-bold text-slate-700 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
      : "inline-flex h-7 w-7 items-center justify-center rounded border border-transparent text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200";
  
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden border border-slate-300 bg-white">
      <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-slate-100">
        <table className={`w-full min-w-[860px] border-collapse text-left ${data.rows.length === 0 ? "h-full" : ""}`}>
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 shadow-[0_1px_0_rgba(15,23,42,0.08)]">
            <tr>
              {data.columns.map((column, index) => (
                <th
                  key={index}
                  className="px-3 py-2 text-[16px] font-bold uppercase tracking-[0.14em] text-slate-700"
                >
                  {column}
                </th>
              ))}
              {hasActions && (
                <th className="px-3 py-2 text-right text-[16px] font-bold uppercase tracking-[0.14em] text-slate-700">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white text-[16px]">
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={columnSpan} className="h-full bg-white px-3 py-4 text-center align-middle">
                  <div className="flex min-h-[360px] flex-col items-center justify-center">
                    <p className="text-[16px] font-bold uppercase tracking-[0.12em] text-slate-400 opacity-70">No records yet</p>
                    <p className="mt-2 text-[16px] font-semibold text-slate-400 opacity-70">Rows will appear here after live ERP records are available.</p>
                  </div>
                </td>
              </tr>
            ) : data.rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                tabIndex={onOpen ? 0 : undefined}
                onClick={() => onOpen?.(data.rawItems?.[rowIndex])}
                onKeyDown={(event) => {
                  if (!onOpen) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(data.rawItems?.[rowIndex]);
                  }
                }}
                className={`group outline-none hover:bg-emerald-50/40 focus:bg-emerald-50 focus:ring-2 focus:ring-inset focus:ring-emerald-200 ${onOpen ? "cursor-pointer" : ""}`}
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={`px-3 py-2 font-semibold ${cellIndex === 0 ? "font-bold text-slate-900" : "text-slate-700"
                      }`}
                  >
                    {cell}
                  </td>
                ))}
                {hasActions && (
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                    {onOpen && (
                      <button onClick={(event) => { event.stopPropagation(); onOpen(data.rawItems?.[rowIndex]); }} title="Open" className={actionButtonClass}>
                        {actionVariant === "buttons" ? "Open" : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4.5M10 14L21 3"/></svg>}
                      </button>
                    )}
                    {onEdit && (
                      <button onClick={(event) => { event.stopPropagation(); onEdit(data.rawItems?.[rowIndex]); }} title="Edit" className={actionButtonClass}>
                        {actionVariant === "buttons" ? "Edit" : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>}
                      </button>
                    )}
                    {onDelete && (
                      <button onClick={(event) => { event.stopPropagation(); onDelete(data.rawItems?.[rowIndex]); }} title="Delete" className={`${actionButtonClass} hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus:ring-rose-100`}>
                         {actionVariant === "buttons" ? "Delete" : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>}
                      </button>
                    )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
