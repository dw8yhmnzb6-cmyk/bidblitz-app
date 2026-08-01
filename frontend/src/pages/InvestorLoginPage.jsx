import { useState } from "react";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { api } from "../services/api";
import { InvestorAuthShell } from "../components/investor/InvestorAuthShell";

export default function InvestorLoginPage({ onBack, onNavigate }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await api.investorPortalLogin(form);
      toast.success("Investor-Login erfolgreich.");
      onNavigate("/investor-portal");
    } catch (error) {
      toast.error(error.message || "Login fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <InvestorAuthShell
      title="Investor Login"
      subtitle="Melde dich in deinem geschützten Investor-Portal an, um Dokumente, Updates, Fragen und Meetings getrennt vom normalen BidBlitz-Konto zu verwalten."
      onBack={onBack}
      footer={
        <div className="mt-5 text-sm text-white/62">
          Noch kein Investor-Portal-Konto?{" "}
          <button className="font-bold text-[#82E7FF]" onClick={() => onNavigate("/investor-register")} data-testid="investor-login-switch-register">
            Jetzt registrieren
          </button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit} data-testid="investor-login-form">
        <div className="space-y-2">
          <Label htmlFor="investor-login-email" className="text-white">E-Mail</Label>
          <Input id="investor-login-email" data-testid="investor-login-email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="border-white/10 bg-white/5 text-white" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="investor-login-password" className="text-white">Passwort</Label>
          <Input id="investor-login-password" data-testid="investor-login-password" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} className="border-white/10 bg-white/5 text-white" />
        </div>
        <Button type="submit" disabled={loading} className="h-12 w-full rounded-full bg-[#06B6D4] text-[#041018] hover:bg-[#33c7e0]" data-testid="investor-login-submit-button">
          {loading ? "Bitte warten..." : "Investor Login"}
        </Button>
      </form>
    </InvestorAuthShell>
  );
}