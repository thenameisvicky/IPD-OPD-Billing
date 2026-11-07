import { useCallback, useRef, useState } from "react";
import { emitTopNavAction, type TopNavAction } from "./actions";
import { quickAddSections } from "./topNavData";
import { useOutsideDismiss } from "./useOutsideDismiss";

type QuickAddItem = (typeof quickAddSections)[number]["items"][number];

export function QuickAddMenu({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  useOutsideDismiss([triggerRef, panelRef], isOpen, closeMenu);

  const runAction = (item: QuickAddItem) => {
    if (!item.enabled) return;
    onNavigate(item.page);
    setIsOpen(false);
    window.setTimeout(() => emitTopNavAction(item.action as TopNavAction), 0);
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") closeMenu();
        }}
        className="group relative inline-flex h-9 w-9 items-center justify-center rounded border border-slate-300 bg-white text-[22px] font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        aria-label="Quick Add"
        aria-expanded={isOpen}
      >
        +
        <span className="pointer-events-none absolute right-0 top-[42px] z-50 hidden whitespace-nowrap rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[13px] font-bold text-white group-hover:block">
          Quick Add
        </span>
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 top-[42px] z-50 w-[260px] rounded border border-slate-300 bg-white p-2 shadow-lg"
          onKeyDown={(event) => {
            if (event.key === "Escape") closeMenu();
          }}
        >
          {quickAddSections.map((group) => (
            <div key={group.title} className="py-1">
              <div className="px-2 py-1 text-[13px] font-bold uppercase text-slate-500">
                {group.title}
              </div>
              {group.items.map((item) => (
                <button
                  key={`${group.title}-${item.label}`}
                  type="button"
                  disabled={!item.enabled}
                  onClick={() => runAction(item)}
                  className={`flex w-full items-center justify-between rounded px-2 py-2 text-left text-[16px] font-bold focus:outline-none focus:ring-2 focus:ring-emerald-100 ${
                    item.enabled
                      ? "text-slate-800 hover:bg-slate-50"
                      : "cursor-not-allowed text-slate-400"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.note && (
                    <span className="text-[12px] font-bold uppercase text-slate-500">
                      {item.note}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
