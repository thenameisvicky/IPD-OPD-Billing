import { useState } from "react";
import axios, { formatApiError, setAuthToken } from "../../utils/axios";

interface LoginProps {
    onLoginSuccess: () => void;
    onGoToSignup: () => void;
}

export default function LoginPage({ onLoginSuccess, onGoToSignup }: LoginProps) {
    const [formData, setFormData] = useState({ username: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const response = await axios.post("/api/main/login", formData, { auth: false });
            const data = response.data;

            if (response.ok && data?.status === "success") {
                setAuthToken(data.token);
                onLoginSuccess();
            } else {
                setError(formatApiError(response, data, "Login failed"));
            }
        } catch (err) {
            setError(err instanceof Error ? `Connection error: ${err.message}` : "Connection error to auth server on port 3000");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD] p-3">
            <div className="w-full max-w-md">
                <div className="text-center mb-5">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center border border-emerald-700 bg-emerald-600 text-xl font-bold text-white">
                        w
                    </div>
                    <h1 className="mb-2 text-2xl font-bold text-slate-900">Welcome Back</h1>
                    <p className="text-slate-600 font-bold uppercase tracking-[0.2em] text-[16px]">Hospital Billing Access</p>
                    <p className="mt-2 text-[13px] font-semibold text-slate-500">Demo: billing / billing123</p>
                </div>

                <div className="bg-white p-3 rounded shadow-sm shadow-slate-100 border border-slate-200">
                    <form onSubmit={handleSubmit} className="space-y-3">
                        {error && (
                            <div className="border border-rose-200 bg-rose-50 px-4 py-3 text-center text-[16px] font-bold uppercase tracking-[0.12em] text-rose-700">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[16px] font-bold text-slate-600 uppercase tracking-[0.14em] ml-1">Username</label>
                            <input
                                required
                                type="text"
                                className="w-full rounded border border-slate-300 bg-slate-50 px-4 py-3 text-[16px] font-bold outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                                placeholder="Your username"
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[16px] font-bold text-slate-600 uppercase tracking-[0.14em] ml-1">Password</label>
                            <div className="relative">
                                <input
                                    required
                                    type={showPassword ? "text" : "password"}
                                    className="w-full rounded border border-slate-300 bg-slate-50 px-4 py-3 pr-12 text-[16px] font-bold outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((value) => !value)}
                                    className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-slate-600 hover:bg-slate-200 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                                    title={showPassword ? "Hide password" : "Show password"}
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
                            className="w-full rounded border border-slate-900 bg-slate-900 py-3 text-[16px] font-bold uppercase tracking-[0.12em] text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {loading ? "Authenticating..." : "Sign In to wAI"}
                        </button>
                    </form>

                    <div className="mt-4 pt-4 border-t border-slate-200 text-center">
                        <button
                            onClick={onGoToSignup}
                            className="text-[16px] font-bold uppercase tracking-[0.12em] text-slate-600 hover:text-emerald-700"
                        >
                            New to wAI? <span className="text-slate-900 ml-1">Create an account</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
