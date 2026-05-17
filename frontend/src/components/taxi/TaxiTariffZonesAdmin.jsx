import { useCallback, useEffect, useState } from "react";
import { Loader2, MapPin, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

const initialForm = {
  name: "",
  center_lat: "52.52",
  center_lng: "13.405",
  radius_km: "15",
  base_fare: "3.5",
  per_km: "1.8",
  per_min: "0.3",
  night_multiplier: "1.2",
  weekend_multiplier: "1.15",
};

export const TaxiTariffZonesAdmin = ({ api, panelBg, panelBorder }) => {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api("/api/taxi/tariff-zones");
      setZones(data.items || []);
    } catch (e) {
      toast.error(e.message);
    }
    setLoading(false);
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const createZone = async () => {
    if (!form.name.trim()) {
      toast.error("Name fehlt");
      return;
    }
    setSaving(true);
    try {
      await api("/api/taxi/admin/tariff-zones", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          center_lat: parseFloat(form.center_lat),
          center_lng: parseFloat(form.center_lng),
          radius_km: parseFloat(form.radius_km),
          base_fare: parseFloat(form.base_fare),
          per_km: parseFloat(form.per_km),
          per_min: parseFloat(form.per_min),
          night_multiplier: parseFloat(form.night_multiplier),
          weekend_multiplier: parseFloat(form.weekend_multiplier),
        }),
      });
      toast.success("Zone angelegt");
      setForm(initialForm);
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(e.message);
    }
    setSaving(false);
  };

  const deleteZone = async (zoneId) => {
    if (!window.confirm("Zone deaktivieren?")) return;
    try {
      await api(`/api/taxi/admin/tariff-zones/${zoneId}`, { method: "DELETE" });
      toast.success("Zone entfernt");
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-3" data-testid="taxi-zones-admin">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Tarif-Zonen</p>
          <p className="text-[11px] text-white/40">{zones.length} aktive Zonen</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          data-testid="taxi-zones-toggle-form"
          className="px-3 py-2 rounded-xl bg-[#00C2FF]/15 border border-[#00C2FF]/25 text-[#00C2FF] text-[11px] font-bold inline-flex items-center gap-1.5"
        >
          <Plus size={12} /> Neue Zone
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: panelBg, border: panelBorder }} data-testid="taxi-zones-form">
          <input value={form.name} onChange={(e) => update("name", e.target.value)} data-testid="taxi-zone-form-name"
            placeholder="z.B. Berlin Innenstadt" className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white" />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.center_lat} onChange={(e) => update("center_lat", e.target.value)} data-testid="taxi-zone-form-center-lat"
              placeholder="Breitengrad" className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white" />
            <input value={form.center_lng} onChange={(e) => update("center_lng", e.target.value)} data-testid="taxi-zone-form-center-lng"
              placeholder="Längengrad" className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input value={form.radius_km} onChange={(e) => update("radius_km", e.target.value)} data-testid="taxi-zone-form-radius"
              placeholder="Radius km" className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white" />
            <input value={form.base_fare} onChange={(e) => update("base_fare", e.target.value)} data-testid="taxi-zone-form-base-fare"
              placeholder="Grundpreis" className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white" />
            <input value={form.per_km} onChange={(e) => update("per_km", e.target.value)} data-testid="taxi-zone-form-per-km"
              placeholder="€/km" className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input value={form.per_min} onChange={(e) => update("per_min", e.target.value)} data-testid="taxi-zone-form-per-min"
              placeholder="€/min" className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white" />
            <input value={form.night_multiplier} onChange={(e) => update("night_multiplier", e.target.value)} data-testid="taxi-zone-form-night-multiplier"
              placeholder="Nacht" className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white" />
            <input value={form.weekend_multiplier} onChange={(e) => update("weekend_multiplier", e.target.value)} data-testid="taxi-zone-form-weekend-multiplier"
              placeholder="Wochenende" className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white" />
          </div>
          <button onClick={createZone} disabled={saving} data-testid="taxi-zone-form-save"
            className="w-full py-2.5 rounded-xl bg-[#00C2FF] text-black text-[12px] font-black inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Speichern
          </button>
        </div>
      )}

      {loading ? <Loader2 className="animate-spin text-white/40 mx-auto my-8" /> : zones.map((zone) => (
        <div key={zone.id} className="rounded-2xl p-4" style={{ background: panelBg, border: panelBorder }} data-testid={`taxi-zone-row-${zone.id}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <MapPin size={13} className="text-[#00C2FF] shrink-0" />
                <p className="text-[14px] font-bold text-white truncate" data-testid={`taxi-zone-name-${zone.id}`}>{zone.name}</p>
              </div>
              <p className="text-[11px] text-white/50">
                {zone.center_lat?.toFixed?.(3) ?? zone.center_lat}, {zone.center_lng?.toFixed?.(3) ?? zone.center_lng} · Radius {zone.radius_km} km
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-white/70">
                <span data-testid={`taxi-zone-pricing-${zone.id}`}>€{Number(zone.base_fare || 0).toFixed(2)} Grundpreis · €{Number(zone.per_km || 0).toFixed(2)}/km · €{Number(zone.per_min || 0).toFixed(2)}/min</span>
                <span data-testid={`taxi-zone-multipliers-${zone.id}`}>Nacht ×{Number(zone.multipliers?.night_22_06 || 1).toFixed(2)} · Wochenende ×{Number(zone.multipliers?.weekend || 1).toFixed(2)}</span>
              </div>
            </div>
            <button onClick={() => deleteZone(zone.id)} data-testid={`taxi-zone-delete-${zone.id}`}
              className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 inline-flex items-center justify-center shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}

      {!loading && zones.length === 0 && (
        <div className="rounded-2xl p-6 text-center text-[12px] text-white/40" style={{ background: panelBg, border: panelBorder }} data-testid="taxi-zones-empty">
          Noch keine Tarif-Zonen angelegt.
        </div>
      )}
    </div>
  );
};