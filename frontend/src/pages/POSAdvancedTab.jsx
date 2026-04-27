/**
 * BidBlitz POS — Mega Advanced Tab
 * UI für alle 28 erweiterten POS-Features:
 *   OCR · Voice · Etiketten · Auto-PO · Bulk-Import/Export · Inventur · Chargen ·
 *   Rezepte · Schichtplan · Performance · Forecast · Cross-Sell · DATEV · P&L ·
 *   Online-Katalog · Reservierung · Marketing · Gutscheine · Alterskontrolle.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
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

const SECTIONS = [
  { id: "demo", label: "Demo-Modus", icon: Sparkles },
  { id: "ki", label: "KI-Tools", icon: Sparkles },
  { id: "stock", label: "Bestand+", icon: Layers },
  { id: "menu", label: "Rezepte & Cross-Sell", icon: ChefHat },
  { id: "ops", label: "Schicht & Reservierung", icon: CalendarDays },
  { id: "money", label: "Finanzen & DATEV", icon: FileSpreadsheet },
  { id: "marketing", label: "Marketing", icon: Mail },
];

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
  const [section, setSection] = useState("demo");

  if (!storeId) {
    return <div className="text-white/60 text-[12px] text-center py-10">Bitte erst eine Filiale wählen.</div>;
  }

  return (
    <div data-testid="pos-advanced-tab">
      <div className="flex gap-1 overflow-x-auto pb-3 hide-scrollbar -mx-1 px-1">
        {SECTIONS.map((s) => (
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
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState(null);

  const seed = async () => {
    setBusy("seed");
    try {
      const d = await api(`/api/pos/demo/seed?store_id=${storeId}`, { method: "POST" });
      setResult(d.created);
      toast.success("Demo-Daten erstellt!");
    } catch (err) { toast.error(err.message); } finally { setBusy(""); }
  };

  const clear = async () => {
    if (!window.confirm("ALLE Demo-Daten (Präfix DEMO) löschen?")) return;
    setBusy("clear");
    try {
      const d = await api(`/api/pos/demo/clear?store_id=${storeId}`, { method: "DELETE" });
      const total = Object.values(d.deleted).reduce((a, b) => a + b, 0);
      toast.success(`${total} Demo-Einträge gelöscht`);
      setResult(null);
    } catch (err) { toast.error(err.message); } finally { setBusy(""); }
  };

  return (
    <>
      <Card title="Demo-Daten mit einem Klick anlegen" icon={Sparkles}>
        <p className="text-[10px] text-white/50 mb-3 leading-relaxed">
          Perfekt für den ersten Test: erzeugt sofort einen Test-Lieferanten, 3 Demo-Produkte
          (Cola, Brötchen, Burger-Menü), einen 25 €-Gutschein, eine offene Inventur,
          ein Rezept (Burger = Brötchen + Cola), eine Reservierung für morgen 19:00 Uhr
          und eine Schicht für heute. Alles mit Präfix <span className="text-[#00C2FF] font-bold">DEMO</span> —
          jederzeit löschbar.
        </p>
        <div className="flex gap-2">
          <Btn onClick={seed} loading={busy === "seed"} testId="demo-seed-btn">
            <Sparkles size={12} /> Demo-Daten erstellen
          </Btn>
          <Btn onClick={clear} loading={busy === "clear"} variant="secondary" testId="demo-clear-btn">
            Alle DEMO-Einträge löschen
          </Btn>
        </div>
        {result && (
          <div className="mt-3 bg-black/30 rounded-lg p-3 text-[10px] space-y-1" data-testid="demo-result">
            <p className="text-[#10B981] font-bold">✓ Erstellt:</p>
            <p className="text-white/70">• Lieferant: <span className="text-white">{result.supplier_id}</span></p>
            <p className="text-white/70">• Produkte: <span className="text-white">{result.product_ids?.length || 0}</span> (IDs: {(result.product_ids || []).join(", ")})</p>
            <p className="text-white/70">• Gutschein: <span className="text-[#00C2FF] font-bold">{result.giftcard?.code}</span> ({result.giftcard?.amount} €)</p>
            <p className="text-white/70">• Offene Inventur: <span className="text-white">{result.stocktake_id}</span></p>
            <p className="text-white/70">• Rezept verknüpft mit Produkt: <span className="text-white">{result.recipe_for}</span></p>
            <p className="text-white/70">• Reservierung: <span className="text-white">{result.reservation_id}</span></p>
            <p className="text-white/70">• Schicht für heute angelegt</p>
            <p className="text-white/40 mt-2 italic">Tipp: wechsle in die Tabs „Bestand+", „Rezepte" oder „Schicht & Reservierung" um die Daten zu sehen.</p>
          </div>
        )}
      </Card>
    </>
  );
}

// ─────────────────── 1. KI: OCR + Voice
function KISection({ storeId, registerId }) {
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
      toast.success(`${data.count} Artikel erkannt`);
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
          toast.success("Transkribiert");
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
      toast.error("Mikrofon-Zugriff verweigert");
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
      <Card title="Lieferschein / Rechnung scannen (Gemini Vision OCR)" icon={Camera}>
        <p className="text-[10px] text-white/40 mb-2">Foto vom Lieferschein hochladen — KI extrahiert Artikel automatisch.</p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Input value={poId} onChange={setPoId} placeholder="PO-ID (optional)" testId="ocr-po-id" />
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={onPickFile} className="hidden" data-testid="ocr-file-input" />
          <Btn onClick={() => fileInputRef.current?.click()} loading={ocrLoading} testId="ocr-upload-btn">
            <Camera size={12} /> {ocrLoading ? "Analysiere…" : "Foto wählen"}
          </Btn>
        </div>
        {ocrResult && (
          <div className="mt-2 max-h-64 overflow-y-auto bg-black/30 rounded-lg p-2" data-testid="ocr-result">
            <p className="text-[10px] text-[#00C2FF] mb-1">{ocrResult.count} Artikel:</p>
            {ocrResult.items?.map((it, i) => (
              <div key={i} className="text-[10px] text-white/80 py-0.5 border-b border-white/5">
                {it.quantity}× {it.name} — {it.unit_price ? `€${it.unit_price}` : ""} {it.barcode ? `· EAN ${it.barcode}` : ""}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Sprach-Befehl an die Kasse (Whisper)" icon={Mic}>
        <p className="text-[10px] text-white/40 mb-2">Beispiele: „2 Coca-Cola hinzufügen", „10 Prozent Rabatt", „Stornieren"</p>
        <div className="flex gap-2">
          {!recording ? (
            <Btn onClick={startRec} loading={voiceLoading} testId="voice-rec-start">
              <Mic size={12} /> {voiceLoading ? "Verarbeite…" : "Aufnahme starten"}
            </Btn>
          ) : (
            <Btn onClick={stopRec} variant="secondary" testId="voice-rec-stop">
              <MicOff size={12} /> Stop
            </Btn>
          )}
        </div>
        {voiceResult && (
          <div className="mt-2 bg-black/30 rounded-lg p-2 text-[10px]" data-testid="voice-result">
            <p className="text-white/60">Text: <span className="text-white">{voiceResult.text}</span></p>
            <p className="text-[#00C2FF] mt-1">Befehl: {JSON.stringify(voiceResult.command)}</p>
          </div>
        )}
      </Card>
    </>
  );
}

// ─────────────────── 2. STOCK: Bulk-Import/Export, Auto-Order, Inventur, Chargen, Etiketten
function StockSection({ storeId }) {
  const [busy, setBusy] = useState("");
  const fileRef = useRef(null);

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
      if (!r.ok) throw new Error(data.detail || "Import fehlgeschlagen");
      toast.success(`${data.created} angelegt, ${data.skipped} übersprungen`);
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
      if (!r.ok) throw new Error("Export fehlgeschlagen");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `produkte_${storeId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exportiert");
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
      toast.success(`${data.created_pos.length} Bestellungen für ${data.low_stock_count} niedrige Artikel angelegt`);
    } catch (err) { toast.error(err.message); } finally { setBusy(""); }
  };

  // Etiketten
  const [labelIds, setLabelIds] = useState("");
  const [labelCopies, setLabelCopies] = useState(1);
  const printLabels = async () => {
    if (!labelIds.trim()) return toast.error("Produkt-IDs fehlen");
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
      if (!r.ok) throw new Error("Etiketten-Druck fehlgeschlagen");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      toast.success("Etiketten generiert");
    } catch (err) { toast.error(err.message); } finally { setBusy(""); }
  };

  // Inventur
  const [stocktakes, setStocktakes] = useState([]);
  const [stkName, setStkName] = useState("Inventur " + new Date().toLocaleDateString("de-DE"));
  const loadStk = useCallback(async () => {
    try {
      const d = await api(`/api/pos/stocktake/list?store_id=${storeId}`);
      setStocktakes(d.stocktakes || d || []);
    } catch {}
  }, [storeId]);
  useEffect(() => { loadStk(); }, [loadStk]);

  const startStk = async () => {
    try {
      await api("/api/pos/stocktake/start", { method: "POST", body: { store_id: storeId, name: stkName } });
      toast.success("Inventur gestartet");
      loadStk();
    } catch (err) { toast.error(err.message); }
  };

  const finalizeStk = async (id) => {
    if (!window.confirm("Inventur abschließen und Bestand korrigieren?")) return;
    try {
      const d = await api(`/api/pos/stocktake/${id}/finalize`, { method: "POST" });
      toast.success(`Abgeschlossen — ${d.adjustments || 0} Anpassungen`);
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
    } catch {}
  }, [storeId, expiryDays]);
  useEffect(() => { loadBatches(); }, [loadBatches]);

  return (
    <>
      <Card title="CSV Bulk-Import / Export" icon={FileSpreadsheet}>
        <p className="text-[10px] text-white/40 mb-2">Spalten: name;barcode;sku;price;purchase_price;tax_rate;stock;minimum_stock;unit;category</p>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" onChange={csvImport} className="hidden" data-testid="csv-import-input" />
          <Btn onClick={() => fileRef.current?.click()} loading={busy === "import"} testId="csv-import-btn">
            <Upload size={12} /> CSV importieren
          </Btn>
          <Btn onClick={csvExport} loading={busy === "export"} variant="secondary" testId="csv-export-btn">
            <Download size={12} /> Exportieren
          </Btn>
        </div>
      </Card>

      <Card title="Auto-Bestellung (Niedrigbestand → PO)" icon={ShoppingCart}>
        <p className="text-[10px] text-white/40 mb-2">Erzeugt automatisch Bestellungen für alle Artikel unter Mindestbestand pro Lieferant.</p>
        <Btn onClick={autoOrder} loading={busy === "auto"} testId="auto-order-btn">
          <ShoppingCart size={12} /> Auto-PO ausführen
        </Btn>
      </Card>

      <Card title="Etiketten / Preisschilder drucken (PDF)" icon={Tag}>
        <Input value={labelIds} onChange={setLabelIds} placeholder="Produkt-IDs kommagetrennt: PRD-123,PRD-456" testId="label-ids-input" />
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Input value={labelCopies} onChange={setLabelCopies} type="number" placeholder="Kopien" testId="label-copies-input" />
          <Btn onClick={printLabels} loading={busy === "labels"} testId="label-print-btn">
            <Tag size={12} /> Drucken
          </Btn>
        </div>
      </Card>

      <Card title="Inventur" icon={ClipboardList}>
        <div className="flex gap-2 mb-3">
          <Input value={stkName} onChange={setStkName} placeholder="Inventur-Name" testId="stk-name-input" />
          <Btn onClick={startStk} testId="stk-start-btn">Start</Btn>
        </div>
        {stocktakes.length === 0 ? (
          <p className="text-[10px] text-white/40">Keine Inventuren bisher.</p>
        ) : (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {stocktakes.map((s) => (
              <div key={s.stocktake_id} className="flex justify-between bg-black/20 rounded-lg p-2 text-[10px]">
                <span className="text-white/80">{s.name} — <span className="text-white/40">{s.status}</span></span>
                {s.status === "open" && (
                  <button onClick={() => finalizeStk(s.stocktake_id)} className="text-[#00C2FF] font-bold" data-testid={`stk-finalize-${s.stocktake_id}`}>
                    Abschließen
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Chargen — bald ablaufend" icon={Layers}>
        <div className="flex gap-2 mb-3">
          <Input value={expiryDays} onChange={setExpiryDays} type="number" placeholder="Tage" testId="expiry-days-input" />
          <Btn onClick={loadBatches} variant="secondary" testId="expiry-refresh-btn">Aktualisieren</Btn>
        </div>
        {batches.length === 0 ? (
          <p className="text-[10px] text-white/40">Keine Chargen laufen in {expiryDays} Tagen ab.</p>
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
  const [productId, setProductId] = useState("");
  const [recipe, setRecipe] = useState({ ingredients: [{ product_id: "", quantity: 1 }] });
  const [busy, setBusy] = useState(false);

  const addIng = () => setRecipe((r) => ({ ...r, ingredients: [...r.ingredients, { product_id: "", quantity: 1 }] }));
  const setIng = (i, k, v) => setRecipe((r) => ({
    ...r,
    ingredients: r.ingredients.map((ing, idx) => idx === i ? { ...ing, [k]: k === "quantity" ? parseFloat(v) : v } : ing),
  }));

  const saveRecipe = async () => {
    if (!productId) return toast.error("Produkt-ID fehlt");
    setBusy(true);
    try {
      await api("/api/pos/recipes/create", {
        method: "POST",
        body: { product_id: productId, ingredients: recipe.ingredients.filter((i) => i.product_id) },
      });
      toast.success("Rezept gespeichert");
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
      <Card title="Rezepte / Stücklisten (BOM)" icon={ChefHat}>
        <p className="text-[10px] text-white/40 mb-2">Bei Verkauf eines Gerichts werden die Zutaten automatisch vom Lager abgezogen.</p>
        <Input value={productId} onChange={setProductId} placeholder="Produkt-ID des Gerichts (PRD-…)" testId="recipe-product-id" />
        <div className="my-2 space-y-1">
          {recipe.ingredients.map((ing, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <div className="col-span-2"><Input value={ing.product_id} onChange={(v) => setIng(i, "product_id", v)} placeholder="Zutat-ID" testId={`recipe-ing-${i}`} /></div>
              <Input value={ing.quantity} onChange={(v) => setIng(i, "quantity", v)} type="number" placeholder="Menge" testId={`recipe-qty-${i}`} />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Btn onClick={addIng} variant="secondary" testId="recipe-add-ing">+ Zutat</Btn>
          <Btn onClick={saveRecipe} loading={busy} testId="recipe-save-btn">Speichern</Btn>
        </div>
      </Card>

      <Card title="Cross-Sell-Empfehlungen" icon={Sparkles}>
        <div className="flex gap-2 mb-2">
          <Input value={csProductId} onChange={setCsProductId} placeholder="Produkt-ID" testId="cs-product-id" />
          <Btn onClick={loadCs} testId="cs-load-btn">Vorschläge</Btn>
        </div>
        {crossSells.length > 0 && (
          <div className="space-y-1">
            {crossSells.map((c, i) => (
              <div key={i} className="text-[10px] bg-black/20 rounded-lg p-2 text-white/80">
                {c.name} — {c.frequency || c.count || 0}× zusammen gekauft
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="KI-Umsatzprognose" icon={TrendingUp}>
        <div className="flex gap-2 mb-2">
          <Input value={forecastDays} onChange={setForecastDays} type="number" placeholder="Tage voraus" testId="fc-days" />
          <Btn onClick={loadForecast} testId="fc-load-btn">Berechnen</Btn>
        </div>
        {forecast && (
          <div className="bg-black/20 rounded-lg p-2 text-[10px]">
            <p className="text-[#00C2FF] mb-1">Prognose:</p>
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
  const loadWeek = async () => {
    try {
      const d = await api(`/api/pos/schedule/week?store_id=${storeId}&week_start=${weekStart}`);
      setWeekData(d.entries || d.schedule || []);
    } catch (err) { toast.error(err.message); }
  };
  useEffect(() => { loadWeek(); /* eslint-disable-next-line */ }, [weekStart]);

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
  const loadResv = async () => {
    try {
      const d = await api(`/api/pos/reservations?store_id=${storeId}`);
      setResvList(d.reservations || []);
    } catch {}
  };
  useEffect(() => { loadResv(); /* eslint-disable-next-line */ }, []);

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
  const loadPnl = async () => {
    try {
      const d = await api(`/api/pos/pnl/today?store_id=${storeId}`);
      setPnl(d);
    } catch (err) { toast.error(err.message); }
  };
  useEffect(() => { loadPnl(); /* eslint-disable-next-line */ }, [storeId]);

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
