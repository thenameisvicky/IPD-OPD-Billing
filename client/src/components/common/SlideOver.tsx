import { createPortal } from "react-dom";
import type { ReactNode } from "react";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    title: ReactNode;
    subtitle?: string;
    widthClassName?: string;
    children: React.ReactNode;
}

export function SlideOver({ isOpen, onClose, title, subtitle, widthClassName = "max-w-md", children }: Props) {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[200] flex justify-end">
            <div 
                className="absolute inset-0 bg-slate-900/25" 
                onClick={onClose}
            />

            <div 
                className={`relative flex h-full w-full flex-col border-l border-slate-300 bg-white ${widthClassName}`}
            >
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
                    <div>
                        <h2 className="text-[16px] font-bold text-slate-900">{title}</h2>
                        {subtitle && <p className="mt-1 text-[16px] font-bold uppercase tracking-[0.14em] text-slate-700">{subtitle}</p>}
                    </div>
                    <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-slate-100 p-3">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
