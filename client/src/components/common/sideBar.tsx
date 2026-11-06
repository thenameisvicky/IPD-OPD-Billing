import { routeLabels } from "../../modules/registry";

export function Sidebar({
  isExpanded,
  setIsHovered,
  activePage,
  setActivePage,
}: any) {
  const navItems = routeLabels;

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <nav
        className="hide-scrollbar flex-1 overflow-y-auto py-2"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {navItems.map((item) => (
          <div
            key={item}
            onClick={() => setActivePage(item)}
            className={`group relative flex cursor-pointer items-center border-l-2 px-3 py-2.5 ${activePage === item ? "border-emerald-600 bg-emerald-50" : "border-transparent hover:border-slate-300 hover:bg-slate-50"}`}
          >
            <div
              className={`flex h-9 min-w-[36px] items-center justify-center border text-[18px] font-bold ${activePage === item ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-600 group-hover:border-emerald-600 group-hover:text-emerald-700"}`}
            >
              {item.charAt(0)}
            </div>

            <span
              className={`ml-3 overflow-hidden whitespace-nowrap text-[18px] font-bold ${!isExpanded ? "pointer-events-none w-0 opacity-0" : "ml-3 w-auto opacity-100"}`}
            >
              {item}
            </span>

            {!isExpanded && (
              <div className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap border border-slate-800 bg-slate-900 px-3 py-1.5 text-[18px] font-bold uppercase tracking-[0.12em] text-white opacity-0 group-hover:opacity-100">
                {item}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="flex justify-center border-t border-slate-200 p-3">
        <div
          className={`h-1 bg-emerald-600 ${isExpanded ? "w-10" : "w-2.5"}`}
        />
      </div>
    </div>
  );
}
