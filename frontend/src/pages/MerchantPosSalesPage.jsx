import { useEffect, useState } from "react";
import { ArrowLeft, Mail, Receipt, RefreshCw } from "lucide-react";
import { Button } from "../components/ui/button";
import { api } from "../services/api";
import { toast } from "sonner";

export default function MerchantPosSalesPage({ onBack }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailReceiptId, setEmailReceiptId] = useState("");
  const [receiptEmail, setReceiptEmail] = useState("");
  const [sendingReceiptId, setSendingReceiptId] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const result = await api.getPosSales("", 60);
      setSales(result.sales || []);
    } catch (error) {
      toast.error(error.message || "Verkäufe konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  const sendReceipt = async (sale) => {
    const email = receiptEmail.trim();
    if (!email) {
      toast.error("Bitte E-Mail-Adresse des Kunden eingeben.");
      return;
    }
    setSendingReceiptId(sale.receipt_id);
    try {
      await api.emailPosReceipt(sale.receipt_id, email);
      toast.success("Beleg wurde per E-Mail gesendet.");
      setEmailReceiptId("");
      setReceiptEmail("");
    } catch (error) {
      toast.error(error.message || "Beleg-E-Mail konnte nicht gesendet werden.");
    } finally {
      setSendingReceiptId("");
    }
  };

  if (loading) return <div className="min-h-screen bg-[#030507]" data-testid="merchant-pos-sales-loading" />;

  return (
    <div className="min-h-screen bg-[#030507] px-4 py-5 sm:px-5 lg:px-8" data-testid="merchant-pos-sales-page">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid="merchant-pos-sales-back-button"><ArrowLeft size={18} /></button>
            <div>
              <h1 className="text-3xl font-black text-white">Verkäufe</h1>
              <p className="text-sm text-white/62">Belege, Beträge und Zahlungsmethoden im schnellen Überblick.</p>
            </div>
          </div>
          <Button onClick={load} variant="outline" className="border-white/10 bg-white/5 text-white" data-testid="merchant-pos-sales-refresh-button"><RefreshCw size={16} className="mr-2" />Neu laden</Button>
        </div>
        <div className="grid gap-3">
          {sales.map((sale, index) => (
            <div key={sale.sale_id} className="rounded-[24px] border border-white/10 bg-white/5 p-4" data-testid={`merchant-pos-sales-row-${index + 1}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-cyan-400/20 bg-cyan-400/10 text-cyan-100"><Receipt size={18} /></div>
                  <div>
                    <div className="text-lg font-black text-white">{sale.receipt_id}</div>
                    <div className="mt-1 text-sm text-white/58">{sale.created_at?.replace("T", " ").slice(0, 16)} · {sale.method}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-white">{Number(sale.total || 0).toFixed(2)} €</div>
                  <div className="mt-1 text-xs text-white/52">{sale.items?.length || 0} Artikel</div>
                </div>
              </div>
              <div className="mt-4 border-t border-white/10 pt-3">
                {emailReceiptId === sale.receipt_id ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      value={receiptEmail}
                      onChange={(event) => setReceiptEmail(event.target.value)}
                      placeholder="kunde@example.com"
                      autoComplete="email"
                      className="min-h-11 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-400/40"
                      data-testid={`merchant-pos-receipt-email-input-${index + 1}`}
                    />
                    <Button
                      onClick={() => sendReceipt(sale)}
                      disabled={sendingReceiptId === sale.receipt_id}
                      className="min-h-11 bg-cyan-400 text-black hover:bg-cyan-300"
                      data-testid={`merchant-pos-receipt-email-send-${index + 1}`}
                    >
                      <Mail size={16} className="mr-2" />
                      {sendingReceiptId === sale.receipt_id ? "Wird gesendet…" : "Beleg senden"}
                    </Button>
                    <Button
                      onClick={() => { setEmailReceiptId(""); setReceiptEmail(""); }}
                      variant="outline"
                      className="min-h-11 border-white/10 bg-white/5 text-white"
                    >
                      Abbrechen
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => { setEmailReceiptId(sale.receipt_id); setReceiptEmail(""); }}
                    variant="outline"
                    className="min-h-11 border-white/10 bg-white/5 text-white"
                    data-testid={`merchant-pos-receipt-email-open-${index + 1}`}
                  >
                    <Mail size={16} className="mr-2" />Beleg per E-Mail
                  </Button>
                )}
              </div>
            </div>
          ))}
          {!sales.length ? <div className="rounded-[24px] border border-dashed border-white/10 bg-[#071019] p-5 text-center text-white/62" data-testid="merchant-pos-sales-empty-state">Noch keine Verkäufe vorhanden.</div> : null}
        </div>
      </div>
    </div>
  );
}