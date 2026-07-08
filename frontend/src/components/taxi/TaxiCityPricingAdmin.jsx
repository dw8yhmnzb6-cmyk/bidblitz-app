import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

const CITY_PRESETS = [
  { city: "Prishtina", key: "prishtina", region: "Kosovo" },
  { city: "Prizren", key: "prizren", region: "Kosovo" },
  { city: "Peja", key: "peja", region: "Kosovo" },
  { city: "Hamburg", key: "hamburg", region: "Deutschland" },
  { city: "Berlin", key: "berlin", region: "Deutschland" },
  { city: "Dubai", key: "dubai", region: "VAE" },
];

const defaultForm = {
  city: "Prishtina",
  region: "Kosovo",
  base_fare: "2.00",
  per_km: "1.10",
  per_minute: "0.18",
  min_fare: "3.50",
  airport_fixed_standard: "15.00",
  airport_fixed_premium: "20.00",
  airport_fixed_van: "24.00",
};

export const TaxiCityPricingAdmin = ({ api, panelBg, panelBorder }) => {
  const [savedCities, setSavedCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await Promise.all(
        CITY_PRESETS.map(async (preset) => {
          const data = await api(`/api/taxi/city-defaults/${encodeURIComponent(preset.key)}`);
          return {
            ...preset,
            default: data.default || null,
          };
        })
      );
      setSavedCities(rows);
    } catch (e) {
      toast.error(e.message);
    }
    setLoading(false);
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const activePreset = useMemo(
    () => CITY_PRESETS.find((item) => item.city === form.city) || CITY_PRESETS[0],
    [form.city]
  );

  const saveCityPricing = async () => {
    setSaving(true);
    try {
      await api("/api/taxi/city-defaults", {
        method: "POST",
        body: JSON.stringify({
          city: activePreset.key,
          options: {
            city_label: form.city,
            region_label: form.region,
            pricing: {
              base_fare: parseFloat(form.base_fare),
              per_km: parseFloat(form.per_km),
              per_minute: parseFloat(form.per_minute),
              min_fare: parseFloat(form.min_fare),
            },
            airport_fixed_fares: {
              standard: parseFloat(form.airport_fixed_standard),
              premium: parseFloat(form.airport_fixed_premium),
              van: parseFloat(form.airport_fixed_van),
            },
          },
        }),
      });
      toast.success("Stadt-Preis gespeichert");
      await load();
    } catch (e) {
      toast.error(e.message);
    }
    setSaving(false);
  };

  const clearCityPricing = async (cityKey) => {
    if (!window.confirm("Preisprofil für diese Stadt entfernen?")) return;
    try {
      await api(`/api/taxi/city-defaults/${encodeURIComponent(cityKey)}`, { method: "DELETE" });
      toast.success("Stadt-Profil entfernt");
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4" data-testid="taxi-city-pricing-admin">
      <div>
        <p className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Städte & Regionen</p>
        <p className="text-[11px] text-white/40 mt-1">
          Lege Preise pro Stadt / Region fest. Beispiel: Hamburg anders als Berlin, Prishtina anders als Prizren.
        </p>
      </div>

      <div className="rounded-2xl p-4 space-y-3" style={{ background: panelBg, border: panelBorder }} data-testid="taxi-city-pricing-form">
        <div className="grid grid-cols-2 gap-2">
          <select
            value={form.city}
            onChange={(e) => {
              const preset = CITY_PRESETS.find((item) => item.city === e.target.value);
              setForm((prev) => ({ ...prev, city: e.target.value, region: preset?.region || prev.region }));
            }}
            data-testid="taxi-city-select"
            className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white"
          >
            {CITY_PRESETS.map((preset) => (
              <option key={preset.key} value={preset.city}>{preset.city}</option>
            ))}
          </select>
          <input
            value={form.region}
            onChange={(e) => update("region", e.target.value)}
            data-testid="taxi-region-input"
            placeholder="Region"
            className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input value={form.base_fare} onChange={(e) => update("base_fare", e.target.value)} data-testid="taxi-city-base-fare" placeholder="Grundpreis" className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white" />
          <input value={form.min_fare} onChange={(e) => update("min_fare", e.target.value)} data-testid="taxi-city-min-fare" placeholder="Mindestpreis" className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={form.per_km} onChange={(e) => update("per_km", e.target.value)} data-testid="taxi-city-per-km" placeholder="€/km" className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white" />
          <input value={form.per_minute} onChange={(e) => update("per_minute", e.target.value)} data-testid="taxi-city-per-minute" placeholder="€/min" className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white" />
        </div>

        <div>
          <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2">Flughafen-Festpreise</p>
          <div className="grid grid-cols-3 gap-2">
            <input value={form.airport_fixed_standard} onChange={(e) => update("airport_fixed_standard", e.target.value)} data-testid="taxi-airport-standard" placeholder="Standard" className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white" />
            <input value={form.airport_fixed_premium} onChange={(e) => update("airport_fixed_premium", e.target.value)} data-testid="taxi-airport-premium" placeholder="Premium" className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white" />
            <input value={form.airport_fixed_van} onChange={(e) => update("airport_fixed_van", e.target.value)} data-testid="taxi-airport-van" placeholder="Van" className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-sm text-white" />
          </div>
        </div>

        <button
          onClick={saveCityPricing}
          disabled={saving}
          data-testid="taxi-city-pricing-save"
          className="w-full py-2.5 rounded-xl bg-[#FFD600] text-black text-[12px] font-black inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Stadt-Preis speichern
        </button>
      </div>

      {loading ? (
        <Loader2 className="animate-spin text-white/40 mx-auto my-8" />
      ) : (
        <div className="space-y-3">
          {savedCities.map((item) => {
            const pricing = item.default?.options?.pricing;
            const airport = item.default?.options?.airport_fixed_fares;
            return (
              <div key={item.key} className="rounded-2xl p-4" style={{ background: panelBg, border: panelBorder }} data-testid={`taxi-city-row-${item.key}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin size={13} className="text-[#FFD600] shrink-0" />
                      <p className="text-[14px] font-bold text-white truncate">{item.city}</p>
                    </div>
                    <p className="text-[11px] text-white/50">{item.region}</p>
                    {pricing ? (
                      <div className="mt-2 text-[11px] text-white/70 space-y-1">
                        <p>€{Number(pricing.base_fare || 0).toFixed(2)} Grundpreis · €{Number(pricing.per_km || 0).toFixed(2)}/km · €{Number(pricing.per_minute || 0).toFixed(2)}/min</p>
                        <p>Mindestpreis €{Number(pricing.min_fare || 0).toFixed(2)}</p>
                        {airport ? <p>Flughafen: Std €{Number(airport.standard || 0).toFixed(2)} · Prem €{Number(airport.premium || 0).toFixed(2)} · Van €{Number(airport.van || 0).toFixed(2)}</p> : null}
                      </div>
                    ) : (
                      <p className="mt-2 text-[11px] text-white/35">Noch kein eigenes Preisprofil gespeichert.</p>
                    )}
                  </div>
                  {item.default ? (
                    <button onClick={() => clearCityPricing(item.key)} data-testid={`taxi-city-delete-${item.key}`} className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 inline-flex items-center justify-center shrink-0">
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
