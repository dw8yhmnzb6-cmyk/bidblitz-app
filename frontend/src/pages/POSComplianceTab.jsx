/**
 * POS Compliance Tab — Tagesabschluss (Z-Bon), Zwischenbericht (X-Bon),
 * DSFinV-K Export, Kassenmeldepflicht (Finanzamt-Formular), Voucher-Stats.
 */
import { useState, useEffect } from "react";
import { FileBarChart, Download, Lock, ShieldCheck, Loader2, Gift, Building2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

async function apiCall(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method, credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
}

const Card = ({ title, icon: Icon, children, testid }) => (
  <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 mb-3" data-testid={testid}>
    {title && (
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon size={14} className="text-[#00C2FF]" />}
        <h3 className="text-[12px] font-bold text-white">{title}</h3>
      </div>
    )}
    {children}
  </div>
);

const SECTIONS = [
  { id: "zbon", label: "Tagesabschluss" },
  { id: "dsfinvk", label: "DSFinV-K" },
  { id: "meldung", label: "Kassenmeldung" },
  { id: "vouchers", label: "Gutscheine" },
];

export default function POSComplianceTab({ storeId }) {
  const [section, setSection] = useState("zbon");
  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-2 mb-3 hide-scrollbar">
        {SECTIONS.map((s) => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap"
            style={{
              background: section === s.id ? "rgba(0,194,255,0.15)" : "rgba(255,255,255,0.04)",
              color: section === s.id ? "#00C2FF" : "rgba(255,255,255,0.6)",
            }}
            data-testid={`pos-comp-tab-${s.id}`}>
            {s.label}
          </button>
        ))}
      </div>
      {section === "zbon" && <ZBonSection storeId={storeId} />}
      {section === "dsfinvk" && <DSFinVKSection storeId={storeId} />}
      {section === "meldung" && <KassenmeldungSection storeId={storeId} />}
      {section === "vouchers" && <VoucherStatsSection storeId={storeId} />}
    </div>
  );
}

function ZBonSection({ storeId }) {
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadPreview = async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const d = await apiCall(`/api/pos/zbon/preview?store_id=${storeId}&day=${day}`);
      setPreview(d);
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };

  const loadList = async () => {
    if (!storeId) return;
    try {
      const d = await apiCall(`/api/pos/zbon/list?store_id=${storeId}&limit=30`);
      setList(d.zbons || []);
    } catch {}
  };

  useEffect(() => { loadPreview(); loadList(); }, [storeId, day]);  // eslint-disable-line

  const closeDay = async () => {
    if (!window.confirm(`Tag ${day} unwiderruflich abschließen? (GoBD-konform, nicht rückgängig)`)) return;
    try {
      await apiCall(`/api/pos/zbon/close?store_id=${storeId}&day=${day}`, { method: "POST" });
      toast.success("Z-Bon erstellt — Tag abgeschlossen");
      loadList(); loadPreview();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div>
      <Card title="X-Bon Vorschau (offener Tag)" icon={FileBarChart} testid="pos-xbon-preview">
        <div className="flex gap-2 mb-3">
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)}
            className="px-2 py-1.5 bg-white/5 border border-white/10 rounded text-[11px]" data-testid="pos-zbon-day" />
          <button onClick={loadPreview} disabled={loading}
            className="px-3 py-1.5 rounded bg-white/10 text-[10px] font-bold">
            {loading ? <Loader2 size={11} className="animate-spin inline" /> : "Aktualisieren"}
          </button>
        </div>
        {preview ? (
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <Stat label="Verkäufe" value={preview.sales_count ?? 0} />
            <Stat label="Brutto" value={`€${(preview.gross_total ?? 0).toFixed(2)}`} color="#00C2FF" />
            <Stat label="Netto" value={`€${(preview.net_total ?? 0).toFixed(2)}`} />
            <Stat label="MwSt" value={`€${(preview.tax_total ?? 0).toFixed(2)}`} color="#F59E0B" />
            <Stat label="Bar" value={`€${(preview.cash_total ?? 0).toFixed(2)}`} />
            <Stat label="Karte" value={`€${(preview.card_total ?? 0).toFixed(2)}`} />
            <Stat label="Wallet" value={`€${(preview.wallet_total ?? 0).toFixed(2)}`} />
            <Stat label="Stornos" value={preview.refund_count ?? 0} color="#EF4444" />
          </div>
        ) : (
          <p className="text-[11px] text-white/40 text-center py-4">Keine Daten</p>
        )}
        <button onClick={closeDay} disabled={!preview || preview.closed}
          className="w-full mt-3 py-2.5 rounded-xl bg-red-500/15 text-red-400 font-bold text-[12px] flex items-center justify-center gap-2 disabled:opacity-30"
          data-testid="pos-zbon-close">
          <Lock size={13} /> Tag abschließen (Z-Bon erzeugen)
        </button>
      </Card>

      <Card title={`Z-Bon Historie (${list.length})`} icon={ShieldCheck}>
        {list.map((z) => (
          <div key={z.zbon_id} className="py-2 border-b border-white/5 last:border-0 text-[11px]">
            <div className="flex justify-between">
              <span className="font-bold">{z.day}</span>
              <span className="text-[#00C2FF]">€{(z.report?.gross_total || 0).toFixed(2)}</span>
            </div>
            <p className="text-[9px] text-white/40 truncate">{z.zbon_id} · sig {z.signature?.slice(0, 16)}…</p>
          </div>
        ))}
        {list.length === 0 && <p className="text-[11px] text-white/40 text-center py-3">Noch keine Z-Bons</p>}
      </Card>
    </div>
  );
}

function DSFinVKSection({ storeId }) {
  const [year, setYear] = useState(new Date().getFullYear());
  return (
    <Card title="DSFinV-K Export (Finanzamt)" icon={Download} testid="pos-dsfinvk">
      <p className="text-[11px] text-white/60 mb-3">
        Digitale Schnittstelle Finanzverwaltung — Kassen (CSV-Export für Betriebsprüfung).
        10-Jahre Aufbewahrungspflicht (§147 AO).
      </p>
      <div className="flex gap-2 mb-3">
        <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value))}
          min="2020" max="2030" className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded text-[12px]"
          data-testid="pos-dsfinvk-year" />
        <a href={`${API}/api/pos/zbon/dsfinv-k/export?store_id=${storeId}&year=${year}`} target="_blank" rel="noopener noreferrer"
          className="px-4 py-2 rounded bg-[#00C2FF] text-black font-bold text-[12px] flex items-center gap-1.5"
          data-testid="pos-dsfinvk-download">
          <Download size={12} /> CSV
        </a>
      </div>
      <div className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 flex gap-2">
        <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
        <span>Bei Betriebsprüfung muss DSFinV-K-Export auf Anfrage übergeben werden (BMF-Schreiben).</span>
      </div>
    </Card>
  );
}

function KassenmeldungSection({ storeId }) {
  const [form, setForm] = useState({
    business_name: "", tax_id: "", address: "", contact_email: "",
    register_serial: "", tse_serial: "", commissioning_date: "",
    decommissioning_date: "", notes: "",
  });
  const [saved, setSaved] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    apiCall(`/api/pos/kassenmeldung/get?store_id=${storeId}`)
      .then((d) => { if (d.meldung) { setForm(d.meldung); setSaved(d.meldung); } })
      .catch(() => {});
  }, [storeId]);

  const save = async () => {
    setLoading(true);
    try {
      const d = await apiCall("/api/pos/kassenmeldung/save", {
        method: "POST",
        body: { ...form, store_id: storeId },
      });
      setSaved(d.meldung);
      toast.success("Kassenmeldung gespeichert");
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };

  const F = (key, label, type = "text") => (
    <div>
      <label className="text-[10px] text-white/60 mb-1 block uppercase">{label}</label>
      <input type={type} value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-[12px]" data-testid={`pos-meldung-${key}`} />
    </div>
  );

  return (
    <Card title="Kassenmeldepflicht (§146a AO)" icon={Building2} testid="pos-kassenmeldung">
      <p className="text-[11px] text-white/60 mb-3">
        Pflichtmeldung beim Finanzamt seit 01.01.2025. Frist Altsysteme: 31.07.2025.
        Daten werden im System dokumentiert (Selbst-Meldung über ELSTER).
      </p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {F("business_name", "Firmenname")}
        {F("tax_id", "Steuer-Nr.")}
        {F("address", "Adresse")}
        {F("contact_email", "Kontakt-Mail", "email")}
        {F("register_serial", "Kassen-SN")}
        {F("tse_serial", "TSE-SN")}
        {F("commissioning_date", "Inbetriebnahme", "date")}
        {F("decommissioning_date", "Außerbetriebnahme", "date")}
      </div>
      <textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })}
        placeholder="Notizen…" rows={3}
        className="w-full px-3 py-2 mb-2 bg-white/5 border border-white/10 rounded text-[12px]" />
      <button onClick={save} disabled={loading}
        className="w-full py-2.5 rounded-xl bg-[#00C2FF] text-black font-black text-[12px] disabled:opacity-50"
        data-testid="pos-meldung-save">
        {loading ? <Loader2 size={12} className="animate-spin inline" /> : saved ? "Aktualisieren" : "Speichern"}
      </button>
      {saved && (
        <p className="text-[10px] text-white/50 mt-2">Zuletzt gespeichert: {new Date(saved.updated_at || saved.created_at).toLocaleString("de-DE")}</p>
      )}
    </Card>
  );
}

function VoucherStatsSection({ storeId }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    if (!storeId) return;
    apiCall(`/api/pos/vouchers/sales/today?store_id=${storeId}`).then(setStats).catch(() => {});
  }, [storeId]);

  return (
    <Card title="Gutscheine & Aufladungen heute" icon={Gift} testid="pos-voucher-stats">
      {stats ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gradient-to-br from-[#FF4060]/15 to-[#FF6B88]/10 p-3 border border-[#FF4060]/20">
            <p className="text-[10px] text-white/60">Gutscheine</p>
            <p className="text-2xl font-black text-[#FF4060]">{stats.vouchers?.count ?? 0}</p>
            <p className="text-[10px] text-white/60 mt-1">€{(stats.vouchers?.total ?? 0).toFixed(2)}</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-[#00C2FF]/15 to-[#00E89D]/10 p-3 border border-[#00C2FF]/20">
            <p className="text-[10px] text-white/60">Aufladungen</p>
            <p className="text-2xl font-black text-[#00C2FF]">{stats.topups?.count ?? 0}</p>
            <p className="text-[10px] text-white/60 mt-1">€{(stats.topups?.total ?? 0).toFixed(2)}</p>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-white/40 text-center py-4">Keine Daten</p>
      )}
    </Card>
  );
}

function Stat({ label, value, color = "white" }) {
  return (
    <div className="rounded-xl bg-white/5 p-2.5">
      <p className="text-[9px] text-white/50 uppercase">{label}</p>
      <p className="text-sm font-black tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}
