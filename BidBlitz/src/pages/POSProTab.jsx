/**
 * BidBlitz POS Pro Tab — TSE/GoBD, KDS, QR-Tisch, Pfand,
 * KI-Assistent, Bilderkennung, Dynamic Pricing, Stempeluhr,
 * Trinkgeld-Pool, Webhooks/API-Keys
 */
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useI18n } from "../store/I18nContext";
import {
  Shield, Archive, ChefHat, QrCode, Coffee, Bot,
  TrendingUp, Clock, DollarSign, Webhook, Loader2,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, { method = "GET", body } = {}) {
  const opts = { method, credentials: "include" };
  if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
}

const usePosProTr = () => {
  const { lang } = useI18n();
  const locale = lang === "sq-XK" ? "sq" : lang === "en-US" ? "en" : lang === "ar-AE" ? "ar" : lang;
  return (values) => values?.[locale] ?? values?.en ?? values?.de ?? "";
};

const Card = ({ title, icon: Icon, children }) => (
  <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 mb-3">
    {title && (
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon size={14} className="text-[#00C2FF]" />}
        <h3 className="text-[12px] font-bold text-white">{title}</h3>
      </div>
    )}
    {children}
  </div>
);
const Btn = ({ children, onClick, loading, variant = "primary", testId, disabled }) => (
  <button onClick={onClick} disabled={loading || disabled} data-testid={testId}
    className="px-4 py-2 rounded-lg text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-50"
    style={{
      background: variant === "primary" ? "linear-gradient(135deg,#00C2FF,#0080FF)" : "rgba(255,255,255,0.06)",
      color: variant === "primary" ? "#fff" : "rgba(255,255,255,0.85)",
    }}>
    {loading && <Loader2 size={11} className="animate-spin" />}
    {children}
  </button>
);
const Input = ({ value, onChange, placeholder, type = "text", testId }) => (
  <input type={type} value={value || ""}
    onChange={(e) => onChange(type === "number" ? parseFloat(e.target.value || 0) : e.target.value)}
    placeholder={placeholder} data-testid={testId}
    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-[#00C2FF]/50" />
);

export default function POSProTab({ storeId, registerId }) {
  const tr = usePosProTr();
  const [section, setSection] = useState("tse");
  const sections = [
    { id: "tse", label: tr({ de: "TSE & GoBD", en: "TSE & GoBD", sq: "TSE & GoBD", ar: "TSE وGoBD" }), icon: Shield },
    { id: "kds", label: tr({ de: "KDS Küche", en: "Kitchen KDS", sq: "KDS kuzhine", ar: "KDS المطبخ" }), icon: ChefHat },
    { id: "tables", label: tr({ de: "QR-Tische", en: "QR tables", sq: "Tavolina QR", ar: "طاولات QR" }), icon: QrCode },
    { id: "deposits", label: tr({ de: "Pfand", en: "Deposits", sq: "Depozita", ar: "الودائع" }), icon: Coffee },
    { id: "ki", label: tr({ de: "KI-Assistent", en: "AI assistant", sq: "Asistenti AI", ar: "مساعد الذكاء الاصطناعي" }), icon: Bot },
    { id: "pricing", label: tr({ de: "Dynamic Pricing", en: "Dynamic pricing", sq: "Çmime dinamike", ar: "التسعير الديناميكي" }), icon: TrendingUp },
    { id: "clock", label: tr({ de: "Stempeluhr", en: "Time clock", sq: "Ora e punës", ar: "ساعة الدوام" }), icon: Clock },
    { id: "tips", label: tr({ de: "Trinkgeld", en: "Tips", sq: "Bakshishet", ar: "الإكراميات" }), icon: DollarSign },
    { id: "api", label: tr({ de: "API & Webhooks", en: "API & webhooks", sq: "API & webhooks", ar: "API وWebhooks" }), icon: Webhook },
  ];
  if (!storeId) return <div className="text-white/60 text-[12px] text-center py-10">{tr({ de: "Bitte erst eine Filiale wählen.", en: "Please choose a store first.", sq: "Ju lutem zgjidhni fillimisht një degë.", ar: "يرجى اختيار الفرع أولاً." })}</div>;
  return (
    <div data-testid="pos-pro-tab">
      <div className="flex gap-1 overflow-x-auto pb-3 hide-scrollbar -mx-1 px-1">
        {sections.map((s) => (
          <button key={s.id} onClick={() => setSection(s.id)} data-testid={`pro-section-${s.id}`}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap"
            style={{
              background: section === s.id ? "rgba(0,194,255,0.15)" : "rgba(255,255,255,0.04)",
              color: section === s.id ? "#00C2FF" : "rgba(255,255,255,0.5)",
              border: section === s.id ? "1px solid rgba(0,194,255,0.3)" : "1px solid transparent",
            }}>
            <s.icon size={10} /> {s.label}
          </button>
        ))}
      </div>
      {section === "tse" && <TSESection />}
      {section === "kds" && <KDSSection storeId={storeId} />}
      {section === "tables" && <TablesSection storeId={storeId} />}
      {section === "deposits" && <DepositsSection storeId={storeId} />}
      {section === "ki" && <AssistantSection storeId={storeId} />}
      {section === "pricing" && <PricingSection storeId={storeId} />}
      {section === "clock" && <ClockSection storeId={storeId} />}
      {section === "tips" && <TipsSection storeId={storeId} />}
      {section === "api" && <ApiSection />}
    </div>
  );
}

// ── TSE / GoBD
function TSESection() {
  const tr = usePosProTr();
  const [provider, setProvider] = useState("fiskaly");
  const [apiKey, setApiKey] = useState("");
  const [tssId, setTssId] = useState("");
  const [busy, setBusy] = useState(false);
  const [integrity, setIntegrity] = useState(null);

  const configure = async () => {
    setBusy(true);
    try {
      await api("/api/pos/tse/configure", { method: "POST", body: { provider, api_key: apiKey, serial: tssId || null } });
      toast.success(tr({ de: "TSE konfiguriert", en: "TSE configured", sq: "TSE u konfigurua", ar: "تم إعداد TSE" }));
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const checkIntegrity = async () => {
    try {
      const [g, s] = await Promise.all([
        api("/api/pos/gobd/integrity-check"),
        api("/api/pos/tse/status").catch(() => null),
      ]);
      setIntegrity({ ...g, tse_status: s });
    } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <Card title={tr({ de: "TSE / Fiskaly Konfiguration (KassenSichV-Pflicht)", en: "TSE / Fiskaly configuration (mandatory)", sq: "Konfigurimi TSE / Fiskaly (i detyrueshëm)", ar: "إعداد TSE / Fiskaly (إلزامي)" })} icon={Shield}>
        <p className="text-[10px] text-white/40 mb-2">{tr({ de: "In Deutschland verpflichtend seit 01.01.2020. Jeder Bon wird mit einer manipulationssicheren Signatur versehen.", en: "Mandatory in Germany since 01/01/2020. Every receipt gets a tamper-proof signature.", sq: "E detyrueshme në Gjermani që nga 01.01.2020. Çdo faturë nënshkruhet në mënyrë të sigurt.", ar: "إلزامي في ألمانيا منذ 01.01.2020. كل إيصال يحصل على توقيع مقاوم للتلاعب." })}</p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <select value={provider} onChange={(e) => setProvider(e.target.value)}
            className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white" data-testid="tse-provider">
            <option value="fiskaly">Fiskaly Cloud-TSE</option>
            <option value="epson">Epson Hardware-TSE</option>
            <option value="swissbit">Swissbit USB-TSE</option>
          </select>
          <Input value={apiKey} onChange={setApiKey} placeholder={tr({ de: "API-Key (vom TSE-Provider)", en: "API key (from TSE provider)", sq: "API key (nga ofruesi TSE)", ar: "مفتاح API (من مزود TSE)" })} testId="tse-api-key" />
          <Input value={tssId} onChange={setTssId} placeholder={tr({ de: "Serial-Nr. (optional)", en: "Serial no. (optional)", sq: "Nr. serial (opsionale)", ar: "الرقم التسلسلي (اختياري)" })} testId="tse-tss-id" />
        </div>
        <Btn onClick={configure} loading={busy} testId="tse-save-btn"><Shield size={12} /> {tr({ de: "TSE aktivieren", en: "Activate TSE", sq: "Aktivizo TSE", ar: "تفعيل TSE" })}</Btn>
      </Card>

      <Card title={tr({ de: "GoBD-Integritätsprüfung", en: "GoBD integrity check", sq: "Kontrolli i integritetit GoBD", ar: "فحص سلامة GoBD" })} icon={Archive}>
        <p className="text-[10px] text-white/40 mb-2">{tr({ de: "Prüft, ob alle bezahlten Bons unveränderbar archiviert sind (10-Jahre-Frist).", en: "Checks whether all paid receipts are archived immutably (10-year retention).", sq: "Kontrollon nëse të gjitha faturat e paguara janë arkivuar në mënyrë të pandryshueshme.", ar: "يتحقق مما إذا كانت جميع الإيصالات المدفوعة مؤرشفة بشكل غير قابل للتغيير." })}</p>
        <Btn onClick={checkIntegrity} variant="secondary" testId="gobd-check-btn">{tr({ de: "Integrität prüfen", en: "Check integrity", sq: "Kontrollo integritetin", ar: "تحقق من السلامة" })}</Btn>
        {integrity && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]" data-testid="gobd-result">
            <div className="bg-black/20 rounded-lg p-2"><p className="text-white/40 text-[9px]">Bons archiviert</p><p className="text-white font-bold">{integrity.gobd_archived}</p></div>
            <div className="bg-black/20 rounded-lg p-2"><p className="text-white/40 text-[9px]">Bons signiert</p><p className="text-white font-bold">{integrity.sales_signed}</p></div>
            <div className="bg-black/20 rounded-lg p-2"><p className="text-white/40 text-[9px]">Bezahlte Bons gesamt</p><p className="text-white font-bold">{integrity.sales_paid_total}</p></div>
            <div className="bg-black/20 rounded-lg p-2"><p className="text-white/40 text-[9px]">Compliance</p><p className={integrity.ok ? "text-[#10B981] font-bold" : "text-[#EF4444] font-bold"}>{integrity.compliance_rate}% {integrity.ok ? "✓" : "⚠"}</p></div>
          </div>
        )}
      </Card>
    </>
  );
}

// ── KDS
function KDSSection({ storeId }) {
  const tr = usePosProTr();
  const [stations, setStations] = useState([]);
  const [name, setName] = useState("Küche");
  const [cats, setCats] = useState("Speisen, Vorspeise");

  const load = useCallback(async () => {
    try { const d = await api(`/api/pos/kds/stations?store_id=${storeId}`); setStations(d.stations || []); } catch (err) { void err; }
  }, [storeId]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try {
      await api(`/api/pos/kds/stations/create?store_id=${storeId}`, {
        method: "POST", body: { name, categories: cats.split(",").map(c => c.trim()).filter(Boolean) },
      });
      toast.success(tr({ de: "Station angelegt", en: "Station created", sq: "Stacioni u krijua", ar: "تم إنشاء المحطة" })); load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <Card title={tr({ de: "Kitchen Display System (KDS)", en: "Kitchen display system (KDS)", sq: "Sistemi i ekranit të kuzhinës (KDS)", ar: "نظام شاشة المطبخ (KDS)" })} icon={ChefHat}>
      <p className="text-[10px] text-white/40 mb-3">{tr({ de: "Lege eine Display-Station an (z.B. Küche, Bar, Pizza). Dann öffne /kds/{station_id} auf einem Tablet in der Küche.", en: "Create a display station (e.g. kitchen, bar, pizza). Then open /kds/{station_id} on a kitchen tablet.", sq: "Krijo një stacion ekrani (p.sh. kuzhinë, bar, pizza). Pastaj hap /kds/{station_id} në një tablet në kuzhinë.", ar: "أنشئ محطة عرض (مثل المطبخ أو البار أو البيتزا). ثم افتح /kds/{station_id} على جهاز لوحي في المطبخ." })}</p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <Input value={name} onChange={setName} placeholder={tr({ de: "Stationsname", en: "Station name", sq: "Emri i stacionit", ar: "اسم المحطة" })} testId="kds-name" />
        <Input value={cats} onChange={setCats} placeholder={tr({ de: "Kategorien (Komma)", en: "Categories (comma)", sq: "Kategoritë (me presje)", ar: "الفئات (بفواصل)" })} testId="kds-cats" />
      </div>
      <Btn onClick={create} testId="kds-create-btn">+ {tr({ de: "Station", en: "Station", sq: "Stacion", ar: "محطة" })}</Btn>
      <div className="mt-3 space-y-1">
        {stations.map((s) => (
          <div key={s.station_id} className="flex justify-between bg-black/20 rounded-lg p-2 text-[10px]">
            <span className="text-white/80">{s.name} <span className="text-white/40">— {(s.categories || []).join(", ")}</span></span>
            <a href={`/kds/${s.station_id}`} target="_blank" rel="noreferrer" className="text-[#00C2FF] font-bold" data-testid={`kds-open-${s.station_id}`}>
              {tr({ de: "Tablet öffnen", en: "Open tablet", sq: "Hap tabletin", ar: "افتح الجهاز اللوحي" })} ↗
            </a>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Tables / QR-Order
function TablesSection({ storeId }) {
  const [tables, setTables] = useState([]);
  const [name, setName] = useState("Tisch 1");
  const [capacity, setCapacity] = useState(4);

  const load = useCallback(async () => {
    try { const d = await api(`/api/pos/tables?store_id=${storeId}`); setTables(d.tables || []); } catch (err) { void err; }
  }, [storeId]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try {
      await api("/api/pos/tables/create", { method: "POST", body: { store_id: storeId, name, capacity } });
      toast.success("Tisch angelegt"); load();
    } catch (e) { toast.error(e.message); }
  };

  const enableQR = async (tableId) => {
    try {
      const d = await api(`/api/pos/tables/${tableId}/qr-enable`, { method: "POST" });
      toast.success(`QR aktiviert: ${d.qr_token}`);
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <Card title="QR-Tisch-Bestellung" icon={QrCode}>
      <p className="text-[10px] text-white/40 mb-3">Lege Tische an, klicke „QR aktivieren“, drucke den QR-Code und klebe ihn auf den Tisch. Gäste scannen, bestellen selbst, Bestellung landet automatisch im KDS.</p>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <Input value={name} onChange={setName} placeholder="Tisch-Name" testId="tbl-num" />
        <Input value={capacity} onChange={setCapacity} type="number" placeholder="Plätze" testId="tbl-seats" />
        <Btn onClick={create} testId="tbl-create-btn">+ Tisch</Btn>
      </div>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {tables.map((t) => (
          <div key={t.table_id} className="bg-black/20 rounded-lg p-2 text-[10px]">
            <p className="text-white/80 font-bold">{t.name} · {t.capacity} Plätze · {t.status}</p>
            {t.qr_token ? (
              <>
                <p className="text-[#00C2FF] break-all">{API}/order/{t.qr_token}</p>
                <button onClick={() => { navigator.clipboard.writeText(`${API}/order/${t.qr_token}`); toast.success("Link kopiert"); }}
                  className="text-[#00C2FF] text-[10px] mt-1" data-testid={`tbl-copy-${t.table_id}`}>
                  Link kopieren
                </button>
              </>
            ) : (
              <button onClick={() => enableQR(t.table_id)} className="text-[#10B981] text-[10px] mt-1 font-bold" data-testid={`tbl-qr-${t.table_id}`}>
                + QR-Self-Order aktivieren
              </button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Deposits / Pfand
function DepositsSection({ storeId }) {
  const [out, setOut] = useState(null);
  const [type, setType] = useState("cup");
  const [qty, setQty] = useState(1);
  const [refund, setRefund] = useState(null);

  const load = useCallback(async () => {
    try { setOut(await api(`/api/pos/deposits/outstanding?store_id=${storeId}`)); } catch (err) { void err; }
  }, [storeId]);
  useEffect(() => { load(); }, [load]);

  const doReturn = async () => {
    try {
      const d = await api(`/api/pos/deposits/return?store_id=${storeId}`, { method: "POST", body: { item_type: type, quantity: qty } });
      setRefund(d.refund_amount);
      toast.success(`€${d.refund_amount} zurück`);
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <Card title="Pfand zurücknehmen" icon={Coffee}>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white" data-testid="dep-type">
            <option value="cup">Mehrweg-Becher (€1)</option>
            <option value="bottle">Pfand-Flasche (€0.25)</option>
          </select>
          <Input value={qty} onChange={setQty} type="number" placeholder="Anzahl" testId="dep-qty" />
          <Btn onClick={doReturn} testId="dep-return-btn">Zurück geben</Btn>
        </div>
        {refund != null && <p className="text-[#10B981] text-[11px] font-bold" data-testid="dep-refund">Erstattet: €{refund}</p>}
      </Card>
      <Card title="Offene Pfand-Beträge" icon={Coffee}>
        {out ? (
          <div className="text-[11px] text-white">
            <p className="text-white/40 text-[10px]">Offene Pfänder: {out.count}</p>
            <p className="text-[#00C2FF] font-bold text-[16px]" data-testid="dep-outstanding">€{out.total_outstanding}</p>
          </div>
        ) : <Loader2 size={14} className="animate-spin text-white/40" />}
      </Card>
    </>
  );
}

// ── Assistant
function AssistantSection({ storeId }) {
  const [q, setQ] = useState("Wie viel hab ich heute verkauft?");
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState([]);

  const ask = async () => {
    if (!q.trim()) return;
    const userMsg = q;
    setChat((c) => [...c, { role: "user", text: userMsg }]);
    setQ("");
    setBusy(true);
    try {
      const d = await api("/api/pos/assistant/ask", { method: "POST", body: { question: userMsg, store_id: storeId } });
      setChat((c) => [...c, { role: "ai", text: d.answer, context: d.context }]);
    } catch (e) {
      setChat((c) => [...c, { role: "ai", text: `❌ ${e.message}` }]);
    } finally { setBusy(false); }
  };

  return (
    <Card title="Geschäfts-Assistent (KI)" icon={Bot}>
      <p className="text-[10px] text-white/40 mb-3">Stelle Fragen zu deinem Geschäft. Der Assistent kennt Umsatz, Bestand und Verkaufsdaten.</p>
      <div className="space-y-2 max-h-80 overflow-y-auto mb-3" data-testid="assistant-chat">
        {chat.map((m, i) => (
          <div key={i} className={`p-2 rounded-lg text-[11px] ${m.role === "user" ? "bg-[#00C2FF]/10 ml-8" : "bg-white/[0.04] mr-8"}`}>
            <p className={m.role === "user" ? "text-[#00C2FF]" : "text-white/90"}>{m.text}</p>
          </div>
        ))}
        {busy && <Loader2 size={14} className="animate-spin text-white/40" />}
      </div>
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Frage stellen…" data-testid="assistant-input"
          className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-[#00C2FF]/50" />
        <Btn onClick={ask} loading={busy} testId="assistant-ask-btn">Fragen</Btn>
      </div>
    </Card>
  );
}

// ── Pricing
function PricingSection({ storeId }) {
  const [rules, setRules] = useState([]);
  const [rule, setRule] = useState({ name: "Happy Hour Cocktails", category: "Cocktails", rule_type: "happy_hour",
                                       discount_percent: 20, starts_at_hour: 17, ends_at_hour: 19 });

  const load = useCallback(async () => {
    try { const d = await api(`/api/pos/pricing/rules?store_id=${storeId}`); setRules(d.rules || []); } catch (err) { void err; }
  }, [storeId]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try {
      await api(`/api/pos/pricing/rules/create?store_id=${storeId}`, { method: "POST", body: rule });
      toast.success("Regel angelegt"); load();
    } catch (e) { toast.error(e.message); }
  };

  const del = async (id) => {
    try { await api(`/api/pos/pricing/rules/${id}`, { method: "DELETE" }); load(); } catch (e) { toast.error(e.message); }
  };

  return (
    <Card title="Dynamic Pricing — Happy Hour & Stoßzeiten" icon={TrendingUp}>
      <p className="text-[10px] text-white/40 mb-3">z.B. Happy Hour 17–19h: −20% auf Cocktails. Oder +10% Mittagsaufschlag auf Burger.</p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <Input value={rule.name} onChange={(v) => setRule({ ...rule, name: v })} placeholder="Regel-Name" testId="prc-name" />
        <select value={rule.rule_type} onChange={(e) => setRule({ ...rule, rule_type: e.target.value })}
          className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white" data-testid="prc-type">
          <option value="happy_hour">Happy Hour</option>
          <option value="time_window">Zeitfenster</option>
          <option value="stock_level">Lagerstand</option>
        </select>
        <Input value={rule.category} onChange={(v) => setRule({ ...rule, category: v })} placeholder="Kategorie" testId="prc-cat" />
        <Input value={rule.discount_percent} onChange={(v) => setRule({ ...rule, discount_percent: v })} type="number" placeholder="Rabatt %" testId="prc-discount" />
        <Input value={rule.starts_at_hour} onChange={(v) => setRule({ ...rule, starts_at_hour: v })} type="number" placeholder="Start-Stunde" testId="prc-start" />
        <Input value={rule.ends_at_hour} onChange={(v) => setRule({ ...rule, ends_at_hour: v })} type="number" placeholder="End-Stunde" testId="prc-end" />
      </div>
      <Btn onClick={create} testId="prc-create-btn">+ Regel anlegen</Btn>
      <div className="mt-3 space-y-1">
        {rules.map((r) => (
          <div key={r.rule_id} className="flex justify-between bg-black/20 rounded-lg p-2 text-[10px]">
            <span className="text-white/80">{r.name} — {r.rule_type} {r.discount_percent ? `−${r.discount_percent}%` : ""}{r.surcharge_percent ? `+${r.surcharge_percent}%` : ""}</span>
            <button onClick={() => del(r.rule_id)} className="text-red-400" data-testid={`prc-del-${r.rule_id}`}>×</button>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Time Clock
function ClockSection({ storeId }) {
  const [me, setMe] = useState([]);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try { const d = await api("/api/pos/timeclock/me?days=7"); setMe(d.punches || []); } catch (err) { void err; }
  }, []);
  useEffect(() => { load(); }, [load]);

  const punch = async (action) => {
    setBusy(action);
    try {
      await api("/api/pos/timeclock/punch", { method: "POST", body: { store_id: storeId, action } });
      toast.success(`Gestempelt: ${action}`); load();
    } catch (e) { toast.error(e.message); } finally { setBusy(""); }
  };

  return (
    <Card title="Mitarbeiter-Stempeluhr" icon={Clock}>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Btn onClick={() => punch("in")} loading={busy === "in"} testId="clk-in">▶ Einstempeln</Btn>
        <Btn onClick={() => punch("out")} loading={busy === "out"} variant="secondary" testId="clk-out">■ Ausstempeln</Btn>
        <Btn onClick={() => punch("break_start")} loading={busy === "break_start"} variant="secondary" testId="clk-break-start">☕ Pause Start</Btn>
        <Btn onClick={() => punch("break_end")} loading={busy === "break_end"} variant="secondary" testId="clk-break-end">↩ Pause Ende</Btn>
      </div>
      <p className="text-[10px] text-white/40 mb-1">Letzte 7 Tage:</p>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {me.slice(0, 30).map((p, i) => (
          <div key={i} className="text-[10px] bg-black/20 rounded-lg p-2 text-white/80 flex justify-between">
            <span>{p.timestamp.slice(0, 19).replace("T", " ")}</span><span className="font-bold">{p.action}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Tips
function TipsSection({ storeId }) {
  const [my, setMy] = useState(null);
  const load = useCallback(async () => {
    try { setMy(await api("/api/pos/tips/my-payouts?days=30")); } catch (err) { void err; }
  }, []);
  useEffect(() => { load(); }, [load]);

  const distribute = async () => {
    if (!window.confirm("Heutigen Trinkgeld-Pool an alle eingestempelten Mitarbeiter verteilen?")) return;
    try {
      const d = await api(`/api/pos/tips/pool/distribute?store_id=${storeId}`, { method: "POST" });
      toast.success(`€${d.total_pool} verteilt an ${d.recipients} Mitarbeiter (€${d.per_person} p.P.)`);
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <Card title="Trinkgeld-Pool verteilen" icon={DollarSign}>
        <p className="text-[10px] text-white/40 mb-2">Verteilt alle Trinkgelder des heutigen Tages gleichmäßig auf alle eingestempelten Mitarbeiter.</p>
        <Btn onClick={distribute} testId="tips-distribute-btn"><DollarSign size={12} /> Heute verteilen</Btn>
      </Card>
      <Card title="Mein Trinkgeld (letzte 30 Tage)" icon={DollarSign}>
        {my ? (
          <>
            <p className="text-[#10B981] font-bold text-[20px]" data-testid="tips-total">€{my.total}</p>
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {(my.payouts || []).map((p, i) => (
                <div key={i} className="text-[10px] bg-black/20 rounded-lg p-2 text-white/80 flex justify-between">
                  <span>{p.day}</span><span>€{p.amount}</span>
                </div>
              ))}
            </div>
          </>
        ) : <Loader2 size={14} className="animate-spin text-white/40" />}
      </Card>
    </>
  );
}

// ── API Keys + Webhooks
function ApiSection() {
  const [hooks, setHooks] = useState([]);
  const [keys, setKeys] = useState([]);
  const [hookUrl, setHookUrl] = useState("https://example.com/webhook");
  const [hookEvents, setHookEvents] = useState("sale.completed,stock.low");
  const [keyName, setKeyName] = useState("Mein Integration");
  const [created, setCreated] = useState(null);

  const load = async () => {
    try {
      const [h, k] = await Promise.all([api("/api/pos/webhooks"), api("/api/pos/api-keys")]);
      setHooks(h.webhooks || []); setKeys(k.keys || []);
    } catch (err) { void err; }
  };
  useEffect(() => { load(); }, []);

  const createHook = async () => {
    try {
      const d = await api("/api/pos/webhooks/create", { method: "POST",
        body: { url: hookUrl, events: hookEvents.split(",").map((s) => s.trim()) } });
      setCreated({ type: "webhook", secret: d.secret, id: d.webhook_id });
      toast.success("Webhook angelegt"); load();
    } catch (e) { toast.error(e.message); }
  };

  const testHook = async (id) => {
    try { await api(`/api/pos/webhooks/${id}/test`, { method: "POST" }); toast.success("Test-Payload gesendet"); }
    catch (e) { toast.error(e.message); }
  };

  const createKey = async () => {
    try {
      const d = await api(`/api/pos/api-keys/create?name=${encodeURIComponent(keyName)}&scopes=read,write`, { method: "POST" });
      setCreated({ type: "key", id: d.key_id, secret: d.key_secret });
      toast.success("API-Key erstellt"); load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <Card title="API-Keys" icon={Webhook}>
        <div className="flex gap-2 mb-2">
          <Input value={keyName} onChange={setKeyName} placeholder="Name" testId="key-name" />
          <Btn onClick={createKey} testId="key-create-btn">+ Erstellen</Btn>
        </div>
        <div className="space-y-1">
          {keys.map((k) => (
            <div key={k.key_id} className="text-[10px] bg-black/20 rounded-lg p-2 text-white/80">
              {k.name} — <span className="text-[#00C2FF]">{k.key_id}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Webhooks" icon={Webhook}>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Input value={hookUrl} onChange={setHookUrl} placeholder="URL" testId="hook-url" />
          <Input value={hookEvents} onChange={setHookEvents} placeholder="events (komma)" testId="hook-events" />
        </div>
        <Btn onClick={createHook} testId="hook-create-btn">+ Webhook</Btn>
        <div className="mt-3 space-y-1">
          {hooks.map((h) => (
            <div key={h.webhook_id} className="text-[10px] bg-black/20 rounded-lg p-2 text-white/80 flex justify-between items-center">
              <span><span className="text-[#00C2FF]">{h.url}</span> — {(h.events || []).join(", ")}</span>
              <button onClick={() => testHook(h.webhook_id)} className="text-[#00C2FF] font-bold" data-testid={`hook-test-${h.webhook_id}`}>Test</button>
            </div>
          ))}
        </div>
      </Card>

      {created && (
        <Card title="⚠ Geheimnis EINMALIG anzeigen — JETZT speichern!">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-[11px]">
            <p className="text-yellow-400 mb-1">{created.type === "key" ? "API-Key Secret:" : "Webhook Secret (HMAC):"}</p>
            <p className="text-white font-mono break-all" data-testid="created-secret">{created.secret}</p>
            <button onClick={() => { navigator.clipboard.writeText(created.secret); toast.success("Kopiert"); setCreated(null); }}
              className="mt-2 text-[#00C2FF] text-[10px] font-bold">Kopieren & schließen</button>
          </div>
        </Card>
      )}
    </>
  );
}
