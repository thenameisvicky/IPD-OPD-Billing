import { FormEvent, useEffect, useState } from "react";
import dayjs from "dayjs";
import { DataTable } from "../../components/common/dataTable";
import { formatDateTime, formatInr, healthcareApi } from "../../api/healthcare";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  Field,
  Fill,
  inputClass,
  PageShell,
  ScrollArea,
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
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [patientQuery, setPatientQuery] = useState("");
  const [form, setForm] = useState({
    patientId: "",
    departmentId: "",
    practitionerId: "",
    bedId: "",
    primaryDiagnosis: "",
    diagnosisCode: "",
    procedureInfo: "",
  });
  const [chargeForm, setChargeForm] = useState({
    description: "",
    category: "OTHER",
    unit: "LUMP_SUM",
    rate: "",
    quantity: "1",
  });
  const [services, setServices] = useState<any[]>([]);

  const loadAdmissions = async () => {
    const res = await healthcareApi.listAdmissions({
      pageSize: 100,
      status: "ADMITTED,BILLING",
    });
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
    const res = await healthcareApi.searchPatients({ q: patientQuery });
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
    });
    if (!res.ok) {
      setError(res.message || "Failed to create admission");
      return;
    }
    setMessage(`Created admission ${res.data.ipNumber}`);
    setCreateOpen(false);
    await loadAdmissions();
    healthcareApi.listAvailableBeds().then((r) => r.ok && setBeds(r.data || []));
  };

  const openAdmission = async (id: string) => {
    const res = await healthcareApi.getAdmission(id);
    if (res.ok) setDetail(res.data);
  };

  const discharge = async () => {
    if (!detail) return;
    if (!confirm("Record discharge and move admission to billing?")) return;
    const res = await healthcareApi.dischargeAdmission(detail.id);
    if (!res.ok) {
      setError(res.message || "Discharge failed");
      return;
    }
    setMessage(`Discharged ${res.data.ipNumber}`);
    await openAdmission(detail.id);
    await loadAdmissions();
  };

  const addCharge = async (event: FormEvent) => {
    event.preventDefault();
    if (!detail) return;
    const res = await healthcareApi.addCharge({
      admissionId: detail.id,
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
    setChargeForm({ description: "", category: "OTHER", unit: "LUMP_SUM", rate: "", quantity: "1" });
    await openAdmission(detail.id);
  };

  return (
    <PageShell
      actions={
        <div className="flex gap-2">
          <button type="button" className={buttonSecondaryClass} onClick={loadAdmissions}>
            Refresh
          </button>
          <button type="button" className={buttonPrimaryClass} onClick={() => setCreateOpen(true)}>
            New admission
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

      <div className="shrink-0 text-[13px] font-semibold text-slate-600">
        {admissions.length} active admission{admissions.length === 1 ? "" : "s"}
      </div>

      <Fill>
        <DataTable
          data={{
            columns: [
              "IP No",
              "Patient",
              "UHID",
              "Admitted",
              "Dept / Doctor",
              "Room / Bed",
              "Invoice",
              "Advance",
              "Draft charges",
              "Status",
            ],
            rows: admissions.map((a) => [
              a.ipNumber,
              a.patientName,
              a.uhid,
              a.admittedAt ? dayjs(a.admittedAt).format("DD-MMM-YYYY HH:mm") : "—",
              [a.department, a.practitioner].filter(Boolean).join(" / ") || "—",
              [a.room, a.bed].filter(Boolean).join(" / ") || "—",
              a.latestInvoice?.number || "—",
              formatInr(a.advanceBalance),
              formatInr(a.draftChargesTotal),
              <StatusPill
                key={a.id}
                value={a.status}
                tone={
                  a.status === "DISCHARGED" ? "slate" : a.status === "BILLING" ? "amber" : "emerald"
                }
              />,
            ]),
            rawItems: admissions,
          }}
          onOpen={(item) => openAdmission(item.id)}
          actionVariant="buttons"
        />
      </Fill>

      {detail && (
        <div className="flex max-h-[42vh] min-h-0 shrink-0 flex-col overflow-hidden border border-slate-300 bg-white">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
            <div>
              <h3 className="text-[16px] font-bold">
                {detail.ipNumber} — {detail.patient?.displayName}
              </h3>
              <p className="text-[14px] font-semibold text-slate-600">
                Admitted {formatDateTime(detail.admittedAt)} · LOS {detail.lengthOfStayDays} days ·{" "}
                {detail.status}
                {detail.invoices?.[0] ? ` · Invoice ${detail.invoices[0].number}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              {detail.status === "ADMITTED" && (
                <button type="button" className={buttonSecondaryClass} onClick={discharge}>
                  Record discharge
                </button>
              )}
              <button type="button" className={buttonSecondaryClass} onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
          </div>

          <ScrollArea className="p-3">
            <div className="mb-2 h-40 min-h-0">
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
            </div>

            <form onSubmit={addCharge} className="mt-3 grid gap-2 border border-slate-200 p-2 lg:grid-cols-5">
              <input
                required
                className={inputClass}
                placeholder="Charge description"
                value={chargeForm.description}
                onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })}
              />
              <select
                className={inputClass}
                value={chargeForm.category}
                onChange={(e) => setChargeForm({ ...chargeForm, category: e.target.value })}
              >
                {["ROOM_RENT", "NURSING", "TREATING_DOCTOR", "PROCEDURE", "PHARMACY", "LABORATORY", "OTHER"].map(
                  (c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ),
                )}
              </select>
              <input
                required
                className={inputClass}
                placeholder="Rate"
                value={chargeForm.rate}
                onChange={(e) => setChargeForm({ ...chargeForm, rate: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder="Qty"
                value={chargeForm.quantity}
                onChange={(e) => setChargeForm({ ...chargeForm, quantity: e.target.value })}
              />
              <button type="submit" className={buttonPrimaryClass}>
                Add charge
              </button>
            </form>

            <div className="mt-2 max-h-28 space-y-1 overflow-auto">
              {services.slice(0, 12).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="flex w-full items-center justify-between border border-slate-200 px-2 py-1 text-left text-[13px] font-semibold hover:bg-slate-50"
                  onClick={async () => {
                    await healthcareApi.addCharge({
                      admissionId: detail.id,
                      serviceItemId: s.id,
                      description: s.name,
                      category: s.category,
                      unit: s.unit,
                      rate: s.currentRate || "0",
                      quantity: s.unit === "PER_DAY" ? String(detail.lengthOfStayDays || 1) : "1",
                      days: s.unit === "PER_DAY" ? String(detail.lengthOfStayDays || 1) : null,
                    });
                    await openAdmission(detail.id);
                  }}
                >
                  <span>{s.name}</span>
                  <span>{formatInr(s.currentRate)}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <form
            onSubmit={createAdmission}
            className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-auto border border-slate-300 bg-white p-4 shadow-xl"
          >
            <h2 className="text-[16px] font-bold uppercase tracking-[0.12em]">New admission</h2>
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
            <Field label="Consultant">
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
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={buttonSecondaryClass}
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className={buttonPrimaryClass}>
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  );
}
