import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Download, QrCode, Send, Smartphone, Wallet, CheckCircle2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

export default function ReceiveMoneyPage({ onBack, onNavigate }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/p2p/qr/generate`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("QR konnte nicht geladen werden");
        const data = await res.json();
        setProfile(data);
      } catch (loadError) {
        setError(loadError?.message || "QR konnte nicht geladen werden");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const receiveCode = useMemo(() => profile?.qr_data || "", [profile]);

  const copyText = async (value, label) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} kopiert`);
    } catch (copyError) {
      void copyError;
      toast.error("Konnte nicht kopiert werden");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-[calc(var(--app-mobile-content-offset,6rem)+1rem)]" data-testid="receive-money-page">
      <div className="sticky top-0 z-30 bg-[#f8fafc]/95 backdrop-blur-xl border-b border-slate-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <motion.button data-testid="receive-money-back" onClick={onBack} whileTap={{ scale: 0.9 }} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center">
            <ArrowLeft size={18} className="text-slate-600" />
          </motion.button>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#00A6E6]">Empfangen</p>
            <h1 className="text-[20px] font-bold text-slate-950">Mein QR-Code</h1>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6">
        <div className="rounded-[30px] border border-[#00C2FF]/18 bg-gradient-to-br from-white to-[#eef8ff] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] mb-5">
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#00A6E6] mb-2">Einfach Geld empfangen</p>
          <h2 className="text-[24px] font-bold text-slate-950 leading-tight">Lass den anderen einfach diesen QR-Code scannen</h2>
          <p className="mt-2 text-[12px] leading-relaxed text-slate-600">Perfekt für private Zahlungen zwischen Kunden. Öffnen, zeigen, scannen, fertig.</p>
        </div>

        {loading ? (
          <div className="rounded-[28px] bg-white border border-slate-200 p-6 text-center">
            <div className="w-10 h-10 mx-auto rounded-full border-2 border-[#00C2FF] border-t-transparent animate-spin" />
            <p className="mt-3 text-[13px] text-slate-500">QR wird geladen…</p>
          </div>
        ) : error ? (
          <div className="rounded-[28px] bg-white border border-red-200 p-5 text-center text-red-500">{error}</div>
        ) : (
          <>
            <div className="rounded-[32px] bg-white border border-slate-200 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] text-center mb-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00C2FF]/10 text-[#00A6E6] text-[11px] font-semibold mb-4">
                <CheckCircle2 size={13} /> Privat empfangen
              </div>
              <div className="w-[240px] h-[240px] mx-auto bg-white rounded-[28px] border border-slate-200 p-4 flex items-center justify-center">
                <QRCodeSVG value={receiveCode} size={190} includeMargin />
              </div>
              <p className="mt-4 text-[16px] font-bold text-slate-950">{profile?.name || "BidBlitz User"}</p>
              <p className="mt-1 text-[12px] text-slate-500">{profile?.bidblitz_id || "BidBlitz ID"}</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-5">
              <motion.button data-testid="receive-money-copy-qr" onClick={() => copyText(receiveCode, "QR-Daten")} whileTap={{ scale: 0.98 }} className="min-h-[50px] rounded-2xl bg-[#00C2FF] text-slate-950 font-bold flex items-center justify-center gap-2 shadow-[0_12px_28px_rgba(0,194,255,0.22)]">
                <Copy size={16} /> Kopieren
              </motion.button>
              <motion.button data-testid="receive-money-send-link" onClick={() => onNavigate?.('/send-money')} whileTap={{ scale: 0.98 }} className="min-h-[50px] rounded-2xl border border-slate-200 bg-white text-slate-900 font-semibold flex items-center justify-center gap-2">
                <Send size={16} /> Senden öffnen
              </motion.button>
            </div>

            <div className="rounded-[28px] bg-white border border-slate-200 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)] mb-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-2xl bg-[#00C2FF]/10 border border-[#00C2FF]/15 flex items-center justify-center"><Smartphone size={18} className="text-[#00A6E6]" /></div>
                <div>
                  <p className="text-[15px] font-bold text-slate-950">So funktioniert es</p>
                  <p className="text-[12px] text-slate-500">Wie im Händlerflow — nur für Kunden</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { icon: QrCode, title: "1. Diesen QR zeigen", desc: "Der andere Kunde öffnet 'Geld senden' und scannt deinen Code." },
                  { icon: Wallet, title: "2. Betrag bestätigen", desc: "Der Sender wählt Betrag und bestätigt die private Wallet-Zahlung." },
                  { icon: CheckCircle2, title: "3. Sofort empfangen", desc: "Das Geld landet direkt in deiner Wallet." },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3 rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3">
                    <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shrink-0"><item.icon size={16} className="text-[#00A6E6]" /></div>
                    <div>
                      <p className="text-[14px] font-semibold text-slate-900">{item.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] bg-slate-950 text-white p-5">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/55 font-semibold mb-2">Alternativen</p>
              <div className="grid grid-cols-1 gap-2.5">
                <motion.button data-testid="receive-money-copy-id" onClick={() => copyText(profile?.bidblitz_id, "BidBlitz ID")} whileTap={{ scale: 0.98 }} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left">
                  <span className="block text-[13px] font-semibold">BidBlitz ID kopieren</span>
                  <span className="block text-[11px] text-white/55 mt-1">{profile?.bidblitz_id}</span>
                </motion.button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}