import { FormEvent, useEffect, useState } from "react";
import { DataTable } from "../../components/common/dataTable";
import { formatDateTime, formatInr, healthcareApi } from "../../api/healthcare";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  Field,
  inputClass,
  PageShell,
  StatusPill,
} from "../../components/hospital/PageShell";

export default function IpdAdmissionPage() {
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [practitioners, setPractitioners] = useState<any[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    patientId: "",
    departmentId: "",
    practitionerId: "",
    bedId: "",
    primaryDiagnosis: "",
    diagnosisCode: "",
    procedureInfo: "",
    policyholderName: "",
    insurerName: "",
    insuranceCardNo: "",
    policyNo: "",
  });
  const [patientQuery, setPatientQuery] = useState("");
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [chargeForm, setChargeForm] = useState({
    description: "",
    category: "OTHER",
    unit: "LUMP_SUM",
    rate: "",
    quantity: "1",
  });
  const [services, setServices] = useState<any[]>([]);

  const loadAdmissions = async () => {
    const res = await healthcareApi.listAdmissions({ pageSize: 50 });
    if (res.ok) setAdmissions(res.data || []);
  };

  useEffect(() => {
    loadAdmissions();
    healthcareApi.listDepartments().then((r) => r.ok && setDepartments(r.data || []));
    healthcareApi.listPractitioners().then((r) => r.ok && setPractitioners(r.data || []));
    healthcareApi.listAvailableBeds().then((r) => r.ok && setBeds(r.data || []));
    healthcareApi.listServices().then((r) => r.ok && setServices(r.data || []));
  }, []);

  const searchPatients = async () => {
    const res = await healthcareApi.searchPatients(patientQuery);
    if (res.ok) setPatients(res.data || []);
  };

  const createAdmission = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const res = await healthcareApi.createAdmission({
      patientId: form.patientId,
      departmentId: form.departmentId || null,
      practitionerId: form.practitionerId || null,
      bedId: form.bedId || null,
      primaryDiagnosis: form.primaryDiagnosis || null,
      diagnosisCode: form.diagnosisCode || null,
      procedureInfo: form.procedureInfo || null,
      policyholderName: form.policyholderName || null,
      insurerName: form.insurerName || null,
      insuranceCardNo: form.insuranceCardNo || null,
      policyNo: form.policyNo || null,
    });
    if (!res.ok) {
      setError(res.message || "Failed to create admission");
      return;
    }
    setMessage(`Created admission ${res.data.ipNumber}`);
    await loadAdmissions();
    healthcareApi.listAvailableBeds().then((r) => r.ok && setBeds(r.data || []));
  };

  const openAdmission = async (id: string) => {
    setSelectedAdmissionId(id);
    const res = await healthcareApi.getAdmission(id);
    if (res.ok) setDetail(res.data);
  };

  const discharge = async () => {
    if (!selectedAdmissionId) return;
    if (!confirm("Record discharge and move admission to billing?")) return;
    const res = await healthcareApi.dischargeAdmission(selectedAdmissionId);
    if (!res.ok) {
      setError(res.message || "Discharge failed");
      return;
    }
    setMessage(`Discharged ${res.data.ipNumber} — status BILLING`);
    await openAdmission(selectedAdmissionId);
    await loadAdmissions();
  };

  const addCharge = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedAdmissionId) return;
    const res = await healthcareApi.addCharge({
      admissionId: selectedAdmissionId,
      description: chargeForm.description,
      category: chargeForm.category,
      unit: chargeForm.unit,
      rate: chargeForm.rate,
      quantity: chargeForm.quantity,
      days: chargeForm.unit === "PER_DAY" ? chargeForm.quantity : null,
    });
    if (!res.ok) {
      setError(res.message || "Failed to add charge");
      return;
    }
    setMessage(`Added charge ${res.data.description}`);
    setChargeForm({ description: "", category: "OTHER", unit: "LUMP_SUM", rate: "", quantity: "1" });
    await openAdmission(selectedAdmissionId);
  };

  const addFromService = async (serviceId: string) => {
    if (!selectedAdmissionId) return;
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;
    const res = await healthcareApi.addCharge({
      admissionId: selectedAdmissionId,
      serviceItemId: service.id,
      description: service.name,
      category: service.category,
      unit: service.unit,
      rate: service.currentRate || "0",
      quantity: service.unit === "PER_DAY" ? String(detail?.lengthOfStayDays || 1) : "1",
      days: service.unit === "PER_DAY" ? String(detail?.lengthOfStayDays || 1) : null,
    });
    if (!res.ok) {
      setError(res.message || "Failed to add service charge");
      return;
    }
    setMessage(`Added ${service.name}`);
    await openAdmission(selectedAdmissionId);
  };

  return (
    <PageShell
      title="IPD Admission"
      subtitle="Admit patients, assign beds, accumulate charges"
      actions={
        <button type="button" className={buttonSecondaryClass} onClick={loadAdmissions}>
          Refresh
        </button>
      }
    >
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

      <div className="grid h-full min-h-0 grid-cols-1 gap-3 xl:grid-cols-[360px_1fr]">
        <form onSubmit={createAdmission} className="space-y-3 overflow-auto border border-slate-300 bg-white p-3">
          <h2 className="text-[16px] font-bold uppercase tracking-[0.14em]">New admission</h2>
          <Field label="Find patient">
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                placeholder="UHID / name / phone"
              />
              <button type="button" className={buttonSecondaryClass} onClick={searchPatients}>
                Go
              </button>
            </div>
          </Field>
          <Field label="Patient">
            <select
              required
              className={inputClass}
              value={form.patientId}
              onChange={(e) => setForm({ ...form, patientId: e.target.value })}
            >
              <option value="">Select patient</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.uhid} — {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Department">
            <select
              className={inputClass}
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            >
              <option value="">Select</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Treating consultant">
            <select
              className={inputClass}
              value={form.practitionerId}
              onChange={(e) => setForm({ ...form, practitionerId: e.target.value })}
            >
              <option value="">Select</option>
              {practitioners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Bed">
            <select
              className={inputClass}
              value={form.bedId}
              onChange={(e) => setForm({ ...form, bedId: e.target.value })}
            >
              <option value="">Assign later</option>
              {beds.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.room?.name} ({b.room?.category})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Primary diagnosis">
            <input
              className={inputClass}
              value={form.primaryDiagnosis}
              onChange={(e) => setForm({ ...form, primaryDiagnosis: e.target.value })}
            />
          </Field>
          <Field label="ICD-10">
            <input
              className={inputClass}
              value={form.diagnosisCode}
              onChange={(e) => setForm({ ...form, diagnosisCode: e.target.value })}
            />
          </Field>
          <Field label="Procedure">
            <input
              className={inputClass}
              value={form.procedureInfo}
              onChange={(e) => setForm({ ...form, procedureInfo: e.target.value })}
            />
          </Field>
          <button type="submit" className={buttonPrimaryClass}>
            Create admission
          </button>
        </form>

        <div className="flex min-h-0 flex-col gap-3 overflow-auto">
          <DataTable
            data={{
              columns: ["IP No", "Patient", "Status", "Room/Bed", "Advance", "Draft charges"],
              rows: admissions.map((a) => [
                a.ipNumber,
                a.patientName,
                <StatusPill key={a.id} value={a.status} tone={a.status === "BILLING" ? "amber" : "emerald"} />,
                [a.room, a.bed].filter(Boolean).join(" / ") || "—",
                formatInr(a.advanceBalance),
                formatInr(a.draftChargesTotal),
              ]),
              rawItems: admissions,
            }}
            onOpen={(item) => openAdmission(item.id)}
            actionVariant="buttons"
          />

          {detail && (
            <div className="border border-slate-300 bg-white p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[16px] font-bold">
                    {detail.ipNumber} — {detail.patient?.displayName}
                  </h3>
                  <p className="text-[14px] font-semibold text-slate-600">
                    Admitted {formatDateTime(detail.admittedAt)} · LOS {detail.lengthOfStayDays} days ·{" "}
                    {detail.status}
                  </p>
                </div>
                <div className="flex gap-2">
                  {detail.status === "ADMITTED" && (
                    <button type="button" className={buttonSecondaryClass} onClick={discharge}>
                      Record discharge
                    </button>
                  )}
                </div>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2 text-[14px] lg:grid-cols-4">
                <div>Draft charges: <strong>{formatInr(detail.totals?.draftCharges)}</strong></div>
                <div>Advance bal.: <strong>{formatInr(detail.totals?.advanceBalance)}</strong></div>
                <div>Diagnosis: <strong>{detail.primaryDiagnosis || "—"}</strong></div>
                <div>Bed: <strong>{detail.currentBed?.code || "Released"}</strong></div>
              </div>

              <h4 className="mb-2 text-[14px] font-bold uppercase">Charges</h4>
              <DataTable
                data={{
                  columns: ["Service", "Rate", "Qty", "Total", "Status"],
                  rows: (detail.charges || []).map((c: any) => [
                    c.description,
                    formatInr(c.rate),
                    String(c.quantity),
                    formatInr(c.lineTotal),
                    c.status,
                  ]),
                }}
              />

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <form onSubmit={addCharge} className="space-y-2 border border-slate-200 p-2">
                  <h4 className="text-[14px] font-bold uppercase">Add manual charge</h4>
                  <input
                    required
                    className={inputClass}
                    placeholder="Description"
                    value={chargeForm.description}
                    onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      className={inputClass}
                      value={chargeForm.category}
                      onChange={(e) => setChargeForm({ ...chargeForm, category: e.target.value })}
                    >
                      {[
                        "ROOM_RENT",
                        "NURSING",
                        "TREATING_DOCTOR",
                        "PROCEDURE",
                        "PHARMACY",
                        "LABORATORY",
                        "RADIOLOGY",
                        "OTHER",
                      ].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <select
                      className={inputClass}
                      value={chargeForm.unit}
                      onChange={(e) => setChargeForm({ ...chargeForm, unit: e.target.value })}
                    >
                      {["PER_DAY", "PER_VISIT", "LUMP_SUM", "PER_ITEM", "AS_BILLED"].map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    <input
                      required
                      className={inputClass}
                      placeholder="Rate"
                      value={chargeForm.rate}
                      onChange={(e) => setChargeForm({ ...chargeForm, rate: e.target.value })}
                    />
                  </div>
                  <button type="submit" className={buttonPrimaryClass}>
                    Add charge
                  </button>
                </form>

                <div className="border border-slate-200 p-2">
                  <h4 className="mb-2 text-[14px] font-bold uppercase">Add from catalogue</h4>
                  <div className="max-h-48 space-y-1 overflow-auto">
                    {services.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="flex w-full items-center justify-between border border-slate-200 px-2 py-1 text-left text-[13px] font-semibold hover:bg-slate-50"
                        onClick={() => addFromService(s.id)}
                      >
                        <span>{s.name}</span>
                        <span>{formatInr(s.currentRate)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
