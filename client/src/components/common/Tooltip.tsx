import type { ReactNode } from 'react';

type TooltipSize = 'small' | 'medium' | 'big';

interface TooltipProps {
  children: ReactNode;
  content: string | ReactNode;
  showArrow?: boolean;
  size?: TooltipSize;
}

export function Tooltip({ children, content, showArrow = true, size = 'medium' }: TooltipProps) {
  const sizeClasses = {
    small: 'w-32 p-2 text-xs',
    medium: 'w-48 p-3 text-sm',
    big: 'w-64 p-3 text-base',
  };

  return (
    <div className="group/tooltip relative inline-block">
      {children}
      <div className="absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 group-hover/tooltip:block">
        <div className={`rounded border border-slate-800 bg-slate-900 text-center text-white opacity-95 ${sizeClasses[size]}`}>
          {content}
          {showArrow && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
          )}
        </div>
      </div>
    </div>
  );
}
