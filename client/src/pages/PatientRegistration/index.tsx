import { FormEvent, useEffect, useState } from "react";
import dayjs from "dayjs";
import { DataTable } from "../../components/common/dataTable";
import { healthcareApi } from "../../api/healthcare";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  Field,
  inputClass,
  Fill,
  PageShell,
} from "../../components/hospital/PageShell";

const emptyForm = {
  firstName: "",
  lastName: "",
  age: "",
  gender: "MALE",
  phone: "",
  dob: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
};

const emptySearch = { name: "", phone: "", dob: "" };

export default function PatientRegistrationPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState(emptySearch);
  const [searchOpen, setSearchOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [filteredMode, setFilteredMode] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    const res = await healthcareApi.searchPatients({ pageSize: 100 });
    setLoading(false);
    if (!res.ok) {
      setError(res.message || "Failed to load patients");
      return;
    }
    setError("");
    setFilteredMode(false);
    setPatients(res.data || []);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const runSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!search.name && !search.phone && !search.dob) {
      setError("Enter at least one of Name, Phone, or DOB");
      return;
    }
    setLoading(true);
    setError("");
    const res = await healthcareApi.searchPatients({
      ...(search.name ? { name: search.name } : {}),
      ...(search.phone ? { phone: search.phone } : {}),
      ...(search.dob ? { dob: search.dob } : {}),
      pageSize: 100,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.message || "Search failed");
      return;
    }
    setPatients(res.data || []);
    setFilteredMode(true);
    setSearchOpen(false);
  };

  const registerPatient = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const res = await healthcareApi.createPatient({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim() || null,
      ageYears: form.age ? Number(form.age) : null,
      sex: form.gender,
      phone: form.phone.trim(),
      dob: form.dob ? new Date(`${form.dob}T00:00:00`).toISOString() : null,
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
    setRegisterOpen(false);
    await loadAll();
  };

  return (
    <PageShell
      actions={
        <div className="flex flex-wrap gap-2">
          {filteredMode && (
            <button type="button" className={buttonSecondaryClass} onClick={loadAll}>
              Show all
            </button>
          )}
          <button type="button" className={buttonSecondaryClass} onClick={() => setSearchOpen(true)}>
            Search
          </button>
          <button type="button" className={buttonPrimaryClass} onClick={() => setRegisterOpen(true)}>
            Register patient
          </button>
        </div>
      }
    >
      {message && (
        <div className="shrink-0 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[15px] font-bold text-emerald-800">
          {message}
        </div>
      )}
      {error && (
        <div className="shrink-0 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-[15px] font-bold text-rose-700">
          {error}
        </div>
      )}

      <Fill>
        {loading ? (
          <div className="p-3 text-[15px] font-semibold text-slate-600">Loading…</div>
        ) : (
          <DataTable
            data={{
              columns: ["UHID", "Name", "Age", "DOB", "Gender", "Phone", "Address"],
              rows: patients.map((patient) => [
                patient.uhid,
                patient.name,
                patient.age ?? "—",
                patient.dob ? dayjs(patient.dob).format("DD-MMM-YYYY") : "—",
                patient.sex,
                patient.phone || "—",
                patient.address || "—",
              ]),
              rawItems: patients,
            }}
          />
        )}
      </Fill>

      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <form
            onSubmit={runSearch}
            className="w-full max-w-md space-y-3 border border-slate-300 bg-white p-4 shadow-xl"
          >
            <h2 className="text-[16px] font-bold uppercase tracking-[0.12em]">Search patients</h2>
            <p className="text-[13px] font-semibold text-slate-600">
              Provide any one of Name, Phone, or Date of birth.
            </p>
            <Field label="Name">
              <input
                className={inputClass}
                value={search.name}
                onChange={(e) => setSearch({ ...search, name: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <input
                className={inputClass}
                value={search.phone}
                onChange={(e) => setSearch({ ...search, phone: e.target.value })}
              />
            </Field>
            <Field label="Date of birth">
              <input
                type="date"
                className={inputClass}
                value={search.dob}
                onChange={(e) => setSearch({ ...search, dob: e.target.value })}
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className={buttonSecondaryClass}
                onClick={() => setSearchOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className={buttonPrimaryClass}>
                Search
              </button>
            </div>
          </form>
        </div>
      )}

      {registerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <form
            onSubmit={registerPatient}
            className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-auto border border-slate-300 bg-white p-4 shadow-xl"
          >
            <h2 className="text-[16px] font-bold uppercase tracking-[0.12em]">Register patient</h2>
            <Field label="First name">
              <input
                required
                className={inputClass}
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </Field>
            <Field label="Last name">
              <input
                className={inputClass}
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Age">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                />
              </Field>
              <Field label="Gender">
                <select
                  className={inputClass}
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
            </div>
            <Field label="DOB">
              <input
                type="date"
                className={inputClass}
                value={form.dob}
                onChange={(e) => setForm({ ...form, dob: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <input
                required
                className={inputClass}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Address">
              <textarea
                className={`${inputClass} min-h-[72px]`}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={buttonSecondaryClass}
                onClick={() => setRegisterOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className={buttonPrimaryClass}>
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  );
}
