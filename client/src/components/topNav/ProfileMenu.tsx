import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "../../utils/axios";
import { useOutsideDismiss } from "./useOutsideDismiss";

type UserContext = {
  name: string;
  role: string;
  company: string;
};

const readUserContext = (payload: any): UserContext => {
  const data = payload?.data || payload || {};
  return {
    name: data.name || data.full_name || data.username || "Current User",
    role: data.role || data.user_role || "User",
    company:
      data.company?.name ||
      data.company_name ||
      data.company ||
      data.organization ||
      data.hospitalName ||
      "Hospital",
  };
};

export function ProfileMenu({
  onNavigate,
  onSignOut,
}: {
  onNavigate: (page: string) => void;
  onSignOut: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<UserContext>({
    name: "Current User",
    role: "User",
    company: "Hospital",
  });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const initials = useMemo(
    () =>
      user.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("") || "U",
    [user.name],
  );

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  useOutsideDismiss([triggerRef, panelRef], isOpen, closeMenu);

  useEffect(() => {
    let cancelled = false;

    const loadUser = async () => {
      try {
        const response = await axios.get("/api/main/me");
        if (!cancelled) setUser(readUserContext(response.data));
      } catch (error) {
        console.error("Failed to load user context", error);
      }
    };

    loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") closeMenu();
        }}
        className="inline-flex h-9 min-w-9 items-center gap-2 rounded border border-slate-300 bg-white px-2 text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        aria-label="Profile and company menu"
        aria-expanded={isOpen}
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-emerald-200 bg-emerald-50 text-[13px] font-bold text-emerald-700">
          {initials}
        </span>
        <span className="hidden max-w-[120px] truncate text-[16px] font-bold lg:inline">
          {user.company}
        </span>
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 top-[42px] z-50 w-[280px] rounded border border-slate-300 bg-white p-2 shadow-lg"
          onKeyDown={(event) => {
            if (event.key === "Escape") closeMenu();
          }}
        >
          <div className="border-b border-slate-200 px-2 py-2">
            <p className="truncate text-[16px] font-bold text-slate-900">{user.name}</p>
            <p className="mt-1 text-[13px] font-bold uppercase text-slate-500">{user.role}</p>
            <p className="mt-1 truncate text-[16px] font-semibold text-slate-700">
              {user.company}
            </p>
          </div>
          <div className="py-2">
            <button
              type="button"
              onClick={() => {
                onNavigate("Hospital");
                setIsOpen(false);
              }}
              className="w-full rounded px-2 py-2 text-left text-[16px] font-bold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              Hospital settings
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="w-full rounded px-2 py-2 text-left text-[16px] font-bold text-rose-700 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-100"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
