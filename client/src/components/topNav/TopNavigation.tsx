import { GlobalCommandSearch } from "./GlobalCommandSearch";
import { NotificationCenter } from "./NotificationCenter";
import { ProfileMenu } from "./ProfileMenu";
import { QuickAddMenu } from "./QuickAddMenu";

export function TopNavigation({
  onNavigate,
  onSignOut,
}: {
  activePage: string;
  onNavigate: (page: string) => void;
  onSignOut: () => void;
}) {
  return (
    <div data-tour="topbar" className="flex min-h-12 w-full items-center border-b border-slate-200 bg-white px-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="shrink-0 text-[18px] font-bold uppercase text-emerald-700">
          Hospital Billing
        </span>
        <GlobalCommandSearch onNavigate={onNavigate} />
      </div>

      <div className="ml-3 flex shrink-0 items-center gap-2">
        <QuickAddMenu onNavigate={onNavigate} />
        <NotificationCenter />
        <button
          type="button"
          onClick={() => onNavigate("Hospital")}
          className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          aria-label="Hospital settings"
          title="Hospital settings"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7.1 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z" />
          </svg>
        </button>
        <ProfileMenu onNavigate={onNavigate} onSignOut={onSignOut} />
      </div>
    </div>
  );
}
