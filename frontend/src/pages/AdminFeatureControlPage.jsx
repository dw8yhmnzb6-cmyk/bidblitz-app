import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, Search, Settings2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { api } from "../services/api";

function Pill({ value, testId }) {
  const tone = String(value || "").toLowerCase();
  const classes = tone === "enabled" ? "border-emerald-400/30 bg-emerald-400/12 text-emerald-100" : tone === "disabled" ? "border-rose-400/30 bg-rose-400/12 text-rose-100" : tone === "maintenance" ? "border-amber-400/30 bg-amber-400/12 text-amber-100" : "border-cyan-400/30 bg-cyan-400/12 text-cyan-100";
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${classes}`} data-testid={testId}>{value}</span>;
}

export default function AdminFeatureControlPage({ onBack }) {
  const [data, setData] = useState({ features: [], presets: {}, audit: [] });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const result = await api.getFeatureControlAdmin();
      setData(result || { features: [], presets: {}, audit: [] });
    } catch (error) {
      toast.error(error.message || "Feature Control konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return data.features || [];
    return (data.features || []).filter((item) => [item.key, item.name, item.description, item.type].join(" ").toLowerCase().includes(term));
  }, [data.features, query]);

  const toggleStatus = async (feature, mode) => {
    try {
      if (mode === "enabled") await api.enableFeatureControlItem(feature.key);
      if (mode === "disabled") await api.disableFeatureControlItem(feature.key);
      if (mode === "maintenance") await api.maintenanceFeatureControlItem(feature.key, { reason: "admin_feature_control" });
      toast.success("Feature aktualisiert.");
      await load();
    } catch (error) {
      toast.error(error.message || "Feature konnte nicht aktualisiert werden.");
    }
  };

  const runBulk = async (action) => {
    if (!selected.length) return toast.error("Bitte zuerst Features auswählen.");
    try {
      await api.bulkFeatureControlAction({ keys: selected, action, reason: "admin_bulk_action" });
      toast.success("Bulk-Aktion ausgeführt.");
      setSelected([]);
      await load();
    } catch (error) {
      toast.error(error.message || "Bulk-Aktion fehlgeschlagen.");
    }
  };

  const applyPreset = async (preset) => {
    try {
      await api.applyFeatureControlPreset({ preset });
      toast.success(`Preset ${preset} angewendet.`);
      await load();
    } catch (error) {
      toast.error(error.message || "Preset konnte nicht angewendet werden.");
    }
  };

  if (loading) return <div className="min-h-screen bg-[#030507]" data-testid="admin-feature-control-loading" />;

  return (
    <div className="min-h-screen bg-[#030507] px-4 py-5 sm:px-5 lg:px-8" data-testid="admin-feature-control-page">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid="admin-feature-control-back-button"><ArrowLeft size={18} /></button>
            <div>
              <h1 className="text-3xl font-black text-white">Feature Control Center</h1>
              <p className="text-sm text-white/62">Module, Routen, Funktionen, Kategorien und Produkte zentral ohne Codeänderung steuern.</p>
            </div>
          </div>
          <Button onClick={load} variant="outline" className="border-white/10 bg-white/5 text-white" data-testid="admin-feature-control-refresh-button"><RefreshCw size={16} className="mr-2" />Neu laden</Button>
        </div>

        <section className="rounded-[28px] border border-white/10 bg-white/5 p-5" data-testid="admin-feature-control-toolbar">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <label className="flex items-center gap-3 rounded-full border border-white/10 bg-[#071019] px-4 py-3 text-white" data-testid="admin-feature-control-search-box">
              <Search size={16} className="text-white/44" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Feature suchen…" className="w-full bg-transparent text-sm outline-none placeholder:text-white/32" data-testid="admin-feature-control-search-input" />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => runBulk("enable")} className="bg-emerald-500 text-black" data-testid="admin-feature-control-bulk-enable-button">Enable selected</Button>
              <Button onClick={() => runBulk("disable")} variant="outline" className="border-white/10 bg-white/5 text-white" data-testid="admin-feature-control-bulk-disable-button">Disable selected</Button>
              <Button onClick={() => runBulk("maintenance")} variant="outline" className="border-white/10 bg-white/5 text-white" data-testid="admin-feature-control-bulk-maintenance-button">Maintenance selected</Button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.keys(data.presets || {}).map((preset) => (
              <button key={preset} onClick={() => applyPreset(preset)} className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-100" data-testid={`admin-feature-control-preset-${preset}`}>
                {preset}
              </button>
            ))}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <section className="rounded-[28px] border border-white/10 bg-white/5 p-5" data-testid="admin-feature-control-list-section">
            <div className="space-y-3">
              {filtered.map((feature, index) => {
                const checked = selected.includes(feature.key);
                return (
                  <div key={feature.key} className="rounded-[22px] border border-white/10 bg-[#071019] p-4" data-testid={`admin-feature-control-feature-${index + 1}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={checked} onChange={() => setSelected((current) => checked ? current.filter((item) => item !== feature.key) : [...current, feature.key])} className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent" data-testid={`admin-feature-control-checkbox-${index + 1}`} />
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#82E7FF]">
                            <span>{feature.type}</span>
                            <span>•</span>
                            <span>{feature.key}</span>
                            {feature.parent_key ? <><span>•</span><span>{feature.parent_key}</span></> : null}
                          </div>
                          <h2 className="mt-2 text-lg font-black text-white">{feature.name}</h2>
                          <p className="mt-2 text-sm text-white/62">{feature.description || "Keine Beschreibung"}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/52">
                            <span>Plattformen: {(feature.platforms || []).join(", ") || "-"}</span>
                            <span>Rollen: {(feature.roles || []).join(", ") || "-"}</span>
                            <span>Länder: {(feature.countries || []).join(", ") || "ALL"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Pill value={feature.status} testId={`admin-feature-control-status-${index + 1}`} />
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => toggleStatus(feature, "enabled")} className="rounded-full border border-emerald-400/30 bg-emerald-400/12 px-3 py-2 text-xs font-bold text-emerald-100" data-testid={`admin-feature-control-enable-${index + 1}`}>Enable</button>
                          <button onClick={() => toggleStatus(feature, "disabled")} className="rounded-full border border-rose-400/30 bg-rose-400/12 px-3 py-2 text-xs font-bold text-rose-100" data-testid={`admin-feature-control-disable-${index + 1}`}>Disable</button>
                          <button onClick={() => toggleStatus(feature, "maintenance")} className="rounded-full border border-amber-400/30 bg-amber-400/12 px-3 py-2 text-xs font-bold text-amber-100" data-testid={`admin-feature-control-maintenance-${index + 1}`}>Maintenance</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5" data-testid="admin-feature-control-summary-card">
              <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-[#06B6D4]/12 bg-[#06B6D4]/10 text-[#9BE8FF]"><Settings2 size={18} /></div><div><h2 className="text-xl font-black text-white">Steuerung</h2><p className="text-sm text-white/58">Hierarchie von Modul bis Produkt.</p></div></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SummaryCard label="Features" value={data.features?.length || 0} testId="admin-feature-control-summary-total" />
                <SummaryCard label="Ausgewählt" value={selected.length} testId="admin-feature-control-summary-selected" />
                <SummaryCard label="Presets" value={Object.keys(data.presets || {}).length} testId="admin-feature-control-summary-presets" />
                <SummaryCard label="Audit Events" value={data.audit?.length || 0} testId="admin-feature-control-summary-audit" />
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5" data-testid="admin-feature-control-audit-card">
              <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-[#06B6D4]/12 bg-[#06B6D4]/10 text-[#9BE8FF]"><ShieldCheck size={18} /></div><div><h2 className="text-xl font-black text-white">Audit</h2><p className="text-sm text-white/58">Wer hat wann etwas geändert.</p></div></div>
              <div className="mt-4 space-y-3">
                {(data.audit || []).slice(0, 16).map((entry, index) => (
                  <div key={`${entry.audit_id}-${index}`} className="rounded-[20px] border border-white/10 bg-[#071019] p-4" data-testid={`admin-feature-control-audit-row-${index + 1}`}>
                    <div className="text-sm font-black text-white">{entry.key}</div>
                    <div className="mt-2 text-xs text-white/52">{entry.changed_by} • {entry.changed_at}</div>
                    <div className="mt-2 text-xs text-[#82E7FF]">{entry.reason || "ohne Grund"}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, testId }) {
  return <div className="rounded-[22px] border border-white/10 bg-[#071019] p-4" data-testid={testId}><div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#82E7FF]">{label}</div><div className="mt-3 text-2xl font-black text-white">{value}</div></div>;
}