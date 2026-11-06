import { FormEvent, useEffect, useState } from "react";
import { DataTable } from "../../components/common/dataTable";
import { healthcareApi } from "../../api/healthcare";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  Field,
  inputClass,
  PageShell,
} from "../../components/hospital/PageShell";

const emptyForm = {
  firstName: "",
  lastName: "",
  age: "",
  gender: "MALE",
  phone: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
};

export default function PatientRegistrationPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async (q = query) => {
    setLoading(true);
    const res = await healthcareApi.searchPatients(q);
    setLoading(false);
    if (!res.ok) {
      setError(res.message || "Search failed");
      return;
    }
    setError("");
    setPatients(res.data || []);
  };

  useEffect(() => {
    load("");
  }, []);

  const registerPatient = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const res = await healthcareApi.createPatient({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim() || null,
      ageYears: Number(form.age),
      sex: form.gender,
      phone: form.phone.trim(),
      addressLine1: form.address.trim(),
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      pincode: form.pincode.trim() || null,
    });
    if (!res.ok) {
      setError(res.message || "Registration failed");
      return;
    }
    setMessage(`Registered ${res.data.displayName} as ${res.data.uhid}`);
    setForm(emptyForm);
    await load(query);
  };

  return (
    <PageShell
      title="Patient Registration"
      subtitle="Search by UHID / name / phone, or register a new patient"
      actions={
        <div className="flex gap-2">
          <input
            className={`${inputClass} w-64`}
            placeholder="Search UHID, name, phone"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") load(query);
            }}
          />
          <button type="button" className={buttonSecondaryClass} onClick={() => load(query)}>
            Search
          </button>
        </div>
      }
    >
      <div className="grid h-full min-h-0 grid-cols-1 gap-3 xl:grid-cols-[380px_1fr]">
        <form onSubmit={registerPatient} className="space-y-3 border border-slate-300 bg-white p-3">
          <h2 className="text-[16px] font-bold uppercase tracking-[0.14em] text-slate-800">
            New patient
          </h2>
          {message && (
            <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[16px] font-bold text-emerald-800">
              {message}
            </div>
          )}
          {error && (
            <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-[16px] font-bold text-rose-700">
              {error}
            </div>
          )}
          <Field label="First name">
            <input
              required
              className={inputClass}
              value={form.firstName}
              onChange={(event) => setForm({ ...form, firstName: event.target.value })}
            />
          </Field>
          <Field label="Last name">
            <input
              className={inputClass}
              value={form.lastName}
              onChange={(event) => setForm({ ...form, lastName: event.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Age">
              <input
                required
                type="number"
                min={0}
                className={inputClass}
                value={form.age}
                onChange={(event) => setForm({ ...form, age: event.target.value })}
              />
            </Field>
            <Field label="Gender">
              <select
                className={inputClass}
                value={form.gender}
                onChange={(event) => setForm({ ...form, gender: event.target.value })}
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
            </Field>
          </div>
          <Field label="Phone">
            <input
              required
              className={inputClass}
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </Field>
          <Field label="Address">
            <textarea
              className={`${inputClass} min-h-[72px]`}
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
            />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="City">
              <input
                className={inputClass}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </Field>
            <Field label="State">
              <input
                className={inputClass}
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
            </Field>
            <Field label="PIN">
              <input
                className={inputClass}
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={buttonPrimaryClass}>
              Register patient
            </button>
            <button
              type="button"
              className={buttonSecondaryClass}
              onClick={() => {
                setForm(emptyForm);
                setMessage("");
              }}
            >
              Clear
            </button>
          </div>
        </form>

        <div className="min-h-0">
          {loading ? (
            <div className="p-3 text-[15px] font-semibold text-slate-600">Searching…</div>
          ) : (
            <DataTable
              data={{
                columns: ["UHID", "Name", "Age", "Gender", "Phone", "Address"],
                rows: patients.map((patient) => [
                  patient.uhid,
                  patient.name,
                  patient.age ?? "—",
                  patient.sex,
                  patient.phone || "—",
                  patient.address || "—",
                ]),
                rawItems: patients,
              }}
            />
          )}
        </div>
      </div>
    </PageShell>
  );
}
