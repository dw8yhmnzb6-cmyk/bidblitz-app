import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Download, QrCode, Send, Smartphone, Wallet, CheckCircle2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useI18n, useUser, useWallet } from "../store";

const GENERIC_QR_ERROR = "Der QR-Code konnte noch nicht erstellt werden. Bitte erneut versuchen.";

function parseQrSource(rawValue) {
  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return { token: trimmed };
    }
  }

  if (rawValue && typeof rawValue === "object") {
    return rawValue;
  }

  return null;
}

export default function ReceiveMoneyPage({ onBack, onNavigate }) {
  const { lang } = useI18n();
  const user = useUser();
  const wallet = useWallet();
  const locale = lang === "sq-XK" ? "sq" : lang === "en-US" ? "en" : lang === "ar-AE" ? "ar" : lang;
  const L = {
    de: { headerBadge: "Empfangen", headerTitle: "Mein QR-Code", heroBadge: "Nur privat empfangen", heroTitle: "Lass den anderen einfach diesen QR-Code scannen", heroDesc: 'Perfekt für private Zahlungen zwischen Kunden. Nicht für Händler-Kasse — dafür bitte "Bezahlen" öffnen.', loading: "QR wird geladen…", privateReceive: "Privat empfangen", merchant: "Für Kasse?", openPay: 'Dann "Bezahlen" öffnen', openSend: "Senden öffnen", copy: "Kopieren", privateLabel: "Privat", privateDesc: "Anderer Kunde scannt diesen QR", how: "So funktioniert es", customerOnly: "Wie im Händlerflow — nur für Kunden", alt: "Alternativen", copyId: "BidBlitz ID kopieren", copyQrData: "QR-Daten kopieren", qrDataLabel: "QR-Daten", copySuccess: "kopiert", copyError: "Konnte nicht kopiert werden", step1Title: "1. Diesen QR zeigen", step1Desc: 'Der andere Kunde öffnet „Geld senden“ und scannt deinen Code.', step2Title: "2. Betrag bestätigen", step2Desc: "Der Sender wählt Betrag und bestätigt die private Wallet-Zahlung.", step3Title: "3. Sofort empfangen", step3Desc: "Das Geld landet direkt in deiner Wallet.", loadError: GENERIC_QR_ERROR, missingData: GENERIC_QR_ERROR },
    en: { headerBadge: "Receive", headerTitle: "My QR code", heroBadge: "Receive privately only", heroTitle: "Let the other person simply scan this QR code", heroDesc: 'Perfect for private payments between customers. Not for merchant checkout — please open "Pay" for that.', loading: "Loading QR…", privateReceive: "Receive privately", merchant: "For checkout?", openPay: 'Then open "Pay"', openSend: "Open send", copy: "Copy", privateLabel: "Private", privateDesc: "Another customer scans this QR", how: "How it works", customerOnly: "Like the merchant flow — only for customers", alt: "Alternatives", copyId: "Copy BidBlitz ID", copyQrData: "Copy QR data", qrDataLabel: "QR data", copySuccess: "copied", copyError: "Could not copy", step1Title: "1. Show this QR", step1Desc: 'The other customer opens “Send money” and scans your code.', step2Title: "2. Confirm amount", step2Desc: "The sender chooses the amount and confirms the private wallet payment.", step3Title: "3. Receive instantly", step3Desc: "The money lands directly in your wallet.", loadError: GENERIC_QR_ERROR, missingData: GENERIC_QR_ERROR },
    sq: { headerBadge: "Marrje", headerTitle: "Kodi im QR", heroBadge: "Merr vetëm privatisht", heroTitle: "Lëre tjetrin të skanojë thjesht këtë kod QR", heroDesc: 'Perfekt për pagesa private mes klientëve. Jo për arkën e tregtarit — për këtë hap "Paguaj".', loading: "QR po ngarkohet…", privateReceive: "Merr privatisht", merchant: "Për arkë?", openPay: 'Atëherë hap "Paguaj"', openSend: "Hap dërgimin", copy: "Kopjo", privateLabel: "Privat", privateDesc: "Klienti tjetër skanon këtë QR", how: "Si funksionon", customerOnly: "Si rrjedha e tregtarit — vetëm për klientë", alt: "Alternativa", copyId: "Kopjo BidBlitz ID", copyQrData: "Kopjo të dhënat QR", qrDataLabel: "Të dhënat QR", copySuccess: "u kopjua", copyError: "Nuk u kopjua dot", step1Title: "1. Trego këtë QR", step1Desc: 'Klienti tjetër hap “Dërgo para” dhe skanon kodin tënd.', step2Title: "2. Konfirmo shumën", step2Desc: "Dërguesi zgjedh shumën dhe konfirmon pagesën private të wallet-it.", step3Title: "3. Merre menjëherë", step3Desc: "Paratë mbërrijnë menjëherë në wallet-in tënd.", loadError: GENERIC_QR_ERROR, missingData: GENERIC_QR_ERROR },
    ar: { headerBadge: "استلام", headerTitle: "رمز QR الخاص بي", heroBadge: "استلام خاص فقط", heroTitle: "دع الطرف الآخر يمسح هذا الرمز بسهولة", heroDesc: 'مثالي للمدفوعات الخاصة بين العملاء. ليس لصندوق التاجر — افتح "الدفع" لذلك.', loading: "جارٍ تحميل QR…", privateReceive: "استلام خاص", merchant: "للصندوق؟", openPay: 'افتح "الدفع"', openSend: "افتح الإرسال", copy: "نسخ", privateLabel: "خاص", privateDesc: "عميل آخر يمسح هذا الرمز", how: "كيف يعمل", customerOnly: "مثل مسار التاجر — ولكن للعملاء فقط", alt: "بدائل", copyId: "نسخ BidBlitz ID", copyQrData: "نسخ بيانات QR", qrDataLabel: "بيانات QR", copySuccess: "تم النسخ", copyError: "تعذر النسخ", step1Title: "1. اعرض هذا الرمز", step1Desc: 'العميل الآخر يفتح "إرسال المال" ويمسح رمزك.', step2Title: "2. أكد المبلغ", step2Desc: "يختار المرسل المبلغ ويؤكد دفعة المحفظة الخاصة.", step3Title: "3. استلم فوراً", step3Desc: "يصل المال مباشرة إلى محفظتك.", loadError: GENERIC_QR_ERROR, missingData: GENERIC_QR_ERROR },
  }[locale];
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user.sessionReady) return;
    if (!user.isAuthenticated) {
      setLoading(false);
      setError(L.loadError);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/p2p/qr/generate`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(L.loadError);
        const data = await res.json();
        setProfile(data);
      } catch (loadError) {
        console.error("[ReceiveMoneyPage] QR load failed", loadError);
        setError(L.loadError);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [L.loadError, user.isAuthenticated, user.sessionReady]);

  const parsedQrSource = useMemo(() => parseQrSource(profile?.qr_data), [profile?.qr_data]);
  const resolvedUserId = user?.id || profile?.user_id || wallet?.id || null;
  const resolvedWalletId = wallet?.walletId || wallet?.id || profile?.wallet_id || null;
  const resolvedBidblitzId = profile?.bidblitz_id || user?.bidblitz_id || wallet?.userNumber || "";
  const qrToken = parsedQrSource?.token || profile?.qr_token || "";

  const qrPayload = useMemo(() => {
    if (!resolvedUserId || !resolvedWalletId || !qrToken) return "";

    const payload = {
      type: "p2p_receive",
      userId: resolvedUserId,
      walletId: resolvedWalletId,
      token: qrToken,
      bidblitzId: resolvedBidblitzId,
      name: profile?.name || user?.name || "BidBlitz User",
    };

    if (typeof parsedQrSource?.amount === "number" && parsedQrSource.amount > 0) {
      payload.amount = parsedQrSource.amount;
    }

    return JSON.stringify(payload);
  }, [parsedQrSource?.amount, profile?.name, qrToken, resolvedBidblitzId, resolvedUserId, resolvedWalletId, user?.name]);

  const qrValue = useMemo(() => (typeof qrPayload === "string" ? qrPayload.trim() : ""), [qrPayload]);
  const qrValueIsValid = typeof qrValue === "string"
    && qrValue !== ""
    && qrValue !== "undefined"
    && qrValue !== "null";
  const hasRequiredIds = Boolean(resolvedUserId && resolvedWalletId);
  const canRenderQr = hasRequiredIds && Boolean(qrToken) && qrValueIsValid;
  const isWaitingForRequirements = (loading || user.isLoading || wallet.isLoading) && !canRenderQr;
  const userFacingQrError = !isWaitingForRequirements && (!hasRequiredIds || !canRenderQr || error)
    ? GENERIC_QR_ERROR
    : "";

  useEffect(() => {
    console.log("QR PAYLOAD:", qrPayload);
    console.log("QR PAYLOAD TYPE:", typeof qrPayload);
  }, [qrPayload]);

  const copyText = async (value, label) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} ${L.copySuccess}`);
    } catch (copyError) {
      void copyError;
      toast.error(L.copyError);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-[calc(var(--app-mobile-content-offset,6rem)+1rem)]" data-testid="receive-money-page" data-cookie-banner-suppress="true">
      <div className="sticky top-0 z-30 bg-[#f8fafc]/95 backdrop-blur-xl border-b border-slate-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <motion.button data-testid="receive-money-back" onClick={onBack} whileTap={{ scale: 0.9 }} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center">
            <ArrowLeft size={18} className="text-slate-600" />
          </motion.button>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#00A6E6]">{L.headerBadge}</p>
            <h1 className="text-[20px] font-bold text-slate-950">{L.headerTitle}</h1>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6">
        <div className="rounded-[30px] border border-[#00C2FF]/18 bg-gradient-to-br from-white to-[#eef8ff] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] mb-5">
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#00A6E6] mb-2">{L.heroBadge}</p>
          <h2 className="text-[24px] font-bold text-slate-950 leading-tight">{L.heroTitle}</h2>
          <p className="mt-2 text-[12px] leading-relaxed text-slate-600">{L.heroDesc}</p>
        </div>

        {isWaitingForRequirements ? (
          <div className="rounded-[28px] bg-white border border-slate-200 p-6 text-center">
            <div className="w-10 h-10 mx-auto rounded-full border-2 border-[#00C2FF] border-t-transparent animate-spin" />
            <p className="mt-3 text-[13px] text-slate-500">{L.loading}</p>
          </div>
        ) : userFacingQrError ? (
          <div data-testid="receive-money-qr-error" className="rounded-[28px] bg-white border border-red-200 p-5 text-center text-red-500">{GENERIC_QR_ERROR}</div>
        ) : (
          <>
            <div className="rounded-[32px] bg-white border border-slate-200 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] text-center mb-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00C2FF]/10 text-[#00A6E6] text-[11px] font-semibold mb-4">
                <CheckCircle2 size={13} /> {L.privateReceive}
              </div>
              <div data-testid="receive-money-qr-container" className="w-[240px] h-[240px] mx-auto bg-white rounded-[28px] border border-slate-200 p-4 flex items-center justify-center">
                <QRCodeSVG value={qrValue} size={190} includeMargin />
              </div>
              <p className="mt-4 text-[16px] font-bold text-slate-950">{profile?.name || "BidBlitz User"}</p>
              <p className="mt-1 text-[12px] text-slate-500">{resolvedBidblitzId || "BidBlitz ID"}</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-5">
              <motion.button data-testid="receive-money-copy-qr" onClick={() => copyText(qrValue, L.qrDataLabel)} whileTap={{ scale: 0.98 }} className="min-h-[50px] rounded-2xl bg-[#00C2FF] text-slate-950 font-bold flex items-center justify-center gap-2 shadow-[0_12px_28px_rgba(0,194,255,0.22)]">
                <Copy size={16} /> {L.copy}
              </motion.button>
              <motion.button data-testid="receive-money-send-link" onClick={() => onNavigate?.('/send-money')} whileTap={{ scale: 0.98 }} className="min-h-[50px] rounded-2xl border border-slate-200 bg-white text-slate-900 font-semibold flex items-center justify-center gap-2">
                <Send size={16} /> {L.openSend}
              </motion.button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-5">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[12px] font-semibold text-[#10B981]">{L.privateLabel}</p>
                <p className="mt-1 text-[11px] text-slate-600">{L.privateDesc}</p>
              </div>
              <motion.button data-testid="receive-money-open-pay" onClick={() => onNavigate?.('/pay')} whileTap={{ scale: 0.98 }} className="rounded-2xl border border-[#00C2FF]/16 bg-[#00C2FF]/8 px-4 py-3 text-left">
                <span className="block text-[12px] font-semibold text-[#00A6E6]">{L.merchant}</span>
                <span className="mt-1 block text-[11px] text-slate-600">{L.openPay}</span>
              </motion.button>
            </div>

            <div className="rounded-[28px] bg-white border border-slate-200 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)] mb-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-2xl bg-[#00C2FF]/10 border border-[#00C2FF]/15 flex items-center justify-center"><Smartphone size={18} className="text-[#00A6E6]" /></div>
                <div>
                  <p className="text-[15px] font-bold text-slate-950">{L.how}</p>
                  <p className="text-[12px] text-slate-500">{L.customerOnly}</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { icon: QrCode, title: L.step1Title, desc: L.step1Desc },
                  { icon: Wallet, title: L.step2Title, desc: L.step2Desc },
                  { icon: CheckCircle2, title: L.step3Title, desc: L.step3Desc },
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
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/55 font-semibold mb-2">{L.alt}</p>
              <div className="grid grid-cols-1 gap-2.5">
                <motion.button data-testid="receive-money-copy-id" onClick={() => copyText(resolvedBidblitzId, "BidBlitz ID")} whileTap={{ scale: 0.98 }} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left">
                  <span className="block text-[13px] font-semibold">{L.copyId}</span>
                  <span className="block text-[11px] text-white/55 mt-1">{resolvedBidblitzId}</span>
                </motion.button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}