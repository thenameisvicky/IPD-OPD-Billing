import { FormEvent, useEffect, useState } from "react";
import { healthcareApi } from "../../api/healthcare";
import {
  buttonPrimaryClass,
  Field,
  inputClass,
  PageShell,
} from "../../components/hospital/PageShell";

export default function HospitalSettingsPage() {
  const [form, setForm] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    healthcareApi.getHospitalSettings().then((res) => {
      if (res.ok) setForm(res.data);
      else setError(res.message || "Failed to load settings");
    });
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const res = await healthcareApi.updateHospitalSettings({
      name: form.name,
      addressLine1: form.addressLine1,
      addressLine2: form.addressLine2,
      city: form.city,
      state: form.state,
      pincode: form.pincode,
      phone: form.phone,
      email: form.email,
      registrationNumber: form.registrationNumber,
      gstin: form.gstin,
      identifierLabel: form.identifierLabel,
      identifierValue: form.identifierValue,
      declarationText: form.declarationText,
      defaultNotes: form.defaultNotes,
      authorizedSignatory: form.authorizedSignatory,
      invoiceFooter: form.invoiceFooter,
      invoicePrefix: form.invoicePrefix,
      losChargingPolicy: form.losChargingPolicy,
      financialYearStartMonth: Number(form.financialYearStartMonth),
    });
    if (!res.ok) {
      setError(res.message || "Save failed");
      return;
    }
    setForm(res.data);
    setMessage("Hospital settings saved — invoice header will use these values");
  };

  if (!form) {
    return (
      <PageShell title="Hospital Configuration">
        <div className="text-[15px] font-semibold text-slate-600">{error || "Loading…"}</div>
      </PageShell>
    );
  }

  const set = (key: string, value: string) => setForm({ ...form, [key]: value });

  return (
    <PageShell title="Hospital Configuration" subtitle="Invoice header, declaration, numbering and LOS policy">
      {message && (
        <div className="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[15px] font-bold text-emerald-800">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-[15px] font-bold text-rose-700">
          {error}
        </div>
      )}
      {form.isDemo && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[14px] font-semibold text-amber-900">
          This hospital record is marked as DEMO/test data. Replace identity fields before production use.
          Tax profiles must be reviewed by the hospital CA — generating invoices does not complete GST compliance.
        </div>
      )}
      <form onSubmit={save} className="grid max-w-4xl gap-3 border border-slate-300 bg-white p-3 md:grid-cols-2">
        {[
          ["name", "Hospital name"],
          ["addressLine1", "Address line 1"],
          ["addressLine2", "Address line 2"],
          ["city", "City"],
          ["state", "State"],
          ["pincode", "PIN code"],
          ["phone", "Phone"],
          ["email", "Email"],
          ["registrationNumber", "Registration number"],
          ["gstin", "GSTIN"],
          ["identifierLabel", "Identifier label (e.g. ROHINI ID)"],
          ["identifierValue", "Identifier value"],
          ["invoicePrefix", "Invoice prefix"],
          ["authorizedSignatory", "Authorized signatory"],
        ].map(([key, label]) => (
          <Field key={key} label={label}>
            <input className={inputClass} value={form[key] || ""} onChange={(e) => set(key, e.target.value)} />
          </Field>
        ))}
        <Field label="FY start month (1-12)">
          <input
            type="number"
            min={1}
            max={12}
            className={inputClass}
            value={form.financialYearStartMonth}
            onChange={(e) => set("financialYearStartMonth", e.target.value)}
          />
        </Field>
        <Field label="LOS charging policy">
          <select
            className={inputClass}
            value={form.losChargingPolicy}
            onChange={(e) => set("losChargingPolicy", e.target.value)}
          >
            <option value="CALENDAR_DAY">Calendar day (inclusive)</option>
            <option value="CALENDAR_DAY_EXCLUSIVE">Calendar day (exclude discharge day)</option>
            <option value="HOURS_24">24-hour blocks</option>
            <option value="CUSTOM">Custom / hospital policy</option>
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="Declaration text">
            <textarea
              className={`${inputClass} min-h-[72px]`}
              value={form.declarationText || ""}
              onChange={(e) => set("declarationText", e.target.value)}
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Default invoice notes">
            <textarea
              className={`${inputClass} min-h-[72px]`}
              value={form.defaultNotes || ""}
              onChange={(e) => set("defaultNotes", e.target.value)}
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Invoice footer">
            <textarea
              className={`${inputClass} min-h-[56px]`}
              value={form.invoiceFooter || ""}
              onChange={(e) => set("invoiceFooter", e.target.value)}
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <button type="submit" className={buttonPrimaryClass}>
            Save hospital settings
          </button>
        </div>
      </form>
    </PageShell>
  );
}
