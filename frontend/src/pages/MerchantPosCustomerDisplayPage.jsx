import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Contrast, Mail, Moon, Printer, QrCode, ReceiptText, Sun, XCircle } from "lucide-react";

const THEMES = {
  dark: "bg-[#021118] text-white border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.16),transparent_28%),linear-gradient(145deg,rgba(4,8,14,0.99),rgba(6,13,20,0.98)_45%,rgba(4,7,11,1))]",
  light: "bg-[#F5FAFD] text-[#04131B] border-slate-200 bg-white",
  contrast: "bg-black text-white border-white bg-black",
};

export default function MerchantPosCustomerDisplayPage() {
  const [state, setState] = useState({
    merchant_name: "BidBlitz Merchant",
    logo: "",
    items: [],
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
    payment_instruction: "Bitte Zahlungsmittel auswählen",
    payment_method: "-",
    receipt_id: "-",
    status: "idle",
  });
  const [theme, setTheme] = useState("dark");

  const themeClass = useMemo(() => THEMES[theme] || THEMES.dark, [theme]);

  useEffect(() => {
    const apply = () => {
      try {
        const raw = localStorage.getItem("bidblitz-pos-customer-display");
        if (raw) setState(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    };
    apply();
    const id = window.setInterval(apply, 800);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={`min-h-screen px-4 py-5 ${theme === "light" ? "bg-[#EAF3F8]" : "bg-[#021118]"}`} data-testid="merchant-pos-customer-display-page">
      <div className={`mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-5xl flex-col justify-between rounded-[40px] border p-6 shadow-[0_20px_44px_rgba(0,0,0,0.24)] ${themeClass}`} data-testid="merchant-pos-customer-display-card">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {state.logo ? <img src={state.logo} alt="Logo" className="h-16 w-16 rounded-3xl object-cover" data-testid="merchant-pos-customer-logo" /> : <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-100 text-xl font-black" data-testid="merchant-pos-customer-logo-fallback">BB</div>}
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-100">Customer Display</div>
                <h1 className="mt-2 text-4xl font-black" data-testid="merchant-pos-customer-merchant-name">{state.merchant_name}</h1>
              </div>
            </div>
            <div>
              <div className="flex flex-wrap gap-2" data-testid="merchant-pos-customer-theme-toggle">
                <ThemeButton icon={Moon} label="Dark" active={theme === "dark"} onClick={() => setTheme("dark")} testId="merchant-pos-customer-theme-dark" />
                <ThemeButton icon={Sun} label="Light" active={theme === "light"} onClick={() => setTheme("light")} testId="merchant-pos-customer-theme-light" />
                <ThemeButton icon={Contrast} label="Kontrast" active={theme === "contrast"} onClick={() => setTheme("contrast")} testId="merchant-pos-customer-theme-contrast" />
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-3" data-testid="merchant-pos-customer-items-list">
            {state.items?.map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex items-center justify-between rounded-[24px] border border-white/10 bg-white/5 px-5 py-4" data-testid={`merchant-pos-customer-item-${index + 1}`}>
                <div>
                  <div className="text-2xl font-black">{item.name}</div>
                  <div className="mt-1 text-sm opacity-70">Menge: {item.quantity}</div>
                </div>
                <div className="text-2xl font-black">{Number(item.total || 0).toFixed(2)} €</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-5" data-testid="merchant-pos-customer-summary">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryValue label="Zwischensumme" value={state.subtotal} testId="merchant-pos-customer-subtotal" />
            <SummaryValue label="Rabatt" value={state.discount} testId="merchant-pos-customer-discount" />
            <SummaryValue label="Steuer" value={state.tax} testId="merchant-pos-customer-tax" />
            <SummaryValue label="Gesamt" value={state.total} prominent testId="merchant-pos-customer-total" />
          </div>
          <div className="mt-4 text-lg text-cyan-100" data-testid="merchant-pos-customer-instruction" role="status" aria-live="assertive">{state.payment_instruction || "Bitte Zahlungsmittel auswählen"}</div>
          <div className="mt-3 text-sm opacity-70" data-testid="merchant-pos-customer-payment-method">Zahlungsmethode: {state.payment_method || "-"}</div>
          <div className="mt-1 text-sm opacity-70" data-testid="merchant-pos-customer-receipt-number">Beleg: {state.receipt_id || "-"}</div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {state.status === "success" ? <div className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/12 px-4 py-2 text-emerald-100" data-testid="merchant-pos-customer-success"><CheckCircle2 size={18} /> Zahlung erfolgreich. Vielen Dank!</div> : null}
            {state.status === "failed" ? <div className="flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-400/12 px-4 py-2 text-rose-100" data-testid="merchant-pos-customer-failure"><XCircle size={18} /> Zahlung wurde abgelehnt.</div> : null}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <ReceiptOption icon={QrCode} label="QR-Code" testId="merchant-pos-customer-receipt-qr" />
            <ReceiptOption icon={Mail} label="E-Mail" testId="merchant-pos-customer-receipt-email" />
            <ReceiptOption icon={Printer} label="Drucken" testId="merchant-pos-customer-receipt-print" />
            <ReceiptOption icon={ReceiptText} label="Kein Beleg" testId="merchant-pos-customer-receipt-none" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptOption({ icon: Icon, label, testId }) {
  return <div className="flex min-h-12 items-center gap-3 rounded-[20px] border border-white/10 bg-[#071019] px-4 py-3 text-sm font-bold text-white" data-testid={testId}><Icon size={16} className="text-cyan-100" />{label}</div>;
}

function ThemeButton({ icon: Icon, label, active, onClick, testId }) {
  return <button onClick={onClick} className={`inline-flex min-h-12 items-center gap-2 rounded-full border px-4 py-3 text-sm font-bold transition ${active ? "border-cyan-400/30 bg-cyan-400/12 text-cyan-100" : "border-white/10 bg-white/5 text-white/72"}`} data-testid={testId}><Icon size={16} aria-hidden="true" />{label}</button>;
}

function SummaryValue({ label, value, prominent, testId }) {
  return <div className="rounded-[20px] border border-white/10 bg-[#071019] p-4" data-testid={testId}><div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#82E7FF]">{label}</div><div className={`mt-2 ${prominent ? "text-4xl" : "text-2xl"} font-black text-white`}>{Number(value || 0).toFixed(2)} €</div></div>;
}