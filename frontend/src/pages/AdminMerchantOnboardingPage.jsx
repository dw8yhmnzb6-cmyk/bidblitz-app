import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { api } from "../services/api";

export default function AdminMerchantOnboardingPage({ onBack }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const result = await api.getAdminMerchantOnboardingOverview();
      setRows(result.rows || []);
    } catch (error) {
      toast.error(error.message || "Merchant Onboarding konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  if (loading) return <div className="min-h-screen bg-[#030507]" data-testid="admin-merchant-onboarding-loading" />;

  return (
    <div className="min-h-screen bg-[#030507] px-4 py-5 sm:px-5 lg:px-8" data-testid="admin-merchant-onboarding-page">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white" data-testid="admin-merchant-onboarding-back-button"><ArrowLeft size={18} /></button>
            <div>
              <h1 className="text-3xl font-black text-white">Merchant Onboarding</h1>
              <p className="text-sm text-white/62">Admin-Sicht auf Setup-Fortschritt, Geräte, Zahlungsmethoden und Blocker.</p>
            </div>
          </div>
          <Button onClick={load} variant="outline" className="border-white/10 bg-white/5 text-white" data-testid="admin-merchant-onboarding-refresh-button"><RefreshCw size={16} className="mr-2" />Neu laden</Button>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map((row, index) => (
            <div key={row.merchant_id} className="rounded-[28px] border border-white/10 bg-white/5 p-5" data-testid={`admin-merchant-onboarding-row-${index + 1}`}>
              <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-[#06B6D4]/12 bg-[#06B6D4]/10 text-[#9BE8FF]"><Store size={18} /></div><div><div className="text-xl font-black text-white">{row.merchant}</div><div className="text-xs text-[#82E7FF]">{row.merchant_id}</div></div></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-white/68">
                <div>Fortschritt: <span className="text-white">{row.onboarding_percentage}%</span></div>
                <div>Aktueller Schritt: <span className="text-white">{row.current_step}</span></div>
                <div>Branche: <span className="text-white">{row.selected_business_type || "-"}</span></div>
                <div>Aktivierung: <span className="text-white">{row.activation_status}</span></div>
                <div>Mitarbeiter: <span className="text-white">{row.staff_count}</span></div>
                <div>Testverkauf: <span className="text-white">{row.test_sale_completed ? "Ja" : "Nein"}</span></div>
              </div>
              <div className="mt-4 text-xs text-white/54">Geräte: {(row.configured_devices || []).join(", ") || "-"}</div>
              <div className="mt-2 text-xs text-white/54">Zahlungen: {(row.enabled_payment_methods || []).join(", ") || "-"}</div>
              <div className="mt-2 text-xs text-rose-200">Blocker: {(row.blockers || []).join(", ") || "keine"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}