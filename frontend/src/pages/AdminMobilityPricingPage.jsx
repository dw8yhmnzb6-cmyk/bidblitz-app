import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Bike, Car, Globe2, Loader2, MapPin, RefreshCw, Save, Trash2, Zap,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL || "";

const MODES = [
  ["taxi", "Taxi", Car],
  ["scooter", "E-Scooter", Zap],
  ["bike", "E-Bike", Bike],
  ["ev", "EV Drive", Zap],
  ["car_sharing", "Carsharing", Car],
  ["car_rental", "Mietwagen", Car],
  ["airport_shuttle", "Airport Shuttle", Car],
  ["vip", "VIP Chauffeur", Car],
];

const EMPTY_MODE = {
  base: "",
  per_km: "",
  per_min: "",
  minimum: "",
  booking_fee: "",
  daily_cap: "",
  min_balance: "",
  premium_multiplier: "",
  van_multiplier: "",
  range_per_km_low: "",
  range_per_km_high: "",
  range_per_min_low: "",
  range_per_min_high: "",
  basis: "",
  surge: false,
};

const emptyForm = () => ({
  country_code: "XK",
  city: "",
  region: "",
  currency: "EUR",
  source: "",
  enabled: true,
});

function modeToDraft(mode = {}) {
  const next = { ...EMPTY_MODE };
  Object.keys(next).forEach((key) => {
    if (key === "surge") next[key] = Boolean(mode[key]);
    else if (mode[key] !== undefined && mode[key] !== null) next[key] = String(mode[key]);
  });
  return next;
}

function draftToMode(draft) {
  const out = {};
  [
    "base", "per_km", "per_min", "minimum", "booking_fee", "daily_cap", "min_balance", "premium_multiplier", "van_multiplier",
    "range_per_km_low", "range_per_km_high", "range_per_min_low", "range_per_min_high",
  ].forEach((key) => {
    if (draft[key] !== "" && draft[key] !== null && draft[key] !== undefined) {
      out[key] = Number(draft[key]);
    }
  });
  if (draft.basis?.trim()) out.basis = draft.basis.trim();
  out.surge = Boolean(draft.surge);
  return out;
}

async function readJson(response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || data?.error || "Anfrage fehlgeschlagen");
  return data;
}

export default function AdminMobilityPricingPage({ onBack }) {
  const [profiles, setProfiles] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [modes, setModes] = useState({ taxi: { ...EMPTY_MODE } });
  const [activeMode, setActiveMode] = useState("taxi");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/mobility-platform/admin/pricing/profiles`, {
        credentials: "include",
      });
      const data = await readJson(res);
      setProfiles(data.profiles || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  const resetForm = () => {
    setForm(emptyForm());
    setModes({ taxi: { ...EMPTY_MODE } });
    setActiveMode("taxi");
    setNotice("");
    setError("");
  };

  const editProfile = (profile) => {
    setForm({
      country_code: profile.country_code || "",
      city: profile.city || "",
      region: profile.region || "",
      currency: profile.currency || "EUR",
      source: profile.source || "",
      enabled: profile.enabled !== false,
    });
    const nextModes = {};
    Object.entries(profile.modes || {}).forEach(([key, value]) => {
      nextModes[key] = modeToDraft(value);
    });
    if (!Object.keys(nextModes).length) nextModes.taxi = { ...EMPTY_MODE };
    setModes(nextModes);
    setActiveMode(Object.keys(nextModes)[0]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const addMode = (mode) => {
    setModes((prev) => ({ ...prev, [mode]: prev[mode] || { ...EMPTY_MODE } }));
    setActiveMode(mode);
  };

  const removeMode = (mode) => {
    setModes((prev) => {
      const next = { ...prev };
      delete next[mode];
      const remaining = Object.keys(next);
      if (!remaining.length) next.taxi = { ...EMPTY_MODE };
      setActiveMode(remaining[0] || "taxi");
      return next;
    });
  };

  const updateMode = (key, value) => {
    setModes((prev) => ({
      ...prev,
      [activeMode]: {
        ...(prev[activeMode] || { ...EMPTY_MODE }),
        [key]: value,
      },
    }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        ...form,
        country_code: form.country_code.trim().toUpperCase(),
        city: form.city.trim() || null,
        region: form.region.trim() || null,
        currency: form.currency.trim().toUpperCase(),
        source: form.source.trim(),
        modes: Object.fromEntries(
          Object.entries(modes).map(([key, value]) => [key, draftToMode(value)])
        ),
      };
      const res = await fetch(`${API}/api/mobility-platform/admin/pricing/profile`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await readJson(res);
      setNotice("Tarifprofil gespeichert.");
      await loadProfiles();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const disableProfile = async (profile) => {
    const label = profile.city || profile.country_code;
    if (!window.confirm(`Tarifprofil für ${label} deaktivieren?`)) return;
    setError("");
    try {
      const params = profile.city ? `?city=${encodeURIComponent(profile.city)}` : "";
      const res = await fetch(
        `${API}/api/mobility-platform/admin/pricing/profile/${encodeURIComponent(profile.country_code)}${params}`,
        { method: "DELETE", credentials: "include" },
      );
      await readJson(res);
      await loadProfiles();
    } catch (err) {
      setError(err.message);
    }
  };

  const activeDraft = modes[activeMode] || EMPTY_MODE;
  const activeModeMeta = useMemo(
    () => MODES.find(([key]) => key === activeMode) || MODES[0],
    [activeMode],
  );

  return (
    <div className="min-h-screen bg-[#05070A] pb-24 text-white" data-testid="admin-mobility-pricing-page">
      <div className="sticky top-0 z-40 border-b border-white/10 bg-[#080B10]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <button onClick={onBack} className="rounded-xl p-2 text-white/60 hover:bg-white/5" data-testid="admin-mobility-pricing-back">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">Mobility Tarife</h1>
            <p className="text-xs text-white/45">Land → Stadt → Transportart · Stadt überschreibt Land</p>
          </div>
          <button onClick={loadProfiles} className="rounded-xl border border-white/10 p-2 text-white/60" aria-label="Neu laden">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)]">
        <form onSubmit={saveProfile} className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5" data-testid="mobility-pricing-form">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">Tarifprofil</p>
              <p className="mt-1 text-sm text-white/50">Stadt leer lassen = Landestarif.</p>
            </div>
            <button type="button" onClick={resetForm} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/60">Neu</button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-white/50">
              Land (ISO)
              <input required maxLength={2} value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none" data-testid="pricing-country-input" />
            </label>
            <label className="text-xs text-white/50">
              Stadt
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="z. B. Prishtina" className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none" data-testid="pricing-city-input" />
            </label>
            <label className="text-xs text-white/50">
              Region/Landname
              <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="Kosovo" className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none" />
            </label>
            <label className="text-xs text-white/50">
              Währung
              <input required maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none" />
            </label>
          </div>

          <label className="block text-xs text-white/50">
            Quelle / Tarifbasis
            <input required value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="z. B. lokale Taxitarif-Verordnung" className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none" data-testid="pricing-source-input" />
          </label>

          <div>
            <p className="mb-2 text-xs font-semibold text-white/60">Transportarten</p>
            <div className="flex flex-wrap gap-2">
              {MODES.map(([key, label, Icon]) => {
                const included = Boolean(modes[key]);
                return (
                  <button key={key} type="button" onClick={() => addMode(key)}
                    className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${activeMode === key ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-300" : included ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-white/10 text-white/45"}`}>
                    <Icon size={13} />{label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 p-3" data-testid="pricing-mode-editor">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-semibold">
                {(() => { const Icon = activeModeMeta[2]; return <Icon size={16} className="text-emerald-400" />; })()}
                {activeModeMeta[1]}
              </div>
              {Object.keys(modes).length > 1 && (
                <button type="button" onClick={() => removeMode(activeMode)} className="inline-flex items-center gap-1 text-xs text-red-300">
                  <Trash2 size={13} /> Entfernen
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                ["base", "Startpreis"], ["per_km", "Preis / km"], ["per_min", "Preis / Min"],
                ["minimum", "Mindestpreis"], ["booking_fee", "Buchungsgebühr"],
                ["daily_cap", "Tageslimit"], ["min_balance", "Mindestguthaben"],
                ...(activeMode === "taxi" ? [["premium_multiplier", "Premium Faktor"], ["van_multiplier", "Van Faktor"]] : []),
                ["range_per_km_low", "km min"], ["range_per_km_high", "km max"],
                ["range_per_min_low", "Min min"], ["range_per_min_high", "Min max"],
              ].map(([key, label]) => (
                <label key={key} className="text-[11px] text-white/45">
                  {label}
                  <input type="number" min="0" step="0.01" value={activeDraft[key]} onChange={(e) => updateMode(key, e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/35 px-2.5 py-2.5 text-sm text-white outline-none" />
                </label>
              ))}
            </div>
            <label className="mt-3 block text-[11px] text-white/45">
              Beschreibung/Formel
              <input value={activeDraft.basis} onChange={(e) => updateMode("basis", e.target.value)} placeholder="z. B. 2,00 € Start + 0,60 €/km"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm text-white outline-none" />
            </label>
            <label className="mt-3 flex items-center gap-2 text-xs text-white/60">
              <input type="checkbox" checked={activeDraft.surge} onChange={(e) => updateMode("surge", e.target.checked)} />
              Dynamische Nachfrage-Multiplikation erlauben
            </label>
          </div>

          {error && <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200">{error}</div>}
          {notice && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs text-emerald-200">{notice}</div>}

          <button disabled={saving} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 font-bold text-black disabled:opacity-50" data-testid="pricing-save-btn">
            {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
            Tarifprofil speichern
          </button>
        </form>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5" data-testid="mobility-pricing-profile-list">
          <div className="mb-4 flex items-center gap-2">
            <Globe2 size={18} className="text-cyan-400" />
            <div>
              <h2 className="font-bold">Mobility Tarifprofile</h2>
              <p className="text-xs text-white/45">{profiles.length} Profile · Built-in + Overrides</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-cyan-400" /></div>
          ) : profiles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/40">Noch keine Tarifprofile verfügbar.</div>
          ) : (
            <div className="space-y-2">
              {profiles.map((profile) => (
                <div key={`${profile.country_code}:${profile.city_key}`} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => editProfile(profile)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="shrink-0 text-emerald-400" />
                        <span className="truncate text-sm font-bold">{profile.city || profile.region || profile.country_code}</span>
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] uppercase text-white/40">{profile.scope || (profile.city ? "city" : "country")}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${profile.source_type === "database" ? "bg-cyan-400/10 text-cyan-300" : "bg-emerald-400/10 text-emerald-300"}`} data-testid={`pricing-source-type-${profile.country_code}-${profile.city_key}`}>
                          {profile.source_type === "database" ? "Override" : "Built-in"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-white/45">{profile.country_code} · {profile.currency} · {Object.keys(profile.modes || {}).join(", ")}</p>
                      <p className="mt-1 truncate text-[10px] text-white/30">{profile.source}</p>
                    </button>
                    {profile.can_disable && (
                      <button type="button" onClick={() => disableProfile(profile)} className="rounded-xl p-2 text-red-300 hover:bg-red-400/10" aria-label="Deaktivieren">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
