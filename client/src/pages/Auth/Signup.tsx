import { useState } from "react";
import axios, { formatApiError } from "../../utils/axios";

interface SignupProps {
    onGoToLogin: () => void;
}

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export default function SignupPage({ onGoToLogin }: SignupProps) {
    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: "",
        name: "", // Company Name
        phone: "",
        company_type: "Manufacturing",
        industry: "Manufacturing",
        address: "",
        country: "India",
        territory: "",
        currency: "INR",
        language: "English",
        time_zone: "Asia/Kolkata",
        fiscal_year: "Apr-Mar",
        registered_gst: true,
        gstin: "",
        pan: "",
        state: "",
        // ui_font_scale: "comfortable",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showAddress, setShowAddress] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const normalizedGstin = formData.gstin.trim().toUpperCase();
        if (formData.registered_gst && !GSTIN_PATTERN.test(normalizedGstin)) {
            setError("Registration failed: Invalid company GSTIN format");
            setLoading(false);
            return;
        }

        try {
            const payload = {
                ...formData,
                company_type: formData.industry,
                state: formData.territory || formData.state,
                gstin: formData.registered_gst ? normalizedGstin : "",
                last_verified: { $date: new Date().toISOString() }
            };

            const response = await axios.post("/api/main/signup", payload, { auth: false });
            const data = response.data;

            if (response.ok && data?.status === "success") {
                // window.localStorage.setItem("wai_font_scale", formData.ui_font_scale);
                setSuccess(true);
                setTimeout(() => onGoToLogin(), 2000);
            } else {
                setError(formatApiError(response, data, "Registration failed"));
            }
        } catch (err) {
            setError(err instanceof Error ? `Connection error: ${err.message}` : "Connection error to auth server on port 3000");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD] p-3">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center border border-emerald-200 bg-emerald-50 text-emerald-700">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>
                    </div>
                    <h2 className="mb-2 text-2xl font-bold text-slate-900">Account Created</h2>
                    <p className="text-slate-600 font-bold uppercase tracking-[0.14em] text-[16px]">Redirecting to login portal...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD] p-3 py-12">
            <div className="w-full max-w-2xl">
                <div className="text-center mb-5">
                    <h1 className="mb-2 text-2xl font-bold text-slate-900">Create Account</h1>
                </div>

                <div className="bg-white p-3 rounded shadow-sm shadow-slate-100 border border-slate-200">
                    <form onSubmit={handleSubmit} className="space-y-3">
                        {error && (
                            <div className="border border-rose-200 bg-rose-50 px-4 py-3 text-center text-[16px] font-bold uppercase tracking-[0.12em] text-rose-700">
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-[16px] font-bold text-slate-600 uppercase tracking-[0.14em] ml-1">Username</label>
                                <input
                                    required
                                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 rounded px-4 py-3 text-sm transition-colors outline-none font-bold"
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[16px] font-bold text-slate-600 uppercase tracking-[0.14em] ml-1">Email</label>
                                <input
                                    required
                                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 rounded px-4 py-3 text-sm transition-colors outline-none font-bold"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[16px] font-bold text-slate-600 uppercase tracking-[0.14em] ml-1">Password</label>
                            <div className="relative">
                                <input
                                    required
                                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 rounded px-4 py-3 pr-12 text-sm transition-colors outline-none font-bold"
                                    type={showPassword ? "text" : "password"}
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

                        <div className="h-[1px] bg-slate-50 my-2" />

                        <div className="space-y-2">
                            <label className="text-[16px] font-bold text-slate-600 uppercase tracking-[0.14em] ml-1">Company Name</label>
                            <input
                                required
                                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 rounded px-4 py-3 text-sm transition-colors outline-none font-bold"
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-[16px] font-bold text-slate-600 uppercase tracking-[0.14em] ml-1">Plant Phone</label>
                                <input
                                    required
                                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 rounded px-4 py-3 text-sm transition-colors outline-none font-bold"
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[16px] font-bold text-slate-600 uppercase tracking-[0.14em] ml-1">Industry</label>
                                <input
                                    required
                                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 rounded px-4 py-3 text-sm transition-colors outline-none font-bold"
                                    type="text"
                                    placeholder="Manufacturing, textile, services..."
                                    value={formData.industry}
                                    onChange={(e) => setFormData({ ...formData, industry: e.target.value, company_type: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                                <label className="text-[16px] font-bold text-slate-600 uppercase tracking-[0.14em] ml-1">Address</label>
                                <button
                                    type="button"
                                    onClick={() => setShowAddress((value) => !value)}
                                    className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-1.5 text-[16px] font-bold text-slate-700 hover:border-emerald-600 hover:text-emerald-700"
                                >
                                    <span className="text-[18px] leading-none">+</span>
                                    {showAddress ? "Hide address" : "Add address"}
                                </button>
                            </div>
                            {showAddress && (
                                <input
                                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 rounded px-4 py-3 text-sm transition-colors outline-none font-bold"
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                />
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-[16px] font-bold text-slate-600 uppercase tracking-[0.14em] ml-1">Territory / State</label>
                                <input
                                    required
                                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 rounded px-4 py-3 text-sm transition-colors outline-none font-bold"
                                    type="text"
                                    value={formData.territory}
                                    onChange={(e) => setFormData({ ...formData, territory: e.target.value, state: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[16px] font-bold text-slate-600 uppercase tracking-[0.14em] ml-1">Country</label>
                                <input
                                    required
                                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 rounded px-4 py-3 text-sm transition-colors outline-none font-bold"
                                    type="text"
                                    value={formData.country}
                                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-[16px] font-bold text-slate-600 uppercase tracking-[0.14em] ml-1">Currency</label>
                                <select
                                    required
                                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 rounded px-4 py-3 text-sm transition-colors outline-none font-bold"
                                    value={formData.currency}
                                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                >
                                    <option value="INR">INR</option>
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                    <option value="GBP">GBP</option>
                                    <option value="AED">AED</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[16px] font-bold text-slate-600 uppercase tracking-[0.14em] ml-1">Language</label>
                                <select
                                    required
                                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 rounded px-4 py-3 text-sm transition-colors outline-none font-bold"
                                    value={formData.language}
                                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                                >
                                    <option value="English">English</option>
                                    <option value="Hindi">Hindi</option>
                                    <option value="Tamil">Tamil</option>
                                    <option value="Telugu">Telugu</option>
                                    <option value="Kannada">Kannada</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-[16px] font-bold text-slate-600 uppercase tracking-[0.14em] ml-1">Time Zone</label>
                                <select
                                    required
                                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 rounded px-4 py-3 text-sm transition-colors outline-none font-bold"
                                    value={formData.time_zone}
                                    onChange={(e) => setFormData({ ...formData, time_zone: e.target.value })}
                                >
                                    <option value="Asia/Kolkata">Asia/Kolkata</option>
                                    <option value="UTC">UTC</option>
                                    <option value="America/New_York">America/New_York</option>
                                    <option value="Europe/London">Europe/London</option>
                                    <option value="Asia/Dubai">Asia/Dubai</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[16px] font-bold text-slate-600 uppercase tracking-[0.14em] ml-1">Fiscal Year</label>
                                <select
                                    required
                                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 rounded px-4 py-3 text-sm transition-colors outline-none font-bold"
                                    value={formData.fiscal_year}
                                    onChange={(e) => setFormData({ ...formData, fiscal_year: e.target.value })}
                                >
                                    <option value="Apr-Mar">Apr - Mar</option>
                                    <option value="Jan-Dec">Jan - Dec</option>
                                    <option value="Jul-Jun">Jul - Jun</option>
                                    <option value="Oct-Sep">Oct - Sep</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-[16px] font-bold text-slate-600 uppercase tracking-[0.14em] ml-1">GST Registered</label>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, registered_gst: !formData.registered_gst, gstin: formData.registered_gst ? "" : formData.gstin })}
                                    className={`flex h-[46px] w-full items-center justify-between rounded border px-4 text-[16px] font-bold ${formData.registered_gst ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-slate-50 text-slate-700"}`}
                                    aria-pressed={formData.registered_gst}
                                >
                                    <span>{formData.registered_gst ? "Registered" : "Not registered"}</span>
                                    <span className={`h-5 w-10 rounded-full p-0.5 ${formData.registered_gst ? "bg-emerald-600" : "bg-slate-300"}`}>
                                        <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${formData.registered_gst ? "translate-x-5" : "translate-x-0"}`} />
                                    </span>
                                </button>
                            </div>
                        </div>

                        {formData.registered_gst && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <label className="text-[16px] font-bold text-slate-600 uppercase tracking-[0.14em] ml-1">GSTIN</label>
                                    <input
                                        required
                                        className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 rounded px-4 py-3 text-sm transition-colors outline-none font-bold"
                                        type="text"
                                        value={formData.gstin}
                                        maxLength={15}
                                        pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]"
                                        title="Enter a valid 15-character GSTIN, e.g. 22AAAAA0000A1Z5"
                                        onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[16px] font-bold text-slate-600 uppercase tracking-[0.14em] ml-1">PAN</label>
                                    <input
                                        required
                                        className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 rounded px-4 py-3 text-sm transition-colors outline-none font-bold"
                                        type="text"
                                        value={formData.pan}
                                        onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                                    />
                                </div>
                            </div>
                        )}

                        {!formData.registered_gst && (
                            <div className="space-y-2">
                                <label className="text-[16px] font-bold text-slate-600 uppercase tracking-[0.14em] ml-1">PAN</label>
                                <input
                                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 rounded px-4 py-3 text-sm transition-colors outline-none font-bold"
                                    type="text"
                                    value={formData.pan}
                                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                                />
                            </div>
                        )}

                        {/* <div className="space-y-2">
                            <label className="text-[16px] font-bold text-slate-600 uppercase tracking-[0.14em] ml-1">Display Size</label>
                            <select
                                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 rounded px-4 py-3 text-sm transition-colors outline-none font-bold appearance-none"
                                value={formData.ui_font_scale}
                                onChange={(e) => setFormData({ ...formData, ui_font_scale: e.target.value })}
                            >
                                <option value="comfortable">Comfortable ERP</option>
                                <option value="large">Large / Accountant Friendly</option>
                            </select>
                            <p className="text-[16px] font-semibold text-slate-700">Use larger, clearer operating text for daily ERP workflows.</p>
                        </div> */}

                        <button
                            disabled={loading}
                            type="submit"
                            className="w-full bg-slate-900 text-white py-5 rounded text-xs font-bold uppercase tracking-[0.14em] shadow-sm shadow-slate-200 hover:bg-emerald-600 transition-colors border border-slate-900 disabled:opacity-50"
                        >
                            {loading ? "Initializing..." : "Register Account"}
                        </button>
                    </form>

                    <div className="mt-4 pt-4 border-t border-slate-200 text-center">
                        <button
                            onClick={onGoToLogin}
                            className="text-slate-600 text-[16px] font-bold uppercase tracking-[0.14em] hover:text-emerald-600 transition-colors"
                        >
                            Already have an account? <span className="text-slate-900 ml-1">Log in here</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
