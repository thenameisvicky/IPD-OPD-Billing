import { ReactNode } from "react";

interface ViewContainerProps {
  primaryToolbar?: ReactNode;
  subToolbar?: { leftActions?: ReactNode; rightActions?: ReactNode };
  activeView: ReactNode;
}

export function ViewContainer({ primaryToolbar, subToolbar, activeView }: ViewContainerProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {primaryToolbar && (
        <div className="flex items-center justify-between">
          {primaryToolbar}
        </div>
      )}
      {subToolbar && (subToolbar.leftActions || subToolbar.rightActions) && (
        <div className="flex flex-col gap-2 border border-slate-300 bg-white px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {subToolbar.leftActions}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {subToolbar.rightActions}
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeView}
      </div>
    </div>
  );
}
