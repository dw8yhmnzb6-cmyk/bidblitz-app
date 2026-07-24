/**
 * BidBlitz Customer Display — zweiter Bildschirm am Kassentresen
 * Zeigt aktuellen Cart + QR-Code für BidBlitz-Wallet-Zahlung
 */
import { useState, useEffect, useCallback } from "react";
import { Loader2, ShoppingCart, QrCode } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function CustomerDisplayPage({ registerId: propRegisterId }) {
  const registerId = propRegisterId || window.location.pathname.split("/").pop();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/pos/customer-display/${registerId}`);
      const d = await r.json();
      setData(d);
    } catch {}
    setLoading(false);
  }, [registerId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-[#00C2FF]" /></div>;

  const cart = data?.cart;
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060810] to-[#0A1626] text-white flex flex-col" data-testid="customer-display">
      <div className="px-8 py-6 border-b border-white/10">
        <h1 className="text-[28px] font-black bg-gradient-to-r from-[#00C2FF] to-[#0080FF] bg-clip-text text-transparent">BidBlitz</h1>
        <p className="text-[12px] text-white/40">{data?.register?.name || "Kasse"}</p>
      </div>

      <div className="flex-1 flex">
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="flex items-center gap-3 mb-6">
            <ShoppingCart size={24} className="text-[#00C2FF]" />
            <h2 className="text-[20px] font-bold">Ihre Bestellung</h2>
          </div>
          {!cart || !cart.items || cart.items.length === 0 ? (
            <p className="text-white/40 text-[16px]">Noch keine Artikel im Warenkorb…</p>
          ) : (
            <div className="space-y-3">
              {cart.items.map((it, i) => (
                <div key={i} className="flex justify-between items-center py-3 border-b border-white/10" data-testid={`cd-item-${i}`}>
                  <div>
                    <p className="text-[16px] font-bold">{it.quantity}× {it.name}</p>
                    <p className="text-[11px] text-white/40">€{it.unit_price?.toFixed(2)} pro Stück</p>
                  </div>
                  <p className="text-[18px] font-black text-[#00C2FF]">€{it.line_total?.toFixed(2)}</p>
                </div>
              ))}
              <div className="flex justify-between items-center pt-4 mt-4 border-t-2 border-[#00C2FF]/40">
                <p className="text-[20px] font-bold">Gesamt</p>
                <p className="text-[32px] font-black text-[#00C2FF]" data-testid="cd-total">€{cart.total?.toFixed(2) || "0.00"}</p>
              </div>
            </div>
          )}
        </div>

        <div className="w-96 p-8 bg-white/[0.03] border-l border-white/10 flex flex-col items-center justify-center">
          <QrCode size={120} className="text-white/30 mb-4" />
          <p className="text-[14px] text-center text-white/70 mb-2">Mit BidBlitz Wallet zahlen</p>
          <p className="text-[10px] text-center text-white/40">{data?.ad_message}</p>
        </div>
      </div>
    </div>
  );
}
