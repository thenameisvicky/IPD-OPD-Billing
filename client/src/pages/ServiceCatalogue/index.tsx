import { FormEvent, useEffect, useState } from "react";
import { DataTable } from "../../components/common/dataTable";
import { formatInr, healthcareApi } from "../../api/healthcare";
import {
  buttonPrimaryClass,
  Field,
  Fill,
  inputClass,
  PageShell,
  ScrollArea,
} from "../../components/hospital/PageShell";

export default function ServiceCataloguePage() {
  const [services, setServices] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    category: "OTHER",
    unit: "LUMP_SUM",
    standardRate: "",
  });
  const [tariffServiceId, setTariffServiceId] = useState("");
  const [newRate, setNewRate] = useState("");
  const [history, setHistory] = useState<any[]>([]);

  const load = async () => {
    const res = await healthcareApi.listServices();
    if (res.ok) setServices(res.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    const res = await healthcareApi.createService(form);
    if (!res.ok) {
      setError(res.message || "Create failed");
      return;
    }
    setMessage(`Created ${res.data.code}`);
    setForm({ code: "", name: "", category: "OTHER", unit: "LUMP_SUM", standardRate: "" });
    await load();
  };

  const viewTariffs = async (serviceId: string) => {
    setTariffServiceId(serviceId);
    const res = await healthcareApi.listTariffs(serviceId);
    if (res.ok) setHistory(res.data || []);
  };

  const addTariff = async (event: FormEvent) => {
    event.preventDefault();
    if (!tariffServiceId) return;
    const res = await healthcareApi.createTariff(tariffServiceId, { rate: newRate });
    if (!res.ok) {
      setError(res.message || "Tariff update failed");
      return;
    }
    setMessage(`Tariff v${res.data.version} created — historical invoices unchanged`);
    setNewRate("");
    await viewTariffs(tariffServiceId);
    await load();
  };

  return (
    <PageShell>
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
      <div className="grid min-h-0 flex-1 gap-2 overflow-hidden lg:grid-cols-[340px_1fr]">
        <ScrollArea className="border border-slate-300 bg-white p-3">
          <form onSubmit={create} className="space-y-2">
            <h2 className="text-[15px] font-bold uppercase">New service</h2>
            <Field label="Code">
              <input required className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </Field>
            <Field label="Name">
              <input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Category">
              <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {["ROOM_RENT","NURSING","TREATING_DOCTOR","PROCEDURE","PHARMACY","LABORATORY","RADIOLOGY","OTHER"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Unit">
              <select className={inputClass} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {["PER_DAY","PER_VISIT","LUMP_SUM","PER_ITEM","AS_BILLED"].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </Field>
            <Field label="Standard rate">
              <input required className={inputClass} value={form.standardRate} onChange={(e) => setForm({ ...form, standardRate: e.target.value })} />
            </Field>
            <button type="submit" className={buttonPrimaryClass}>Create service</button>
          </form>
        </ScrollArea>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <Fill>
            <DataTable
              data={{
                columns: ["Code", "Name", "Category", "Unit", "Current rate", "Ver"],
                rows: services.map((s) => [
                  s.code,
                  s.name,
                  s.category,
                  s.unit,
                  formatInr(s.currentRate),
                  s.tariffVersion ?? "—",
                ]),
                rawItems: services,
              }}
              onOpen={(item) => viewTariffs(item.id)}
              actionVariant="buttons"
            />
          </Fill>

          {tariffServiceId && (
            <div className="flex max-h-[36vh] min-h-0 shrink-0 flex-col overflow-hidden border border-slate-300 bg-white p-3">
              <form onSubmit={addTariff} className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                <h3 className="shrink-0 text-[15px] font-bold">Tariff history / new version</h3>
                <Fill>
                  <DataTable
                    data={{
                      columns: ["Version", "Rate", "Effective from", "Active"],
                      rows: history.map((t) => [
                        t.version,
                        formatInr(t.rate),
                        new Date(t.effectiveFrom).toLocaleDateString("en-IN"),
                        t.active ? "Yes" : "No",
                      ]),
                    }}
                  />
                </Fill>
                <div className="flex shrink-0 gap-2">
                  <input
                    required
                    className={inputClass}
                    placeholder="New rate"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                  />
                  <button type="submit" className={buttonPrimaryClass}>Add tariff version</button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
