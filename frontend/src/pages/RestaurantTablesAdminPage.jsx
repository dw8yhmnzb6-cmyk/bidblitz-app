import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Copy, Loader2, Pencil, Plus, Printer, QrCode, RefreshCw, Search, Trash2, Wifi } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

const API = process.env.REACT_APP_BACKEND_URL;

const FLOORPLAN_BOUNDS = { width: 1200, height: 560 };
const TABLE_COLORS = ["#22c55e", "#06b6d4", "#f97316", "#a855f7", "#eab308", "#ef4444"];
const PRINTER_ROLE_FLOW = [
  { id: "kitchen", label: "Kitchen", hint: "Küchenbons / Produktionsdruck" },
  { id: "service", label: "Service", hint: "Service- und Runner-Bons" },
  { id: "bill", label: "Bill", hint: "Rechnung / Kasse" },
];
const SIZE_PRESETS = {
  sm: { label: "2 Plätze", width: 72, height: 72, seats: 2 },
  md: { label: "4 Plätze", width: 92, height: 72, seats: 4 },
  lg: { label: "6 Plätze", width: 116, height: 92, seats: 6 },
  xl: { label: "8 Plätze", width: 144, height: 96, seats: 8 },
};
const emptyForm = { table_number: "", table_name: "", area: "Gastraum", button_id: "", shape: "square", size_key: "md", color: "#22c55e" };
const statusStyle = {
  free: "bg-emerald-500/15 border-emerald-400/20 text-emerald-200",
  occupied: "bg-amber-500/15 border-amber-400/20 text-amber-100",
  order_open: "bg-cyan-500/15 border-cyan-400/20 text-cyan-100",
  service_call: "bg-rose-500/15 border-rose-400/20 text-rose-100",
  bill_requested: "bg-violet-500/15 border-violet-400/20 text-violet-100",
};
const diagStatusStyle = {
  ok: "bg-emerald-500/15 border-emerald-400/20 text-emerald-100",
  error: "bg-rose-500/15 border-rose-400/20 text-rose-100",
  missing: "bg-amber-500/15 border-amber-400/20 text-amber-100",
  invalid: "bg-orange-500/15 border-orange-400/20 text-orange-100",
};

const hexToRgba = (hex, alpha) => {
  const normalized = (hex || "#22c55e").replace("#", "");
  const value = normalized.length === 3 ? normalized.split("").map((item) => item + item).join("") : normalized;
  const int = Number.parseInt(value, 16);
  if (Number.isNaN(int)) return `rgba(34,197,94,${alpha})`;
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const snapValue = (value, step = 24) => Math.round(value / step) * step;

async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.detail || data.message || "Fehler");
    error.status = response.status;
    throw error;
  }
  return data;
}

export default function RestaurantTablesAdminPage({ onBack }) {
  const printRefs = useRef({});
  const floorplanRef = useRef(null);
  const [tables, setTables] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storeId, setStoreId] = useState("");
  const [hardware, setHardware] = useState({ printers: [], button_webhook_url: "", nfc_base_url: "" });
  const [printerForm, setPrinterForm] = useState({ role: "kitchen", name: "", type: "network", ip: "", port: 9100, device: "" });
  const [printerWizardMode, setPrinterWizardMode] = useState("auto");
  const [discoverySubnet, setDiscoverySubnet] = useState("192.168.1");
  const [discoveryStartHost, setDiscoveryStartHost] = useState(1);
  const [discoveryEndHost, setDiscoveryEndHost] = useState(24);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryResults, setDiscoveryResults] = useState([]);
  const [printerVerified, setPrinterVerified] = useState(false);
  const [lastPrinterTest, setLastPrinterTest] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [selectedArea, setSelectedArea] = useState("all");
  const [zoom, setZoom] = useState(1);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [diagnosticLogs, setDiagnosticLogs] = useState([]);
  const [diagnosticResult, setDiagnosticResult] = useState(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [tablesRes, hardwareRes, diagnosticsRes] = await Promise.all([api("/api/tables"), api("/api/table-hardware"), api("/api/table-hardware/diagnostics")]);
      setTables(tablesRes.tables || []);
      setStoreId(tablesRes.store?.store_id || hardwareRes.store_id || "");
      setHardware(hardwareRes || { printers: [], button_webhook_url: "", nfc_base_url: "" });
      setDiagnosticLogs(diagnosticsRes.logs || []);
    } catch (error) {
      if (error.status !== 401) toast.error(error.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => ({
    total: tables.length,
    service: tables.filter((table) => table.status === "service_call").length,
    orders: tables.filter((table) => table.status === "order_open").length,
    bills: tables.filter((table) => table.status === "bill_requested").length,
  }), [tables]);

  const areas = useMemo(() => Array.from(new Set(tables.map((table) => table.area || "Gastraum"))), [tables]);
  const visibleTables = useMemo(() => selectedArea === "all" ? tables : tables.filter((table) => table.area === selectedArea), [selectedArea, tables]);

  const latestDiagnostics = useMemo(() => diagnosticLogs.reduce((acc, log) => {
    if (!log?.role || acc[log.role]) return acc;
    acc[log.role] = log;
    return acc;
  }, {}), [diagnosticLogs]);

  const printerRoleStatus = useMemo(() => PRINTER_ROLE_FLOW.map((role) => {
    const saved = (hardware.printers || []).find((printer) => printer.role === role.id);
    return {
      ...role,
      saved: Boolean(saved),
      value: saved?.ip || saved?.device || saved?.type || "Noch nicht verbunden",
      printer: saved || null,
    };
  }), [hardware.printers]);

  const activePrinterRoleIndex = useMemo(() => Math.max(0, PRINTER_ROLE_FLOW.findIndex((item) => item.id === printerForm.role)), [printerForm.role]);
  const completedPrinterRoles = printerRoleStatus.filter((item) => item.saved).length;

  useEffect(() => {
    if (selectedArea !== "all" && areas.length && !areas.includes(selectedArea)) {
      setSelectedArea(areas[0]);
    }
  }, [areas, selectedArea]);

  useEffect(() => {
    const sourceIp = printerForm.ip || hardware.printers.find((printer) => printer.ip)?.ip || "";
    const parts = String(sourceIp).split(".");
    if (parts.length === 4) {
      setDiscoverySubnet(parts.slice(0, 3).join("."));
    }
  }, [hardware.printers, printerForm.ip]);

  const saveTable = async () => {
    if (!form.table_number.trim() || !form.table_name.trim()) {
      toast.error("Tischnummer und Tischname sind Pflicht");
      return;
    }
    setSaving(true);
    const preset = SIZE_PRESETS[form.size_key] || SIZE_PRESETS.md;
    const payload = { ...form, seats: preset.seats, width: preset.width, height: preset.height };
    try {
      if (editingId) {
        await api(`/api/tables/${editingId}`, { method: "PUT", body: payload });
        toast.success("Tisch aktualisiert");
      } else {
        await api("/api/tables", { method: "POST", body: payload });
        toast.success("Tisch angelegt");
      }
      setForm(emptyForm);
      setEditingId("");
      await load();
    } catch (error) {
      toast.error(error.message);
    }
    setSaving(false);
  };

  const editTable = (table) => {
    setEditingId(table.table_id);
    setForm({
      table_number: table.table_number || "",
      table_name: table.table_name || "",
      area: table.area || "Gastraum",
      button_id: table.button_id || "",
      shape: table.shape || "square",
      size_key: table.size_key || "md",
      color: table.color || "#22c55e",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (!dragging) return undefined;
    const move = (event) => {
      const rect = floorplanRef.current?.getBoundingClientRect();
      if (!rect) return;
      setTables((prev) => prev.map((table) => {
        if (table.table_id !== dragging.tableId) return table;
        const tableWidth = Number(table.width || 92);
        const tableHeight = Number(table.height || 72);
        const rawX = (event.clientX - rect.left) / zoom - dragging.offsetX;
        const rawY = (event.clientY - rect.top) / zoom - dragging.offsetY;
        const limitedX = Math.max(0, Math.min(FLOORPLAN_BOUNDS.width - tableWidth, rawX));
        const limitedY = Math.max(0, Math.min(FLOORPLAN_BOUNDS.height - tableHeight, rawY));
        return {
          ...table,
          x: Math.round(snapToGrid ? snapValue(limitedX) : limitedX),
          y: Math.round(snapToGrid ? snapValue(limitedY) : limitedY),
        };
      }));
    };
    const up = async () => {
      const target = tables.find((table) => table.table_id === dragging.tableId);
      setDragging(null);
      if (!target) return;
      try {
        await api(`/api/tables/${target.table_id}`, { method: "PUT", body: { x: target.x, y: target.y } });
      } catch (error) {
        toast.error(error.message || "Position konnte nicht gespeichert werden");
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, snapToGrid, tables, zoom]);

  const deleteTable = async (tableId) => {
    if (!window.confirm("Tisch wirklich löschen?")) return;
    try {
      await api(`/api/tables/${tableId}`, { method: "DELETE" });
      toast.success("Tisch gelöscht");
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const regenerateQr = async (tableId) => {
    try {
      await api(`/api/tables/${tableId}/generate-qr`, { method: "POST" });
      toast.success("QR-Link aktualisiert");
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const copyLink = async (table) => {
    try {
      await navigator.clipboard.writeText(table.qr_code_absolute_url || `${window.location.origin}${table.qr_code_url}`);
      toast.success("QR-Link kopiert");
    } catch {
      toast.error("Link konnte nicht kopiert werden");
    }
  };

  const printQr = (table) => {
    const node = printRefs.current[table.table_id];
    const svg = node?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const popup = window.open("", "_blank", "width=520,height=720");
    if (!popup) return;
    popup.document.write(`
      <html><body style="font-family:Outfit,Arial;padding:32px;text-align:center;color:#111">
      <h1>${table.table_name}</h1>
      <p>Tischnummer ${table.table_number} · ${table.area}</p>
      <div style="display:inline-block;padding:18px;border:2px solid #111;border-radius:20px">${xml}</div>
      <p style="margin-top:14px;font-size:12px">${table.qr_code_absolute_url}</p>
      <script>setTimeout(()=>window.print(),150)</script>
      </body></html>
    `);
    popup.document.close();
  };

  const savePrinter = async () => {
    if (!printerVerified) {
      toast.error("Bitte erst erfolgreichen Testbon drucken");
      return;
    }
    if (printerForm.type === "network" && !printerForm.ip.trim()) {
      toast.error("Bitte IP-Adresse eingeben oder Drucker suchen");
      return;
    }
    if (printerForm.type === "usb" && !printerForm.device.trim()) {
      toast.error("Bitte USB-Gerät oder Pfad eintragen");
      return;
    }
    try {
      await api("/api/table-hardware/printers", { method: "POST", body: { ...printerForm, store_id: storeId || undefined } });
      toast.success("Printer-Mapping gespeichert");
      await load();
      const currentIndex = PRINTER_ROLE_FLOW.findIndex((item) => item.id === printerForm.role);
      const nextRole = PRINTER_ROLE_FLOW[currentIndex + 1]?.id;
      if (nextRole) {
        loadPrinterRole(nextRole);
        toast.success(`Weiter mit ${nextRole}`);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const testPrinter = async () => {
    if (printerForm.type === "network" && !printerForm.ip.trim()) {
      toast.error("Bitte IP-Adresse eingeben oder Drucker suchen");
      return;
    }
    if (printerForm.type === "usb" && !printerForm.device.trim()) {
      toast.error("Bitte USB-Gerät oder Pfad eintragen");
      return;
    }
    try {
      const result = await api("/api/table-hardware/printers/test", { method: "POST", body: { ...printerForm, role: printerForm.role, store_id: storeId || undefined } });
      setPrinterVerified(true);
      setLastPrinterTest({ status: "ok", message: `Testbon gesendet (${result.result?.printer || printerForm.type})` });
      toast.success(`Testbon gesendet (${result.result?.printer || printerForm.type})`);
    } catch (error) {
      setPrinterVerified(false);
      setLastPrinterTest({ status: "error", message: error.message || "Test fehlgeschlagen" });
      toast.error(error.message || "Testbon fehlgeschlagen");
    }
  };

  const discoverPrinters = async () => {
    setDiscoveryLoading(true);
    setDiscoveryResults([]);
    try {
      const result = await api("/api/table-hardware/discover", {
        method: "POST",
        body: {
          subnet: discoverySubnet,
          start_host: Number(discoveryStartHost) || 1,
          end_host: Number(discoveryEndHost) || 24,
          ports: [Number(printerForm.port) || 9100],
          store_id: storeId || undefined,
        },
      });
      setDiscoveryResults(result.results || []);
      toast.success(result.count ? `${result.count} Drucker gefunden` : "Keine Drucker gefunden");
    } catch (error) {
      toast.error(error.message || "Suche fehlgeschlagen");
    }
    setDiscoveryLoading(false);
  };

  const runDiagnostics = async (role = printerForm.role) => {
    setDiagnosticLoading(true);
    try {
      const result = await api("/api/table-hardware/diagnostics", { method: "POST", body: { role, store_id: storeId || undefined } });
      setDiagnosticResult(result.result || null);
      const history = await api("/api/table-hardware/diagnostics");
      setDiagnosticLogs(history.logs || []);
      toast.success(`Diagnose ${role} abgeschlossen`);
    } catch (error) {
      toast.error(error.message || "Diagnose fehlgeschlagen");
    }
    setDiagnosticLoading(false);
  };

  const loadPrinterRole = (role) => {
    const match = hardware.printers.find((printer) => printer.role === role);
    setPrinterForm({
      role,
      name: match?.name || "",
      type: match?.type || "network",
      ip: match?.ip || "",
      port: match?.port || 9100,
      device: match?.device || "",
    });
    setPrinterWizardMode(match?.type === "usb" ? "usb" : "auto");
    setPrinterVerified(false);
    setLastPrinterTest(null);
  };

  const updatePrinterForm = (patch) => {
    setPrinterForm((prev) => ({ ...prev, ...patch }));
    setPrinterVerified(false);
    setLastPrinterTest(null);
  };

  const selectDiscoveredPrinter = (printer) => {
    updatePrinterForm({
      type: "network",
      name: printer.name || `ESC/POS ${printer.ip}`,
      ip: printer.ip || "",
      port: printer.port || 9100,
      device: "",
    });
    setPrinterWizardMode("manual");
    toast.success(`Drucker ${printer.ip}:${printer.port} übernommen`);
  };

  const writeNfcTag = async (table) => {
    if (typeof window === "undefined" || typeof window.NDEFReader === "undefined") {
      toast.error("Web NFC wird auf diesem Gerät nicht unterstützt");
      return;
    }
    try {
      const ndef = new window.NDEFReader();
      const url = table.qr_code_absolute_url || `${window.location.origin}${table.qr_code_url}`;
      await ndef.write({ records: [{ recordType: "url", data: url }] });
      toast.success(`NFC-Tag für ${table.table_name} geschrieben`);
    } catch (error) {
      toast.error(error?.message || "NFC-Tag konnte nicht geschrieben werden");
    }
  };

  return (
    <div className="min-h-screen bg-[#06070B] text-white pb-20" data-testid="restaurant-tables-admin-page">
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#06070B]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5" data-testid="restaurant-tables-admin-back-button">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-black">Restaurant Tischsystem</h1>
            <p className="text-sm text-white/45">QR, Button-ID, Status und Druck vorbereitet</p>
          </div>
          <button onClick={load} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/75" data-testid="restaurant-tables-admin-refresh-button">
            <RefreshCw size={14} className="mr-2 inline-block" /> Aktualisieren
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-3 md:grid-cols-4">
          {[{ label: "Tische", value: summary.total }, { label: "Offene Orders", value: summary.orders }, { label: "Service", value: summary.service }, { label: "Rechnung", value: summary.bills }].map((item) => (
            <div key={item.label} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4" data-testid={`restaurant-admin-metric-${item.label.toLowerCase()}`}>
              <p className="text-xs uppercase tracking-[0.18em] text-white/35">{item.label}</p>
              <p className="mt-3 text-3xl font-black">{item.value}</p>
            </div>
          ))}
        </div>

        <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5" data-testid="restaurant-admin-table-form-section">
          <div className="grid gap-3 md:grid-cols-4">
            <input value={form.table_number} onChange={(event) => setForm((prev) => ({ ...prev, table_number: event.target.value }))} placeholder="Tischnummer" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none" data-testid="restaurant-admin-table-number-input" />
            <input value={form.table_name} onChange={(event) => setForm((prev) => ({ ...prev, table_name: event.target.value }))} placeholder="Tischname" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none" data-testid="restaurant-admin-table-name-input" />
            <input value={form.area} onChange={(event) => setForm((prev) => ({ ...prev, area: event.target.value }))} placeholder="Bereich / Raum" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none" data-testid="restaurant-admin-table-area-input" />
            <input value={form.button_id} onChange={(event) => setForm((prev) => ({ ...prev, button_id: event.target.value }))} placeholder="Button-ID" className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none" data-testid="restaurant-admin-button-id-input" />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_120px_minmax(0,1fr)]">
            <select value={form.shape} onChange={(event) => setForm((prev) => ({ ...prev, shape: event.target.value }))} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none" data-testid="restaurant-admin-table-shape-select">
              <option value="square">Rechteck</option>
              <option value="round">Rund</option>
              <option value="bar">Bar / Lang</option>
            </select>
            <select value={form.size_key} onChange={(event) => setForm((prev) => ({ ...prev, size_key: event.target.value }))} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none" data-testid="restaurant-admin-table-size-select">
              {Object.entries(SIZE_PRESETS).map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}
            </select>
            <input type="color" value={form.color} onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))} className="h-[52px] w-full rounded-2xl border border-white/10 bg-black/20 px-2" data-testid="restaurant-admin-table-color-input" />
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/65" data-testid="restaurant-admin-table-preview-chip">
              <span>Vorschau</span>
              <span className="rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: form.color, backgroundColor: hexToRgba(form.color, 0.18), color: form.color }}>{SIZE_PRESETS[form.size_key]?.label || "4 Plätze"}</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={saveTable} disabled={saving} className="rounded-full bg-gradient-to-r from-[#00C2FF] to-[#FFA24C] px-4 py-3 text-sm font-black text-[#05070B] disabled:opacity-50" data-testid="restaurant-admin-save-table-button">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={14} className="mr-2 inline-block" />{editingId ? "Tisch speichern" : "Tisch anlegen"}</>}
            </button>
            <button onClick={() => { setEditingId(""); setForm(emptyForm); }} className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/70" data-testid="restaurant-admin-reset-table-button">
              Reset
            </button>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5" data-testid="restaurant-admin-hardware-section">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div>
              <h2 className="text-lg font-black">Hardware-Mapping</h2>
              <p className="mt-1 text-sm text-white/45">Thermodrucker rollenbasiert mappen, Button-Webhook fixieren, NFC-URL auf Tags schreiben.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {(hardware.printers || []).map((printer) => (
                  <button key={printer.printer_id || printer.role} onClick={() => loadPrinterRole(printer.role)} className="rounded-[24px] border border-white/10 bg-black/20 p-4 text-left" data-testid={`restaurant-admin-printer-card-${printer.role}`}>
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-white/35">{printer.role}</p>
                    <p className="mt-2 text-base font-semibold">{printer.name || "Nicht gesetzt"}</p>
                    <p className="mt-1 text-xs text-white/45">{printer.type} {printer.ip || printer.device || "file fallback"}</p>
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-[24px] border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                <p className="font-semibold text-white">Webhook + NFC</p>
                <p className="mt-2 font-mono text-xs break-all">Button Webhook: {hardware.button_webhook_url || `${window.location.origin}/api/button-webhook`}</p>
                <p className="mt-2 font-mono text-xs break-all">NFC Base URL: {hardware.nfc_base_url || `${window.location.origin}/table/`}</p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {["kitchen", "service", "bill"].map((role) => {
                  const result = latestDiagnostics[role]?.result;
                  const status = result?.status || "missing";
                  return (
                    <button key={role} onClick={() => runDiagnostics(role)} className={`rounded-[24px] border p-4 text-left ${diagStatusStyle[status] || diagStatusStyle.missing}`} data-testid={`restaurant-admin-diagnostics-card-${role}`}>
                      <p className="text-xs font-black uppercase tracking-[0.18em] opacity-80">{role}</p>
                      <p className="mt-2 text-sm font-semibold">{result?.message || "Noch kein Diagnose-Lauf"}</p>
                      <p className="mt-1 text-xs opacity-70">{result?.ip || result?.device || result?.type || "Ping / Socket / USB Check"}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-white/35">Printer Setup Wizard</p>
              <div className="mt-4 grid gap-3">
                <div className="rounded-[24px] border border-cyan-400/15 bg-cyan-400/8 p-4" data-testid="restaurant-admin-printer-onboarding-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Geführtes Onboarding</p>
                      <p className="mt-1 text-xs text-white/55">Verbinde nacheinander Kitchen → Service → Bill. Nach dem Speichern springt der Wizard automatisch weiter.</p>
                    </div>
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100" data-testid="restaurant-admin-printer-onboarding-progress">{completedPrinterRoles}/3 fertig</span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {printerRoleStatus.map((role, index) => (
                      <button
                        key={role.id}
                        onClick={() => loadPrinterRole(role.id)}
                        className={`rounded-2xl border px-3 py-3 text-left ${printerForm.role === role.id ? "border-cyan-400/30 bg-cyan-400/15" : role.saved ? "border-emerald-400/20 bg-emerald-400/10" : "border-white/10 bg-[#0A0A0F]"}`}
                        data-testid={`restaurant-admin-printer-onboarding-role-${role.id}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">{index + 1}. {role.label}</p>
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${role.saved ? diagStatusStyle.ok : diagStatusStyle.missing}`}>{role.saved ? "fertig" : "offen"}</span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-white">{role.hint}</p>
                        <p className="mt-1 text-[11px] text-white/45 break-all">{role.value}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { id: "auto", label: "Auto suchen", icon: Search },
                    { id: "manual", label: "IP manuell", icon: Wifi },
                    { id: "usb", label: "USB / Pfad", icon: Printer },
                  ].map((mode) => {
                    const Icon = mode.icon;
                    return (
                      <button key={mode.id} onClick={() => { setPrinterWizardMode(mode.id); updatePrinterForm({ type: mode.id === "usb" ? "usb" : "network" }); }} className={`rounded-2xl border px-4 py-3 text-sm font-bold ${printerWizardMode === mode.id ? "border-cyan-400/30 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-[#0A0A0F] text-white/70"}`} data-testid={`restaurant-admin-printer-mode-${mode.id}`}>
                        <Icon size={14} className="mr-2 inline-block" />{mode.label}
                      </button>
                    );
                  })}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { step: "1", label: printerWizardMode === "auto" ? "Drucker suchen" : printerWizardMode === "manual" ? "IP eingeben" : "USB wählen" },
                    { step: "2", label: "Testbon drucken" },
                    { step: "3", label: "Verbinden & speichern" },
                  ].map((item, index) => <div key={item.step} className={`rounded-2xl border px-4 py-3 text-sm ${activePrinterRoleIndex >= 0 && index <= 2 ? "border-white/10 bg-[#0A0A0F] text-white/70" : "border-white/5 bg-[#0A0A0F] text-white/40"}`} data-testid={`restaurant-admin-printer-step-${item.step}`}><span className="mr-2 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">{item.step}</span>{item.label}</div>)}
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3" data-testid="restaurant-admin-printer-current-role-banner">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Aktuelle Rolle</p>
                  <p className="mt-1 text-sm font-semibold text-white">{PRINTER_ROLE_FLOW[activePrinterRoleIndex]?.label || "Kitchen"}</p>
                  <p className="mt-1 text-xs text-white/45">{PRINTER_ROLE_FLOW[activePrinterRoleIndex]?.hint || "Küchenbons / Produktionsdruck"}</p>
                </div>
                <select value={printerForm.role} onChange={(event) => loadPrinterRole(event.target.value)} className="rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-sm outline-none" data-testid="restaurant-admin-printer-role-select">
                  <option value="kitchen">Kitchen</option>
                  <option value="service">Service</option>
                  <option value="bill">Bill</option>
                </select>
                <input value={printerForm.name} onChange={(event) => updatePrinterForm({ name: event.target.value })} placeholder="Printer Name" className="rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-sm outline-none" data-testid="restaurant-admin-printer-name-input" />
                <select value={printerForm.type} onChange={(event) => updatePrinterForm({ type: event.target.value })} className="rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-sm outline-none" data-testid="restaurant-admin-printer-type-select">
                  <option value="network">Network ESC/POS</option>
                  <option value="usb">USB</option>
                  <option value="file">File Fallback</option>
                </select>
                {printerWizardMode === "auto" && (
                  <div className="rounded-[24px] border border-cyan-400/20 bg-cyan-400/10 p-4" data-testid="restaurant-admin-printer-discovery-panel">
                    <div className="grid gap-2 sm:grid-cols-[1.2fr_90px_90px_auto]">
                      <input value={discoverySubnet} onChange={(event) => setDiscoverySubnet(event.target.value)} placeholder="Subnetz z. B. 192.168.1" className="rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-sm outline-none" data-testid="restaurant-admin-printer-discovery-subnet-input" />
                      <input value={discoveryStartHost} onChange={(event) => setDiscoveryStartHost(event.target.value)} placeholder="Von" className="rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-sm outline-none" data-testid="restaurant-admin-printer-discovery-start-input" />
                      <input value={discoveryEndHost} onChange={(event) => setDiscoveryEndHost(event.target.value)} placeholder="Bis" className="rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-sm outline-none" data-testid="restaurant-admin-printer-discovery-end-input" />
                      <button onClick={discoverPrinters} disabled={discoveryLoading} className="rounded-2xl border border-cyan-400/20 bg-cyan-400/15 px-4 py-3 text-sm font-bold text-cyan-100 disabled:opacity-50" data-testid="restaurant-admin-printer-discovery-button">{discoveryLoading ? "Suche..." : "Suchen"}</button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {discoveryResults.map((printer) => (
                        <button key={`${printer.ip}:${printer.port}`} onClick={() => selectDiscoveredPrinter(printer)} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-left" data-testid={`restaurant-admin-discovered-printer-${printer.ip?.replace(/\./g, "-")}-${printer.port}`}>
                          <div>
                            <p className="text-sm font-semibold text-white">{printer.name}</p>
                            <p className="text-xs text-white/45">{printer.ip}:{printer.port}</p>
                          </div>
                          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/15 px-3 py-1 text-[11px] font-bold text-cyan-100">Übernehmen</span>
                        </button>
                      ))}
                      {!discoveryLoading && discoveryResults.length === 0 && <p className="text-sm text-white/55" data-testid="restaurant-admin-printer-discovery-empty">Noch keine Treffer. Alternativ IP manuell eingeben.</p>}
                    </div>
                  </div>
                )}
                {printerWizardMode !== "usb" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input value={printerForm.ip} onChange={(event) => updatePrinterForm({ ip: event.target.value })} placeholder="IP Adresse" className="rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-sm outline-none" data-testid="restaurant-admin-printer-ip-input" />
                    <input value={printerForm.port} onChange={(event) => updatePrinterForm({ port: event.target.value })} placeholder="Port" className="rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-sm outline-none" data-testid="restaurant-admin-printer-port-input" />
                  </div>
                )}
                {printerWizardMode === "usb" && (
                  <div className="rounded-[24px] border border-amber-400/20 bg-amber-400/10 p-4" data-testid="restaurant-admin-printer-usb-panel">
                    <p className="text-sm font-semibold text-amber-100">USB / lokaler Drucker</p>
                    <p className="mt-1 text-xs text-amber-50/70">Pfad oder Gerätebezeichnung eintragen und danach Testbon drucken. Native Auto-Suche folgt separat.</p>
                    <input value={printerForm.device} onChange={(event) => updatePrinterForm({ device: event.target.value })} placeholder="USB Device z. B. /dev/usb/lp0" className="mt-3 w-full rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3 text-sm outline-none" data-testid="restaurant-admin-printer-device-input" />
                  </div>
                )}
                <div className="grid gap-2 sm:grid-cols-3">
                  <button onClick={savePrinter} disabled={!printerVerified} className="rounded-full bg-gradient-to-r from-[#00C2FF] to-[#FFA24C] px-4 py-3 text-sm font-black text-[#05070B] disabled:opacity-50" data-testid="restaurant-admin-printer-save-button">Verbinden & speichern</button>
                  <button onClick={testPrinter} className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/75" data-testid="restaurant-admin-printer-test-button">Testbon</button>
                  <button onClick={() => runDiagnostics(printerForm.role)} disabled={diagnosticLoading} className="rounded-full border border-cyan-400/20 bg-cyan-400/15 px-4 py-3 text-sm font-bold text-cyan-100 disabled:opacity-50" data-testid="restaurant-admin-printer-diagnostics-button">Diagnose</button>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-[#0A0A0F] p-4" data-testid="restaurant-admin-printer-wizard-status">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Verbindungsstatus</p>
                      <p className="mt-1 text-xs text-white/45">Speichern erst nach erfolgreichem Test</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${printerVerified ? diagStatusStyle.ok : diagStatusStyle.missing}`}>{printerVerified ? "verified" : "pending"}</span>
                  </div>
                  <p className="mt-3 text-sm text-white/75">{lastPrinterTest?.message || (printerVerified ? "Testbon erfolgreich gesendet." : "Noch kein erfolgreicher Testbon in diesem Setup." )}</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-[#0A0A0F] p-4" data-testid="restaurant-admin-printer-diagnostics-result">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Aktuelle Diagnose</p>
                      <p className="mt-1 text-xs text-white/45">Rolle {printerForm.role}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${diagStatusStyle[diagnosticResult?.status] || diagStatusStyle.missing}`}>{diagnosticResult?.status || "idle"}</span>
                  </div>
                  <p className="mt-3 text-sm text-white/80">{diagnosticResult?.message || "Noch keine Diagnose ausgeführt."}</p>
                  {(diagnosticResult?.ip || diagnosticResult?.device || diagnosticResult?.port) && <p className="mt-2 font-mono text-xs text-white/45">{diagnosticResult?.ip || diagnosticResult?.device}{diagnosticResult?.port ? `:${diagnosticResult.port}` : ""}</p>}
                </div>
                <div className="rounded-[24px] border border-white/10 bg-[#0A0A0F] p-4" data-testid="restaurant-admin-printer-diagnostics-logs">
                  <p className="text-sm font-semibold text-white">Diagnose-Logs</p>
                  <div className="mt-3 space-y-2">
                    {diagnosticLogs.slice(0, 6).map((log) => (
                      <div key={log.id} className="rounded-2xl border border-white/10 bg-black/20 p-3" data-testid={`restaurant-admin-printer-log-${log.id}`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/40">{log.role}</p>
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${diagStatusStyle[log.result?.status] || diagStatusStyle.missing}`}>{log.result?.status || "missing"}</span>
                        </div>
                        <p className="mt-2 text-sm text-white/75">{log.result?.message || "Keine Meldung"}</p>
                        <p className="mt-1 text-[11px] text-white/35">{new Date(log.created_at).toLocaleString("de-DE")}</p>
                      </div>
                    ))}
                    {diagnosticLogs.length === 0 && <p className="text-sm text-white/45">Noch keine Diagnose-Logs vorhanden.</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-5" data-testid="restaurant-admin-floorplan-section">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Floorplan / Raumplan</h2>
              <p className="mt-1 text-sm text-white/45">Bereiche, Größen, Formen, Zoom und Snapping direkt im Raumplan.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs font-bold text-white/70" data-testid="restaurant-admin-floorplan-zoom-control">
                Zoom {zoom.toFixed(2)}×
                <input type="range" min="0.8" max="1.6" step="0.1" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="ml-3 align-middle" />
              </label>
              <button onClick={() => setSnapToGrid((prev) => !prev)} className={`rounded-full border px-4 py-2 text-xs font-bold ${snapToGrid ? "border-cyan-400/30 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/5 text-white/70"}`} data-testid="restaurant-admin-floorplan-snap-toggle">
                Snap {snapToGrid ? "an" : "aus"}
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => setSelectedArea("all")} className={`rounded-full border px-4 py-2 text-xs font-bold ${selectedArea === "all" ? "border-white/30 bg-white/10 text-white" : "border-white/10 bg-black/20 text-white/70"}`} data-testid="restaurant-admin-floorplan-area-all">Alle Räume</button>
            {areas.map((area, index) => {
              const color = TABLE_COLORS[index % TABLE_COLORS.length];
              return (
                <button key={area} onClick={() => setSelectedArea(area)} className={`rounded-full border px-4 py-2 text-xs font-bold ${selectedArea === area ? "text-white" : "text-white/70"}`} style={{ borderColor: color, backgroundColor: selectedArea === area ? hexToRgba(color, 0.22) : hexToRgba(color, 0.1) }} data-testid={`restaurant-admin-floorplan-area-${area.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`}>
                  {area}
                </button>
              );
            })}
          </div>
          <div className="mt-4 overflow-auto rounded-[28px] border border-dashed border-white/10 bg-[#07090F]" data-testid="restaurant-admin-floorplan-scroll-shell">
            <div ref={floorplanRef} className="relative" style={{ width: FLOORPLAN_BOUNDS.width * zoom, height: FLOORPLAN_BOUNDS.height * zoom, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0)", backgroundSize: `${24 * zoom}px ${24 * zoom}px` }} data-testid="restaurant-admin-floorplan-canvas">
              {visibleTables.map((table) => {
                const borderColor = table.color || TABLE_COLORS[0];
                const shapeClass = table.shape === "round" ? "rounded-full" : table.shape === "bar" ? "rounded-[18px]" : "rounded-[22px]";
                return (
                  <button
                    key={table.table_id}
                    onPointerDown={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      setDragging({ tableId: table.table_id, offsetX: (event.clientX - rect.left) / zoom, offsetY: (event.clientY - rect.top) / zoom });
                    }}
                    style={{ left: (table.x || 24) * zoom, top: (table.y || 24) * zoom, width: (table.width || 92) * zoom, height: (table.height || 72) * zoom, borderColor, backgroundColor: hexToRgba(borderColor, 0.18), color: borderColor }}
                    className={`absolute border px-3 py-3 text-left text-xs font-bold shadow-xl ${shapeClass}`}
                    data-testid={`restaurant-admin-floorplan-table-${table.table_id}`}
                  >
                    <div className="text-white">{table.table_name}</div>
                    <div className="mt-1 text-[11px] text-white/75">#{table.table_number} · {table.seats || SIZE_PRESETS[table.size_key]?.seats || 4}P</div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-white/45" /></div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3" data-testid="restaurant-admin-tables-grid">
            {tables.map((table, index) => (
              <motion.div key={table.table_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4" data-testid={`restaurant-admin-table-card-${table.table_id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black">{table.table_name}</p>
                    <p className="text-sm text-white/45">#{table.table_number} · {table.area}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusStyle[table.status] || statusStyle.free}`} data-testid={`restaurant-admin-table-status-${table.table_id}`}>{table.status}</span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-[120px_minmax(0,1fr)]">
                  <div ref={(node) => { printRefs.current[table.table_id] = node; }} className="rounded-2xl bg-white p-3">
                    <QRCodeSVG value={table.qr_code_absolute_url || `${window.location.origin}${table.qr_code_url}`} size={96} includeMargin />
                  </div>
                  <div className="space-y-2 text-sm text-white/70">
                    <p data-testid={`restaurant-admin-table-button-value-${table.table_id}`}>Button: {table.button_id || "—"}</p>
                    <p>NFC Entry: {table.qr_code_absolute_url}</p>
                    <p>Open Orders: {table.open_order_count}</p>
                    <p>Service Calls: {table.open_service_call_count}</p>
                    <p>Form: {table.shape} · {SIZE_PRESETS[table.size_key]?.label || "Custom"}</p>
                    <p className="font-mono text-xs text-white/45">{table.qr_code_absolute_url}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => regenerateQr(table.table_id)} className="rounded-2xl border border-cyan-400/20 bg-cyan-400/15 px-3 py-3 text-xs font-bold text-cyan-100" data-testid={`restaurant-admin-generate-qr-${table.table_id}`}>
                    <QrCode size={14} className="mr-2 inline-block" /> QR neu
                  </button>
                  <button onClick={() => printQr(table)} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs font-bold text-white/75" data-testid={`restaurant-admin-print-qr-${table.table_id}`}>
                    <Printer size={14} className="mr-2 inline-block" /> Drucken
                  </button>
                  <button onClick={() => writeNfcTag(table)} className="rounded-2xl border border-emerald-400/20 bg-emerald-400/15 px-3 py-3 text-xs font-bold text-emerald-100" data-testid={`restaurant-admin-write-nfc-${table.table_id}`}>
                    NFC schreiben
                  </button>
                  <button onClick={() => copyLink(table)} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs font-bold text-white/75" data-testid={`restaurant-admin-copy-link-${table.table_id}`}>
                    <Copy size={14} className="mr-2 inline-block" /> Link
                  </button>
                  <button onClick={() => editTable(table)} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs font-bold text-white/75" data-testid={`restaurant-admin-edit-table-${table.table_id}`}>
                    <Pencil size={14} className="mr-2 inline-block" /> Bearbeiten
                  </button>
                </div>
                <button onClick={() => deleteTable(table.table_id)} className="mt-2 w-full rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-3 text-xs font-bold text-rose-100" data-testid={`restaurant-admin-delete-table-${table.table_id}`}>
                  <Trash2 size={14} className="mr-2 inline-block" /> Löschen
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}