import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, Printer, RefreshCw, Wifi } from "lucide-react";
import { Button } from "../components/ui/button";
import { api } from "../services/api";
import { toast } from "sonner";

export default function MerchantPosHardwarePage({ onBack }) {
  const [health, setHealth] = useState({ printers: [], scanner_count: 0, tse: null });
  const [setup, setSetup] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const setupState = setup || await api.getMerchantSetupState();
      setSetup(setupState);
      const storeId = setupState?.stores?.[0]?.store_id;
      if (!storeId) throw new Error("Keine Filiale für Hardware-Diagnose gefunden.");
      const result = await api.getPosHardwareHealth(storeId);
      setHealth(result || { printers: [], scanner_count: 0, tse: null });
    } catch (error) {
      toast.error(error.message || "Hardware-Status konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  if (loading) return <div className="min-h-screen bg-[#030507]" data-testid="merchant-pos-hardware-loading" />;

  return (
    <div className="min-h-screen bg-[#030507] px-4 py-5 sm:px-5 lg:px-8" data-testid="merchant-pos-hardware-page">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid="merchant-pos-hardware-back-button"><ArrowLeft size={18} /></button>
            <div>
              <h1 className="text-3xl font-black text-white">Hardware</h1>
              <p className="text-sm text-white/62">Detaillierte Diagnose getrennt vom eigentlichen Checkout.</p>
            </div>
          </div>
          <Button onClick={load} variant="outline" className="border-white/10 bg-white/5 text-white" data-testid="merchant-pos-hardware-refresh-button"><RefreshCw size={16} className="mr-2" />Neu laden</Button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <StatusCard icon={Wifi} label="Netzstatus" value={navigator.onLine ? "Online" : "Offline"} testId="merchant-pos-hardware-network-card" />
          <StatusCard icon={Printer} label="Drucker" value={health.printers?.length ? `${health.printers.length} verbunden` : "Drucker nicht verbunden"} testId="merchant-pos-hardware-printer-card" />
          <StatusCard icon={AlertCircle} label="Scanner" value={health.scanner_count ? `${health.scanner_count} aktiv` : "Kein Scanner gemeldet"} testId="merchant-pos-hardware-scanner-card" />
        </div>
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-5" data-testid="merchant-pos-hardware-printers-list">
          <h2 className="text-xl font-black text-white">Geräteübersicht</h2>
          <div className="mt-4 grid gap-3">
            {(health.printers || []).map((printer, index) => (
              <div key={printer.printer_id || index} className="rounded-[22px] border border-white/10 bg-[#071019] p-4" data-testid={`merchant-pos-hardware-printer-row-${index + 1}`}>
                <div className="text-base font-black text-white">{printer.name || printer.printer_id || "Bondrucker"}</div>
                <div className="mt-2 text-sm text-white/58">{printer.type || "unbekannt"} · {printer.ip || printer.device || "lokal"}</div>
              </div>
            ))}
            {!health.printers?.length ? <div className="rounded-[22px] border border-dashed border-white/10 bg-[#071019] p-4 text-sm text-white/62" data-testid="merchant-pos-hardware-empty-state">Noch kein bestätigter Drucker verbunden.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ icon: Icon, label, value, testId }) {
  return <div className="rounded-[24px] border border-white/10 bg-white/5 p-4" data-testid={testId}><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-cyan-400/20 bg-cyan-400/10 text-cyan-100"><Icon size={18} /></div><div><div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#82E7FF]">{label}</div><div className="mt-2 text-lg font-black text-white">{value}</div></div></div></div>;
}