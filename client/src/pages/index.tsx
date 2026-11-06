import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Sidebar } from "../components/common/sideBar";
import { PageBreadcrumb } from "../components/topNav/PageBreadcrumb";
import { TopNavigation } from "../components/topNav/TopNavigation";
import LoginPage from "./Auth/Login";
import SignupPage from "./Auth/Signup";
import { getModuleRoute } from "../modules/registry";
import axios, { clearAuthToken, hasAuthToken, setAuthToken } from "../utils/axios";

const IDLE_LOCK_MS = 3 * 60 * 1000;
const FREEZE_DB = "wai_client_freeze";
const FREEZE_STORE = "snapshots";
const TOUR_LOCAL_KEY = "wai_tutorial_completed";

const tourSteps = [
  {
    target: "topbar",
    title: "Control bar",
    body: "Use this strip for the workspace identity and session actions.",
  },
  {
    target: "sidebar",
    title: "Modules",
    body: "Move between IPD Dashboard, Patients, Admissions, Final Bill, and other billing modules.",
  },
  {
    target: "workspace",
    title: "Workspace",
    body: "Daily ERP work opens in this area with dense tables, forms, and operating views.",
  },
  {
    target: "logout",
    title: "Sign out",
    body: "End the session from here when the workstation is unattended.",
  },
];

function openFreezeDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FREEZE_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(FREEZE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveFrozenSession() {
  if (!("indexedDB" in window)) return;

  const fields = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input, textarea, select",
    ),
  ).map((field) => ({
    name: field.name || field.id || field.getAttribute("aria-label") || field.type,
    value: field.type === "password" ? "" : field.value,
    type: field.tagName.toLowerCase(),
    page: window.location.hash || window.location.pathname,
  }));

  const db = await openFreezeDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(FREEZE_STORE, "readwrite");
    transaction.objectStore(FREEZE_STORE).put(
      {
        savedAt: new Date().toISOString(),
        fields,
      },
      "latest",
    );
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

function SecurityLockOverlay({ onUnlock }: { onUnlock: () => void }) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await axios.post("/api/main/login", formData, { auth: false });
      const data = response.data;
      if (response.ok && data?.status === "success") {
        setAuthToken(data.token);
        onUnlock();
      } else {
        setError(data?.message || data?.error || "Login failed. Please try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reach auth server.");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      className="m-0 h-screen max-h-none w-screen max-w-none border-0 bg-transparent p-0 backdrop:bg-slate-950/70 backdrop:backdrop-blur-sm"
    >
      <div className="flex min-h-screen items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded border border-slate-300 bg-white p-4 shadow-xl">
        <div className="mb-4">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded border border-emerald-200 bg-emerald-50 text-emerald-700">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Session Locked</h2>
          <p className="mt-2 text-[16px] font-semibold text-slate-700">
            No activity was detected for 3 minutes. For security, please sign in again. Your current screen is kept open and visible form data has been frozen locally.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-[16px] font-bold text-rose-700">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-[16px] font-bold text-slate-600">Username</label>
            <input
              required
              type="text"
              className="w-full rounded border border-slate-300 bg-slate-50 px-4 py-3 text-[16px] font-bold outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              value={formData.username}
              onChange={(event) => setFormData({ ...formData, username: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[16px] font-bold text-slate-600">Password</label>
            <div className="relative">
              <input
                required
                type={showPassword ? "text" : "password"}
                className="w-full rounded border border-slate-300 bg-slate-50 px-4 py-3 pr-12 text-[16px] font-bold outline-none focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                value={formData.password}
                onChange={(event) => setFormData({ ...formData, password: event.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-slate-600 hover:bg-slate-200"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18" /><path d="M10.6 10.6A2 2 0 0 0 13.4 13.4" /><path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c5 0 9 4.5 10 8a12.6 12.6 0 0 1-3.1 4.9" /><path d="M6.1 6.1A12.2 12.2 0 0 0 2 12c1 3.5 5 8 10 8a10.8 10.8 0 0 0 4.2-.9" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </div>
          <button
            disabled={loading}
            type="submit"
            className="w-full rounded border border-slate-900 bg-slate-900 py-3 text-[16px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "Unlocking..." : "Unlock Session"}
          </button>
        </form>
      </div>
      </div>
    </dialog>,
    document.body,
  );
}

function TourChoiceModal({
  onStart,
  onSkip,
}: {
  onStart: () => void;
  onSkip: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-sm rounded border border-slate-300 bg-white p-4 shadow-xl">
        <div className="text-[16px] font-bold uppercase tracking-[0.14em] text-emerald-700">
          Welcome to wAI
        </div>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">
          Show you around?
        </h2>
        <p className="mt-2 text-[16px] font-semibold text-slate-700">
          Start a short tour of the main operating areas, or continue directly into the workspace.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="rounded border border-slate-300 bg-white px-3 py-3 text-[16px] font-bold text-slate-700 hover:bg-slate-50"
          >
            Explore myself
          </button>
          <button
            type="button"
            onClick={onStart}
            className="rounded border border-slate-900 bg-slate-900 px-3 py-3 text-[16px] font-bold text-white hover:bg-emerald-700"
          >
            Show around
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function GuidedTour({
  onFinish,
}: {
  onFinish: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [position, setPosition] = useState({ top: 72, left: 240 });
  const step = tourSteps[stepIndex];

  useLayoutEffect(() => {
    const updatePosition = () => {
      const element = document.querySelector(`[data-tour="${step.target}"]`);
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const modalWidth = 320;
      const modalHeight = 188;
      const gap = 12;
      const canPlaceRight = rect.right + modalWidth + gap < window.innerWidth;
      const canPlaceBelow = rect.bottom + modalHeight + gap < window.innerHeight;
      const left = canPlaceRight
        ? rect.right + gap
        : Math.max(12, Math.min(window.innerWidth - modalWidth - 12, rect.left));
      const top = canPlaceBelow
        ? rect.bottom + gap
        : Math.max(12, Math.min(window.innerHeight - modalHeight - 12, rect.top));

      setPosition({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [step.target]);

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-slate-950/10" />
      <div
        className="pointer-events-auto absolute w-[320px] rounded border border-slate-300 bg-white p-3 shadow-xl"
        style={{ top: position.top, left: position.left }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
          <div>
            <div className="text-[16px] font-bold uppercase tracking-[0.14em] text-slate-500">
              {stepIndex + 1} / {tourSteps.length}
            </div>
            <h3 className="mt-1 text-[18px] font-bold text-slate-900">
              {step.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onFinish}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-[18px] font-bold text-slate-600 hover:bg-slate-50"
            aria-label="Close tour"
          >
            x
          </button>
        </div>
        <p className="mt-3 text-[16px] font-semibold leading-6 text-slate-700">
          {step.body}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-300 text-[20px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            aria-label="Previous tour step"
          >
            {"<"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (stepIndex === tourSteps.length - 1) {
                onFinish();
              } else {
                setStepIndex((value) => value + 1);
              }
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-900 bg-slate-900 text-[20px] font-bold text-white hover:bg-emerald-700"
            aria-label={stepIndex === tourSteps.length - 1 ? "Finish tour" : "Next tour step"}
          >
            {stepIndex === tourSteps.length - 1 ? "OK" : ">"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function PagesRouter() {
  const [authStatus, setAuthStatus] = useState<
    "loading" | "unauthenticated" | "authenticated" | "signup"
  >("loading");
  const [activePage, setActivePage] = useState("IPD Dashboard");
  const [isLocked, setIsLocked] = useState(true);
  const [sessionLocked, setSessionLocked] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [tourPromptOpen, setTourPromptOpen] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  // Display-size configuration is disabled for now; default ERP readability is applied globally.

  useEffect(() => {
    const checkAuth = () => {
      setAuthStatus(hasAuthToken() ? "authenticated" : "unauthenticated");
    };
    checkAuth();
  }, []);

  const handleLogout = () => {
    clearAuthToken();
    setSessionLocked(false);
    setTourPromptOpen(false);
    setTourActive(false);
    setAuthStatus("unauthenticated");
  };

  const markTutorialCompleted = async () => {
    localStorage.setItem(TOUR_LOCAL_KEY, "true");
    try {
      await axios.patch("/api/main/me/tutorial", { completed: true });
    } catch (error) {
      console.error("Failed to persist tutorial completion", error);
    }
  };

  const finishTour = () => {
    setTourActive(false);
    setTourPromptOpen(false);
    markTutorialCompleted();
  };

  useEffect(() => {
    if (authStatus !== "authenticated") return;

    let cancelled = false;
    const loadTutorialState = async () => {
      try {
        const response = await axios.get("/api/main/me");
        const completed = Boolean((response.data as any)?.data?.tutorial_completed);
        if (!cancelled && !completed) setTourPromptOpen(true);
      } catch (error) {
        if (!cancelled && localStorage.getItem(TOUR_LOCAL_KEY) !== "true") {
          setTourPromptOpen(true);
        }
      }
    };

    loadTutorialState();
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  useEffect(() => {
    if (authStatus !== "authenticated" || sessionLocked) return;

    let timer: number | undefined;
    const lockSession = () => {
      saveFrozenSession().catch((error) => {
        console.error("Failed to freeze session state", error);
      });
      clearAuthToken();
      setSessionLocked(true);
    };
    const resetTimer = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lockSession, IDLE_LOCK_MS);
    };
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "input"];

    events.forEach((eventName) => window.addEventListener(eventName, resetTimer, true));
    resetTimer();

    return () => {
      window.clearTimeout(timer);
      events.forEach((eventName) => window.removeEventListener(eventName, resetTimer, true));
    };
  }, [authStatus, sessionLocked]);

  if (authStatus === "loading") {
    return (
      <div className="h-screen flex items-center justify-center bg-[#FDFDFD]">
        <div className="border border-slate-300 bg-white px-4 py-2 text-[16px] font-bold uppercase tracking-[0.12em] text-slate-500">
          Loading
        </div>
      </div>
    );
  }

  if (authStatus === "signup") {
    return (
      <div className="auth-route-motion">
        <SignupPage onGoToLogin={() => setAuthStatus("unauthenticated")} />
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <div className="auth-route-motion">
        <LoginPage
          onLoginSuccess={() => setAuthStatus("authenticated")}
          onGoToSignup={() => setAuthStatus("signup")}
        />
      </div>
    );
  }

  const isExpanded = isLocked || isHovered;

  const renderPage = () => {
    const RouteComponent = getModuleRoute(activePage).component;
    return <RouteComponent />;
  };

  return (
    <div className="flex flex-col h-screen bg-[#FDFDFD] overflow-hidden font-sans text-slate-900">
      <TopNavigation
        activePage={activePage}
        onNavigate={setActivePage}
        onSignOut={handleLogout}
      />

      <div className="flex flex-1 overflow-hidden">
        <div
          data-tour="sidebar"
          className={`${isExpanded ? "w-[220px]" : "w-[64px]"} flex h-full shrink-0 border-r border-slate-300 bg-white`}
        >
          <Sidebar
            isExpanded={isExpanded}
            isLocked={isLocked}
            setIsLocked={setIsLocked}
            setIsHovered={setIsHovered}
            activePage={activePage}
            setActivePage={setActivePage}
          />
        </div>

        <div data-tour="workspace" className="flex-1 flex flex-col relative h-full min-w-0">
          <PageBreadcrumb activePage={activePage} />
          <div className="relative flex-1 overflow-hidden p-1.5">
            {renderPage()}
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
                .auth-route-motion { animation: authRouteEnter 180ms ease-out both; }
                @keyframes authRouteEnter {
                  from { opacity: 0; transform: translateY(8px) scale(0.995); }
                  to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .hide-scrollbar::-webkit-scrollbar { width: 4px; }
                .hide-scrollbar::-webkit-scrollbar-thumb { background-color: transparent; border-radius: 10px; }
                .hide-scrollbar:hover::-webkit-scrollbar-thumb { background-color: #e2e8f0; }
                .hide-scrollbar { scrollbar-width: thin; scrollbar-color: transparent transparent; }
                .hide-scrollbar:hover { scrollbar-color: #e2e8f0 transparent; }
            `,
        }}
      />
      {sessionLocked && (
        <SecurityLockOverlay onUnlock={() => setSessionLocked(false)} />
      )}
      {tourPromptOpen && !tourActive && !sessionLocked && (
        <TourChoiceModal
          onStart={() => {
            setTourPromptOpen(false);
            setTourActive(true);
          }}
          onSkip={finishTour}
        />
      )}
      {tourActive && !sessionLocked && <GuidedTour onFinish={finishTour} />}
    </div>
  );
}
