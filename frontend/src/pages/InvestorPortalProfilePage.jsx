import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { api } from "../services/api";
import { useInvestorPortalSession } from "../components/investor/useInvestorPortalSession";
import { InvestorPortalShell } from "../components/investor/InvestorPortalShell";

export default function InvestorPortalProfilePage({ onNavigate }) {
  const { account, loading, refreshSession } = useInvestorPortalSession(onNavigate);
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", company: "", locale: "de" });
  useEffect(() => {
    if (!account) return;
    setForm({ first_name: account.first_name || "", last_name: account.last_name || "", phone: account.phone || "", company: account.company || "", locale: account.locale || "de" });
  }, [account]);
  const handleLogout = async () => { await api.investorPortalLogout(); onNavigate("/investor-login"); };
  if (loading || !account) return <div className="min-h-screen bg-[#030507]" />;

  return (
    <InvestorPortalShell account={account} title="Investor Profil" subtitle="Kontaktdaten und Sprache deines separaten Investor-Portals verwalten." activePath="/investor-portal/profile" onNavigate={onNavigate} onLogout={handleLogout}>
      <div className="grid gap-4 md:grid-cols-2">
        {[["Vorname", "first_name"], ["Nachname", "last_name"], ["Telefon", "phone"], ["Firma / Organisation", "company"]].map(([label, key]) => (
          <div key={key} className="space-y-2 rounded-[24px] border border-white/8 bg-white/5 p-4">
            <Label className="text-white">{label}</Label>
            <Input value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} className="border-white/10 bg-white/5 text-white" data-testid={`investor-profile-${key}`} />
          </div>
        ))}
      </div>
      <Button className="mt-5 rounded-full bg-[#06B6D4] text-[#041018] hover:bg-[#33c7e0]" onClick={async () => { await api.updateInvestorPortalProfile(form); toast.success("Profil gespeichert."); refreshSession(); }} data-testid="investor-profile-save-button">Profil speichern</Button>
    </InvestorPortalShell>
  );
}