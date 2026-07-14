/**
 * BidBlitz POS — Mega Advanced Tab
 * UI für alle 28 erweiterten POS-Features:
 *   OCR · Voice · Etiketten · Auto-PO · Bulk-Import/Export · Inventur · Chargen ·
 *   Rezepte · Schichtplan · Performance · Forecast · Cross-Sell · DATEV · P&L ·
 *   Online-Katalog · Reservierung · Marketing · Gutscheine · Alterskontrolle.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useI18n } from "../store/I18nContext";
import {
  Camera, Mic, Tag, ShoppingCart, Upload, Download, ClipboardList,
  Layers, ChefHat, CalendarDays, TrendingUp, Sparkles, FileSpreadsheet,
  Receipt, Globe, BookOpen, Mail, Gift, ShieldAlert, Loader2, MicOff,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

async function api(path, { method = "GET", body, raw = false, formData = null } = {}) {
  const opts = { method, credentials: "include" };
  if (formData) {
    opts.body = formData;
  } else if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, opts);
  if (raw) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
  return data;
}

const usePosAdvancedTr = () => {
  const { lang } = useI18n();
  const locale = lang === "sq-XK" ? "sq" : lang === "en-US" ? "en" : lang === "ar-AE" ? "ar" : lang;
  return (values) => values?.[locale] ?? values?.en ?? values?.de ?? "";
};

const Card = ({ title, icon: Icon, children }) => (
  <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 mb-3">
    <div className="flex items-center gap-2 mb-3">
      {Icon && <Icon size={14} className="text-[#00C2FF]" />}
      <h3 className="text-[12px] font-bold text-white">{title}</h3>
    </div>
    {children}
  </div>
);

const Btn = ({ children, onClick, loading, variant = "primary", testId, disabled }) => (
  <button
    onClick={onClick}
    disabled={loading || disabled}
    data-testid={testId}
    className="px-4 py-2 rounded-lg text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-50"
    style={{
      background: variant === "primary" ? "linear-gradient(135deg,#00C2FF,#0080FF)" : "rgba(255,255,255,0.06)",
      color: variant === "primary" ? "#fff" : "rgba(255,255,255,0.85)",
    }}
  >
    {loading && <Loader2 size={11} className="animate-spin" />}
    {children}
  </button>
);

const Input = ({ value, onChange, placeholder, type = "text", testId }) => (
  <input
    type={type}
    value={value || ""}
    onChange={(e) => onChange(type === "number" ? parseFloat(e.target.value || 0) : e.target.value)}
    placeholder={placeholder}
    data-testid={testId}
    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-[#00C2FF]/50"
  />
);

export default function POSAdvancedTab({ storeId, registerId }) {
  const tr = usePosAdvancedTr();
  const [section, setSection] = useState("demo");
  const sections = [
    { id: "demo", label: tr({ de: "Demo-Modus", en: "Demo mode", sq: "Mënyra demo", ar: "وضع العرض" }), icon: Sparkles },
    { id: "ki", label: tr({ de: "KI-Tools", en: "AI tools", sq: "Mjetet AI", ar: "أدوات الذكاء الاصطناعي" }), icon: Sparkles },
    { id: "stock", label: tr({ de: "Bestand+", en: "Inventory+", sq: "Inventari+", ar: "المخزون+" }), icon: Layers },
    { id: "menu", label: tr({ de: "Rezepte & Cross-Sell", en: "Recipes & cross-sell", sq: "Receta & cross-sell", ar: "الوصفات والبيع الإضافي" }), icon: ChefHat },
    { id: "ops", label: tr({ de: "Schicht & Reservierung", en: "Shifts & reservations", sq: "Turnet & rezervimet", ar: "المناوبات والحجوزات" }), icon: CalendarDays },
    { id: "money", label: tr({ de: "Finanzen & DATEV", en: "Finance & DATEV", sq: "Financa & DATEV", ar: "المالية وDATEV" }), icon: FileSpreadsheet },
    { id: "marketing", label: tr({ de: "Marketing", en: "Marketing", sq: "Marketing", ar: "التسويق" }), icon: Mail },
  ];

  if (!storeId) {
    return <div className="text-white/60 text-[12px] text-center py-10">{tr({ de: "Bitte erst eine Filiale wählen.", en: "Please choose a store first.", sq: "Ju lutem zgjidhni fillimisht një degë.", ar: "يرجى اختيار الفرع أولاً." })}</div>;
  }

  return (
    <div data-testid="pos-advanced-tab">
      <div className="flex gap-1 overflow-x-auto pb-3 hide-scrollbar -mx-1 px-1">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            data-testid={`adv-section-${s.id}`}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap"
            style={{
              background: section === s.id ? "rgba(0,194,255,0.15)" : "rgba(255,255,255,0.04)",
              color: section === s.id ? "#00C2FF" : "rgba(255,255,255,0.5)",
              border: section === s.id ? "1px solid rgba(0,194,255,0.3)" : "1px solid transparent",
            }}
          >
            <s.icon size={10} /> {s.label}
          </button>
        ))}
      </div>

      {section === "demo" && <DemoSection storeId={storeId} />}
      {section === "ki" && <KISection storeId={storeId} registerId={registerId} />}
      {section === "stock" && <StockSection storeId={storeId} />}
      {section === "menu" && <MenuSection storeId={storeId} />}
      {section === "ops" && <OpsSection storeId={storeId} />}
      {section === "money" && <MoneySection storeId={storeId} />}
      {section === "marketing" && <MarketingSection storeId={storeId} />}
    </div>
  );
}

// ─────────────────── 0. DEMO MODE — One-Click Sample Data
function DemoSection({ storeId }) {
  const tr = usePosAdvancedTr();
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState(null);

  const seed = async () => {
    setBusy("seed");
    try {
      const d = await api(`/api/pos/demo/seed?store_id=${storeId}`, { method: "POST" });
      setResult(d.created);
      toast.success(tr({ de: "Demo-Daten erstellt!", en: "Demo data created!", sq: "Të dhënat demo u krijuan!", ar: "تم إنشاء بيانات العرض!" }));
    } catch (err) { toast.error(err.message); } finally { setBusy(""); }
  };

  const clear = async () => {
    if (!window.confirm(tr({ de: "ALLE Demo-Daten (Präfix DEMO) löschen?", en: "Delete ALL demo data (prefix DEMO)?", sq: "Të fshihen TË GJITHA të dhënat demo (prefiksi DEMO)?", ar: "حذف كل بيانات العرض (بادئة DEMO)؟" }))) return;
    setBusy("clear");
    try {
      const d = await api(`/api/pos/demo/clear?store_id=${storeId}`, { method: "DELETE" });
      const total = Object.values(d.deleted).reduce((a, b) => a + b, 0);
      toast.success(tr({ de: `${total} Demo-Einträge gelöscht`, en: `${total} demo entries deleted`, sq: `${total} hyrje demo u fshinë`, ar: `تم حذف ${total} من بيانات العرض` }));
      setResult(null);
    } catch (err) { toast.error(err.message); } finally { setBusy(""); }
  };

  return (
    <>
      <Card title={tr({ de: "Demo-Daten mit einem Klick anlegen", en: "Create demo data in one click", sq: "Krijo të dhëna demo me një klikim", ar: "أنشئ بيانات العرض بنقرة واحدة" })} icon={Sparkles}>
        <p className="text-[10px] text-white/50 mb-3 leading-relaxed">
          {tr({ de: "Perfekt für den ersten Test: erzeugt sofort einen Test-Lieferanten, 3 Demo-Produkte (Cola, Brötchen, Burger-Menü), einen 25 €-Gutschein, eine offene Inventur, ein Rezept, eine Reservierung und eine Schicht für heute.", en: "Perfect for a first test: instantly creates a supplier, 3 demo products, a €25 gift card, an open stocktake, a recipe, a reservation and a shift for today.", sq: "Perfekte për testin e parë: krijon menjëherë një furnitor, 3 produkte demo, një voucher 25 €, një inventurë të hapur, një recetë, një rezervim dhe një turn për sot.", ar: "مثالي لأول اختبار: ينشئ فوراً مورداً و3 منتجات تجريبية وبطاقة هدية بقيمة 25€ وجرداً مفتوحاً ووصفةً وحجزاً ومناوبة لليوم." })}
          <span className="text-[#00C2FF] font-bold"> DEMO</span>.
        </p>
        <div className="flex gap-2">
          <Btn onClick={seed} loading={busy === "seed"} testId="demo-seed-btn">
            <Sparkles size={12} /> {tr({ de: "Demo-Daten erstellen", en: "Create demo data", sq: "Krijo të dhëna demo", ar: "أنشئ بيانات العرض" })}
          </Btn>
          <Btn onClick={clear} loading={busy === "clear"} variant="secondary" testId="demo-clear-btn">
            {tr({ de: "Alle DEMO-Einträge löschen", en: "Delete all DEMO entries", sq: "Fshi të gjitha hyrjet DEMO", ar: "احذف كل بيانات DEMO" })}
          </Btn>
        </div>
        {result && (
          <div className="mt-3 bg-black/30 rounded-lg p-3 text-[10px] space-y-1" data-testid="demo-result">
            <p className="text-[#10B981] font-bold">✓ {tr({ de: "Erstellt", en: "Created", sq: "U krijua", ar: "تم الإنشاء" })}:</p>
            <p className="text-white/70">• {tr({ de: "Lieferant", en: "Supplier", sq: "Furnitor", ar: "المورد" })}: <span className="text-white">{result.supplier_id}</span></p>
            <p className="text-white/70">• {tr({ de: "Produkte", en: "Products", sq: "Produktet", ar: "المنتجات" })}: <span className="text-white">{result.product_ids?.length || 0}</span> (IDs: {(result.product_ids || []).join(", ")})</p>
            <p className="text-white/70">• {tr({ de: "Gutschein", en: "Gift card", sq: "Voucher", ar: "بطاقة هدية" })}: <span className="text-[#00C2FF] font-bold">{result.giftcard?.code}</span> ({result.giftcard?.amount} €)</p>
            <p className="text-white/70">• {tr({ de: "Offene Inventur", en: "Open stocktake", sq: "Inventurë e hapur", ar: "جرد مفتوح" })}: <span className="text-white">{result.stocktake_id}</span></p>
            <p className="text-white/70">• {tr({ de: "Rezept verknüpft", en: "Recipe linked", sq: "Receta e lidhur", ar: "وصفة مرتبطة" })}: <span className="text-white">{result.recipe_for}</span></p>
            <p className="text-white/70">• {tr({ de: "Reservierung", en: "Reservation", sq: "Rezervim", ar: "حجز" })}: <span className="text-white">{result.reservation_id}</span></p>
            <p className="text-white/70">• {tr({ de: "Schicht für heute angelegt", en: "Shift created for today", sq: "Turni për sot u krijua", ar: "تم إنشاء مناوبة لليوم" })}</p>
            <p className="text-white/40 mt-2 italic">{tr({ de: "Tipp: wechsle in die Tabs Bestand+, Rezepte oder Schicht & Reservierung, um die Daten zu sehen.", en: "Tip: switch to Inventory+, Recipes or Shifts & Reservations to see the data.", sq: "Këshillë: kalo te Inventari+, Recetat ose Turnet & Rezervimet për t'i parë të dhënat.", ar: "نصيحة: انتقل إلى المخزون+ أو الوصفات أو المناوبات والحجوزات لرؤية البيانات." })}</p>
          </div>
        )}
      </Card>
    </>
  );
}

// ─────────────────── 1. KI: OCR + Voice
function KISection({ storeId, registerId }) {
  const tr = usePosAdvancedTr();
  const fileInputRef = useRef(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [poId, setPoId] = useState("");

  const [recording, setRecording] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceResult, setVoiceResult] = useState(null);
  const mediaRecRef = useRef(null);
  const audioChunksRef = useRef([]);

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    setOcrResult(null);
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const data = await api("/api/pos/ocr/delivery-note", {
        method: "POST",
        body: { image_base64: b64, store_id: storeId, po_id: poId || null },
      });
      setOcrResult(data);
      toast.success(tr({ de: `${data.count} Artikel erkannt`, en: `${data.count} items detected`, sq: `U zbuluan ${data.count} artikuj`, ar: `تم اكتشاف ${data.count} عناصر` }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setOcrLoading(false);
      e.target.value = "";
    }
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      rec.ondataavailable = (ev) => audioChunksRef.current.push(ev.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const b64 = await new Promise((res) => {
          const r = new FileReader();
          r.onload = () => res(r.result.split(",")[1]);
          r.readAsDataURL(blob);
        });
        setVoiceLoading(true);
        try {
          const data = await api("/api/pos/voice/transcribe", {
            method: "POST",
            body: { audio_base64: b64, register_id: registerId },
          });
          setVoiceResult(data);
          toast.success(tr({ de: "Transkribiert", en: "Transcribed", sq: "U transkriptua", ar: "تم التفريغ" }));
        } catch (err) {
          toast.error(err.message);
        } finally {
          setVoiceLoading(false);
        }
      };
      rec.start();
      mediaRecRef.current = rec;
      setRecording(true);
    } catch (err) {
      toast.error(tr({ de: "Mikrofon-Zugriff verweigert", en: "Microphone access denied", sq: "Qasja në mikrofon u refuzua", ar: "تم رفض الوصول إلى الميكروفون" }));
    }
  };

  const stopRec = () => {
    if (mediaRecRef.current && recording) {
      mediaRecRef.current.stop();
      setRecording(false);
    }
  };

  return (
    <>
      <Card title={tr({ de: "Lieferschein / Rechnung scannen (Gemini Vision OCR)", en: "Scan delivery note / invoice (Gemini Vision OCR)", sq: "Skano fletëdorëzimin / faturën (Gemini Vision OCR)", ar: "امسح ورقة التسليم / الفاتورة (Gemini Vision OCR)" })} icon={Camera}>
        <p className="text-[10px] text-white/40 mb-2">{tr({ de: "Foto vom Lieferschein hochladen — KI extrahiert Artikel automatisch.", en: "Upload a delivery note photo — AI extracts items automatically.", sq: "Ngarko një foto të fletëdorëzimit — AI nxjerr artikujt automatikisht.", ar: "ارفع صورة ورقة التسليم — يستخرج الذكاء الاصطناعي العناصر تلقائياً." })}</p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Input value={poId} onChange={setPoId} placeholder={tr({ de: "PO-ID (optional)", en: "PO ID (optional)", sq: "PO ID (opsionale)", ar: "معرّف PO (اختياري)" })} testId="ocr-po-id" />
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={onPickFile} className="hidden" data-testid="ocr-file-input" />
          <Btn onClick={() => fileInputRef.current?.click()} loading={ocrLoading} testId="ocr-upload-btn">
            <Camera size={12} /> {ocrLoading ? tr({ de: "Analysiere…", en: "Analyzing…", sq: "Po analizohet…", ar: "جارٍ التحليل…" }) : tr({ de: "Foto wählen", en: "Choose photo", sq: "Zgjidh foto", ar: "اختر صورة" })}
          </Btn>
        </div>
        {ocrResult && (
          <div className="mt-2 max-h-64 overflow-y-auto bg-black/30 rounded-lg p-2" data-testid="ocr-result">
            <p className="text-[10px] text-[#00C2FF] mb-1">{ocrResult.count} {tr({ de: "Artikel", en: "items", sq: "artikuj", ar: "عناصر" })}:</p>
            {ocrResult.items?.map((it, i) => (
              <div key={i} className="text-[10px] text-white/80 py-0.5 border-b border-white/5">
                {it.quantity}× {it.name} — {it.unit_price ? `€${it.unit_price}` : ""} {it.barcode ? `· EAN ${it.barcode}` : ""}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={tr({ de: "Sprach-Befehl an die Kasse (Whisper)", en: "Voice command at checkout (Whisper)", sq: "Komandë zanore për arkën (Whisper)", ar: "أمر صوتي إلى الكاشير (Whisper)" })} icon={Mic}>
        <p className="text-[10px] text-white/40 mb-2">{tr({ de: "Beispiele: 2 Coca-Cola hinzufügen, 10 Prozent Rabatt, Stornieren", en: "Examples: add 2 Coca-Cola, 10 percent discount, cancel", sq: "Shembuj: shto 2 Coca-Cola, 10 për qind zbritje, anulo", ar: "أمثلة: أضف 2 كوكاكولا، خصم 10 بالمئة، إلغاء" })}</p>
        <div className="flex gap-2">
          {!recording ? (
            <Btn onClick={startRec} loading={voiceLoading} testId="voice-rec-start">
              <Mic size={12} /> {voiceLoading ? tr({ de: "Verarbeite…", en: "Processing…", sq: "Po përpunohet…", ar: "جارٍ المعالجة…" }) : tr({ de: "Aufnahme starten", en: "Start recording", sq: "Nis regjistrimin", ar: "ابدأ التسجيل" })}
            </Btn>
          ) : (
            <Btn onClick={stopRec} variant="secondary" testId="voice-rec-stop">
              <MicOff size={12} /> {tr({ de: "Stop", en: "Stop", sq: "Ndalo", ar: "إيقاف" })}
            </Btn>
          )}
        </div>
        {voiceResult && (
          <div className="mt-2 bg-black/30 rounded-lg p-2 text-[10px]" data-testid="voice-result">
            <p className="text-white/60">{tr({ de: "Text", en: "Text", sq: "Teksti", ar: "النص" })}: <span className="text-white">{voiceResult.text}</span></p>
            <p className="text-[#00C2FF] mt-1">{tr({ de: "Befehl", en: "Command", sq: "Komanda", ar: "الأمر" })}: {JSON.stringify(voiceResult.command)}</p>
          </div>
        )}
      </Card>
    </>
  );
}

// ─────────────────── 2. STOCK: Bulk-Import/Export, Auto-Order, Inventur, Chargen, Etiketten
function StockSection({ storeId }) {
  const tr = usePosAdvancedTr();
  const [busy, setBusy] = useState("");
  const fileRef = useRef(null);
  const [autoSettings, setAutoSettings] = useState({
    enabled: false,
    trigger_low_stock: true,
    trigger_velocity: true,
    trigger_daily_time: false,
    run_time: "20:00",
    velocity_days: 7,
    lookahead_days: 3,
    auto_submit_orders: true,
    print_delivery_note: true,
  });
  const [autoItems, setAutoItems] = useState([]);
  const [autoOrderResult, setAutoOrderResult] = useState(null);

  const loadAutoOrder = useCallback(async () => {
    try {
      const [settingsRes, itemsRes] = await Promise.all([
        api(`/api/pos/auto-order/settings?store_id=${storeId}`),
        api(`/api/pos/auto-order/items?store_id=${storeId}`),
      ]);
      setAutoSettings(settingsRes.settings || {});
      setAutoItems(itemsRes.items || []);
    } catch (err) { void err; }
  }, [storeId]);

  useEffect(() => { loadAutoOrder(); }, [loadAutoOrder]);

  const csvImport = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy("import");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch(`${API}/api/pos/products/bulk-import?store_id=${storeId}`, {
        method: "POST", credentials: "include", body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || tr({ de: "Import fehlgeschlagen", en: "Import failed", sq: "Importi dështoi", ar: "فشل الاستيراد" }));
      toast.success(tr({ de: `${data.created} angelegt, ${data.skipped} übersprungen`, en: `${data.created} created, ${data.skipped} skipped`, sq: `${data.created} u krijuan, ${data.skipped} u kapërcyen`, ar: `تم إنشاء ${data.created} وتخطي ${data.skipped}` }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy("");
      e.target.value = "";
    }
  };

  const csvExport = async () => {
    setBusy("export");
    try {
      const r = await fetch(`${API}/api/pos/products/bulk-export?store_id=${storeId}`, { credentials: "include" });
      if (!r.ok) throw new Error(tr({ de: "Export fehlgeschlagen", en: "Export failed", sq: "Eksporti dështoi", ar: "فشل التصدير" }));
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `produkte_${storeId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(tr({ de: "CSV exportiert", en: "CSV exported", sq: "CSV u eksportua", ar: "تم تصدير CSV" }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  };

  const autoOrder = async () => {
    setBusy("auto");
    try {
      const data = await api(`/api/pos/auto-order/run?store_id=${storeId}`, { method: "POST" });
      setAutoOrderResult(data);
      toast.success(tr({ de: `${data.created_pos.length} Bestellungen für ${data.low_stock_count} niedrige Artikel angelegt`, en: `${data.created_pos.length} orders created for ${data.low_stock_count} low-stock items`, sq: `U krijuan ${data.created_pos.length} porosi për ${data.low_stock_count} artikuj me stok të ulët`, ar: `تم إنشاء ${data.created_pos.length} طلبات لـ ${data.low_stock_count} عناصر منخفضة المخزون` }));
      loadAutoOrder();
    } catch (err) { toast.error(err.message); } finally { setBusy(""); }
  };

  const saveAutoSettings = async () => {
    setBusy("auto-settings");
    try {
      const data = await api(`/api/pos/auto-order/settings?store_id=${storeId}`, { method: "POST", body: autoSettings });
      setAutoSettings(data.settings || autoSettings);
      toast.success(tr({ de: "Auto-Bestellregeln gespeichert", en: "Auto-order rules saved", sq: "Rregullat e auto-porosisë u ruajtën", ar: "تم حفظ قواعد الطلب التلقائي" }));
    } catch (err) { toast.error(err.message); } finally { setBusy(""); }
  };

  const saveAutoItems = async () => {
    setBusy("auto-items");
    try {
      await api(`/api/pos/auto-order/items`, { method: "POST", body: { store_id: storeId, items: autoItems } });
      toast.success(tr({ de: "Auto-Bestellartikel gespeichert", en: "Auto-order items saved", sq: "Artikujt e auto-porosisë u ruajtën", ar: "تم حفظ عناصر الطلب التلقائي" }));
      loadAutoOrder();
    } catch (err) { toast.error(err.message); } finally { setBusy(""); }
  };

  const updateAutoItem = (productId, patch) => {
    setAutoItems((prev) => prev.map((item) => item.product_id === productId ? { ...item, ...patch } : item));
  };

  // Etiketten
  const [labelIds, setLabelIds] = useState("");
  const [labelCopies, setLabelCopies] = useState(1);
  const printLabels = async () => {
    if (!labelIds.trim()) return toast.error(tr({ de: "Produkt-IDs fehlen", en: "Product IDs missing", sq: "Mungojnë ID-të e produkteve", ar: "معرّفات المنتجات مفقودة" }));
    setBusy("labels");
    try {
      const r = await fetch(`${API}/api/pos/labels/generate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_ids: labelIds.split(",").map((x) => x.trim()).filter(Boolean),
          copies_per_product: labelCopies,
        }),
      });
      if (!r.ok) throw new Error(tr({ de: "Etiketten-Druck fehlgeschlagen", en: "Label print failed", sq: "Printimi i etiketave dështoi", ar: "فشل طباعة الملصقات" }));
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      toast.success(tr({ de: "Etiketten generiert", en: "Labels generated", sq: "Etiketat u gjeneruan", ar: "تم إنشاء الملصقات" }));
    } catch (err) { toast.error(err.message); } finally { setBusy(""); }
  };

  // Inventur
  const [stocktakes, setStocktakes] = useState([]);
  const [stkName, setStkName] = useState(`${tr({ de: "Inventur", en: "Stocktake", sq: "Inventurë", ar: "الجرد" })} ` + new Date().toLocaleDateString("de-DE"));
  const loadStk = useCallback(async () => {
    try {
      const d = await api(`/api/pos/stocktake/list?store_id=${storeId}`);
      setStocktakes(d.stocktakes || d || []);
    } catch (err) { void err; }
  }, [storeId]);
  useEffect(() => { loadStk(); }, [loadStk]);

  const startStk = async () => {
    try {
      await api("/api/pos/stocktake/start", { method: "POST", body: { store_id: storeId, name: stkName } });
      toast.success(tr({ de: "Inventur gestartet", en: "Stocktake started", sq: "Inventura u nis", ar: "تم بدء الجرد" }));
      loadStk();
    } catch (err) { toast.error(err.message); }
  };

  const finalizeStk = async (id) => {
    if (!window.confirm(tr({ de: "Inventur abschließen und Bestand korrigieren?", en: "Finalize stocktake and adjust inventory?", sq: "Të mbyllet inventura dhe të korrigjohet stoku?", ar: "إنهاء الجرد وتعديل المخزون؟" }))) return;
    try {
      const d = await api(`/api/pos/stocktake/${id}/finalize`, { method: "POST" });
      toast.success(tr({ de: `Abgeschlossen — ${d.adjustments || 0} Anpassungen`, en: `Completed — ${d.adjustments || 0} adjustments`, sq: `U përfundua — ${d.adjustments || 0} korrigjime`, ar: `اكتمل — ${d.adjustments || 0} تعديلات` }));
      loadStk();
    } catch (err) { toast.error(err.message); }
  };

  // Chargen
  const [batches, setBatches] = useState([]);
  const [expiryDays, setExpiryDays] = useState(14);
  const loadBatches = useCallback(async () => {
    try {
      const d = await api(`/api/pos/batches/expiring?store_id=${storeId}&days=${expiryDays}`);
      setBatches(d.batches || []);
    } catch (err) { void err; }
  }, [storeId, expiryDays]);
  useEffect(() => { loadBatches(); }, [loadBatches]);

  return (
    <>
      <Card title={tr({ de: "CSV Bulk-Import / Export", en: "CSV bulk import / export", sq: "CSV import / export në grup", ar: "استيراد / تصدير CSV بالجملة" })} icon={FileSpreadsheet}>
        <p className="text-[10px] text-white/40 mb-2">{tr({ de: "Spalten", en: "Columns", sq: "Kolonat", ar: "الأعمدة" })}: name;barcode;sku;price;purchase_price;tax_rate;stock;minimum_stock;unit;category</p>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" onChange={csvImport} className="hidden" data-testid="csv-import-input" />
          <Btn onClick={() => fileRef.current?.click()} loading={busy === "import"} testId="csv-import-btn">
            <Upload size={12} /> {tr({ de: "CSV importieren", en: "Import CSV", sq: "Importo CSV", ar: "استيراد CSV" })}
          </Btn>
          <Btn onClick={csvExport} loading={busy === "export"} variant="secondary" testId="csv-export-btn">
            <Download size={12} /> {tr({ de: "Exportieren", en: "Export", sq: "Eksporto", ar: "تصدير" })}
          </Btn>
        </div>
      </Card>

      <Card title={tr({ de: "Auto-Bestellung + Lieferschein", en: "Auto-order + delivery note", sq: "Auto-porosi + fletëdorëzim", ar: "طلب تلقائي + ورقة تسليم" })} icon={ShoppingCart}>
        <p className="text-[10px] text-white/40 mb-3">
          {tr({ de: "Kombination aus Mindestbestand, Verkaufsrate und fixer Uhrzeit. Auto-generierte Bestellungen landen direkt in der Warenwirtschaft der POS-Module und erzeugen einen Lieferschein zum Drucken.", en: "Combines minimum stock, sales velocity and a fixed time. Auto-generated orders go directly into POS inventory and create a printable delivery note.", sq: "Kombinon stokun minimal, ritmin e shitjes dhe një orar fiks. Porositë automatike hyjnë direkt në inventarin POS dhe krijojnë fletëdorëzim për printim.", ar: "يجمع بين الحد الأدنى للمخزون وسرعة البيع ووقت ثابت. الطلبات التلقائية تدخل مباشرة إلى مخزون نقاط البيع وتولد ورقة تسليم قابلة للطباعة." })}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-[11px]">
          <label className="bg-black/20 rounded-lg p-2 border border-white/10 flex items-center gap-2" data-testid="auto-order-enabled-toggle">
            <input type="checkbox" checked={!!autoSettings.enabled} onChange={(e) => setAutoSettings({ ...autoSettings, enabled: e.target.checked })} /> {tr({ de: "Aktiv", en: "Active", sq: "Aktiv", ar: "نشط" })}
          </label>
          <label className="bg-black/20 rounded-lg p-2 border border-white/10 flex items-center gap-2">
            <input type="checkbox" checked={!!autoSettings.trigger_low_stock} onChange={(e) => setAutoSettings({ ...autoSettings, trigger_low_stock: e.target.checked })} /> {tr({ de: "Mindestbestand", en: "Minimum stock", sq: "Stoku minimal", ar: "الحد الأدنى للمخزون" })}
          </label>
          <label className="bg-black/20 rounded-lg p-2 border border-white/10 flex items-center gap-2">
            <input type="checkbox" checked={!!autoSettings.trigger_velocity} onChange={(e) => setAutoSettings({ ...autoSettings, trigger_velocity: e.target.checked })} /> {tr({ de: "Verkaufsrate", en: "Sales velocity", sq: "Ritmi i shitjes", ar: "سرعة المبيعات" })}
          </label>
          <label className="bg-black/20 rounded-lg p-2 border border-white/10 flex items-center gap-2">
            <input type="checkbox" checked={!!autoSettings.trigger_daily_time} onChange={(e) => setAutoSettings({ ...autoSettings, trigger_daily_time: e.target.checked })} /> {tr({ de: "Uhrzeit", en: "Time", sq: "Ora", ar: "الوقت" })}
          </label>
          <Input value={autoSettings.run_time} onChange={(v) => setAutoSettings({ ...autoSettings, run_time: v })} placeholder="20:00" testId="auto-order-run-time" />
          <Input value={autoSettings.velocity_days} onChange={(v) => setAutoSettings({ ...autoSettings, velocity_days: v })} type="number" placeholder={tr({ de: "Verkaufstage", en: "Sales days", sq: "Ditët e shitjes", ar: "أيام المبيعات" })} testId="auto-order-velocity-days" />
          <Input value={autoSettings.lookahead_days} onChange={(v) => setAutoSettings({ ...autoSettings, lookahead_days: v })} type="number" placeholder={tr({ de: "Vorlauf Tage", en: "Lead days", sq: "Ditët paraprake", ar: "أيام التحضير" })} testId="auto-order-lookahead-days" />
          <label className="bg-black/20 rounded-lg p-2 border border-white/10 flex items-center gap-2">
            <input type="checkbox" checked={!!autoSettings.auto_submit_orders} onChange={(e) => setAutoSettings({ ...autoSettings, auto_submit_orders: e.target.checked })} /> {tr({ de: "Direkt bestellen", en: "Order directly", sq: "Porosit direkt", ar: "اطلب مباشرة" })}
          </label>
        </div>

        <div className="flex gap-2 mb-3">
          <Btn onClick={saveAutoSettings} loading={busy === "auto-settings"} testId="auto-order-settings-save">
            <ShoppingCart size={12} /> {tr({ de: "Regeln speichern", en: "Save rules", sq: "Ruaj rregullat", ar: "احفظ القواعد" })}
          </Btn>
          <Btn onClick={autoOrder} loading={busy === "auto"} testId="auto-order-btn">
            <ShoppingCart size={12} /> {tr({ de: "Auto-PO ausführen", en: "Run auto PO", sq: "Ekzekuto auto-PO", ar: "شغّل طلب الشراء التلقائي" })}
          </Btn>
        </div>

        <div className="bg-black/20 rounded-xl border border-white/10 overflow-hidden" data-testid="auto-order-items-list">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] uppercase tracking-wide text-white/40 border-b border-white/10">
            <span className="col-span-3">{tr({ de: "Artikel", en: "Item", sq: "Artikulli", ar: "العنصر" })}</span>
            <span className="col-span-2">{tr({ de: "Bestand", en: "Stock", sq: "Stoku", ar: "المخزون" })}</span>
            <span className="col-span-2">{tr({ de: "Ziel", en: "Target", sq: "Synimi", ar: "الهدف" })}</span>
            <span className="col-span-2">VE</span>
            <span className="col-span-2">{tr({ de: "Einheit", en: "Unit", sq: "Njësia", ar: "الوحدة" })}</span>
            <span className="col-span-1">Auto</span>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {autoItems.filter((item) => item.supplier_id).map((item) => (
              <div key={item.product_id} className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-white/5 text-[11px] items-center" data-testid={`auto-order-item-${item.product_id}`}>
                <div className="col-span-3 min-w-0">
                  <p className="text-white font-semibold truncate">{item.name}</p>
                  <p className="text-[10px] text-white/40 truncate">{item.supplier_name || tr({ de: "Lieferant", en: "Supplier", sq: "Furnitor", ar: "المورد" })}</p>
                </div>
                <div className="col-span-2 text-white/70">{item.stock} / min {item.minimum_stock}</div>
                <div className="col-span-2"><Input value={item.reorder_target_stock} onChange={(v) => updateAutoItem(item.product_id, { reorder_target_stock: v })} type="number" placeholder={tr({ de: "Ziel", en: "Target", sq: "Synimi", ar: "الهدف" })} testId={`auto-target-${item.product_id}`} /></div>
                <div className="col-span-2"><Input value={item.order_unit_size} onChange={(v) => updateAutoItem(item.product_id, { order_unit_size: v })} type="number" placeholder="VE" testId={`auto-unit-size-${item.product_id}`} /></div>
                <div className="col-span-2"><Input value={item.order_unit_label} onChange={(v) => updateAutoItem(item.product_id, { order_unit_label: v })} placeholder={tr({ de: "Stk / Stange", en: "pcs / pack", sq: "copë / pako", ar: "قطعة / عبوة" })} testId={`auto-unit-label-${item.product_id}`} /></div>
                <label className="col-span-1 flex justify-center"><input type="checkbox" checked={!!item.auto_reorder_enabled} onChange={(e) => updateAutoItem(item.product_id, { auto_reorder_enabled: e.target.checked })} data-testid={`auto-enable-${item.product_id}`} /></label>
                <div className="col-span-12"><Input value={item.reorder_note || ""} onChange={(v) => updateAutoItem(item.product_id, { reorder_note: v })} placeholder={tr({ de: "Hinweis für Lieferschein / Bestellung (optional)", en: "Note for delivery note / order (optional)", sq: "Shënim për fletëdorëzim / porosi (opsionale)", ar: "ملاحظة لورقة التسليم / الطلب (اختياري)" })} testId={`auto-note-${item.product_id}`} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <Btn onClick={saveAutoItems} loading={busy === "auto-items"} variant="secondary" testId="auto-order-items-save">
            {tr({ de: "Artikel speichern", en: "Save items", sq: "Ruaj artikujt", ar: "احفظ العناصر" })}
          </Btn>
        </div>

        {autoOrderResult && (
          <div className="mt-3 bg-black/30 rounded-xl p-3 text-[11px] space-y-2" data-testid="auto-order-result">
            <p className="text-white/70">{tr({ de: `${autoOrderResult.created_pos?.length || 0} Bestellung(en) erzeugt für ${autoOrderResult.low_stock_count || 0} betroffene Artikel.`, en: `${autoOrderResult.created_pos?.length || 0} order(s) created for ${autoOrderResult.low_stock_count || 0} affected items.`, sq: `${autoOrderResult.created_pos?.length || 0} porosi u krijuan për ${autoOrderResult.low_stock_count || 0} artikuj të prekur.`, ar: `تم إنشاء ${autoOrderResult.created_pos?.length || 0} طلب/طلبات لـ ${autoOrderResult.low_stock_count || 0} عناصر متأثرة.` })}</p>
            {(autoOrderResult.created_pos || []).map((po) => (
              <div key={po.po_id} className="flex flex-wrap items-center justify-between gap-2 border border-white/10 rounded-lg p-2">
                <div>
                  <p className="font-semibold text-white">{po.supplier_name || po.supplier}</p>
                  <p className="text-white/45">{po.po_id} · {po.lines} Pos · €{Number(po.total || 0).toFixed(2)}</p>
                </div>
                <div className="flex gap-2">
                  <Btn onClick={() => window.open(`${API}${po.delivery_note_url}`, "_blank")} variant="secondary" testId={`auto-delivery-note-${po.po_id}`}>
                    <Receipt size={12} /> {tr({ de: "Lieferschein", en: "Delivery note", sq: "Fletëdorëzimi", ar: "ورقة التسليم" })}
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={tr({ de: "Etiketten / Preisschilder drucken (PDF)", en: "Print labels / price tags (PDF)", sq: "Printo etiketa / çmimet (PDF)", ar: "اطبع الملصقات / بطاقات الأسعار (PDF)" })} icon={Tag}>
        <Input value={labelIds} onChange={setLabelIds} placeholder={tr({ de: "Produkt-IDs kommagetrennt: PRD-123,PRD-456", en: "Product IDs comma-separated: PRD-123,PRD-456", sq: "ID-të e produkteve me presje: PRD-123,PRD-456", ar: "معرّفات المنتجات مفصولة بفواصل: PRD-123,PRD-456" })} testId="label-ids-input" />
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Input value={labelCopies} onChange={setLabelCopies} type="number" placeholder={tr({ de: "Kopien", en: "Copies", sq: "Kopje", ar: "نسخ" })} testId="label-copies-input" />
          <Btn onClick={printLabels} loading={busy === "labels"} testId="label-print-btn">
            <Tag size={12} /> {tr({ de: "Drucken", en: "Print", sq: "Printo", ar: "طباعة" })}
          </Btn>
        </div>
      </Card>

      <Card title={tr({ de: "Inventur", en: "Stocktake", sq: "Inventura", ar: "الجرد" })} icon={ClipboardList}>
        <div className="flex gap-2 mb-3">
          <Input value={stkName} onChange={setStkName} placeholder={tr({ de: "Inventur-Name", en: "Stocktake name", sq: "Emri i inventurës", ar: "اسم الجرد" })} testId="stk-name-input" />
          <Btn onClick={startStk} testId="stk-start-btn">{tr({ de: "Start", en: "Start", sq: "Nis", ar: "ابدأ" })}</Btn>
        </div>
        {stocktakes.length === 0 ? (
          <p className="text-[10px] text-white/40">{tr({ de: "Keine Inventuren bisher.", en: "No stocktakes yet.", sq: "Ende nuk ka inventura.", ar: "لا توجد عمليات جرد بعد." })}</p>
        ) : (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {stocktakes.map((s) => (
              <div key={s.stocktake_id} className="flex justify-between bg-black/20 rounded-lg p-2 text-[10px]">
                <span className="text-white/80">{s.name} — <span className="text-white/40">{s.status}</span></span>
                {s.status === "open" && (
                  <button onClick={() => finalizeStk(s.stocktake_id)} className="text-[#00C2FF] font-bold" data-testid={`stk-finalize-${s.stocktake_id}`}>
                    {tr({ de: "Abschließen", en: "Finalize", sq: "Mbylle", ar: "إنهاء" })}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={tr({ de: "Chargen — bald ablaufend", en: "Batches — expiring soon", sq: "Lotet — skadojnë së shpejti", ar: "الدفعات — تنتهي قريباً" })} icon={Layers}>
        <div className="flex gap-2 mb-3">
          <Input value={expiryDays} onChange={setExpiryDays} type="number" placeholder={tr({ de: "Tage", en: "Days", sq: "Ditë", ar: "أيام" })} testId="expiry-days-input" />
          <Btn onClick={loadBatches} variant="secondary" testId="expiry-refresh-btn">{tr({ de: "Aktualisieren", en: "Refresh", sq: "Përditëso", ar: "تحديث" })}</Btn>
        </div>
        {batches.length === 0 ? (
          <p className="text-[10px] text-white/40">{tr({ de: `Keine Chargen laufen in ${expiryDays} Tagen ab.`, en: `No batches expire within ${expiryDays} days.`, sq: `Asnjë lot nuk skadon brenda ${expiryDays} ditëve.`, ar: `لا توجد دفعات تنتهي خلال ${expiryDays} يومًا.` })}</p>
        ) : (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {batches.map((b, i) => (
              <div key={i} className="text-[10px] bg-black/20 rounded-lg p-2 text-white/80">
                {b.product_name || b.product_id} — Charge {b.batch_no} · {b.quantity}× · MHD {b.expiry_date}
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

// ─────────────────── 3. MENU: Rezepte (BOM) + Cross-Sell + Forecast
function MenuSection({ storeId }) {
  const tr = usePosAdvancedTr();
  const [productId, setProductId] = useState("");
  const [recipe, setRecipe] = useState({ ingredients: [{ product_id: "", quantity: 1 }] });
  const [busy, setBusy] = useState(false);

  const addIng = () => setRecipe((r) => ({ ...r, ingredients: [...r.ingredients, { product_id: "", quantity: 1 }] }));
  const setIng = (i, k, v) => setRecipe((r) => ({
    ...r,
    ingredients: r.ingredients.map((ing, idx) => idx === i ? { ...ing, [k]: k === "quantity" ? parseFloat(v) : v } : ing),
  }));

  const saveRecipe = async () => {
    if (!productId) return toast.error(tr({ de: "Produkt-ID fehlt", en: "Product ID missing", sq: "Mungon ID e produktit", ar: "معرّف المنتج مفقود" }));
    setBusy(true);
    try {
      await api("/api/pos/recipes/create", {
        method: "POST",
        body: { product_id: productId, ingredients: recipe.ingredients.filter((i) => i.product_id) },
      });
      toast.success(tr({ de: "Rezept gespeichert", en: "Recipe saved", sq: "Receta u ruajt", ar: "تم حفظ الوصفة" }));
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  // Cross-sell
  const [csProductId, setCsProductId] = useState("");
  const [crossSells, setCrossSells] = useState([]);
  const loadCs = async () => {
    if (!csProductId) return;
    try {
      const d = await api(`/api/pos/cross-sell/${csProductId}?store_id=${storeId}`);
      setCrossSells(d.suggestions || []);
    } catch (err) { toast.error(err.message); }
  };

  // Forecast
  const [forecastDays, setForecastDays] = useState(7);
  const [forecast, setForecast] = useState(null);
  const loadForecast = async () => {
    try {
      const d = await api(`/api/pos/forecast/sales?store_id=${storeId}&days_ahead=${forecastDays}`);
      setForecast(d);
    } catch (err) { toast.error(err.message); }
  };

  return (
    <>
      <Card title={tr({ de: "Rezepte / Stücklisten (BOM)", en: "Recipes / bill of materials (BOM)", sq: "Receta / BOM", ar: "الوصفات / قائمة المواد" })} icon={ChefHat}>
        <p className="text-[10px] text-white/40 mb-2">{tr({ de: "Bei Verkauf eines Gerichts werden die Zutaten automatisch vom Lager abgezogen.", en: "When a dish is sold, ingredients are deducted from stock automatically.", sq: "Kur shitet një pjatë, përbërësit zbriten automatikisht nga stoku.", ar: "عند بيع طبق، يتم خصم المكونات من المخزون تلقائياً." })}</p>
        <Input value={productId} onChange={setProductId} placeholder={tr({ de: "Produkt-ID des Gerichts (PRD-…)", en: "Dish product ID (PRD-…)", sq: "ID e produktit të pjatës (PRD-…)", ar: "معرّف منتج الطبق (PRD-…)" })} testId="recipe-product-id" />
        <div className="my-2 space-y-1">
          {recipe.ingredients.map((ing, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <div className="col-span-2"><Input value={ing.product_id} onChange={(v) => setIng(i, "product_id", v)} placeholder={tr({ de: "Zutat-ID", en: "Ingredient ID", sq: "ID e përbërësit", ar: "معرّف المكوّن" })} testId={`recipe-ing-${i}`} /></div>
              <Input value={ing.quantity} onChange={(v) => setIng(i, "quantity", v)} type="number" placeholder={tr({ de: "Menge", en: "Quantity", sq: "Sasia", ar: "الكمية" })} testId={`recipe-qty-${i}`} />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Btn onClick={addIng} variant="secondary" testId="recipe-add-ing">+ {tr({ de: "Zutat", en: "Ingredient", sq: "Përbërës", ar: "مكوّن" })}</Btn>
          <Btn onClick={saveRecipe} loading={busy} testId="recipe-save-btn">{tr({ de: "Speichern", en: "Save", sq: "Ruaj", ar: "حفظ" })}</Btn>
        </div>
      </Card>

      <Card title={tr({ de: "Cross-Sell-Empfehlungen", en: "Cross-sell suggestions", sq: "Sugjerime cross-sell", ar: "اقتراحات البيع الإضافي" })} icon={Sparkles}>
        <div className="flex gap-2 mb-2">
          <Input value={csProductId} onChange={setCsProductId} placeholder={tr({ de: "Produkt-ID", en: "Product ID", sq: "ID e produktit", ar: "معرّف المنتج" })} testId="cs-product-id" />
          <Btn onClick={loadCs} testId="cs-load-btn">{tr({ de: "Vorschläge", en: "Suggestions", sq: "Sugjerime", ar: "اقتراحات" })}</Btn>
        </div>
        {crossSells.length > 0 && (
          <div className="space-y-1">
            {crossSells.map((c, i) => (
              <div key={i} className="text-[10px] bg-black/20 rounded-lg p-2 text-white/80">
                {c.name} — {c.frequency || c.count || 0}× {tr({ de: "zusammen gekauft", en: "bought together", sq: "blerë bashkë", ar: "تم شراؤه معًا" })}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={tr({ de: "KI-Umsatzprognose", en: "AI revenue forecast", sq: "Parashikimi AI i të ardhurave", ar: "توقع الإيرادات بالذكاء الاصطناعي" })} icon={TrendingUp}>
        <div className="flex gap-2 mb-2">
          <Input value={forecastDays} onChange={setForecastDays} type="number" placeholder={tr({ de: "Tage voraus", en: "Days ahead", sq: "Ditë përpara", ar: "أيام مسبقًا" })} testId="fc-days" />
          <Btn onClick={loadForecast} testId="fc-load-btn">{tr({ de: "Berechnen", en: "Calculate", sq: "Llogarit", ar: "احسب" })}</Btn>
        </div>
        {forecast && (
          <div className="bg-black/20 rounded-lg p-2 text-[10px]">
            <p className="text-[#00C2FF] mb-1">{tr({ de: "Prognose", en: "Forecast", sq: "Parashikimi", ar: "التوقع" })}:</p>
            {(forecast.forecast || forecast.days || []).map((d, i) => (
              <div key={i} className="flex justify-between text-white/80 py-0.5">
                <span>{d.date}</span><span>€{(d.predicted_revenue || d.value || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

// ─────────────────── 4. OPS: Schichtplan + Reservierung + Online-Katalog + Performance
function OpsSection({ storeId }) {
  // Schicht
  const [schedule, setSchedule] = useState({ user_id: "", date: new Date().toISOString().slice(0, 10), start: "09:00", end: "17:00", role: "cashier" });
  const [weekStart, setWeekStart] = useState(new Date().toISOString().slice(0, 10));
  const [weekData, setWeekData] = useState([]);

  const addSch = async () => {
    try {
      await api("/api/pos/schedule/add", { method: "POST", body: { ...schedule, store_id: storeId } });
      toast.success("Schicht eingetragen");
      loadWeek();
    } catch (err) { toast.error(err.message); }
  };
  const loadWeek = useCallback(async () => {
    try {
      const d = await api(`/api/pos/schedule/week?store_id=${storeId}&week_start=${weekStart}`);
      setWeekData(d.entries || d.schedule || []);
    } catch (err) { toast.error(err.message); }
  }, [storeId, weekStart]);
  useEffect(() => { loadWeek(); }, [loadWeek]);

  // Reservierung
  const [resv, setResv] = useState({ guest_name: "", phone: "", when: "", party_size: 2, notes: "" });
  const [resvList, setResvList] = useState([]);
  const addResv = async () => {
    if (!resv.guest_name || !resv.when) return toast.error("Name & Zeit nötig");
    try {
      await api("/api/pos/reservations/create", { method: "POST", body: { ...resv, store_id: storeId } });
      toast.success("Reservierung gespeichert");
      loadResv();
    } catch (err) { toast.error(err.message); }
  };
  const loadResv = useCallback(async () => {
    try {
      const d = await api(`/api/pos/reservations?store_id=${storeId}`);
      setResvList(d.reservations || []);
    } catch (err) { void err; }
  }, [storeId]);
  useEffect(() => { loadResv(); }, [loadResv]);

  // Performance
  const [perfDays, setPerfDays] = useState(30);
  const [perf, setPerf] = useState([]);
  const loadPerf = async () => {
    try {
      const d = await api(`/api/pos/performance/cashiers?store_id=${storeId}&days=${perfDays}`);
      setPerf(d.cashiers || d.performance || []);
    } catch (err) { toast.error(err.message); }
  };

  return (
    <>
      <Card title="Schichtplan" icon={CalendarDays}>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Input value={schedule.user_id} onChange={(v) => setSchedule({ ...schedule, user_id: v })} placeholder="User-ID" testId="sch-user" />
          <Input value={schedule.role} onChange={(v) => setSchedule({ ...schedule, role: v })} placeholder="Rolle" testId="sch-role" />
          <Input value={schedule.date} onChange={(v) => setSchedule({ ...schedule, date: v })} type="date" testId="sch-date" />
          <div className="grid grid-cols-2 gap-1">
            <Input value={schedule.start} onChange={(v) => setSchedule({ ...schedule, start: v })} placeholder="09:00" testId="sch-start" />
            <Input value={schedule.end} onChange={(v) => setSchedule({ ...schedule, end: v })} placeholder="17:00" testId="sch-end" />
          </div>
        </div>
        <div className="flex gap-2 mb-2">
          <Btn onClick={addSch} testId="sch-add-btn">+ Schicht</Btn>
          <Input value={weekStart} onChange={setWeekStart} type="date" testId="sch-week-start" />
          <Btn onClick={loadWeek} variant="secondary" testId="sch-load-btn">Woche laden</Btn>
        </div>
        {weekData.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {weekData.map((w, i) => (
              <div key={i} className="text-[10px] bg-black/20 rounded-lg p-2 text-white/80">
                {w.date} · {w.user_id} · {w.start}–{w.end} · {w.role}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Reservierungen" icon={BookOpen}>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Input value={resv.guest_name} onChange={(v) => setResv({ ...resv, guest_name: v })} placeholder="Gast-Name" testId="rsv-name" />
          <Input value={resv.phone} onChange={(v) => setResv({ ...resv, phone: v })} placeholder="Telefon" testId="rsv-phone" />
          <Input value={resv.when} onChange={(v) => setResv({ ...resv, when: v })} placeholder="2026-02-15 19:00" testId="rsv-when" />
          <Input value={resv.party_size} onChange={(v) => setResv({ ...resv, party_size: v })} type="number" placeholder="Personen" testId="rsv-party" />
        </div>
        <Btn onClick={addResv} testId="rsv-add-btn">Reservieren</Btn>
        {resvList.length > 0 && (
          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
            {resvList.map((r, i) => (
              <div key={i} className="text-[10px] bg-black/20 rounded-lg p-2 text-white/80">
                {r.when} · {r.guest_name} · {r.party_size}P · {r.phone || "-"}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Online-Katalog (öffentlich)" icon={Globe}>
        <p className="text-[10px] text-white/40 mb-2">Teile diese URL für die öffentliche Speisekarte / Online-Bestellung:</p>
        <div className="bg-black/30 rounded-lg p-2 text-[10px] text-[#00C2FF] break-all" data-testid="public-catalog-url">
          {API}/api/pos/public/catalog/{storeId}
        </div>
        <Btn onClick={() => { navigator.clipboard.writeText(`${API}/api/pos/public/catalog/${storeId}`); toast.success("Kopiert"); }} variant="secondary" testId="catalog-copy">
          Link kopieren
        </Btn>
      </Card>

      <Card title="Kassierer-Performance" icon={TrendingUp}>
        <div className="flex gap-2 mb-2">
          <Input value={perfDays} onChange={setPerfDays} type="number" placeholder="Tage" testId="perf-days" />
          <Btn onClick={loadPerf} testId="perf-load-btn">Auswerten</Btn>
        </div>
        {perf.length > 0 && (
          <div className="space-y-1">
            {perf.map((p, i) => (
              <div key={i} className="text-[10px] bg-black/20 rounded-lg p-2 text-white/80 flex justify-between">
                <span>{p.cashier_name || p.cashier_id || p.user_id}</span>
                <span>{p.sales_count || p.transactions || 0}× · €{(p.total_revenue || p.revenue || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

// ─────────────────── 5. MONEY: DATEV + Lexoffice + P&L
function MoneySection({ storeId }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const dlExport = async (kind) => {
    try {
      const r = await fetch(`${API}/api/pos/accounting/${kind}/export?store_id=${storeId}&year=${year}&month=${month}`, { credentials: "include" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail || "Export fehlgeschlagen");
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${kind}_${year}-${String(month).padStart(2, "0")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${kind.toUpperCase()} CSV exportiert`);
    } catch (err) { toast.error(err.message); }
  };

  const [pnl, setPnl] = useState(null);
  const loadPnl = useCallback(async () => {
    try {
      const d = await api(`/api/pos/pnl/today?store_id=${storeId}`);
      setPnl(d);
    } catch (err) { toast.error(err.message); }
  }, [storeId]);
  useEffect(() => { loadPnl(); }, [loadPnl]);

  return (
    <>
      <Card title="DATEV / Lexoffice Export" icon={FileSpreadsheet}>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Input value={year} onChange={setYear} type="number" placeholder="Jahr" testId="acc-year" />
          <Input value={month} onChange={setMonth} type="number" placeholder="Monat" testId="acc-month" />
        </div>
        <div className="flex gap-2">
          <Btn onClick={() => dlExport("datev")} testId="datev-btn"><Download size={12} /> DATEV CSV</Btn>
          <Btn onClick={() => dlExport("lexoffice")} variant="secondary" testId="lexoffice-btn"><Download size={12} /> Lexoffice CSV</Btn>
        </div>
      </Card>

      <Card title="Gewinn & Verlust — heute" icon={Receipt}>
        <Btn onClick={loadPnl} variant="secondary" testId="pnl-refresh-btn">Aktualisieren</Btn>
        {pnl && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-black/20 rounded-lg p-2"><p className="text-white/40 text-[9px]">Umsatz</p><p className="text-white font-bold">€{(pnl.revenue || 0).toFixed(2)}</p></div>
            <div className="bg-black/20 rounded-lg p-2"><p className="text-white/40 text-[9px]">Wareneinsatz</p><p className="text-white font-bold">€{(pnl.cogs || 0).toFixed(2)}</p></div>
            <div className="bg-black/20 rounded-lg p-2"><p className="text-white/40 text-[9px]">Brutto-Gewinn</p><p className="text-[#10B981] font-bold">€{(pnl.gross_profit || 0).toFixed(2)}</p></div>
            <div className="bg-black/20 rounded-lg p-2"><p className="text-white/40 text-[9px]">Marge</p><p className="text-[#00C2FF] font-bold">{((pnl.margin_percent || 0)).toFixed(1)}%</p></div>
            <div className="bg-black/20 rounded-lg p-2 col-span-2"><p className="text-white/40 text-[9px]">Transaktionen</p><p className="text-white font-bold">{pnl.transactions || 0}</p></div>
          </div>
        )}
      </Card>
    </>
  );
}

// ─────────────────── 6. MARKETING: Kampagnen + Gutscheine + Alterskontrolle
function MarketingSection({ storeId }) {
  const [camp, setCamp] = useState({ name: "", subject: "", html: "<h1>Hi {{name}}</h1>", target_tier: "all", target_inactive_days: 0 });
  const [busy, setBusy] = useState(false);

  const sendCamp = async () => {
    if (!camp.name || !camp.subject) return toast.error("Name & Betreff nötig");
    setBusy(true);
    try {
      const d = await api("/api/pos/marketing/campaigns/send", { method: "POST", body: camp });
      toast.success(`${d.sent} versendet, ${d.failed} fehlgeschlagen`);
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  // Gutscheine
  const [gc, setGc] = useState({ amount: 25, recipient_email: "", recipient_name: "", message: "" });
  const [gcResult, setGcResult] = useState(null);
  const createGc = async () => {
    try {
      const d = await api("/api/pos/giftcards/create", { method: "POST", body: gc });
      setGcResult(d.giftcard);
      toast.success(`Gutschein-Code: ${d.giftcard.code}`);
    } catch (err) { toast.error(err.message); }
  };

  const [redeemCode, setRedeemCode] = useState("");
  const [redeemAmt, setRedeemAmt] = useState(0);
  const redeemGc = async () => {
    try {
      const d = await api("/api/pos/giftcards/redeem", { method: "POST", body: { code: redeemCode, amount: redeemAmt } });
      toast.success(`€${d.redeemed} eingelöst — Rest €${d.remaining_balance}`);
    } catch (err) { toast.error(err.message); }
  };

  // Alterskontrolle
  const [ageCart, setAgeCart] = useState("");
  const [ageMin, setAgeMin] = useState(18);
  const logAge = async (verified) => {
    if (!ageCart) return toast.error("Cart-ID fehlt");
    try {
      await api("/api/pos/age-check/log", {
        method: "POST",
        body: { cart_id: ageCart, cashier_id: "", age_verified: verified, minimum_age: ageMin, method: "visual" },
      });
      toast.success(verified ? "Alter bestätigt" : "Verkauf abgelehnt — protokolliert");
    } catch (err) { toast.error(err.message); }
  };

  return (
    <>
      <Card title="E-Mail-Kampagne an Stammkunden" icon={Mail}>
        <div className="space-y-2 mb-2">
          <Input value={camp.name} onChange={(v) => setCamp({ ...camp, name: v })} placeholder="Kampagnen-Name" testId="camp-name" />
          <Input value={camp.subject} onChange={(v) => setCamp({ ...camp, subject: v })} placeholder="Betreff" testId="camp-subject" />
          <textarea
            value={camp.html}
            onChange={(e) => setCamp({ ...camp, html: e.target.value })}
            placeholder="HTML-Inhalt"
            data-testid="camp-html"
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white outline-none h-24"
          />
          <div className="grid grid-cols-2 gap-2">
            <select value={camp.target_tier} onChange={(e) => setCamp({ ...camp, target_tier: e.target.value })}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white outline-none" data-testid="camp-tier">
              <option value="all">Alle Tiers</option>
              <option value="bronze">Bronze</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="platinum">Platinum</option>
            </select>
            <Input value={camp.target_inactive_days} onChange={(v) => setCamp({ ...camp, target_inactive_days: v })} type="number" placeholder="Inaktiv seit X Tagen" testId="camp-inactive" />
          </div>
        </div>
        <Btn onClick={sendCamp} loading={busy} testId="camp-send-btn"><Mail size={12} /> Kampagne senden</Btn>
      </Card>

      <Card title="Geschenkgutscheine" icon={Gift}>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Input value={gc.amount} onChange={(v) => setGc({ ...gc, amount: v })} type="number" placeholder="Betrag €" testId="gc-amount" />
          <Input value={gc.recipient_email} onChange={(v) => setGc({ ...gc, recipient_email: v })} placeholder="Empfänger-E-Mail" testId="gc-email" />
          <Input value={gc.recipient_name} onChange={(v) => setGc({ ...gc, recipient_name: v })} placeholder="Empfänger-Name" testId="gc-name" />
          <Input value={gc.message} onChange={(v) => setGc({ ...gc, message: v })} placeholder="Nachricht" testId="gc-msg" />
        </div>
        <Btn onClick={createGc} testId="gc-create-btn">Gutschein erstellen</Btn>
        {gcResult && <p className="text-[#00C2FF] text-[11px] mt-2 font-bold" data-testid="gc-result">Code: {gcResult.code} · €{gcResult.balance}</p>}
        <div className="border-t border-white/5 mt-3 pt-3">
          <p className="text-[10px] text-white/50 mb-2">Einlösen:</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2"><Input value={redeemCode} onChange={setRedeemCode} placeholder="Code" testId="gc-redeem-code" /></div>
            <Input value={redeemAmt} onChange={setRedeemAmt} type="number" placeholder="€" testId="gc-redeem-amt" />
          </div>
          <Btn onClick={redeemGc} variant="secondary" testId="gc-redeem-btn">Einlösen</Btn>
        </div>
      </Card>

      <Card title="Alterskontrolle (Tabak/Alkohol)" icon={ShieldAlert}>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Input value={ageCart} onChange={setAgeCart} placeholder="Cart-ID (POS-CRT-…)" testId="age-cart" />
          <Input value={ageMin} onChange={setAgeMin} type="number" placeholder="Mindest-Alter" testId="age-min" />
        </div>
        <div className="flex gap-2">
          <Btn onClick={() => logAge(true)} testId="age-ok-btn">✓ Alter ok</Btn>
          <Btn onClick={() => logAge(false)} variant="secondary" testId="age-reject-btn">✗ Ablehnen</Btn>
        </div>
      </Card>
    </>
  );
}
